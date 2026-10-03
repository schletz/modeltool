/** Standard SQL data types offered in the combobox. Parameters are typed by the user. */
export const DATA_TYPE_SUGGESTIONS: readonly string[] = [
  'SMALLINT',
  'INTEGER',
  'BIGINT',
  'DECIMAL(p,s)',
  'NUMERIC(p,s)',
  'REAL',
  'DOUBLE PRECISION',
  'CHAR(n)',
  'VARCHAR(n)',
  'CLOB',
  'BOOLEAN',
  'DATE',
  'TIME',
  'TIMESTAMP',
  'BLOB',
];

const INTEGER_TYPES = new Set(['SMALLINT', 'INTEGER', 'INT', 'BIGINT']);

/** Normalizes a data type for comparisons: upper case, no superfluous whitespace. */
export function normalizeDataType(dataType: string): string {
  return dataType.trim().toUpperCase().replace(/\s*\(\s*/g, '(').replace(/\s*,\s*/g, ',').replace(/\s*\)/g, ')').replace(/\s+/g, ' ');
}

/** True for integer types, the only ones allowed for IDENTITY. */
export function isIntegerType(dataType: string): boolean {
  return INTEGER_TYPES.has(normalizeDataType(dataType));
}

/** True if two data types are equal apart from case and whitespace. */
export function sameDataType(a: string, b: string): boolean {
  return normalizeDataType(a) === normalizeDataType(b);
}
