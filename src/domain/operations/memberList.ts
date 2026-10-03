import type { Id } from '../model/common';

/** Something with an id inside an ordered list (attributes, columns). */
interface Identified {
  id: Id;
}

/** Inserts `item` after the element with id `afterId`; at the start if `afterId` is null. */
export function insertAfter<T extends Identified>(items: readonly T[], afterId: Id | null, item: T): T[] {
  if (afterId === null) return [item, ...items];
  const index = items.findIndex((i) => i.id === afterId);
  if (index < 0) return [...items, item];
  return [...items.slice(0, index + 1), item, ...items.slice(index + 1)];
}

/** Applies a partial update to the element with the given id. */
export function patchById<T extends Identified>(items: readonly T[], id: Id, patch: NoInfer<Partial<T>>): T[] {
  return items.map((i) => (i.id === id ? { ...i, ...patch } : i));
}

/**
 * Moves the element with id `id` one step up or down, skipping over elements that are not
 * in the same group (PK and non-PK members are displayed in separate blocks, so a move
 * swaps with the neighbour inside the block).
 */
export function moveWithinGroup<T extends Identified>(
  items: readonly T[],
  id: Id,
  direction: -1 | 1,
  sameGroup: (a: T, b: T) => boolean,
): T[] {
  const index = items.findIndex((i) => i.id === id);
  const item = items[index];
  if (!item) return [...items];
  let other = index + direction;
  while (other >= 0 && other < items.length && !sameGroup(item, items[other] as T)) other += direction;
  if (other < 0 || other >= items.length) return [...items];
  const result = [...items];
  result[index] = items[other] as T;
  result[other] = item;
  return result;
}
