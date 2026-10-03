import type { Id } from '../model/common';
import type { ViewKind } from '../model/document';

/** Blocker codes of the logical model. Messages are produced by the UI (i18n) from code + params. */
export type LogicalIssueCode =
  | 'entityWithoutPrimaryKey'
  | 'emptyEntityName'
  | 'duplicateEntityName'
  | 'emptyAttributeName'
  | 'duplicateAttributeName'
  | 'identifyingParentNotOne'
  | 'identifyingCycle'
  | 'rollDownIncomplete'
  | 'rollDownIdentifyingParent';

/** Blocker codes of the physical model (checked before the DDL export). */
export type PhysicalIssueCode =
  | 'columnWithoutDataType'
  | 'tableWithoutPrimaryKey'
  | 'manyToManyRelationship'
  | 'emptyTableName'
  | 'duplicateTableName'
  | 'emptyColumnName'
  | 'duplicateColumnName'
  | 'identityOnNonInteger'
  | 'foreignKeyTypeMismatch';

/** A blocker found by the validation. */
export interface ValidationIssue {
  code: LogicalIssueCode | PhysicalIssueCode;
  view: ViewKind;
  /**
   * Diagram element to select when the user clicks the issue: an entity, table,
   * relationship or generalization id.
   */
  elementId: Id;
  /** Values for the message placeholders, e.g. { entity: "Student", attribute: "Name" }. */
  params: Record<string, string>;
}
