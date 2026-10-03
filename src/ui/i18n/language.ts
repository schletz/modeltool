import { create } from 'zustand';
import { de } from './de';
import { en } from './en';
import type { MessageKey, Messages } from './messages';

export type Language = 'de' | 'en';

const STORAGE_KEY = 'er-modeltool.language';
const catalogs: Record<Language, Messages> = { de, en };

function initialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'de' || stored === 'en') return stored;
  } catch {
    // localStorage may be unavailable (privacy settings); fall back to the browser language.
  }
  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en';
}

interface LanguageState {
  language: Language;
  setLanguage(language: Language): void;
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: initialLanguage(),
  setLanguage: (language) => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Not persisted, still switch for this session.
    }
    document.documentElement.lang = language;
    set({ language });
  },
}));

export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

/** Translates a key in the given language, replacing `{name}` placeholders. */
export function translate(language: Language, key: MessageKey, params?: Record<string, string | number>): string {
  const text = catalogs[language][key];
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** Hook returning the translate function of the current language. */
export function useT(): Translate {
  const language = useLanguageStore((s) => s.language);
  return (key, params) => translate(language, key, params);
}

/** Translate outside React (commands, exports). */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  return translate(useLanguageStore.getState().language, key, params);
}
