import type { Id } from '../../../domain/model/common';
import type { Entity, LogicalModel } from '../../../domain/model/logical';
import type { Column, Table } from '../../../domain/model/physical';
import { effectivePrimaryKey } from '../../../domain/foreignKeys/logicalForeignKeys';

export type KeyLabel = '' | 'PK' | 'FK' | 'PK, FK';

export function keyLabel(isPrimaryKey: boolean, isForeignKey: boolean): KeyLabel {
  if (isPrimaryKey && isForeignKey) return 'PK, FK';
  if (isPrimaryKey) return 'PK';
  return isForeignKey ? 'FK' : '';
}

/** One displayed attribute line of an entity. */
export interface EntityRow {
  id: Id;
  name: string;
  keyLabel: KeyLabel;
  isPrimaryKey: boolean;
  isOptional: boolean;
  isForeignKey: boolean;
  /** PK attribute inherited from the supertype (shown greyed out, not editable). */
  isInherited: boolean;
}

/** Attribute lines split into the key block (top) and the other attributes. */
export interface RowBlocks<R> {
  keyRows: R[];
  otherRows: R[];
}

/** Display rows of an entity; subtypes show the supertype's key greyed out on top. */
export function entityRows(model: LogicalModel, entity: Entity): RowBlocks<EntityRow> {
  const generalization = model.generalizations.find((g) => g.subtypeIds.includes(entity.id));
  const inherited: EntityRow[] = generalization
    ? effectivePrimaryKey(model, generalization.supertypeId).map((a) => ({
        id: `inherited-${a.id}`,
        name: a.name,
        keyLabel: 'PK',
        isPrimaryKey: true,
        isOptional: false,
        isForeignKey: false,
        isInherited: true,
      }))
    : [];
  const rows = entity.attributes.map<EntityRow>((a) => ({
    id: a.id,
    name: a.name,
    keyLabel: keyLabel(a.isPrimaryKey, a.fk !== undefined),
    isPrimaryKey: a.isPrimaryKey,
    isOptional: a.isOptional,
    isForeignKey: a.fk !== undefined,
    isInherited: false,
  }));
  return {
    keyRows: [...inherited, ...rows.filter((r) => r.isPrimaryKey)],
    otherRows: rows.filter((r) => !r.isPrimaryKey),
  };
}

/** Display rows of a table: PK columns on top. */
export function tableRows(table: Table): RowBlocks<Column> {
  return {
    keyRows: table.columns.filter((c) => c.isPrimaryKey),
    otherRows: table.columns.filter((c) => !c.isPrimaryKey),
  };
}
