import { describe, expect, it } from 'vitest';
import { createEmptyDocument, type ModelDocument } from '../model/document';
import { parseDocument, serializeDocument, type ParseResult } from './documentSerializer';

/** A document that uses every field, including all optional ones. */
function fullDocument(): ModelDocument {
  return {
    format: 'er-modeltool',
    version: 1,
    meta: { modelName: 'School', studentName: 'Ada', className: '3AHIF', studentId: '42', savedAt: '2026-10-03T10:00:00.000Z' },
    settings: { namingConvention: 'snake_case' },
    logical: {
      entities: [
        { id: 'p', name: 'Person', position: { x: 10, y: 20 }, attributes: [{ id: 'p.id', name: 'id', isPrimaryKey: true, isOptional: false }] },
        { id: 's', name: 'Student', position: { x: 10, y: 200 }, attributes: [{ id: 's.n', name: 'nr', isPrimaryKey: false, isOptional: true }] },
        {
          id: 'e',
          name: 'Exam',
          position: { x: 300, y: 200.5 },
          attributes: [
            { id: 'e.id', name: 'id', isPrimaryKey: true, isOptional: false },
            { id: 'e.fk', name: 'student_id', isPrimaryKey: false, isOptional: false, fk: { relationshipId: 'r', referencedId: 'p.id', isRenamed: true } },
          ],
        },
      ],
      relationships: [
        {
          id: 'r',
          sourceId: 's',
          targetId: 'e',
          sourceCardinality: 'one',
          targetCardinality: 'zeroOrMany',
          isIdentifying: false,
          sourceAnchor: { side: 'right', offset: 0.25 },
          targetAnchor: { side: 'left', offset: 0.5 },
        },
        { id: 'q', sourceId: 'e', targetId: 'e', sourceCardinality: 'zeroOrOne', targetCardinality: 'oneOrMany', isIdentifying: true },
      ],
      generalizations: [{ id: 'g', supertypeId: 'p', subtypeIds: ['s'], isComplete: true, position: { x: 50, y: 120 }, strategy: 'rollDown' }],
      notes: [{ id: 'n1', text: 'Assumption', position: { x: -5, y: 0 }, width: 120, height: 60 }],
    },
    physical: {
      tables: [
        {
          id: 't1',
          name: 'person',
          position: { x: 0, y: 0 },
          columns: [{ id: 'c1', name: 'id', dataType: 'INTEGER', isPrimaryKey: true, isNotNull: true, isUnique: false, isIdentity: true }],
          uniqueConstraints: [],
        },
        {
          id: 't2',
          name: 'exam',
          position: { x: 300, y: 0 },
          columns: [
            { id: 'c2', name: 'id', dataType: '', isPrimaryKey: true, isNotNull: true, isUnique: false, isIdentity: false },
            {
              id: 'c3',
              name: 'person_id',
              dataType: 'INTEGER',
              isPrimaryKey: false,
              isNotNull: false,
              isUnique: true,
              isIdentity: false,
              fk: { relationshipId: 'pr', referencedId: 'c1', isRenamed: false, isTypeOverridden: false },
            },
          ],
          uniqueConstraints: [{ id: 'u1', name: 'UQ_exam_id_person_id', columnIds: ['c2', 'c3'] }],
        },
      ],
      relationships: [
        { id: 'pr', sourceId: 't1', targetId: 't2', sourceCardinality: 'one', targetCardinality: 'zeroOrMany', isIdentifying: false, sourceAnchor: { side: 'bottom', offset: 1 } },
      ],
      notes: [{ id: 'n2', text: '', position: { x: 1, y: 2 }, width: 10, height: 10 }],
    },
  };
}

/** Serializes a full document after applying `mutate` to its plain JSON object. */
function parseMutated(mutate: (json: Record<string, any>) => void): ParseResult {
  const json = JSON.parse(serializeDocument(fullDocument())) as Record<string, any>;
  mutate(json);
  return parseDocument(JSON.stringify(json));
}

function schemaError(detail: string): ParseResult {
  return { ok: false, error: 'invalidSchema', detail };
}

describe('serializeDocument / parseDocument', () => {
  it('pretty prints with two spaces', () => {
    expect(serializeDocument(createEmptyDocument())).toBe(JSON.stringify(createEmptyDocument(), null, 2));
  });

  it('round-trips a full document identically', () => {
    const doc = fullDocument();
    expect(parseDocument(serializeDocument(doc))).toStrictEqual({ ok: true, document: doc });
  });

  it('round-trips an empty document and keeps absent optional fields absent', () => {
    const doc = createEmptyDocument();
    expect(parseDocument(serializeDocument(doc))).toStrictEqual({ ok: true, document: doc });
    const result = parseMutated((j) => {
      delete j.logical.relationships[0].sourceAnchor;
      delete j.logical.generalizations[0].strategy;
      delete j.logical.entities[2].attributes[1].fk;
    });
    if (!result.ok) throw new Error('expected ok');
    expect('sourceAnchor' in result.document.logical.relationships[0]!).toBe(false);
    expect('strategy' in result.document.logical.generalizations[0]!).toBe(false);
    expect('fk' in result.document.logical.entities[2]!.attributes[1]!).toBe(false);
  });

  it('drops unknown properties', () => {
    const result = parseMutated((j) => {
      j.extra = 1;
      j.logical.entities[0].color = 'red';
      j.physical.tables[1].columns[1].fk.comment = 'x';
    });
    expect(result).toStrictEqual({ ok: true, document: fullDocument() });
  });

  it('reports invalid JSON', () => {
    expect(parseDocument('{ "format": ')).toEqual({ ok: false, error: 'invalidJson' });
    expect(parseDocument('')).toEqual({ ok: false, error: 'invalidJson' });
  });

  it('reports a wrong format', () => {
    for (const text of ['null', '42', '"er-modeltool"', '[]', '{}', '{"format":"other","version":1}']) {
      expect(parseDocument(text)).toEqual({ ok: false, error: 'wrongFormat' });
    }
  });

  it('reports unsupported versions', () => {
    for (const version of [2, 0, 1.5, '1', null]) {
      expect(parseMutated((j) => (j.version = version))).toEqual({ ok: false, error: 'unsupportedVersion' });
    }
    expect(parseMutated((j) => delete j.version)).toEqual({ ok: false, error: 'unsupportedVersion' });
  });

  it('reports wrong types and missing fields with their path', () => {
    expect(parseMutated((j) => delete j.meta)).toEqual(schemaError('meta'));
    expect(parseMutated((j) => (j.meta.studentId = 5))).toEqual(schemaError('meta.studentId'));
    expect(parseMutated((j) => delete j.logical.entities[2].name)).toEqual(schemaError('logical.entities[2].name'));
    expect(parseMutated((j) => (j.logical.entities[0].position.x = 'a'))).toEqual(schemaError('logical.entities[0].position.x'));
    expect(parseMutated((j) => (j.logical.entities[1].attributes[0].isOptional = 1))).toEqual(
      schemaError('logical.entities[1].attributes[0].isOptional'),
    );
    expect(parseMutated((j) => (j.logical.entities[2].attributes[1].fk = { relationshipId: 'r' }))).toEqual(
      schemaError('logical.entities[2].attributes[1].fk.referencedId'),
    );
    expect(parseMutated((j) => delete j.physical.tables[1].columns[1].fk.isTypeOverridden)).toEqual(
      schemaError('physical.tables[1].columns[1].fk.isTypeOverridden'),
    );
    expect(parseMutated((j) => (j.logical.notes = null))).toEqual(schemaError('logical.notes'));
    expect(parseMutated((j) => delete j.physical.tables[0].uniqueConstraints)).toEqual(schemaError('physical.tables[0].uniqueConstraints'));
    expect(parseMutated((j) => (j.logical.entities[0].id = ''))).toEqual(schemaError('logical.entities[0].id'));
    expect(parseMutated((j) => (j.physical.notes[0].width = Infinity))).toEqual(schemaError('physical.notes[0].width'));
  });

  it('reports invalid enum values', () => {
    expect(parseMutated((j) => (j.settings.namingConvention = 'camelCase'))).toEqual(schemaError('settings.namingConvention'));
    expect(parseMutated((j) => (j.logical.relationships[1].targetCardinality = 'many'))).toEqual(
      schemaError('logical.relationships[1].targetCardinality'),
    );
    expect(parseMutated((j) => (j.logical.relationships[0].sourceAnchor.side = 'center'))).toEqual(
      schemaError('logical.relationships[0].sourceAnchor.side'),
    );
    expect(parseMutated((j) => (j.logical.generalizations[0].strategy = 'rollSideways'))).toEqual(
      schemaError('logical.generalizations[0].strategy'),
    );
  });

  it('reports broken references', () => {
    expect(parseMutated((j) => (j.logical.relationships[0].targetId = 'nope'))).toEqual(schemaError('logical.relationships[0].targetId'));
    expect(parseMutated((j) => (j.physical.relationships[0].sourceId = 'e'))).toEqual(schemaError('physical.relationships[0].sourceId'));
    expect(parseMutated((j) => (j.logical.generalizations[0].supertypeId = 'x'))).toEqual(
      schemaError('logical.generalizations[0].supertypeId'),
    );
    expect(parseMutated((j) => j.logical.generalizations[0].subtypeIds.push('x'))).toEqual(
      schemaError('logical.generalizations[0].subtypeIds[1]'),
    );
    expect(parseMutated((j) => j.physical.tables[1].uniqueConstraints[0].columnIds.push('c1'))).toEqual(
      schemaError('physical.tables[1].uniqueConstraints[0].columnIds[2]'),
    );
  });

  it('reports duplicate ids', () => {
    expect(parseMutated((j) => (j.logical.entities[1].id = 'p'))).toEqual(schemaError('logical.entities[1].id'));
    expect(parseMutated((j) => (j.logical.entities[2].attributes[1].id = 'e.id'))).toEqual(
      schemaError('logical.entities[2].attributes[1].id'),
    );
    expect(parseMutated((j) => (j.physical.tables[1].columns[1].id = 'c2'))).toEqual(schemaError('physical.tables[1].columns[1].id'));
    expect(parseMutated((j) => (j.logical.relationships[1].id = 'r'))).toEqual(schemaError('logical.relationships[1].id'));
  });

  it('reports violations of the generalization rules', () => {
    // Subtype equals the supertype.
    expect(parseMutated((j) => (j.logical.generalizations[0].subtypeIds = ['p']))).toEqual(
      schemaError('logical.generalizations[0].subtypeIds[0]'),
    );
    // Subtype of two generalizations.
    expect(
      parseMutated((j) =>
        j.logical.generalizations.push({ id: 'g2', supertypeId: 'e', subtypeIds: ['s'], isComplete: false, position: { x: 0, y: 0 } }),
      ),
    ).toEqual(schemaError('logical.generalizations[1].subtypeIds[0]'));
    // A subtype that is a supertype itself (two levels).
    expect(
      parseMutated((j) =>
        j.logical.generalizations.push({ id: 'g2', supertypeId: 's', subtypeIds: ['e'], isComplete: false, position: { x: 0, y: 0 } }),
      ),
    ).toEqual(schemaError('logical.generalizations[0].subtypeIds[0]'));
  });
});
