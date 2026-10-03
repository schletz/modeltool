import type { NamingConvention } from './common';
import type { LogicalModel } from './logical';
import type { PhysicalModel } from './physical';

export const DOCUMENT_FORMAT = 'er-modeltool';
export const DOCUMENT_VERSION = 1;

export interface ModelMeta {
  modelName: string;
  studentName: string;
  className: string;
  /** Optional matriculation number. */
  studentId: string;
  /** ISO timestamp, set automatically on save. */
  savedAt: string;
}

export interface ModelSettings {
  namingConvention: NamingConvention;
}

/** Everything stored in one JSON file: both models, settings and metadata. */
export interface ModelDocument {
  format: typeof DOCUMENT_FORMAT;
  version: typeof DOCUMENT_VERSION;
  meta: ModelMeta;
  settings: ModelSettings;
  logical: LogicalModel;
  physical: PhysicalModel;
}

/** Which of the two views a model element belongs to. */
export type ViewKind = 'logical' | 'physical';

/** Creates an empty document. */
export function createEmptyDocument(): ModelDocument {
  return {
    format: DOCUMENT_FORMAT,
    version: DOCUMENT_VERSION,
    meta: { modelName: '', studentName: '', className: '', studentId: '', savedAt: '' },
    settings: { namingConvention: 'PascalCase' },
    logical: { entities: [], relationships: [], generalizations: [], notes: [] },
    physical: { tables: [], relationships: [], notes: [] },
  };
}

/** True if a physical model has been generated (or drawn) already. */
export function hasPhysicalModel(doc: ModelDocument): boolean {
  return doc.physical.tables.length > 0;
}
