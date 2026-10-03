import { useEffect } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { writeAutosave } from '../services/autosave';

const AUTOSAVE_DELAY_MS = 1000;

/**
 * Autosaves the document to localStorage about one second after the last change and
 * warns before closing the tab with unsaved changes (spec 9.2, 9.3).
 * Autosave starts only once `enabled` is true, so a pending restore is not overwritten.
 */
export function usePersistenceGuards(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useDocumentStore.subscribe((state, previous) => {
      if (state.doc === previous.doc) return;
      clearTimeout(timer);
      timer = setTimeout(() => writeAutosave(useDocumentStore.getState().doc), AUTOSAVE_DELAY_MS);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [enabled]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!useDocumentStore.getState().dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);
}
