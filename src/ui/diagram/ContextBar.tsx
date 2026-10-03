import { Panel } from '@xyflow/react';
import { CARDINALITIES, type Relationship } from '../../domain/model/common';
import type { Generalization } from '../../domain/model/logical';
import { resetAnchors, swapDirection, updateRelationship } from '../../domain/operations/relationshipOperations';
import { removeSubtype, updateGeneralization } from '../../domain/operations/logicalOperations';
import { useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';
import { useT } from '../i18n/language';
import { deleteSelection } from '../commands/editCommands';
import { changeCardinality } from './edges/RelationshipEdge';
import { CardinalityIcon } from './CardinalityIcon';

/** Context bar for the selected relationship or generalization (spec 3.3). */
export function ContextBar() {
  const selection = useUiStore((s) => s.selection);
  const view = useUiStore((s) => s.view);
  const doc = useDocumentStore((s) => s.doc);
  if (!selection) return null;

  const model = doc[view];
  const relationship = model.relationships.find((r) => r.id === selection.id);
  if (relationship) return <RelationshipBar relationship={relationship} />;

  if (view !== 'logical') return null;
  const [generalizationId, role, subtypeId] = selection.id.split(':');
  const generalization = doc.logical.generalizations.find((g) => g.id === generalizationId);
  if (!generalization) return null;
  return <GeneralizationBar generalization={generalization} subtypeId={role === 'sub' ? subtypeId : undefined} />;
}

function nodeName(id: string): string {
  const { doc } = useDocumentStore.getState();
  const node = [...doc.logical.entities, ...doc.physical.tables].find((n) => n.id === id);
  return node?.name || '?';
}

function RelationshipBar({ relationship }: { relationship: Relationship }) {
  const t = useT();
  const view = useUiStore((s) => s.view);
  const commit = useDocumentStore((s) => s.commit);
  const ends = [
    { end: 'source' as const, name: nodeName(relationship.sourceId), value: relationship.sourceCardinality },
    { end: 'target' as const, name: nodeName(relationship.targetId), value: relationship.targetCardinality },
  ];
  return (
    <Panel position="top-center" className="context-bar" data-testid="context-bar">
      {ends.map(({ end, name, value }) => (
        <div key={end} className="context-group" role="group" aria-label={name}>
          <span className="context-label">{name}</span>
          {CARDINALITIES.map((c) => (
            <button
              key={c}
              className={c === value ? 'icon-button active' : 'icon-button'}
              title={t(`cardinality.${c}`)}
              aria-pressed={c === value}
              data-testid={`set-${end}-${c}`}
              onClick={() => changeCardinality(relationship, end, c)}
            >
              <CardinalityIcon cardinality={c} />
            </button>
          ))}
        </div>
      ))}
      <div className="context-group">
        <label className="toggle">
          <input
            type="checkbox"
            checked={relationship.isIdentifying}
            data-testid="toggle-identifying"
            onChange={(e) => commit(view, (m) => updateRelationship(m, relationship.id, { isIdentifying: e.target.checked }))}
          />
          {t('relationship.identifying')}
        </label>
        <button onClick={() => commit(view, (m) => swapDirection(m, relationship.id))} title={t('relationship.swapHint')}>
          ⇄ {t('relationship.swap')}
        </button>
        {(relationship.sourceAnchor || relationship.targetAnchor) && (
          <button onClick={() => commit(view, (m) => resetAnchors(m, relationship.id))}>{t('relationship.resetAnchors')}</button>
        )}
        <button className="danger" onClick={deleteSelection}>
          {t('common.delete')}
        </button>
      </div>
    </Panel>
  );
}

function GeneralizationBar({ generalization, subtypeId }: { generalization: Generalization; subtypeId: string | undefined }) {
  const t = useT();
  const commit = useDocumentStore((s) => s.commit);
  const select = useUiStore((s) => s.select);
  return (
    <Panel position="top-center" className="context-bar" data-testid="context-bar">
      <div className="context-group">
        <span className="context-label">{t('generalization.title', { name: nodeName(generalization.supertypeId) })}</span>
        <label className="toggle">
          <input
            type="checkbox"
            checked={generalization.isComplete}
            data-testid="toggle-complete"
            onChange={(e) => commit('logical', (m) => updateGeneralization(m, generalization.id, { isComplete: e.target.checked }))}
          />
          {t('generalization.complete')}
        </label>
        {subtypeId && (
          <button
            onClick={() => {
              commit('logical', (m) => removeSubtype(m, generalization.id, subtypeId));
              select(null);
            }}
          >
            {t('generalization.removeSubtype', { name: nodeName(subtypeId) })}
          </button>
        )}
        <button
          className="danger"
          onClick={() => {
            useUiStore.getState().select({ kind: 'node', id: generalization.id });
            deleteSelection();
          }}
        >
          {t('generalization.delete')}
        </button>
      </div>
    </Panel>
  );
}
