/**
 * Orders nodes so that every node comes after its dependencies, preferring the original
 * order of `nodes` among the nodes that are ready. On a cycle no node is ready; then the
 * first remaining node in original order is taken, so the result is deterministic.
 * Self dependencies and dependencies on unknown nodes are ignored.
 */
export function topologicalOrder<T>(nodes: readonly T[], dependenciesOf: (node: T) => readonly T[]): T[] {
  const known = new Set(nodes);
  const done = new Set<T>();
  const result: T[] = [];
  const isReady = (n: T): boolean => dependenciesOf(n).every((d) => d === n || done.has(d) || !known.has(d));

  for (;;) {
    const remaining = nodes.filter((n) => !done.has(n));
    if (remaining.length === 0) return result;
    const next = remaining.find(isReady) ?? (remaining[0] as T);
    done.add(next);
    result.push(next);
  }
}
