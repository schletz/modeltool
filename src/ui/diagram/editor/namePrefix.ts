/** Result of typing a name with a property prefix. */
export interface ParsedName {
  name: string;
  isPrimaryKey: boolean;
  isOptional: boolean;
}

/**
 * Interprets the input prefixes of spec 3.2: "#id" makes the attribute a primary key,
 * "?email" makes it optional. The prefix is removed from the name.
 */
export function parseNamePrefix(input: string): ParsedName {
  if (input.startsWith('#')) return { name: input.slice(1), isPrimaryKey: true, isOptional: false };
  if (input.startsWith('?')) return { name: input.slice(1), isPrimaryKey: false, isOptional: true };
  return { name: input, isPrimaryKey: false, isOptional: false };
}
