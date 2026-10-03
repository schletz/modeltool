import { resolveRoles } from '../cardinality';
import { isIntegerType, sameDataType } from '../dataTypes';
import { referencedColumn } from '../foreignKeys/referencedColumn';
import type { Id } from '../model/common';
import type { PhysicalModel, Table } from '../model/physical';
import type { PhysicalIssueCode, ValidationIssue } from './issues';

type Report = (code: PhysicalIssueCode, elementId: Id, params: Record<string, string>) => void;

/** Checks the blockers of the physical model before the DDL export (spec 7). */
export function validatePhysical(model: PhysicalModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const report: Report = (code, elementId, params) => {
    issues.push({ code, view: 'physical', elementId, params });
  };

  const tableNames = new Set<string>();
  for (const table of model.tables) {
    const name = table.name.trim();
    if (name === '') report('emptyTableName', table.id, { table: table.name });
    else if (tableNames.has(name.toLowerCase())) report('duplicateTableName', table.id, { table: name });
    tableNames.add(name.toLowerCase());
    validateTable(model, table, report);
  }

  const tableName = (id: Id): string => model.tables.find((t) => t.id === id)?.name ?? '';
  for (const rel of model.relationships) {
    if (resolveRoles(rel).kind === 'manyToMany') {
      report('manyToManyRelationship', rel.id, { source: tableName(rel.sourceId), target: tableName(rel.targetId) });
    }
  }
  return issues;
}

function validateTable(model: PhysicalModel, table: Table, report: Report): void {
  if (!table.columns.some((c) => c.isPrimaryKey)) report('tableWithoutPrimaryKey', table.id, { table: table.name });

  const columnNames = new Set<string>();
  for (const column of table.columns) {
    const params = { table: table.name, column: column.name };
    const name = column.name.trim();
    if (name === '') report('emptyColumnName', table.id, params);
    else if (columnNames.has(name.toLowerCase())) report('duplicateColumnName', table.id, params);
    columnNames.add(name.toLowerCase());

    // A missing type is reported once; type dependent checks need a type.
    if (column.dataType.trim() === '') {
      report('columnWithoutDataType', table.id, params);
      continue;
    }
    if (column.isIdentity && !isIntegerType(column.dataType)) {
      report('identityOnNonInteger', table.id, { ...params, dataType: column.dataType });
    }
    const referenced = referencedColumn(model, column);
    if (referenced && referenced.column.dataType.trim() !== '' && !sameDataType(referenced.column.dataType, column.dataType)) {
      report('foreignKeyTypeMismatch', table.id, {
        ...params,
        dataType: column.dataType,
        referencedTable: referenced.table.name,
        referencedColumn: referenced.column.name,
        referencedDataType: referenced.column.dataType,
      });
    }
  }
}
