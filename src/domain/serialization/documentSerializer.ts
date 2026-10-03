import { DOCUMENT_FORMAT, DOCUMENT_VERSION, type ModelDocument } from '../model/document';
import { readDocumentV1 } from './documentSchemaV1';
import { SchemaError, readObject } from './schemaReader';

export type ParseResult =
  | { ok: true; document: ModelDocument }
  | {
      ok: false;
      /** Machine readable reason, translated by the UI. */
      error: 'invalidJson' | 'wrongFormat' | 'unsupportedVersion' | 'invalidSchema';
      /** Path to the offending value, e.g. "logical.entities[2].name". */
      detail?: string;
    };

type RawDocument = Record<string, unknown>;

/**
 * Migrations of older file versions: entry `n` converts a raw version `n` document into
 * a raw version `n + 1` document. A version without a migration path is unsupported.
 */
const MIGRATIONS: Readonly<Record<number, (raw: RawDocument) => RawDocument>> = {};

/** Serializes a document to pretty printed JSON. */
export function serializeDocument(doc: ModelDocument): string {
  return JSON.stringify(doc, null, 2);
}

/** Parses and schema-checks a JSON document. Never throws. */
export function parseDocument(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalidJson' };
  }
  if (typeof json !== 'object' || json === null || Array.isArray(json) || (json as RawDocument).format !== DOCUMENT_FORMAT) {
    return { ok: false, error: 'wrongFormat' };
  }
  try {
    const raw = migrate(json as RawDocument);
    if (raw === undefined) return { ok: false, error: 'unsupportedVersion' };
    return { ok: true, document: readDocumentV1(readObject(raw, '')) };
  } catch (e) {
    if (e instanceof SchemaError) return { ok: false, error: 'invalidSchema', detail: e.path };
    return { ok: false, error: 'invalidSchema' };
  }
}

/** Brings a raw document to the current version; undefined if its version is unsupported. */
function migrate(raw: RawDocument): RawDocument | undefined {
  const version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version > DOCUMENT_VERSION) return undefined;
  let current = raw;
  for (let v = version; v < DOCUMENT_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) return undefined;
    current = step(current);
  }
  return current;
}
