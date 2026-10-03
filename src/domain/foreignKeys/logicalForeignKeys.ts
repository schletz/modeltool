import { resolveRoles } from '../cardinality';
import { newId } from '../ids';
import type { Cardinality, ForeignKeyOrigin, Id, NamingConvention, Relationship } from '../model/common';
import type { Entity, LogicalAttribute, LogicalModel } from '../model/logical';
import { foreignKeyName, uniqueName } from '../naming';
import { analyzeKeyGraph, supertypeBySubtype } from './keyGraph';

/**
 * Primary key of an entity as seen by its children: own PK attributes plus FK attributes
 * from identifying relationships (they are flagged isPrimaryKey). A subtype has no own
 * key and returns the effective key of its supertype.
 */
export function effectivePrimaryKey(model: LogicalModel, entityId: Id): LogicalAttribute[] {
  const keyOwnerId = supertypeBySubtype(model).get(entityId) ?? entityId;
  const owner = model.entities.find((e) => e.id === keyOwnerId);
  return owner?.attributes.filter((a) => a.isPrimaryKey) ?? [];
}

/** A 1:n or 1:1 relationship seen from the child that receives the FK attributes. */
interface Role {
  rel: Relationship;
  /** Position in the model's relationship list, used for deterministic ordering. */
  index: number;
  parentId: Id;
  childId: Id;
  parentCardinality: Cardinality;
  /** The generated attributes become part of the child's primary key. */
  isKey: boolean;
}

/** One attribute of an entity's effective primary key while the sync runs. */
interface KeyMember {
  id: Id;
  /** Final name; for generated members assigned by the naming phase. */
  name: string;
  isGenerated: boolean;
  /** Position in the entity's attribute list, Infinity for new members (they are appended). */
  inputIndex: number;
}

/** A generated FK attribute under construction. */
interface Draft extends KeyMember {
  role: Role;
  /** Position of the referenced attribute within the parent's key. */
  keyIndex: number;
  referenced: KeyMember;
  /** The attribute generated for the same (relationship, referenced attribute) before. */
  existing?: LogicalAttribute;
}

interface EntityState {
  entity: Entity;
  isSubtype: boolean;
  /** Roles in which this entity is the child, in relationship order. */
  roles: Role[];
  /** First generated attribute per origin, keyed by `originKey`. */
  existingByOrigin: Map<string, { attr: LogicalAttribute; index: number }>;
  drafts: Draft[];
  key: KeyMember[];
}

/**
 * Recomputes all generated FK attributes of the model (spec 3.4) and returns a new model.
 * Must be called after every change; it is idempotent. Unchanged entities and attributes
 * keep their object identity.
 *
 * Auto generated names are made unique within the child in this order: user given names
 * (normal attributes and renamed FKs) first, then FKs of identifying relationships, then
 * the other FKs, each group in relationship order and key order.
 */
export function syncLogicalForeignKeys(model: LogicalModel, convention: NamingConvention): LogicalModel {
  const supertypeOf = supertypeBySubtype(model);
  const graph = analyzeKeyGraph(model, supertypeOf);
  const states = createStates(model, supertypeOf, graph.cyclicRelationshipIds);
  const stateOf = (id: Id): EntityState => states.get(id) as EntityState;
  const keyOf = (id: Id): KeyMember[] => stateOf(supertypeOf.get(id) ?? id).key;

  // Structure: the key members of all entities, providers before receivers, then the
  // non-key FKs, which only need the (now complete) keys of their parents.
  for (const id of graph.order) {
    const state = stateOf(id);
    if (state.isSubtype) continue;
    const own = state.entity.attributes.flatMap((a, i): KeyMember[] =>
      !a.fk && a.isPrimaryKey ? [{ id: a.id, name: a.name, isGenerated: false, inputIndex: i }] : [],
    );
    const generated = state.roles.filter((r) => r.isKey).flatMap((r) => addDrafts(state, r, keyOf(r.parentId)));
    state.key = [...own, ...generated].sort((a, b) => a.inputIndex - b.inputIndex);
  }
  for (const state of states.values()) {
    for (const role of state.roles) if (!role.isKey) addDrafts(state, role, keyOf(role.parentId));
  }

  // Naming: key FK names migrate along identifying chains, so they are assigned in
  // dependency order before the non-key FKs, which may reuse them.
  const taken = new Map<Id, string[]>();
  for (const state of states.values()) {
    const names = state.entity.attributes.filter((a) => !a.fk).map((a) => a.name);
    for (const draft of state.drafts) {
      if (draft.existing?.fk?.isRenamed) {
        draft.name = draft.existing.name;
        names.push(draft.name);
      }
    }
    taken.set(state.entity.id, names);
  }
  const nameDrafts = (state: EntityState, isKey: boolean): void => {
    const names = taken.get(state.entity.id) as string[];
    for (const draft of sortedDrafts(state.drafts.filter((d) => d.role.isKey === isKey && !d.existing?.fk?.isRenamed))) {
      draft.name = uniqueName(baseName(draft, stateOf(draft.role.parentId).entity, convention), names);
      names.push(draft.name);
    }
  };
  for (const id of graph.order) nameDrafts(stateOf(id), true);
  for (const state of states.values()) nameDrafts(state, false);

  return { ...model, entities: model.entities.map((e) => assemble(stateOf(e.id))) };
}

function createStates(model: LogicalModel, supertypeOf: ReadonlyMap<Id, Id>, cyclic: ReadonlySet<Id>): Map<Id, EntityState> {
  const states = new Map<Id, EntityState>();
  for (const entity of model.entities) {
    const existingByOrigin = new Map<string, { attr: LogicalAttribute; index: number }>();
    entity.attributes.forEach((attr, index) => {
      if (attr.fk && !existingByOrigin.has(originKey(attr.fk))) existingByOrigin.set(originKey(attr.fk), { attr, index });
    });
    states.set(entity.id, { entity, isSubtype: supertypeOf.has(entity.id), roles: [], existingByOrigin, drafts: [], key: [] });
  }
  model.relationships.forEach((rel, index) => {
    const roles = resolveRoles(rel);
    if (roles.kind === 'manyToMany') return;
    const child = states.get(roles.childId);
    if (!child || !states.has(roles.parentId)) return;
    child.roles.push({
      rel,
      index,
      parentId: roles.parentId,
      childId: roles.childId,
      parentCardinality: roles.parentCardinality,
      // Subtypes have no key of their own, and relationships on an identifying cycle must
      // not feed keys back into themselves (that would grow without end).
      isKey: rel.isIdentifying && !cyclic.has(rel.id) && !child.isSubtype,
    });
  });
  return states;
}

/** Creates one draft per attribute of the parent's key, reusing ids of existing attributes. */
function addDrafts(state: EntityState, role: Role, parentKey: readonly KeyMember[]): Draft[] {
  const drafts = parentKey.map((referenced, keyIndex): Draft => {
    const found = state.existingByOrigin.get(originKey({ relationshipId: role.rel.id, referencedId: referenced.id }));
    return {
      id: found?.attr.id ?? newId(),
      name: '',
      isGenerated: true,
      inputIndex: found?.index ?? Infinity,
      role,
      keyIndex,
      referenced,
      existing: found?.attr,
    };
  });
  state.drafts.push(...drafts);
  return drafts;
}

function baseName(draft: Draft, parent: Entity, convention: NamingConvention): string {
  // A migrated key keeps the name it already has in the parent.
  if (draft.referenced.isGenerated) return draft.referenced.name;
  return foreignKeyName(parent.name, draft.referenced.name, convention);
}

function sortedDrafts(drafts: Draft[]): Draft[] {
  return [...drafts].sort((a, b) => a.role.index - b.role.index || a.keyIndex - b.keyIndex);
}

/** Builds the entity's new attribute list: existing positions kept, new FKs appended. */
function assemble(state: EntityState): Entity {
  const draftByExisting = new Map<LogicalAttribute, Draft>();
  for (const d of state.drafts) if (d.existing) draftByExisting.set(d.existing, d);

  const attributes: LogicalAttribute[] = [];
  for (const attr of state.entity.attributes) {
    if (!attr.fk) {
      attributes.push(normalizeOwnAttribute(attr, state.isSubtype));
      continue;
    }
    const draft = draftByExisting.get(attr);
    if (draft) attributes.push(toAttribute(draft));
  }
  for (const draft of sortedDrafts(state.drafts.filter((d) => !d.existing))) attributes.push(toAttribute(draft));

  const unchanged =
    attributes.length === state.entity.attributes.length && attributes.every((a, i) => a === state.entity.attributes[i]);
  return unchanged ? state.entity : { ...state.entity, attributes };
}

function normalizeOwnAttribute(attr: LogicalAttribute, isSubtype: boolean): LogicalAttribute {
  const isPrimaryKey = attr.isPrimaryKey && !isSubtype;
  const isOptional = attr.isOptional && !isPrimaryKey;
  return isPrimaryKey === attr.isPrimaryKey && isOptional === attr.isOptional ? attr : { ...attr, isPrimaryKey, isOptional };
}

function toAttribute(draft: Draft): LogicalAttribute {
  const { rel, isKey, parentCardinality } = draft.role;
  const isOptional = !isKey && !rel.isIdentifying && parentCardinality === 'zeroOrOne';
  const isRenamed = draft.existing?.fk?.isRenamed ?? false;
  const old = draft.existing;
  if (
    old?.fk &&
    old.name === draft.name &&
    old.isPrimaryKey === isKey &&
    old.isOptional === isOptional &&
    old.fk.relationshipId === rel.id &&
    old.fk.referencedId === draft.referenced.id
  ) {
    return old;
  }
  return {
    id: draft.id,
    name: draft.name,
    isPrimaryKey: isKey,
    isOptional,
    fk: { relationshipId: rel.id, referencedId: draft.referenced.id, isRenamed },
  };
}

function originKey(fk: Pick<ForeignKeyOrigin, 'relationshipId' | 'referencedId'>): string {
  return JSON.stringify([fk.relationshipId, fk.referencedId]);
}
