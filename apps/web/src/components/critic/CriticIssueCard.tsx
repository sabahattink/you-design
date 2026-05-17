'use client';

import * as React from 'react';
import type { CriticIssue } from '@you-design/shared';
import { useWorkspaceStore } from '@/lib/workspace/store';

interface Props {
  reportId: string;
  issue: CriticIssue;
  onFix?: (issue: CriticIssue) => void;
}

const SEVERITY_STYLES: Record<
  CriticIssue['severity'],
  { border: string; tag: string; label: string }
> = {
  critical: { border: 'border-red-500', tag: 'bg-red-500 text-white', label: 'CRITICAL' },
  warning: { border: 'border-amber-500', tag: 'bg-amber-500 text-white', label: 'WARNING' },
  info: { border: 'border-sky-500', tag: 'bg-sky-500 text-white', label: 'INFO' },
};

const CATEGORY_LABELS: Record<CriticIssue['category'], string> = {
  intent: 'Intent',
  a11y: 'A11y',
  domain: 'Domain',
  copy: 'Copy',
  craft: 'Craft',
};

export function CriticIssueCard({ reportId, issue, onFix }: Props) {
  const updateIssueStatus = useWorkspaceStore((s) => s.updateIssueStatus);
  const setSelected = useWorkspaceStore((s) => s.setSelectedElement);
  const style = SEVERITY_STYLES[issue.severity];

  if (issue.status === 'dismissed') return null;

  return (
    <div
      className={`border-l-4 ${style.border} bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded p-3 text-sm flex flex-col gap-2 ${
        issue.status === 'fixed' ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className={`px-1.5 py-0.5 rounded font-semibold tracking-wider ${style.tag}`}>
          {style.label}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-[color:var(--color-border)]">
          {CATEGORY_LABELS[issue.category]}
        </span>
        {issue.elementId && (
          <button
            onClick={() => issue.elementId && setSelected(issue.elementId)}
            className="text-[color:var(--color-muted)] underline hover:text-[color:var(--color-fg)]"
            title={`Select ${issue.elementId} on canvas`}
          >
            #{issue.elementId}
          </button>
        )}
        {issue.status === 'fixed' && <span className="text-green-600 text-xs">✓ fixed</span>}
      </div>
      <div>{issue.message}</div>
      {issue.suggestion && (
        <div className="text-xs text-[color:var(--color-muted)] italic">
          Suggested: {issue.suggestion}
        </div>
      )}
      {issue.status === 'open' && (
        <div className="flex gap-2 mt-1">
          {onFix && (
            <button
              onClick={() => onFix(issue)}
              className="px-2 py-1 text-xs rounded bg-[color:var(--color-fg)] text-[color:var(--color-bg)]"
            >
              Fix
            </button>
          )}
          <button
            onClick={() => updateIssueStatus(reportId, issue.id, 'dismissed')}
            className="px-2 py-1 text-xs rounded border border-[color:var(--color-border)]"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
