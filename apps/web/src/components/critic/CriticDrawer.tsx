'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { useDesignerSend } from '@/lib/chat/useDesignerSend';
import { CriticIssueCard } from './CriticIssueCard';
import type { CriticIssue, Severity } from '@you-design/shared';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Filter = 'all' | Severity;

export function CriticDrawer({ open, onClose }: Props) {
  const currentPath = useWorkspaceStore((s) => s.currentPath);
  const reports = useWorkspaceStore((s) => s.criticReports[s.currentPath] ?? []);
  const isCriticRunning = useWorkspaceStore((s) => s.isCriticRunning);
  const updateIssueStatus = useWorkspaceStore((s) => s.updateIssueStatus);
  const sendBuild = useDesignerSend();

  const [filter, setFilter] = React.useState<Filter>('all');

  const allIssues: Array<{ reportId: string; issue: CriticIssue }> = React.useMemo(() => {
    const items: Array<{ reportId: string; issue: CriticIssue }> = [];
    for (const r of reports) {
      for (const issue of r.issues) {
        items.push({ reportId: r.id, issue });
      }
    }
    return items.filter((x) => filter === 'all' || x.issue.severity === filter);
  }, [reports, filter]);

  const onFix = async (reportId: string, issue: CriticIssue) => {
    const elementHint = issue.elementId ? ` Target element data-yd-id: ${issue.elementId}.` : '';
    const suggestionHint = issue.suggestion ? ` Suggested: ${issue.suggestion}` : '';
    const msg = `Fix this issue on ${currentPath}: ${issue.message}.${elementHint}${suggestionHint}`;
    await sendBuild(msg);
    updateIssueStatus(reportId, issue.id, 'fixed');
  };

  if (!open) return null;

  return (
    <aside className="absolute right-0 top-0 h-full w-96 z-20 bg-[color:var(--color-bg)] border-l border-[color:var(--color-border)] shadow-xl flex flex-col">
      <div className="h-10 flex items-center justify-between px-3 border-b border-[color:var(--color-border)]">
        <div className="text-sm font-medium">
          Critic{' '}
          <span className="text-[color:var(--color-muted)] text-xs">({currentPath})</span>
        </div>
        <button
          onClick={onClose}
          className="text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
          aria-label="Close critic drawer"
        >
          ✕
        </button>
      </div>
      <div className="flex gap-1 px-3 py-2 text-xs border-b border-[color:var(--color-border)]">
        {(['all', 'critical', 'warning', 'info'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-0.5 rounded ${
              filter === f
                ? 'bg-[color:var(--color-fg)] text-[color:var(--color-bg)]'
                : 'border border-[color:var(--color-border)]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {isCriticRunning && (
          <div className="text-xs italic text-[color:var(--color-muted)]">
            critic reviewing...
          </div>
        )}
        {allIssues.length === 0 && !isCriticRunning && (
          <div className="text-xs italic text-[color:var(--color-muted)]">
            No issues to show for the current page yet.
          </div>
        )}
        {allIssues.map(({ reportId, issue }) => (
          <CriticIssueCard
            key={`${reportId}:${issue.id}`}
            reportId={reportId}
            issue={issue}
            onFix={(i) => onFix(reportId, i)}
          />
        ))}
      </div>
    </aside>
  );
}
