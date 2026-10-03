import type { ForeignKeyOrigin, Id, Note, Point, Relationship } from './common';

/** Foreign key column origin, extended by the data type override flag. */
export interface PhysicalForeignKeyOrigin extends ForeignKeyOrigin {
  /**
   * True when the user set a data type different from the referenced primary key column.
   * Otherwise the column follows the referenced column's data type automatically.
   */
  isTypeOverridden: boolean;
}

/** Column of a physical table. */
export interface Column {
  id: Id;
  /** Unique within the table. */
  name: string;
  /** SQL data type including parameters, e.g. "VARCHAR(100)". Empty string = not set yet. */
  dataType: string;
  isPrimaryKey: boolean;
  isNotNull: boolean;
  /** Single column UNIQUE constraint. */
  isUnique: boolean;
  /** GENERATED ALWAYS AS IDENTITY, only valid for integer types. */
  isIdentity: boolean;
  fk?: PhysicalForeignKeyOrigin;
}

/** Named UNIQUE constraint spanning several columns of one table. */
export interface UniqueConstraint {
  id: Id;
  name: string;
  columnIds: Id[];
}

export interface Table {
  id: Id;
  /** Unique within the model. */
  name: string;
  position: Point;
  columns: Column[];
  uniqueConstraints: UniqueConstraint[];
}

export interface PhysicalModel {
  tables: Table[];
  relationships: Relationship[];
  notes: Note[];
}
