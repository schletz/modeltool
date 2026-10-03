import { describe, expect, it } from 'vitest';
import type { PhysicalModel } from '../model/physical';
import { col, columnNamed, fkCol, physical, pk, rel, table, tableNamed } from '../testing/physicalTestBuilders';
import { applyParentCardinalityToForeignKeys, syncPhysicalForeignKeys } from './physicalForeignKeys';

const sync = (m: PhysicalModel): PhysicalModel => syncPhysicalForeignKeys(m, 'PascalCase');
const names = (m: PhysicalModel, t: string): string[] => tableNamed(m, t).columns.map((c) => c.name);

describe('syncPhysicalForeignKeys', () => {
  const schoolStudent = physical(
    [table('School', [pk('Id', 'INTEGER'), col('Name', 'VARCHAR(100)')]), table('Student', [pk('Id'), col('Name', 'VARCHAR(100)')])],
    [rel('r1', 'School', 'Student')],
  );

  it('creates an FK column per parent key column with the referenced type', () => {
    const result = sync(schoolStudent);
    const fk = columnNamed(tableNamed(result, 'Student'), 'SchoolId');
    expect(names(result, 'Student')).toEqual(['Id', 'Name', 'SchoolId']);
    expect(fk).toMatchObject({
      dataType: 'INTEGER',
      isPrimaryKey: false,
      isNotNull: true,
      isUnique: false,
      isIdentity: false,
      fk: { relationshipId: 'r1', referencedId: 'School.Id', isRenamed: false, isTypeOverridden: false },
    });
  });

  it('creates NULLable FK columns for an optional parent end', () => {
    const m = { ...schoolStudent, relationships: [rel('r1', 'School', 'Student', 'zeroOrOne')] };
    expect(columnNamed(tableNamed(sync(m), 'Student'), 'SchoolId').isNotNull).toBe(false);
  });

  it('is idempotent', () => {
    const once = sync(schoolStudent);
    expect(sync(once)).toEqual(once);
  });

  it('keeps id, position, NOT NULL, UNIQUE and renamed names of existing FK columns', () => {
    const m = physical(
      [
        table('School', [pk('Id')]),
        table('Student', [
          fkCol('MySchool', 'r1', 'School.Id', 'INTEGER', { id: 'fk1', isNotNull: false, isUnique: true, fk: { relationshipId: 'r1', referencedId: 'School.Id', isRenamed: true, isTypeOverridden: false } }),
          pk('Id'),
        ]),
      ],
      [rel('r1', 'School', 'Student')],
    );
    const fk = tableNamed(sync(m), 'Student').columns[0];
    expect(fk).toMatchObject({ id: 'fk1', name: 'MySchool', isNotNull: false, isUnique: true });
  });

  it('follows composite keys: adds, removes and renames FK columns', () => {
    const m = physical(
      [table('Room', [pk('Building'), pk('Nr')]), table('Lesson', [pk('Id')])],
      [rel('r1', 'Room', 'Lesson')],
    );
    const first = sync(m);
    expect(names(first, 'Lesson')).toEqual(['Id', 'RoomBuilding', 'RoomNr']);

    const roomChanged = physical(
      [table('Room', [pk('Building'), col('Nr'), pk('Floor')]), tableNamed(first, 'Lesson')],
      first.relationships,
    );
    expect(names(sync(roomChanged), 'Lesson')).toEqual(['Id', 'RoomBuilding', 'RoomFloor']);

    const renamed = { ...first, tables: first.tables.map((t) => (t.name === 'Room' ? { ...t, name: 'Classroom' } : t)) };
    expect(names(sync(renamed), 'Lesson')).toEqual(['Id', 'ClassroomBuilding', 'ClassroomNr']);
  });

  it('numbers colliding names', () => {
    const m = physical(
      [table('Airport', [pk('Id')]), table('Flight', [pk('Id')])],
      [rel('r1', 'Airport', 'Flight'), rel('r2', 'Airport', 'Flight')],
    );
    expect(names(sync(m), 'Flight')).toEqual(['Id', 'AirportId', 'AirportId2']);
  });

  it('propagates the referenced type unless the FK type is overridden', () => {
    const synced = sync(schoolStudent);
    const bigint = { ...synced, tables: synced.tables.map((t) => (t.name === 'School' ? table('School', [pk('Id', 'BIGINT')]) : t)) };
    expect(columnNamed(tableNamed(sync(bigint), 'Student'), 'SchoolId').dataType).toBe('BIGINT');

    const overridden: PhysicalModel = {
      ...bigint,
      tables: bigint.tables.map((t) =>
        t.name !== 'Student'
          ? t
          : { ...t, columns: t.columns.map((c) => (c.fk ? { ...c, dataType: 'SMALLINT', fk: { ...c.fk, isTypeOverridden: true } } : c)) },
      ),
    };
    expect(columnNamed(tableNamed(sync(overridden), 'Student'), 'SchoolId').dataType).toBe('SMALLINT');
  });

  it('propagates keys transitively along identifying chains regardless of relationship order', () => {
    const m = physical(
      [table('Student', [pk('Nr')]), table('Class', [pk('Name', 'CHAR(5)')]), table('School', [pk('Id')])],
      [rel('r2', 'Class', 'Student', 'one', 'zeroOrMany', true), rel('r1', 'School', 'Class', 'one', 'zeroOrMany', true)],
    );
    const result = sync(m);
    expect(names(result, 'Class')).toEqual(['Name', 'SchoolId']);
    // The FK to an FK column reuses its name instead of "ClassSchoolId".
    expect(names(result, 'Student')).toEqual(['Nr', 'ClassName', 'SchoolId']);
    const student = tableNamed(result, 'Student');
    expect(student.columns.every((c) => c.isPrimaryKey && c.isNotNull)).toBe(true);
    expect(columnNamed(student, 'ClassName').dataType).toBe('CHAR(5)');
    expect(sync(result)).toEqual(result);
  });

  it('terminates on identifying cycles and stays stable', () => {
    const m = physical(
      [table('A', [pk('Id')]), table('B', [pk('Id')])],
      [rel('r1', 'A', 'B', 'one', 'zeroOrMany', true), rel('r2', 'B', 'A', 'one', 'zeroOrMany', true), rel('r3', 'A', 'A', 'one', 'zeroOrMany', true)],
    );
    const result = sync(m);
    expect(names(result, 'A')).toEqual(['Id', 'BId', 'AId']);
    expect(names(result, 'B')).toEqual(['Id', 'AId']);
    expect(sync(result)).toEqual(result);
  });

  it('removes FK columns of deleted, n:m or reversed relationships', () => {
    const synced = sync(schoolStudent);
    expect(names(sync({ ...synced, relationships: [] }), 'Student')).toEqual(['Id', 'Name']);
    expect(names(sync({ ...synced, relationships: [rel('r1', 'School', 'Student', 'zeroOrMany')] }), 'Student')).toEqual(['Id', 'Name']);

    // Swapping the direction of a symmetric 1:1 moves the FK to the other table.
    const oneToOne = sync({ ...schoolStudent, relationships: [rel('r1', 'School', 'Student', 'one', 'one')] });
    const swapped = sync({ ...oneToOne, relationships: [rel('r1', 'Student', 'School', 'one', 'one')] });
    expect(names(swapped, 'Student')).toEqual(['Id', 'Name']);
    expect(names(swapped, 'School')).toEqual(['Id', 'Name', 'StudentId']);
  });

  it('makes identifying FK columns part of the key and NOT NULL', () => {
    const m = { ...schoolStudent, relationships: [rel('r1', 'School', 'Student', 'one', 'zeroOrMany', true)] };
    expect(columnNamed(tableNamed(sync(m), 'Student'), 'SchoolId')).toMatchObject({ isPrimaryKey: true, isNotNull: true });
  });

  it('handles non identifying self references', () => {
    const m = physical([table('Employee', [pk('Id')])], [rel('r1', 'Employee', 'Employee', 'zeroOrOne')]);
    const result = sync(m);
    expect(names(result, 'Employee')).toEqual(['Id', 'EmployeeId']);
    expect(columnNamed(tableNamed(result, 'Employee'), 'EmployeeId').isNotNull).toBe(false);
  });

  it('uses snake_case names', () => {
    const m = physical([table('school_class', [pk('id')]), table('student', [pk('id')])], [rel('r1', 'school_class', 'student')]);
    expect(names(syncPhysicalForeignKeys(m, 'snake_case'), 'student')).toEqual(['id', 'school_class_id']);
  });
});

describe('applyParentCardinalityToForeignKeys', () => {
  const synced = syncPhysicalForeignKeys(
    physical([table('School', [pk('Id')]), table('Student', [pk('Id')])], [rel('r1', 'School', 'Student')]),
    'PascalCase',
  );

  it('sets NOT NULL from the parent end', () => {
    const optional = { ...synced, relationships: [rel('r1', 'School', 'Student', 'zeroOrOne')] };
    const nullable = applyParentCardinalityToForeignKeys(optional, 'r1');
    expect(columnNamed(tableNamed(nullable, 'Student'), 'SchoolId').isNotNull).toBe(false);

    const mandatory = applyParentCardinalityToForeignKeys({ ...nullable, relationships: synced.relationships }, 'r1');
    expect(columnNamed(tableNamed(mandatory, 'Student'), 'SchoolId').isNotNull).toBe(true);
  });

  it('keeps identifying FK columns NOT NULL and ignores unknown relationships', () => {
    const identifying = { ...synced, relationships: [rel('r1', 'School', 'Student', 'zeroOrOne', 'zeroOrMany', true)] };
    expect(columnNamed(tableNamed(applyParentCardinalityToForeignKeys(identifying, 'r1'), 'Student'), 'SchoolId').isNotNull).toBe(true);
    expect(applyParentCardinalityToForeignKeys(synced, 'unknown')).toBe(synced);
  });
});
