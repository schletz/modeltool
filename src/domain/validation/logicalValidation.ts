import { resolveRoles } from '../cardinality';
import { effectivePrimaryKey } from '../foreignKeys/logicalForeignKeys';
import { analyzeKeyGraph, supertypeBySubtype } from '../foreignKeys/keyGraph';
import type { Id } from '../model/common';
import type { Entity, GeneralizationStrategy, LogicalModel } from '../model/logical';
import type { LogicalIssueCode, ValidationIssue } from './issues';

/**
 * Checks the blockers of the logical model (spec 7). `strategies` maps generalization ids
 * to the chosen strategy; roll down rules are only checked for generalizations listed there.
 *
 * Expects a model whose FK attributes are in sync (see `syncLogicalForeignKeys`).
 * Issue params: entity, attribute, name, parent, child, supertype, entities.
 */
export function validateLogical(
  model: LogicalModel,
  strategies: Readonly<Record<Id, GeneralizationStrategy>> = {},
): ValidationIssue[] {
  return [
    ...checkNames(model),
    ...checkPrimaryKeys(model),
    ...checkIdentifyingRelationships(model),
    ...checkRollDown(model, strategies),
  ];
}

function issue(code: LogicalIssueCode, elementId: Id, params: Record<string, string> = {}): ValidationIssue {
  return { code, view: 'logical', elementId, params };
}

/** Returns the items whose (trimmed, case-insensitive) name occurred before; empty names are skipped. */
function duplicates<T>(items: readonly T[], nameOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = nameOf(item).trim().toLowerCase();
    if (key === '') return false;
    if (seen.has(key)) return true;
    seen.add(key);
    return false;
  });
}

function checkNames(model: LogicalModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const e of model.entities) if (e.name.trim() === '') issues.push(issue('emptyEntityName', e.id));
  for (const e of duplicates(model.entities, (x) => x.name)) issues.push(issue('duplicateEntityName', e.id, { name: e.name }));
  for (const e of model.entities) {
    for (const a of e.attributes) if (a.name.trim() === '') issues.push(issue('emptyAttributeName', e.id, { entity: e.name }));
    for (const a of duplicates(e.attributes, (x) => x.name)) {
      issues.push(issue('duplicateAttributeName', e.id, { entity: e.name, attribute: a.name }));
    }
  }
  return issues;
}

function checkPrimaryKeys(model: LogicalModel): ValidationIssue[] {
  const subtypeIds = new Set(model.generalizations.flatMap((g) => g.subtypeIds));
  // Children of identifying relationships receive their key from the parent.
  const identifyingChildIds = new Set(
    model.relationships.flatMap((rel) => {
      const roles = resolveRoles(rel);
      return rel.isIdentifying && roles.kind !== 'manyToMany' ? [roles.childId] : [];
    }),
  );
  return model.entities
    .filter((e) => !subtypeIds.has(e.id) && !identifyingChildIds.has(e.id) && effectivePrimaryKey(model, e.id).length === 0)
    .map((e) => issue('entityWithoutPrimaryKey', e.id, { entity: e.name }));
}

function checkIdentifyingRelationships(model: LogicalModel): ValidationIssue[] {
  const nameOf = entityNames(model);
  const issues: ValidationIssue[] = [];
  for (const rel of model.relationships) {
    if (!rel.isIdentifying) continue;
    const roles = resolveRoles(rel);
    if (roles.kind === 'manyToMany') {
      issues.push(issue('identifyingParentNotOne', rel.id, { parent: nameOf(rel.sourceId), child: nameOf(rel.targetId) }));
    } else if (roles.parentCardinality !== 'one') {
      issues.push(issue('identifyingParentNotOne', rel.id, { parent: nameOf(roles.parentId), child: nameOf(roles.childId) }));
    }
  }
  for (const cycle of analyzeKeyGraph(model, supertypeBySubtype(model)).cycles) {
    issues.push(
      issue('identifyingCycle', cycle.relationshipIds[0] as Id, { entities: cycle.entityIds.map(nameOf).join(', ') }),
    );
  }
  return issues;
}

function checkRollDown(model: LogicalModel, strategies: Readonly<Record<Id, GeneralizationStrategy>>): ValidationIssue[] {
  const nameOf = entityNames(model);
  const issues: ValidationIssue[] = [];
  for (const gen of model.generalizations) {
    if (strategies[gen.id] !== 'rollDown') continue;
    const supertype = nameOf(gen.supertypeId);
    if (!gen.isComplete) issues.push(issue('rollDownIncomplete', gen.id, { supertype }));
    const identifyingChildren = model.relationships.flatMap((rel) => {
      const roles = resolveRoles(rel);
      return rel.isIdentifying && roles.kind !== 'manyToMany' && roles.parentId === gen.supertypeId ? [roles.childId] : [];
    });
    if (identifyingChildren.length > 0) {
      issues.push(issue('rollDownIdentifyingParent', gen.id, { supertype, child: identifyingChildren.map(nameOf).join(', ') }));
    }
  }
  return issues;
}

function entityNames(model: LogicalModel): (id: Id) => string {
  const byId = new Map<Id, Entity>(model.entities.map((e) => [e.id, e]));
  return (id) => byId.get(id)?.name ?? '';
}
