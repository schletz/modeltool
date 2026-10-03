import { describe, expect, it } from 'vitest';
import type { PhysicalModel } from '../model/physical';
import { col, fkCol, physical, pk, rel, table } from '../testing/physicalTestBuilders';
import type { PhysicalIssueCode } from './issues';
import { validatePhysical } from './physicalValidation';

const codes = (m: PhysicalModel): PhysicalIssueCode[] => validatePhysical(m).map((i) => i.code as PhysicalIssueCode);

describe('validatePhysical', () => {
  const valid = physical(
    [
      table('School', [pk('Id', 'INTEGER', { isIdentity: true }), col('Name', 'VARCHAR(100)')]),
      table('Student', [pk('Id'), fkCol('SchoolId', 'r1', 'School.Id', 'integer')]),
    ],
    [rel('r1', 'School', 'Student')],
  );

  it('accepts a valid model', () => {
    expect(validatePhysical(valid)).toEqual([]);
  });

  it('reports columns without data type', () => {
    const m = physical([table('School', [pk('Id'), col('Name', '  ')])]);
    expect(validatePhysical(m)).toEqual([
      { code: 'columnWithoutDataType', view: 'physical', elementId: 'School', params: { table: 'School', column: 'Name' } },
    ]);
  });

  it('reports tables without primary key', () => {
    const m = physical([table('Log', [col('Text', 'CLOB')])]);
    expect(validatePhysical(m)).toEqual([{ code: 'tableWithoutPrimaryKey', view: 'physical', elementId: 'Log', params: { table: 'Log' } }]);
  });

  it('reports n:m relationships', () => {
    const m = { ...valid, relationships: [rel('r1', 'School', 'Student', 'zeroOrMany', 'oneOrMany')] };
    expect(validatePhysical(m)).toEqual([
      { code: 'manyToManyRelationship', view: 'physical', elementId: 'r1', params: { source: 'School', target: 'Student' } },
    ]);
  });

  it('reports empty and duplicate table names (case insensitive)', () => {
    const m = physical([table('School', [pk('Id')]), { ...table('school', [pk('Id')]), id: 't2' }, { ...table('', [pk('Id')]), id: 't3' }]);
    expect(validatePhysical(m)).toEqual([
      { code: 'duplicateTableName', view: 'physical', elementId: 't2', params: { table: 'school' } },
      { code: 'emptyTableName', view: 'physical', elementId: 't3', params: { table: '' } },
    ]);
  });

  it('reports empty and duplicate column names (case insensitive)', () => {
    const m = physical([table('School', [pk('Id'), col('Name', 'CHAR(1)', { id: 'c1' }), col('NAME', 'CHAR(1)', { id: 'c2' }), col('', 'CHAR(1)', { id: 'c3' })])]);
    expect(codes(m)).toEqual(['duplicateColumnName', 'emptyColumnName']);
    expect(validatePhysical(m)[0]?.params).toEqual({ table: 'School', column: 'NAME' });
  });

  it('reports IDENTITY on non integer types', () => {
    const m = physical([table('School', [pk('Id', 'VARCHAR(10)', { isIdentity: true }), col('Nr', 'BIGINT', { isIdentity: true })])]);
    expect(validatePhysical(m)).toEqual([
      { code: 'identityOnNonInteger', view: 'physical', elementId: 'School', params: { table: 'School', column: 'Id', dataType: 'VARCHAR(10)' } },
    ]);
  });

  it('reports FK columns whose type differs from the referenced column', () => {
    const m = physical(
      [table('School', [pk('Id', 'INTEGER')]), table('Student', [pk('Id'), fkCol('SchoolId', 'r1', 'School.Id', 'BIGINT')])],
      [rel('r1', 'School', 'Student')],
    );
    expect(validatePhysical(m)).toEqual([
      {
        code: 'foreignKeyTypeMismatch',
        view: 'physical',
        elementId: 'Student',
        params: {
          table: 'Student',
          column: 'SchoolId',
          dataType: 'BIGINT',
          referencedTable: 'School',
          referencedColumn: 'Id',
          referencedDataType: 'INTEGER',
        },
      },
    ]);
  });

  it('reports a missing type only once', () => {
    const m = physical(
      [table('School', [pk('Id', 'INTEGER')]), table('Student', [pk('Id'), fkCol('SchoolId', 'r1', 'School.Id', '', { isIdentity: true })])],
      [rel('r1', 'School', 'Student')],
    );
    expect(codes(m)).toEqual(['columnWithoutDataType']);
  });
});
