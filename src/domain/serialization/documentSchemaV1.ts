import {
  CARDINALITIES,
  type Anchor,
  type ForeignKeyOrigin,
  type NamingConvention,
  type Note,
  type Point,
  type Relationship,
  type Side,
} from '../model/common';
import { DOCUMENT_FORMAT, DOCUMENT_VERSION, type ModelDocument, type ModelMeta } from '../model/document';
import type { Entity, Generalization, GeneralizationStrategy, LogicalAttribute, LogicalModel } from '../model/logical';
import type { Column, PhysicalForeignKeyOrigin, PhysicalModel, Table, UniqueConstraint } from '../model/physical';
import {
  fail,
  field,
  optionalField,
  readArray,
  readBoolean,
  readEnum,
  readId,
  readNumber,
  readObject,
  readString,
  requireUniqueIds,
  type Reader,
} from './schemaReader';

// Records instead of arrays so the compiler reports a missing union member.
const SIDES = Object.keys({ top: 0, right: 0, bottom: 0, left: 0 } satisfies Record<Side, 0>) as Side[];
const CONVENTIONS = Object.keys({ PascalCase: 0, snake_case: 0 } satisfies Record<NamingConvention, 0>) as NamingConvention[];
const STRATEGIES = Object.keys({ rollUp: 0, rollDown: 0 } satisfies Record<GeneralizationStrategy, 0>) as GeneralizationStrategy[];

/**
 * Reads a document of the current version (format and version were checked before).
 * Only known properties are copied; absent optional properties stay absent.
 * Throws SchemaError with the path of the first invalid value.
 */
export function readDocumentV1(raw: Record<string, unknown>): ModelDocument {
  return {
    format: DOCUMENT_FORMAT,
    version: DOCUMENT_VERSION,
    meta: field(raw, '', 'meta', readMeta),
    settings: field(raw, '', 'settings', (v, p) => ({
      namingConvention: field(readObject(v, p), p, 'namingConvention', readEnum(CONVENTIONS)),
    })),
    logical: field(raw, '', 'logical', readLogicalModel),
    physical: field(raw, '', 'physical', readPhysicalModel),
  };
}

const readMeta: Reader<ModelMeta> = (value, path) => {
  const o = readObject(value, path);
  return {
    modelName: field(o, path, 'modelName', readString),
    studentName: field(o, path, 'studentName', readString),
    className: field(o, path, 'className', readString),
    studentId: field(o, path, 'studentId', readString),
    savedAt: field(o, path, 'savedAt', readString),
  };
};

const readPoint: Reader<Point> = (value, path) => {
  const o = readObject(value, path);
  return { x: field(o, path, 'x', readNumber), y: field(o, path, 'y', readNumber) };
};

const readAnchor: Reader<Anchor> = (value, path) => {
  const o = readObject(value, path);
  return { side: field(o, path, 'side', readEnum(SIDES)), offset: field(o, path, 'offset', readNumber) };
};

const readRelationship: Reader<Relationship> = (value, path) => {
  const o = readObject(value, path);
  const sourceAnchor = optionalField(o, path, 'sourceAnchor', readAnchor);
  const targetAnchor = optionalField(o, path, 'targetAnchor', readAnchor);
  return {
    id: field(o, path, 'id', readId),
    sourceId: field(o, path, 'sourceId', readId),
    targetId: field(o, path, 'targetId', readId),
    sourceCardinality: field(o, path, 'sourceCardinality', readEnum(CARDINALITIES)),
    targetCardinality: field(o, path, 'targetCardinality', readEnum(CARDINALITIES)),
    isIdentifying: field(o, path, 'isIdentifying', readBoolean),
    ...(sourceAnchor === undefined ? {} : { sourceAnchor }),
    ...(targetAnchor === undefined ? {} : { targetAnchor }),
  };
};

const readNote: Reader<Note> = (value, path) => {
  const o = readObject(value, path);
  return {
    id: field(o, path, 'id', readId),
    text: field(o, path, 'text', readString),
    position: field(o, path, 'position', readPoint),
    width: field(o, path, 'width', readNumber),
    height: field(o, path, 'height', readNumber),
  };
};

function readForeignKeyOrigin(o: Record<string, unknown>, path: string): ForeignKeyOrigin {
  return {
    relationshipId: field(o, path, 'relationshipId', readId),
    referencedId: field(o, path, 'referencedId', readId),
    isRenamed: field(o, path, 'isRenamed', readBoolean),
  };
}

const readAttribute: Reader<LogicalAttribute> = (value, path) => {
  const o = readObject(value, path);
  const fk = optionalField(o, path, 'fk', (v, p) => readForeignKeyOrigin(readObject(v, p), p));
  return {
    id: field(o, path, 'id', readId),
    name: field(o, path, 'name', readString),
    isPrimaryKey: field(o, path, 'isPrimaryKey', readBoolean),
    isOptional: field(o, path, 'isOptional', readBoolean),
    ...(fk === undefined ? {} : { fk }),
  };
};

const readEntity: Reader<Entity> = (value, path) => {
  const o = readObject(value, path);
  return {
    id: field(o, path, 'id', readId),
    name: field(o, path, 'name', readString),
    position: field(o, path, 'position', readPoint),
    attributes: field(o, path, 'attributes', readArray(readAttribute)),
  };
};

const readGeneralization: Reader<Generalization> = (value, path) => {
  const o = readObject(value, path);
  const strategy = optionalField(o, path, 'strategy', readEnum(STRATEGIES));
  return {
    id: field(o, path, 'id', readId),
    supertypeId: field(o, path, 'supertypeId', readId),
    subtypeIds: field(o, path, 'subtypeIds', readArray(readId)),
    isComplete: field(o, path, 'isComplete', readBoolean),
    position: field(o, path, 'position', readPoint),
    ...(strategy === undefined ? {} : { strategy }),
  };
};

const readLogicalModel: Reader<LogicalModel> = (value, path) => {
  const o = readObject(value, path);
  const model: LogicalModel = {
    entities: field(o, path, 'entities', readArray(readEntity)),
    relationships: field(o, path, 'relationships', readArray(readRelationship)),
    generalizations: field(o, path, 'generalizations', readArray(readGeneralization)),
    notes: field(o, path, 'notes', readArray(readNote)),
  };
  checkLogicalReferences(model, path);
  return model;
};

function checkLogicalReferences(model: LogicalModel, path: string): void {
  requireUniqueIds(model.entities, `${path}.entities`);
  model.entities.forEach((e, i) => requireUniqueIds(e.attributes, `${path}.entities[${i}].attributes`));
  requireUniqueIds(model.notes, `${path}.notes`);
  const entityIds = new Set(model.entities.map((e) => e.id));
  checkRelationships(model.relationships, entityIds, `${path}.relationships`);

  const gensPath = `${path}.generalizations`;
  requireUniqueIds(model.generalizations, gensPath);
  const supertypeIds = new Set(model.generalizations.map((g) => g.supertypeId));
  const subtypeIds = new Set<string>();
  model.generalizations.forEach((gen, i) => {
    if (!entityIds.has(gen.supertypeId)) fail(`${gensPath}[${i}].supertypeId`);
    gen.subtypeIds.forEach((subId, j) => {
      // One level only: a subtype is no supertype, not its own supertype and in one generalization only.
      const invalid = !entityIds.has(subId) || subId === gen.supertypeId || supertypeIds.has(subId) || subtypeIds.has(subId);
      if (invalid) fail(`${gensPath}[${i}].subtypeIds[${j}]`);
      subtypeIds.add(subId);
    });
  });
}

function checkRelationships(relationships: readonly Relationship[], nodeIds: ReadonlySet<string>, path: string): void {
  requireUniqueIds(relationships, path);
  relationships.forEach((rel, i) => {
    if (!nodeIds.has(rel.sourceId)) fail(`${path}[${i}].sourceId`);
    if (!nodeIds.has(rel.targetId)) fail(`${path}[${i}].targetId`);
  });
}

const readColumn: Reader<Column> = (value, path) => {
  const o = readObject(value, path);
  const fk = optionalField(o, path, 'fk', (v, p): PhysicalForeignKeyOrigin => {
    const fkObject = readObject(v, p);
    return { ...readForeignKeyOrigin(fkObject, p), isTypeOverridden: field(fkObject, p, 'isTypeOverridden', readBoolean) };
  });
  return {
    id: field(o, path, 'id', readId),
    name: field(o, path, 'name', readString),
    dataType: field(o, path, 'dataType', readString),
    isPrimaryKey: field(o, path, 'isPrimaryKey', readBoolean),
    isNotNull: field(o, path, 'isNotNull', readBoolean),
    isUnique: field(o, path, 'isUnique', readBoolean),
    isIdentity: field(o, path, 'isIdentity', readBoolean),
    ...(fk === undefined ? {} : { fk }),
  };
};

const readUniqueConstraint: Reader<UniqueConstraint> = (value, path) => {
  const o = readObject(value, path);
  return {
    id: field(o, path, 'id', readId),
    name: field(o, path, 'name', readString),
    columnIds: field(o, path, 'columnIds', readArray(readId)),
  };
};

const readTable: Reader<Table> = (value, path) => {
  const o = readObject(value, path);
  const table: Table = {
    id: field(o, path, 'id', readId),
    name: field(o, path, 'name', readString),
    position: field(o, path, 'position', readPoint),
    columns: field(o, path, 'columns', readArray(readColumn)),
    uniqueConstraints: field(o, path, 'uniqueConstraints', readArray(readUniqueConstraint)),
  };
  requireUniqueIds(table.columns, `${path}.columns`);
  requireUniqueIds(table.uniqueConstraints, `${path}.uniqueConstraints`);
  const columnIds = new Set(table.columns.map((c) => c.id));
  table.uniqueConstraints.forEach((uc, i) =>
    uc.columnIds.forEach((id, j) => {
      if (!columnIds.has(id)) fail(`${path}.uniqueConstraints[${i}].columnIds[${j}]`);
    }),
  );
  return table;
};

const readPhysicalModel: Reader<PhysicalModel> = (value, path) => {
  const o = readObject(value, path);
  const model: PhysicalModel = {
    tables: field(o, path, 'tables', readArray(readTable)),
    relationships: field(o, path, 'relationships', readArray(readRelationship)),
    notes: field(o, path, 'notes', readArray(readNote)),
  };
  requireUniqueIds(model.tables, `${path}.tables`);
  requireUniqueIds(model.notes, `${path}.notes`);
  checkRelationships(model.relationships, new Set(model.tables.map((t) => t.id)), `${path}.relationships`);
  return model;
};
