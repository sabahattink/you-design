'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import type { Severity } from '@you-design/shared';

interface Props {
  onOpen: () => void;
}

const EMPTY_REPORTS: never[] = [];
const ORDER: Severity[] = ['critical', 'warning', 'info'];
const DOT: Record<Severity, string> = {
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-sky-500',
};

export function CriticBadge({ onOpen }: Props) {
  const reports = useWorkspaceStore((s) => s.criticReports[s.currentPath] ?? EMPTY_REPORTS);
  const isCriticRunning = useWorkspaceStore((s) => s.agentsRunning['critic'] ?? false);

  const openIssues = React.useMemo(
    () => reports.flatMap((r) => r.issues).filter((i) => i.status === 'open'),
    [reports],
  );
  const highestSeverity: Severity | null = React.useMemo(() => {
    for (const sev of ORDER) {
      if (openIssues.some((i) => i.severity === sev)) return sev;
    }
    return null;
  }, [openIssues]);

  return (
    <button
      onClick={onOpen}
      className="p-2 border-t border-[color:var(--color-border)] flex items-center justify-between text-xs hover:bg-[color:var(--color-border)] w-full text-left"
    >
      <span className="uppercase tracking-wide text-[color:var(--color-muted)]">
        Critic
      </span>
      <span className="flex items-center gap-2">
        {isCriticRunning && (
          <span className="italic text-[color:var(--color-muted)]">running</span>
        )}
        {highestSeverity && (
          <span
            className={`inline-block w-2 h-2 rounded-full ${DOT[highestSeverity]}`}
            aria-hidden
          />
        )}
        <span className="text-[color:var(--color-muted)]">
          {openIssues.length}
        </span>
      </span>
    </button>
  );
}
