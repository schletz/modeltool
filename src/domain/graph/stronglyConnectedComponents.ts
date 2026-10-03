/** Directed edge between two nodes, e.g. parent -> child. */
export interface Edge<T> {
  from: T;
  to: T;
}

/**
 * Splits a directed graph into strongly connected components (Tarjan's algorithm).
 * The components are returned in topological order: a component comes before every
 * component reachable from it. Nodes inside a component keep the order of `nodes`,
 * which makes the result deterministic.
 */
export function stronglyConnectedComponents<T>(nodes: readonly T[], edges: readonly Edge<T>[]): T[][] {
  const successors = new Map<T, T[]>(nodes.map((n) => [n, []]));
  for (const e of edges) successors.get(e.from)?.push(e.to);

  const indexOf = new Map<T, number>();
  const lowLink = new Map<T, number>();
  const onStack = new Set<T>();
  const stack: T[] = [];
  const reverseTopological: T[][] = [];

  const visit = (node: T): void => {
    indexOf.set(node, indexOf.size);
    lowLink.set(node, indexOf.get(node) as number);
    stack.push(node);
    onStack.add(node);
    for (const next of successors.get(node) ?? []) {
      if (!indexOf.has(next)) {
        if (!successors.has(next)) continue;
        visit(next);
        lowLink.set(node, Math.min(lowLink.get(node) as number, lowLink.get(next) as number));
      } else if (onStack.has(next)) {
        lowLink.set(node, Math.min(lowLink.get(node) as number, indexOf.get(next) as number));
      }
    }
    if (lowLink.get(node) === indexOf.get(node)) {
      const members = new Set<T>();
      let member: T | undefined;
      do {
        member = stack.pop() as T;
        onStack.delete(member);
        members.add(member);
      } while (member !== node);
      reverseTopological.push(nodes.filter((n) => members.has(n)));
    }
  };

  for (const n of nodes) if (!indexOf.has(n)) visit(n);
  // Tarjan emits a component only after all components reachable from it.
  return reverseTopological.reverse();
}
