/** Undo/redo stack of one view. */
export interface History<M> {
  past: M[];
  future: M[];
  /** Key of the last commit; consecutive commits with the same key are merged (typing). */
  lastKey: string | null;
}

/** At least 50 steps are required; a few more cost nothing. */
export const HISTORY_LIMIT = 100;

export function emptyHistory<M>(): History<M> {
  return { past: [], future: [], lastKey: null };
}

/** Records `previous` as an undo step unless the commit is merged with the last one. */
export function record<M>(history: History<M>, previous: M, key: string | null): History<M> {
  if (key !== null && key === history.lastKey) return { ...history, future: [] };
  return { past: [...history.past, previous].slice(-HISTORY_LIMIT), future: [], lastKey: key };
}

export function undoStep<M>(history: History<M>, current: M): [History<M>, M] | null {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) return null;
  return [{ past: history.past.slice(0, -1), future: [current, ...history.future], lastKey: null }, previous];
}

export function redoStep<M>(history: History<M>, current: M): [History<M>, M] | null {
  const next = history.future[0];
  if (next === undefined) return null;
  return [{ past: [...history.past, current], future: history.future.slice(1), lastKey: null }, next];
}
