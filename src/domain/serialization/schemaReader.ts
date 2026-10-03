/** Thrown by the readers when a value does not match the schema; `path` locates it. */
export class SchemaError extends Error {
  constructor(readonly path: string) {
    super(`Invalid value at ${path}`);
  }
}

/** Reads and type checks an unknown JSON value found at `path`. */
export type Reader<T> = (value: unknown, path: string) => T;

export function fail(path: string): never {
  throw new SchemaError(path);
}

/** Path of an object property: ("logical", "entities") -> "logical.entities". */
export function propertyPath(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`;
}

export function readObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path);
  return value as Record<string, unknown>;
}

export const readString: Reader<string> = (value, path) => (typeof value === 'string' ? value : fail(path));

export const readBoolean: Reader<boolean> = (value, path) => (typeof value === 'boolean' ? value : fail(path));

export const readNumber: Reader<number> = (value, path) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fail(path);

/** Non-empty string used as element id. */
export const readId: Reader<string> = (value, path) => (typeof value === 'string' && value !== '' ? value : fail(path));

export function readEnum<T extends string>(values: readonly T[]): Reader<T> {
  return (value, path) => (values.includes(value as T) ? (value as T) : fail(path));
}

export function readArray<T>(item: Reader<T>): Reader<T[]> {
  return (value, path) => {
    if (!Array.isArray(value)) fail(path);
    return value.map((v, i) => item(v, `${path}[${i}]`));
  };
}

/** Reads a required property of an object. */
export function field<T>(obj: Record<string, unknown>, path: string, key: string, reader: Reader<T>): T {
  return reader(obj[key], propertyPath(path, key));
}

/** Reads an optional property; returns undefined if it is absent. */
export function optionalField<T>(obj: Record<string, unknown>, path: string, key: string, reader: Reader<T>): T | undefined {
  return obj[key] === undefined ? undefined : reader(obj[key], propertyPath(path, key));
}

/** Fails at the path of the first item whose id occurred before. */
export function requireUniqueIds(items: readonly { id: string }[], path: string): void {
  const seen = new Set<string>();
  items.forEach((item, i) => {
    if (seen.has(item.id)) fail(`${path}[${i}].id`);
    seen.add(item.id);
  });
}
