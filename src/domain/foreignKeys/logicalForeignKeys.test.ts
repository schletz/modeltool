import { describe, expect, it } from 'vitest';
import type { LogicalModel } from '../model/logical';
import { effectivePrimaryKey, syncLogicalForeignKeys } from './logicalForeignKeys';
import {
  attr,
  attributeNamed,
  attributeNames,
  entity,
  entityOf,
  generalization,
  model,
  pk,
  rel,
  updateEntity,
} from './logicalTestModel';

const sync = (m: LogicalModel): LogicalModel => syncLogicalForeignKeys(m, 'PascalCase');

/** A(Id) =identifying=> B(Nr) =identifying=> C(Pos) --non-identifying--> D(Id). */
function chain(): LogicalModel {
  return sync(
    model(
      [
        entity('a', 'A', [pk('a.id', 'Id')]),
        entity('b', 'B', [pk('b.nr', 'Nr')]),
        entity('c', 'C', [pk('c.pos', 'Pos')]),
        entity('d', 'D', [pk('d.id', 'Id')]),
      ],
      [
        rel('ab', 'a', 'b', { identifying: true }),
        rel('bc', 'b', 'c', { identifying: true }),
        rel('cd', 'c', 'd'),
      ],
    ),
  );
}

describe('syncLogicalForeignKeys', () => {
  it('adds a mandatory FK attribute to the child of a 1:n relationship', () => {
    const m = sync(
      model([entity('s', 'Student', [pk('s.id', 'Id')]), entity('e', 'Exam', [pk('e.id', 'Id')])], [rel('r', 's', 'e')]),
    );
    expect(attributeNames(m, 'e')).toEqual(['Id', 'StudentId']);
    expect(attributeNamed(m, 'e', 'StudentId')).toMatchObject({
      isPrimaryKey: false,
      isOptional: false,
      fk: { relationshipId: 'r', referencedId: 's.id', isRenamed: false },
    });
    expect(attributeNames(m, 's')).toEqual(['Id']);
  });

  it('creates one FK attribute per attribute of a combined primary key', () => {
    const m = sync(
      model(
        [entity('room', 'Room', [pk('r.b', 'Building'), pk('r.n', 'Nr'), attr('r.s', 'Seats')]), entity('bk', 'Booking', [pk('bk.id', 'Id')])],
        [rel('r', 'room', 'bk')],
      ),
    );
    expect(attributeNames(m, 'bk')).toEqual(['Id', 'RoomBuilding', 'RoomNr']);
    expect(entityOf(m, 'bk').attributes.map((a) => a.fk?.referencedId)).toEqual([undefined, 'r.b', 'r.n']);
  });

  it('makes FK attributes of identifying relationships part of the primary key', () => {
    const m = chain();
    expect(attributeNamed(m, 'b', 'AId')).toMatchObject({ isPrimaryKey: true, isOptional: false });
    expect(effectivePrimaryKey(m, 'b').map((a) => a.name)).toEqual(['Nr', 'AId']);
  });

  it('propagates keys transitively along identifying chains and reuses migrated names', () => {
    const m = chain();
    expect(attributeNames(m, 'b')).toEqual(['Nr', 'AId']);
    expect(attributeNames(m, 'c')).toEqual(['Pos', 'BNr', 'AId']);
    expect(attributeNames(m, 'd')).toEqual(['Id', 'CPos', 'BNr', 'AId']);
    expect(entityOf(m, 'd').attributes.every((a) => !a.isPrimaryKey || a.name === 'Id')).toBe(true);
    // C's migrated AId references B's AId, not A's Id.
    expect(attributeNamed(m, 'c', 'AId').fk?.referencedId).toBe(attributeNamed(m, 'b', 'AId').id);
  });

  it('is idempotent and keeps object references of unchanged entities', () => {
    const once = chain();
    const twice = sync(once);
    expect(twice).toEqual(once);
    once.entities.forEach((e, i) => expect(twice.entities[i]).toBe(e));
  });

  it('works independent of the entity order in the model', () => {
    const m = chain();
    const reversed = sync({ ...m, entities: [...m.entities].reverse() });
    expect(attributeNames(reversed, 'd')).toEqual(['Id', 'CPos', 'BNr', 'AId']);
  });

  it('propagates a renamed parent key to all descendants and keeps ids', () => {
    const before = chain();
    const after = sync(updateEntity(before, 'a', (e) => ({ ...e, attributes: [pk('a.id', 'Key')] })));
    expect(attributeNames(after, 'b')).toEqual(['Nr', 'AKey']);
    expect(attributeNames(after, 'c')).toEqual(['Pos', 'BNr', 'AKey']);
    expect(attributeNames(after, 'd')).toEqual(['Id', 'CPos', 'BNr', 'AKey']);
    expect(attributeNamed(after, 'd', 'AKey').id).toBe(attributeNamed(before, 'd', 'AId').id);
  });

  it('propagates an added parent key attribute to all descendants', () => {
    const before = chain();
    const after = sync(updateEntity(before, 'a', (e) => ({ ...e, attributes: [...e.attributes, pk('a.code', 'Code')] })));
    expect(attributeNames(after, 'b')).toEqual(['Nr', 'AId', 'ACode']);
    expect(attributeNames(after, 'c')).toEqual(['Pos', 'BNr', 'AId', 'ACode']);
    expect(attributeNames(after, 'd')).toEqual(['Id', 'CPos', 'BNr', 'AId', 'ACode']);
  });

  it('removes FK attributes when the parent key attribute is removed or no longer a key', () => {
    const before = chain();
    const removed = sync(updateEntity(before, 'a', (e) => ({ ...e, attributes: [] })));
    expect(attributeNames(removed, 'b')).toEqual(['Nr']);
    expect(attributeNames(removed, 'd')).toEqual(['Id', 'CPos', 'BNr']);
    const demoted = sync(updateEntity(before, 'a', (e) => ({ ...e, attributes: [attr('a.id', 'Id')] })));
    expect(attributeNames(demoted, 'c')).toEqual(['Pos', 'BNr']);
  });

  it('keeps names of FK attributes renamed by the user, also for migrated keys', () => {
    const before = chain();
    const renamed = updateEntity(before, 'b', (e) => ({
      ...e,
      attributes: e.attributes.map((a) => (a.fk ? { ...a, name: 'OwnerId', fk: { ...a.fk, isRenamed: true } } : a)),
    }));
    const after = sync(updateEntity(sync(renamed), 'a', (e) => ({ ...e, attributes: [pk('a.id', 'Key')] })));
    expect(attributeNames(after, 'b')).toEqual(['Nr', 'OwnerId']);
    expect(attributeNamed(after, 'b', 'OwnerId').fk?.isRenamed).toBe(true);
    expect(attributeNames(after, 'c')).toEqual(['Pos', 'BNr', 'OwnerId']);
  });

  it('keeps the position of FK attributes when other attributes are added', () => {
    const before = chain();
    const after = sync(updateEntity(before, 'd', (e) => ({ ...e, attributes: [...e.attributes, attr('d.x', 'Note')] })));
    expect(attributeNames(after, 'd')).toEqual(['Id', 'CPos', 'BNr', 'AId', 'Note']);
  });

  it('removes the FK attributes of a deleted relationship', () => {
    const before = chain();
    const after = sync({ ...before, relationships: before.relationships.filter((r) => r.id !== 'cd') });
    expect(attributeNames(after, 'd')).toEqual(['Id']);
  });

  it('numbers colliding names of two relationships to the same parent', () => {
    const m = sync(
      model(
        [entity('ap', 'Airport', [pk('ap.id', 'Id')]), entity('f', 'Flight', [pk('f.id', 'Id')])],
        [rel('dep', 'ap', 'f'), rel('arr', 'ap', 'f')],
      ),
    );
    expect(attributeNames(m, 'f')).toEqual(['Id', 'AirportId', 'AirportId2']);
    expect(attributeNamed(m, 'f', 'AirportId2').fk?.relationshipId).toBe('arr');
  });

  it('avoids names of user defined attributes', () => {
    const m = sync(
      model(
        [entity('ap', 'Airport', [pk('ap.id', 'Id')]), entity('f', 'Flight', [pk('f.id', 'Id'), attr('f.x', 'AirportId')])],
        [rel('dep', 'ap', 'f')],
      ),
    );
    expect(attributeNames(m, 'f')).toEqual(['Id', 'AirportId', 'AirportId2']);
  });

  it('handles recursive relationships, numbering a FK that collides with the key', () => {
    const plain = sync(model([entity('e', 'Employee', [pk('e.id', 'Id')])], [rel('boss', 'e', 'e')]));
    expect(attributeNames(plain, 'e')).toEqual(['Id', 'EmployeeId']);
    const prefixed = sync(model([entity('e', 'Employee', [pk('e.id', 'EmployeeId')])], [rel('boss', 'e', 'e')]));
    expect(attributeNames(prefixed, 'e')).toEqual(['EmployeeId', 'EmployeeId2']);
  });

  it('places the FK of a 1 : 0..1 relationship on the 0..1 side, in both drawing directions', () => {
    const entities = [entity('p', 'Person', [pk('p.id', 'Id')]), entity('c', 'Car', [pk('c.id', 'Id')])];
    const forward = sync(model(entities, [rel('r', 'p', 'c', { source: 'one', target: 'zeroOrOne' })]));
    expect(attributeNames(forward, 'c')).toEqual(['Id', 'PersonId']);
    expect(attributeNames(forward, 'p')).toEqual(['Id']);
    const backward = sync(model(entities, [rel('r', 'c', 'p', { source: 'zeroOrOne', target: 'one' })]));
    expect(attributeNames(backward, 'c')).toEqual(['Id', 'PersonId']);
    expect(attributeNames(backward, 'p')).toEqual(['Id']);
  });

  it('places the FK of a symmetric 1:1 relationship on the target and moves it when swapped', () => {
    const entities = [entity('p', 'Person', [pk('p.id', 'Id')]), entity('c', 'Car', [pk('c.id', 'Id')])];
    const drawn = sync(model(entities, [rel('r', 'p', 'c', { source: 'one', target: 'one' })]));
    expect(attributeNames(drawn, 'c')).toEqual(['Id', 'PersonId']);
    const swapped = sync({ ...drawn, relationships: [rel('r', 'c', 'p', { source: 'one', target: 'one' })] });
    expect(attributeNames(swapped, 'c')).toEqual(['Id']);
    expect(attributeNames(swapped, 'p')).toEqual(['Id', 'CarId']);
  });

  it('derives optionality from a 0..1 parent end, but never for key attributes', () => {
    const entities = [entity('d', 'Department', [pk('d.id', 'Id')]), entity('e', 'Employee', [pk('e.id', 'Id')])];
    const optional = sync(model(entities, [rel('r', 'd', 'e', { source: 'zeroOrOne' })]));
    expect(attributeNamed(optional, 'e', 'DepartmentId')).toMatchObject({ isOptional: true, isPrimaryKey: false });
    const identifying = sync(model(entities, [rel('r', 'd', 'e', { source: 'zeroOrOne', identifying: true })]));
    expect(attributeNamed(identifying, 'e', 'DepartmentId')).toMatchObject({ isOptional: false, isPrimaryKey: true });
  });

  it('forces own primary key attributes to be mandatory', () => {
    const m = sync(model([entity('a', 'A', [{ id: 'a.id', name: 'Id', isPrimaryKey: true, isOptional: true }])]));
    expect(attributeNamed(m, 'a', 'Id').isOptional).toBe(false);
  });

  it('uses the supertype key for a subtype parent and removes own keys of subtypes', () => {
    const m = sync(
      model(
        [
          entity('p', 'Person', [pk('p.id', 'Id')]),
          entity('s', 'Student', [pk('s.nr', 'StudentNr')]),
          entity('x', 'Exam', [pk('x.id', 'Id')]),
        ],
        [rel('r', 's', 'x')],
        [generalization('g', 'p', ['s'])],
      ),
    );
    expect(attributeNamed(m, 's', 'StudentNr').isPrimaryKey).toBe(false);
    expect(effectivePrimaryKey(m, 's').map((a) => a.id)).toEqual(['p.id']);
    expect(attributeNamed(m, 'x', 'StudentId').fk?.referencedId).toBe('p.id');
  });

  it('creates no FK attributes for n:m relationships and removes them when a relationship becomes n:m', () => {
    const entities = [entity('s', 'Student', [pk('s.id', 'Id')]), entity('c', 'Course', [pk('c.id', 'Id')])];
    const nm = sync(model(entities, [rel('r', 's', 'c', { source: 'zeroOrMany' })]));
    expect(attributeNames(nm, 'c')).toEqual(['Id']);
    expect(attributeNames(nm, 's')).toEqual(['Id']);
    const oneToMany = sync(model(entities, [rel('r', 's', 'c')]));
    const changed = sync({ ...oneToMany, relationships: [rel('r', 's', 'c', { source: 'oneOrMany' })] });
    expect(attributeNames(changed, 'c')).toEqual(['Id']);
  });

  it('uses the naming convention', () => {
    const m = syncLogicalForeignKeys(
      model([entity('s', 'Student', [pk('s.id', 'Id')]), entity('e', 'Exam', [])], [rel('r', 's', 'e')]),
      'snake_case',
    );
    expect(attributeNames(m, 'e')).toEqual(['student_id']);
  });

  it('terminates and stays stable for identifying cycles and self-loops', () => {
    const initial = model(
      [entity('a', 'A', [pk('a.id', 'Id')]), entity('b', 'B', [pk('b.id', 'Id')]), entity('c', 'C', [pk('c.id', 'Id')])],
      [
        rel('ab', 'a', 'b', { identifying: true }),
        rel('ba', 'b', 'a', { identifying: true }),
        rel('cc', 'c', 'c', { identifying: true }),
        rel('bc', 'b', 'c', { identifying: true }),
      ],
    );
    const first = sync(initial);
    let m = first;
    for (let i = 0; i < 5; i++) m = sync(m);
    expect(m).toEqual(first);
    expect(attributeNames(m, 'a')).toEqual(['Id', 'BId']);
    expect(attributeNames(m, 'b')).toEqual(['Id', 'AId']);
    // Cyclic relationships give plain FKs, the acyclic one B -> C still a key FK.
    expect(attributeNamed(m, 'c', 'CId')).toMatchObject({ isPrimaryKey: false, fk: { relationshipId: 'cc' } });
    expect(attributeNamed(m, 'c', 'BId')).toMatchObject({ isPrimaryKey: true, fk: { relationshipId: 'bc' } });
    // The self-loop also migrates C's key part BId, which is numbered after the key FK.
    expect(attributeNames(m, 'c')).toEqual(['Id', 'CId', 'BId2', 'BId']);
  });

  it('ignores relationships to missing entities', () => {
    const m = sync(model([entity('a', 'A', [pk('a.id', 'Id')])], [rel('r', 'a', 'missing'), rel('q', 'missing', 'a')]));
    expect(attributeNames(m, 'a')).toEqual(['Id']);
  });
});

describe('effectivePrimaryKey', () => {
  it('returns the own key attributes and an empty list for unknown entities', () => {
    const m = model([entity('a', 'A', [pk('a.id', 'Id'), attr('a.n', 'Name'), pk('a.k', 'Key')])]);
    expect(effectivePrimaryKey(m, 'a').map((a) => a.name)).toEqual(['Id', 'Key']);
    expect(effectivePrimaryKey(m, 'missing')).toEqual([]);
  });
});
