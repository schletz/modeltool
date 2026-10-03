import { describe, expect, it } from 'vitest';
import { syncLogicalForeignKeys } from '../foreignKeys/logicalForeignKeys';
import { attr, entity, generalization, model, pk, rel } from '../foreignKeys/logicalTestModel';
import type { LogicalModel } from '../model/logical';
import type { LogicalIssueCode } from './issues';
import { validateLogical } from './logicalValidation';

const synced = (m: LogicalModel): LogicalModel => syncLogicalForeignKeys(m, 'PascalCase');

function codes(m: LogicalModel, strategies: Parameters<typeof validateLogical>[1] = {}): LogicalIssueCode[] {
  return validateLogical(m, strategies).map((i) => i.code as LogicalIssueCode);
}

/** Person (supertype) with subtypes Student and Teacher, plus an unrelated Course. */
function withGeneralization(isComplete: boolean, identifyingChild = false): LogicalModel {
  return synced(
    model(
      [
        entity('p', 'Person', [pk('p.id', 'Id')]),
        entity('s', 'Student', [attr('s.n', 'Nr')]),
        entity('t', 'Teacher', [attr('t.r', 'Room')]),
        entity('a', 'Address', [pk('a.nr', 'Nr')]),
      ],
      identifyingChild ? [rel('pa', 'p', 'a', { identifying: true })] : [],
      [generalization('g', 'p', ['s', 't'], isComplete)],
    ),
  );
}

describe('validateLogical', () => {
  it('accepts a valid model', () => {
    const m = synced(
      model(
        [entity('s', 'Student', [pk('s.id', 'Id'), attr('s.n', 'Name')]), entity('e', 'Exam', [pk('e.nr', 'Nr')])],
        [rel('r', 's', 'e', { identifying: true })],
      ),
    );
    expect(validateLogical(m)).toEqual([]);
  });

  describe('entityWithoutPrimaryKey', () => {
    it('reports an entity without key', () => {
      const issues = validateLogical(model([entity('a', 'A', [attr('a.n', 'Name')])]));
      expect(issues).toEqual([{ code: 'entityWithoutPrimaryKey', view: 'logical', elementId: 'a', params: { entity: 'A' } }]);
    });

    it('accepts subtypes and children of identifying relationships without own key', () => {
      expect(codes(withGeneralization(true))).toEqual([]);
      const m = synced(model([entity('a', 'A', [pk('a.id', 'Id')]), entity('b', 'B')], [rel('r', 'a', 'b', { identifying: true })]));
      expect(codes(m)).toEqual([]);
    });

    it('does not accept the child of a non-identifying relationship', () => {
      const m = synced(model([entity('a', 'A', [pk('a.id', 'Id')]), entity('b', 'B')], [rel('r', 'a', 'b')]));
      expect(codes(m)).toEqual(['entityWithoutPrimaryKey']);
    });
  });

  describe('entity names', () => {
    it('reports empty entity names', () => {
      const issues = validateLogical(model([entity('a', '  ', [pk('a.id', 'Id')])]));
      expect(issues.map((i) => [i.code, i.elementId])).toEqual([['emptyEntityName', 'a']]);
    });

    it('reports every further entity with a name that differs only in case', () => {
      const issues = validateLogical(
        model([
          entity('a', 'Student', [pk('a.id', 'Id')]),
          entity('b', 'student', [pk('b.id', 'Id')]),
          entity('c', 'STUDENT ', [pk('c.id', 'Id')]),
          entity('d', 'Course', [pk('d.id', 'Id')]),
        ]),
      );
      expect(issues.map((i) => [i.code, i.elementId, i.params.name])).toEqual([
        ['duplicateEntityName', 'b', 'student'],
        ['duplicateEntityName', 'c', 'STUDENT '],
      ]);
    });
  });

  describe('attribute names', () => {
    it('reports empty attribute names', () => {
      const issues = validateLogical(model([entity('a', 'A', [pk('a.id', 'Id'), attr('a.x', '')])]));
      expect(issues).toEqual([{ code: 'emptyAttributeName', view: 'logical', elementId: 'a', params: { entity: 'A' } }]);
    });

    it('reports duplicate attribute names including FK attributes', () => {
      const m = synced(
        model(
          [entity('s', 'Student', [pk('s.id', 'Id')]), entity('e', 'Exam', [pk('e.id', 'Id'), attr('e.x', 'Name')])],
          [rel('r', 's', 'e')],
        ),
      );
      const renamed: LogicalModel = {
        ...m,
        entities: m.entities.map((e) => ({
          ...e,
          attributes: e.attributes.map((a) => (a.fk ? { ...a, name: 'NAME', fk: { ...a.fk, isRenamed: true } } : a)),
        })),
      };
      expect(validateLogical(renamed)).toEqual([
        { code: 'duplicateAttributeName', view: 'logical', elementId: 'e', params: { entity: 'Exam', attribute: 'NAME' } },
      ]);
    });

    it('accepts equal attribute names in different entities', () => {
      expect(codes(model([entity('a', 'A', [pk('a.id', 'Id')]), entity('b', 'B', [pk('b.id', 'Id')])]))).toEqual([]);
    });
  });

  describe('identifyingParentNotOne', () => {
    const entities = [entity('a', 'A', [pk('a.id', 'Id')]), entity('b', 'B', [pk('b.id', 'Id')])];

    it('reports an identifying relationship whose parent end is not 1', () => {
      const issues = validateLogical(synced(model(entities, [rel('r', 'a', 'b', { source: 'zeroOrOne', identifying: true })])));
      expect(issues).toEqual([
        { code: 'identifyingParentNotOne', view: 'logical', elementId: 'r', params: { parent: 'A', child: 'B' } },
      ]);
    });

    it('reports an identifying n:m relationship', () => {
      const m = synced(model(entities, [rel('r', 'a', 'b', { source: 'zeroOrMany', identifying: true })]));
      expect(codes(m)).toEqual(['identifyingParentNotOne']);
    });

    it('accepts parent end 1 and non-identifying relationships with other parent ends', () => {
      const m = synced(
        model(entities, [rel('r', 'a', 'b', { identifying: true }), rel('q', 'a', 'b', { source: 'zeroOrOne' })]),
      );
      expect(codes(m)).toEqual([]);
    });
  });

  describe('identifyingCycle', () => {
    it('reports one issue per cycle', () => {
      const m = synced(
        model(
          [entity('a', 'A', [pk('a.id', 'Id')]), entity('b', 'B', [pk('b.id', 'Id')]), entity('c', 'C', [pk('c.id', 'Id')])],
          [
            rel('ab', 'a', 'b', { identifying: true }),
            rel('ba', 'b', 'a', { identifying: true }),
            rel('cc', 'c', 'c', { identifying: true }),
          ],
        ),
      );
      expect(validateLogical(m)).toEqual([
        { code: 'identifyingCycle', view: 'logical', elementId: 'ab', params: { entities: 'A, B' } },
        { code: 'identifyingCycle', view: 'logical', elementId: 'cc', params: { entities: 'C' } },
      ]);
    });

    it('reports a cycle closed by a subtype inheriting its supertype key', () => {
      const m = synced(
        model(
          [entity('p', 'Person', [pk('p.id', 'Id')]), entity('s', 'Student')],
          [rel('sp', 's', 'p', { identifying: true })],
          [generalization('g', 'p', ['s'])],
        ),
      );
      expect(codes(m)).toEqual(['identifyingCycle']);
    });

    it('accepts non-identifying cycles and identifying chains', () => {
      const m = synced(
        model(
          [entity('a', 'A', [pk('a.id', 'Id')]), entity('b', 'B', [pk('b.id', 'Id')]), entity('c', 'C', [pk('c.id', 'Id')])],
          [rel('ab', 'a', 'b', { identifying: true }), rel('bc', 'b', 'c', { identifying: true }), rel('ca', 'c', 'a'), rel('aa', 'a', 'a')],
        ),
      );
      expect(codes(m)).toEqual([]);
    });
  });

  describe('roll down', () => {
    it('reports roll down of an incomplete generalization', () => {
      expect(validateLogical(withGeneralization(false), { g: 'rollDown' })).toEqual([
        { code: 'rollDownIncomplete', view: 'logical', elementId: 'g', params: { supertype: 'Person' } },
      ]);
    });

    it('reports roll down when the supertype is parent of an identifying relationship', () => {
      expect(validateLogical(withGeneralization(true, true), { g: 'rollDown' })).toEqual([
        { code: 'rollDownIdentifyingParent', view: 'logical', elementId: 'g', params: { supertype: 'Person', child: 'Address' } },
      ]);
    });

    it('checks roll down rules only for generalizations rolled down', () => {
      expect(codes(withGeneralization(false, true))).toEqual([]);
      expect(codes(withGeneralization(false, true), { g: 'rollUp' })).toEqual([]);
      expect(codes(withGeneralization(true), { g: 'rollDown' })).toEqual([]);
    });
  });
});
