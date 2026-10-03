/** Binary min-heap of integer items keyed by a numeric priority. */
export class MinHeap {
  private readonly items: number[] = [];
  private readonly priorities: number[] = [];

  /** Number of queued items. */
  get size(): number {
    return this.items.length;
  }

  /** Adds an item; duplicates are allowed (lazy decrease-key). */
  push(item: number, priority: number): void {
    const { items, priorities } = this;
    let i = items.length;
    items.push(item);
    priorities.push(priority);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const parentPriority = priorities[parent]!;
      if (parentPriority <= priority) break;
      items[i] = items[parent]!;
      priorities[i] = parentPriority;
      i = parent;
    }
    items[i] = item;
    priorities[i] = priority;
  }

  /** Removes and returns the item with the smallest priority, or undefined if empty. */
  pop(): { item: number; priority: number } | undefined {
    const { items, priorities } = this;
    if (items.length === 0) return undefined;
    const top = { item: items[0]!, priority: priorities[0]! };
    const lastItem = items.pop()!;
    const lastPriority = priorities.pop()!;
    const n = items.length;
    if (n === 0) return top;

    // Sift the former last element down from the root.
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      if (left >= n) break;
      const right = left + 1;
      const child = right < n && priorities[right]! < priorities[left]! ? right : left;
      if (priorities[child]! >= lastPriority) break;
      items[i] = items[child]!;
      priorities[i] = priorities[child]!;
      i = child;
    }
    items[i] = lastItem;
    priorities[i] = lastPriority;
    return top;
  }
}
