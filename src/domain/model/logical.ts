import type { ForeignKeyOrigin, Id, Note, Point, Relationship } from './common';

/** Attribute of a logical entity. */
export interface LogicalAttribute {
  id: Id;
  /** Unique within the entity (including foreign key attributes). */
  name: string;
  isPrimaryKey: boolean;
  /** Primary key attributes are always mandatory, so this is false for them. */
  isOptional: boolean;
  /** Set for foreign key attributes generated from a relationship. */
  fk?: ForeignKeyOrigin;
}

/** Entity of the logical model. */
export interface Entity {
  id: Id;
  /** Unique within the model. */
  name: string;
  position: Point;
  attributes: LogicalAttribute[];
}

/** Strategy to map a generalization to tables. */
export type GeneralizationStrategy = 'rollUp' | 'rollDown';

/**
 * One level generalization in IE/IDEF1X style (supertype - circle - subtypes).
 * A subtype cannot be a supertype and belongs to at most one generalization.
 * Subtypes have no primary key of their own, they inherit the supertype's key.
 */
export interface Generalization {
  id: Id;
  supertypeId: Id;
  subtypeIds: Id[];
  /** Complete (total, double bar) or incomplete (partial, single bar). */
  isComplete: boolean;
  /** Top left corner of the category circle node. */
  position: Point;
  /** Last strategy chosen in the transformation dialog, preselected next time. */
  strategy?: GeneralizationStrategy;
}

export interface LogicalModel {
  entities: Entity[];
  relationships: Relationship[];
  generalizations: Generalization[];
  notes: Note[];
}
