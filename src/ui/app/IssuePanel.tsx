import type { ValidationIssue } from '../../domain/validation/issues';
import { useDocumentStore } from '../store/documentStore';
import { useUiStore } from '../store/uiStore';
import { useT } from '../i18n/language';

/** List of blockers; a click jumps to the affected element (spec 4.1). */
export function IssuePanel() {
  const t = useT();
  const issueList = useUiStore((s) => s.issueList);
  if (!issueList) return null;

  const jump = (issue: ValidationIssue) => {
    const ui = useUiStore.getState();
    if (ui.view !== issue.view) ui.setView(issue.view);
    const relationship = useDocumentStore.getState().doc[issue.view].relationships.find((r) => r.id === issue.elementId);
    ui.select({ kind: relationship ? 'edge' : 'node', id: issue.elementId });
    // Relationships are centered on their child node.
    ui.requestFocus(relationship ? relationship.targetId : issue.elementId);
  };

  return (
    <aside className="issue-panel" data-testid="issue-panel">
      <div className="issue-head">
        <strong>{t(issueList.context === 'transform' ? 'issues.transformTitle' : 'issues.exportTitle', { count: issueList.issues.length })}</strong>
        <button className="small" onClick={() => useUiStore.getState().showIssues(null)} aria-label={t('common.close')}>
          ✕
        </button>
      </div>
      <ul>
        {issueList.issues.map((issue, i) => (
          <li key={i}>
            <button className="link" onClick={() => jump(issue)}>
              {t(`issue.${issue.code}`, issue.params)}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
