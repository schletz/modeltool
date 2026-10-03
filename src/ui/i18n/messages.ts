import type { de } from './de';

/** All translation keys; the German catalog is the reference. */
export type MessageKey = keyof typeof de;

/** A complete catalog: the compiler reports missing keys in other languages. */
export type Messages = Record<MessageKey, string>;
