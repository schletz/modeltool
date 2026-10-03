import { describe, expect, it } from 'vitest';
import type { Relationship } from '../model/common';
import type { ModelSettings } from '../model/document';
import type { GeneralizationStrategy, LogicalModel } from '../model/logical';
import type { PhysicalModel } from '../model/physical';
import { attr, entity, fkAttr, generalization, logical, pkAttr } from '../testing/logicalTestBuilders';
import { columnNamed, rel, tableNamed } from '../testing/physicalTestBuilders';
import { syncPhysicalForeignKeys } from '../foreignKeys/physicalForeignKeys';
import { transformToPhysical } from './transformToPhysical';

const pascal: ModelSettings = { namingConvention: 'PascalCase' };
const transform = (
  m: LogicalModel,
  strategies: Record<string, GeneralizationStrategy> = {},
  previous?: PhysicalModel,
): PhysicalModel => transformToPhysical(m, pascal, strategies, previous);

const names = (m: PhysicalModel, t: string): string[] => tableNamed(m, t).columns.map((c) => c.name);

/** All relationships drawn between two tables (by name), in either direction. */
function between(m: PhysicalModel, a: string, b: string): Relationship[] {
  const ids = [tableNamed(m, a).id, tableNamed(m, b).id];
  return m.relationships.filter((r) => ids.includes(r.sourceId) && ids.includes(r.targetId) && (a === b || r.sourceId !== r.targetId));
}

function single(m: PhysicalModel, a: string, b: string): Relationship {
  const found = between(m, a, b);
  expect(found).toHaveLength(1);
  return found[0] as Relationship;
}

describe('transformToPhysical: 1:n and 1:1', () => {
  const schoolModel = logical(
    [
      entity('School', [pkAttr('Id'), attr('Name')], { x: 10, y: 20 }),
      entity('Student', [pkAttr('Id'), attr('Name'), attr('Email', { isOptional: true }), fkAttr('SchoolId', 'r1', 'School.Id')], { x: 300, y: 40 }),
    ],
    [{ ...rel('r1', 'School', 'Student'), sourceAnchor: { side: 'right', offset: 0.5 } }],
  );

  it('maps entities to tables and attributes to untyped columns', () => {
    const result = transform({ ...schoolModel, notes: [{ id: 'n1', text: 'assumption', position: { x: 0, y: 0 }, width: 10, height: 10 }] });
    expect(result.tables.map((t) => t.name)).toEqual(['School', 'Student']);
    const student = tableNamed(result, 'Student');
    expect(student.position).toEqual({ x: 300, y: 40 });
    expect(names(result, 'Student')).toEqual(['Id', 'Name', 'Email', 'SchoolId']);
    expect(student.columns.map((c) => c.isNotNull)).toEqual([true, true, false, true]);
    expect(student.columns.every((c) => c.dataType === '' && !c.isUnique && !c.isIdentity)).toBe(true);
    expect(columnNamed(student, 'Id').isPrimaryKey).toBe(true);
    // Logical notes are not taken over.
    expect(result.notes).toEqual([]);
  });

  it('maps a 1:n relationship to an FK relationship with the same cardinalities and anchors', () => {
    const result = transform(schoolModel);
    const r = single(result, 'School', 'Student');
    expect(r).toMatchObject({
      sourceId: tableNamed(result, 'School').id,
      targetId: tableNamed(result, 'Student').id,
      sourceCardinality: 'one',
      targetCardinality: 'zeroOrMany',
      isIdentifying: false,
      sourceAnchor: { side: 'right', offset: 0.5 },
    });
    expect(r.id).not.toBe('r1');
    const fk = columnNamed(tableNamed(result, 'Student'), 'SchoolId');
    expect(fk.fk).toEqual({
      relationshipId: r.id,
      referencedId: columnNamed(tableNamed(result, 'School'), 'Id').id,
      isRenamed: false,
      isTypeOverridden: false,
    });
  });

  it('keeps renamed FK names (role names)', () => {
    const m = logical(
      [
        entity('Airport', [pkAttr('Code')]),
        entity('Flight', [
          pkAttr('Nr'),
          fkAttr('DepartureAirportCode', 'r1', 'Airport.Code', { isRenamed: true }),
          fkAttr('ArrivalAirportCode', 'r2', 'Airport.Code', { isRenamed: true }),
        ]),
      ],
      [rel('r1', 'Airport', 'Flight'), rel('r2', 'Airport', 'Flight')],
    );
    const result = transform(m);
    expect(names(result, 'Flight')).toEqual(['Nr', 'DepartureAirportCode', 'ArrivalAirportCode']);
    expect(tableNamed(result, 'Flight').columns.filter((c) => c.fk?.isRenamed)).toHaveLength(2);
    expect(between(result, 'Airport', 'Flight')).toHaveLength(2);
  });

  it('adds UNIQUE to the FK column of a 1:1 relationship', () => {
    const m = logical(
      [entity('Person', [pkAttr('Id')]), entity('Passport', [pkAttr('Nr'), fkAttr('PersonId', 'r1', 'Person.Id')])],
      [rel('r1', 'Person', 'Passport', 'one', 'zeroOrOne')],
    );
    const result = transform(m);
    expect(columnNamed(tableNamed(result, 'Passport'), 'PersonId').isUnique).toBe(true);
    expect(single(result, 'Person', 'Passport')).toMatchObject({ sourceCardinality: 'one', targetCardinality: 'zeroOrOne' });
  });

  it('adds a named UNIQUE constraint for composite 1:1 FKs', () => {
    const m = logical(
      [
        entity('Room', [pkAttr('Building'), pkAttr('Nr')]),
        entity('Beamer', [pkAttr('Id'), fkAttr('RoomBuilding', 'r1', 'Room.Building'), fkAttr('RoomNr', 'r1', 'Room.Nr')]),
      ],
      [rel('r1', 'Room', 'Beamer', 'one', 'zeroOrOne')],
    );
    const beamer = tableNamed(transform(m), 'Beamer');
    expect(beamer.columns.some((c) => c.isUnique)).toBe(false);
    expect(beamer.uniqueConstraints).toHaveLength(1);
    expect(beamer.uniqueConstraints[0]?.name).toBe('UQ_Beamer_RoomBuilding_RoomNr');
    expect(beamer.uniqueConstraints[0]?.columnIds).toEqual([columnNamed(beamer, 'RoomBuilding').id, columnNamed(beamer, 'RoomNr').id]);
  });

  it('does not add UNIQUE when the FK columns are the whole primary key', () => {
    const m = logical(
      [entity('Person', [pkAttr('Id')]), entity('Employee', [fkAttr('PersonId', 'r1', 'Person.Id', { isPrimaryKey: true }), attr('Salary')])],
      [rel('r1', 'Person', 'Employee', 'one', 'zeroOrOne', true)],
    );
    const employee = tableNamed(transform(m), 'Employee');
    expect(columnNamed(employee, 'PersonId')).toMatchObject({ isPrimaryKey: true, isUnique: false });
    expect(employee.uniqueConstraints).toEqual([]);
  });
});

describe('transformToPhysical: n:m', () => {
  it('creates a junction table between the two tables', () => {
    const m = logical(
      [entity('Student', [pkAttr('Id')], { x: 0, y: 0 }), entity('Course', [pkAttr('Id'), attr('Title')], { x: 400, y: 200 })],
      [rel('r1', 'Student', 'Course', 'oneOrMany', 'zeroOrMany')],
    );
    const result = transform(m);
    const junction = tableNamed(result, 'StudentCourse');
    expect(junction.position).toEqual({ x: 200, y: 100 });
    expect(names(result, 'StudentCourse')).toEqual(['StudentId', 'CourseId']);
    expect(junction.columns.every((c) => c.isPrimaryKey && c.isNotNull)).toBe(true);
    // Rows per student = courses per student (target end, min 0); rows per course: min 1.
    expect(single(result, 'Student', 'StudentCourse')).toMatchObject({
      sourceId: tableNamed(result, 'Student').id,
      sourceCardinality: 'one',
      targetCardinality: 'zeroOrMany',
      isIdentifying: true,
    });
    expect(single(result, 'Course', 'StudentCourse')).toMatchObject({ sourceCardinality: 'one', targetCardinality: 'oneOrMany', isIdentifying: true });
    expect(between(result, 'Student', 'Course')).toHaveLength(0);
  });

  it('uses the snake_case convention and avoids table name collisions', () => {
    const m = logical(
      [entity('student', [pkAttr('id')]), entity('course', [pkAttr('id')]), entity('student_course', [pkAttr('id')])],
      [rel('r1', 'student', 'course', 'zeroOrMany', 'zeroOrMany')],
    );
    const result = transformToPhysical(m, { namingConvention: 'snake_case' }, {});
    expect(names(result, 'student_course2')).toEqual(['student_id', 'course_id']);
  });

  it('numbers the FK columns of a recursive n:m relationship', () => {
    const m = logical([entity('Person', [pkAttr('Id')], { x: 100, y: 50 })], [rel('r1', 'Person', 'Person', 'zeroOrMany', 'zeroOrMany')]);
    const result = transform(m);
    const junction = tableNamed(result, 'PersonPerson');
    expect(names(result, 'PersonPerson')).toEqual(['PersonId', 'PersonId2']);
    expect(junction.position.y).toBe(50);
    expect(junction.position.x).toBeGreaterThan(100);
    expect(result.relationships).toHaveLength(2);
  });
});

describe('transformToPhysical: generalization', () => {
  // Person (supertype) with subtypes Student and Teacher:
  // r1 School -> Person (supertype is child), r4 Person -> Address (supertype is parent),
  // r3 Class -> Student (subtype is child), r2 Teacher -> Course (subtype is parent).
  const school = logical(
    [
      entity('School', [pkAttr('Id')]),
      entity('Class', [pkAttr('Id')]),
      entity('Person', [pkAttr('Id'), attr('Name'), fkAttr('SchoolId', 'r1', 'School.Id')], { x: 100, y: 100 }),
      entity('Student', [attr('MatrNr'), fkAttr('ClassId', 'r3', 'Class.Id')], { x: 0, y: 300 }),
      entity('Teacher', [attr('Salary')], { x: 300, y: 300 }),
      entity('Course', [pkAttr('Id'), fkAttr('LecturerId', 'r2', 'Person.Id', { isRenamed: true })]),
      entity('Address', [pkAttr('Id'), fkAttr('PersonId', 'r4', 'Person.Id')]),
    ],
    [rel('r1', 'School', 'Person'), rel('r2', 'Teacher', 'Course'), rel('r3', 'Class', 'Student'), rel('r4', 'Person', 'Address')],
    [generalization('g1', 'Person', ['Student', 'Teacher'])],
  );

  describe('roll up (default)', () => {
    const result = transform(school);

    it('creates only the supertype table with NULLable subtype columns', () => {
      expect(result.tables.map((t) => t.name)).toEqual(['School', 'Class', 'Person', 'Course', 'Address']);
      expect(names(result, 'Person')).toEqual(['Id', 'Name', 'SchoolId', 'MatrNr', 'ClassId', 'Salary']);
      const person = tableNamed(result, 'Person');
      expect(columnNamed(person, 'MatrNr').isNotNull).toBe(false);
      expect(columnNamed(person, 'Salary').isNotNull).toBe(false);
      expect(columnNamed(person, 'SchoolId').isNotNull).toBe(true);
      expect(transform(school, { g1: 'rollUp' })).toMatchObject({ tables: result.tables.map((t) => ({ name: t.name })) });
    });

    it('keeps relationships of the supertype', () => {
      expect(single(result, 'School', 'Person')).toMatchObject({ sourceCardinality: 'one', targetCardinality: 'zeroOrMany' });
      expect(single(result, 'Person', 'Address')).toMatchObject({ sourceCardinality: 'one' });
      expect(columnNamed(tableNamed(result, 'Address'), 'PersonId').fk?.referencedId).toBe(columnNamed(tableNamed(result, 'Person'), 'Id').id);
    });

    it('re-hangs subtype relationships to the supertype table', () => {
      // The FK landing in the supertype table becomes NULLable, the parent end optional.
      const classPerson = single(result, 'Class', 'Person');
      expect(classPerson).toMatchObject({ sourceId: tableNamed(result, 'Class').id, sourceCardinality: 'zeroOrOne', targetCardinality: 'zeroOrMany' });
      const classId = columnNamed(tableNamed(result, 'Person'), 'ClassId');
      expect(classId).toMatchObject({ isNotNull: false, isPrimaryKey: false, fk: { relationshipId: classPerson.id } });

      const course = tableNamed(result, 'Course');
      expect(names(result, 'Course')).toEqual(['Id', 'LecturerId']);
      expect(columnNamed(course, 'LecturerId')).toMatchObject({ isNotNull: true, fk: { relationshipId: single(result, 'Person', 'Course').id } });
    });
  });

  it('names not renamed FKs to a rolled up subtype after the supertype table', () => {
    const m = {
      ...school,
      entities: school.entities.map((e) =>
        e.name === 'Course' ? entity('Course', [pkAttr('Id'), fkAttr('TeacherId', 'r2', 'Person.Id')]) : e,
      ),
    };
    const result = transform(m);
    expect(names(result, 'Course')).toEqual(['Id', 'PersonId']);
    expect(syncPhysicalForeignKeys(result, 'PascalCase')).toEqual(result);
  });

  describe('roll down', () => {
    const result = transform(school, { g1: 'rollDown' });

    it('creates one table per subtype with the supertype key and attributes', () => {
      expect(result.tables.map((t) => t.name)).toEqual(['School', 'Class', 'Student', 'Teacher', 'Course', 'Address']);
      expect(names(result, 'Student')).toEqual(['Id', 'Name', 'SchoolId', 'MatrNr', 'ClassId']);
      expect(names(result, 'Teacher')).toEqual(['Id', 'Name', 'SchoolId', 'Salary']);
      expect(tableNamed(result, 'Student').position).toEqual({ x: 0, y: 300 });
      expect(columnNamed(tableNamed(result, 'Student'), 'Id')).toMatchObject({ isPrimaryKey: true, isNotNull: true });
      expect(columnNamed(tableNamed(result, 'Student'), 'MatrNr').isNotNull).toBe(true);
    });

    it('duplicates relationships where the supertype is child', () => {
      for (const subtype of ['Student', 'Teacher']) {
        const r = single(result, 'School', subtype);
        expect(r).toMatchObject({ sourceCardinality: 'one', targetCardinality: 'zeroOrMany' });
        expect(columnNamed(tableNamed(result, subtype), 'SchoolId')).toMatchObject({ isNotNull: true, fk: { relationshipId: r.id } });
      }
    });

    it('gives the referencing table one NULLable FK per subtype where the supertype is parent', () => {
      expect(names(result, 'Address')).toEqual(['Id', 'StudentId', 'TeacherId']);
      const address = tableNamed(result, 'Address');
      for (const subtype of ['Student', 'Teacher']) {
        const r = single(result, subtype, 'Address');
        expect(r).toMatchObject({ sourceId: tableNamed(result, subtype).id, sourceCardinality: 'zeroOrOne', targetCardinality: 'zeroOrMany' });
        expect(columnNamed(address, `${subtype}Id`)).toMatchObject({
          isNotNull: false,
          fk: { relationshipId: r.id, referencedId: columnNamed(tableNamed(result, subtype), 'Id').id },
        });
      }
    });

    it('produces an FK-synced model', () => {
      expect(syncPhysicalForeignKeys(result, 'PascalCase')).toEqual(result);
    });

    it('keeps relationships of subtypes at their own table', () => {
      expect(columnNamed(tableNamed(result, 'Student'), 'ClassId').fk?.relationshipId).toBe(single(result, 'Class', 'Student').id);
      expect(columnNamed(tableNamed(result, 'Course'), 'LecturerId').fk?.referencedId).toBe(columnNamed(tableNamed(result, 'Teacher'), 'Id').id);
    });
  });
});

describe('transformToPhysical: re-transformation', () => {
  const m = logical(
    [
      entity('School', [pkAttr('Id'), attr('Name')], { x: 0, y: 0 }),
      entity('Student', [pkAttr('Id'), attr('Name'), fkAttr('SchoolId', 'r1', 'School.Id')], { x: 300, y: 0 }),
      entity('Course', [pkAttr('Id')], { x: 600, y: 0 }),
    ],
    [rel('r1', 'School', 'Student'), rel('r2', 'Student', 'Course', 'zeroOrMany', 'zeroOrMany')],
  );

  /** Applies `patch` to the named column of the named table. */
  function edit(model: PhysicalModel, tableName: string, columnName: string, patch: object): PhysicalModel {
    return {
      ...model,
      tables: model.tables.map((t) =>
        t.name !== tableName ? t : { ...t, columns: t.columns.map((c) => (c.name === columnName ? { ...c, ...patch } : c)) },
      ),
    };
  }

  const first = transform(m);
  let edited = edit(first, 'School', 'Id', { dataType: 'INTEGER', isIdentity: true });
  edited = edit(edited, 'Student', 'Id', { dataType: 'INTEGER' });
  edited = edit(edited, 'Student', 'Name', { dataType: 'VARCHAR(100)', isUnique: true });
  edited = edit(edited, 'StudentCourse', 'CourseId', { dataType: 'BIGINT' });
  edited = {
    ...edited,
    tables: [
      ...edited.tables.map((t) => (t.name === 'School' ? { ...t, position: { x: 50, y: 60 } } : t)),
      { id: 'extra', name: 'Extra', position: { x: 0, y: 0 }, columns: [], uniqueConstraints: [] },
    ],
    notes: [{ id: 'n1', text: 'physical note', position: { x: 1, y: 2 }, width: 100, height: 50 }],
  };

  it('preserves positions, column properties and notes by name', () => {
    const result = transform(m, {}, edited);
    expect(tableNamed(result, 'School').position).toEqual({ x: 50, y: 60 });
    expect(columnNamed(tableNamed(result, 'School'), 'Id')).toMatchObject({ dataType: 'INTEGER', isIdentity: true });
    expect(columnNamed(tableNamed(result, 'Student'), 'Name')).toMatchObject({ dataType: 'VARCHAR(100)', isUnique: true });
    expect(result.notes).toEqual(edited.notes);
    expect(result.tables.map((t) => t.name)).not.toContain('Extra');
  });

  it('lets FK columns follow the preserved referenced type', () => {
    const result = transform(m, {}, edited);
    expect(columnNamed(tableNamed(result, 'Student'), 'SchoolId')).toMatchObject({ dataType: 'INTEGER', fk: { isTypeOverridden: false } });
    expect(columnNamed(tableNamed(result, 'StudentCourse'), 'StudentId').dataType).toBe('INTEGER');
  });

  it('marks a preserved FK type that differs from the referenced type as overridden', () => {
    const result = transform(m, {}, edited);
    expect(columnNamed(tableNamed(result, 'StudentCourse'), 'CourseId')).toMatchObject({ dataType: 'BIGINT', fk: { isTypeOverridden: true } });
  });

  it('applies new columns and keeps unchanged ones', () => {
    const changed = {
      ...m,
      entities: m.entities.map((e) => (e.name === 'Student' ? { ...e, attributes: [...e.attributes, attr('Email', { id: 'Student.Email' })] } : e)),
    };
    const result = transform(changed, {}, edited);
    expect(names(result, 'Student')).toEqual(['Id', 'Name', 'SchoolId', 'Email']);
    expect(columnNamed(tableNamed(result, 'Student'), 'Email').dataType).toBe('');
  });
});
