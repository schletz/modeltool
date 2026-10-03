import type { NamingConvention } from './model/common';

/** Splits an identifier like "StudentCourse", "student_course" or "first name" into lower case words. */
export function splitWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9À-ɏ]+/)
    .filter((w) => w.length > 0)
    .map((w) => w.toLowerCase());
}

/** Joins words according to the naming convention. */
export function joinWords(words: string[], convention: NamingConvention): string {
  if (convention === 'snake_case') return words.join('_');
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

/**
 * Name of a generated foreign key attribute/column from the parent's name and the
 * referenced primary key name: ("Student", "Id") -> "StudentId" / "student_id".
 * If the key name already starts with the parent name ("StudentNr"), it is not repeated.
 */
export function foreignKeyName(parentName: string, keyName: string, convention: NamingConvention): string {
  const parentWords = splitWords(parentName);
  const keyWords = splitWords(keyName);
  const alreadyPrefixed =
    parentWords.length > 0 &&
    keyWords.length > parentWords.length &&
    parentWords.every((w, i) => keyWords[i] === w);
  return joinWords(alreadyPrefixed ? keyWords : [...parentWords, ...keyWords], convention);
}

/** Name of a junction table for an n:m relationship: ("Student", "Course") -> "StudentCourse". */
export function junctionTableName(firstName: string, secondName: string, convention: NamingConvention): string {
  return joinWords([...splitWords(firstName), ...splitWords(secondName)], convention);
}

/**
 * Makes `name` unique against `taken` (case insensitive) by appending 2, 3, ...:
 * "AirportId" -> "AirportId2".
 */
export function uniqueName(name: string, taken: Iterable<string>): string {
  const lower = new Set(Array.from(taken, (t) => t.toLowerCase()));
  if (!lower.has(name.toLowerCase())) return name;
  for (let i = 2; ; i++) {
    const candidate = `${name}${i}`;
    if (!lower.has(candidate.toLowerCase())) return candidate;
  }
}
