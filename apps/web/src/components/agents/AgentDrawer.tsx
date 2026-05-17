'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { useDesignerSend } from '@/lib/chat/useDesignerSend';
import { CriticIssueCard } from '@/components/critic/CriticIssueCard';
import { runAgent } from '@/lib/chat/agent-dispatch';
import { COPYWRITER_SYSTEM_PROMPT, COPYWRITER_TOOLS } from '@/lib/chat/copywriter-agent';
import { A11Y_SYSTEM_PROMPT, A11Y_TOOLS } from '@/lib/chat/a11y-agent';
import { DEV_SYSTEM_PROMPT, DEV_TOOLS } from '@/lib/chat/dev-agent';
import type { AgentType, CriticIssue } from '@you-design/shared';

interface Props {
  open: boolean;
  onClose: () => void;
}

const EMPTY_REPORTS: never[] = [];

const AGENT_TABS: Array<{ id: AgentType; label: string; auto: boolean }> = [
  { id: 'critic', label: 'Critic', auto: true },
  { id: 'copywriter', label: 'Copywriter', auto: false },
  { id: 'a11y', label: 'A11y', auto: false },
  { id: 'dev', label: 'Dev', auto: false },
];

export function AgentDrawer({ open, onClose }: Props) {
  const currentPath = useWorkspaceStore((s) => s.currentPath);
  const reports = useWorkspaceStore((s) => s.criticReports[s.currentPath] ?? EMPTY_REPORTS);
  const agentsRunning = useWorkspaceStore((s) => s.agentsRunning);
  const updateIssueStatus = useWorkspaceStore((s) => s.updateIssueStatus);
  const pages = useWorkspaceStore((s) => s.pages);
  const sendBuild = useDesignerSend();

  const [activeTab, setActiveTab] = React.useState<AgentType>('critic');

  const tabReports = React.useMemo(
    () => reports.filter((r) => (r.agentType ?? 'critic') === activeTab),
    [reports, activeTab],
  );

  const allIssues = React.useMemo(
    () => tabReports.flatMap((r) => r.issues.map((issue) => ({ reportId: r.id, issue }))),
    [tabReports],
  );

  const isRunning = agentsRunning[activeTab] ?? false;

  const handleFix = async (reportId: string, issue: CriticIssue) => {
    const elementHint = issue.elementId ? ` Target element data-yd-id: ${issue.elementId}.` : '';
    const suggestionHint = issue.suggestion ? ` Suggested: ${issue.suggestion}` : '';
    const msg = `Fix this issue on ${currentPath}: ${issue.message}.${elementHint}${suggestionHint}`;
    await sendBuild(msg);
    updateIssueStatus(reportId, issue.id, 'fixed');
  };

  const handleRunAgent = () => {
    const page = pages[currentPath];
    if (!page) return;
    if (activeTab === 'copywriter') {
      void runAgent('copywriter', COPYWRITER_SYSTEM_PROMPT, COPYWRITER_TOOLS, currentPath, page.html);
    } else if (activeTab === 'a11y') {
      void runAgent('a11y', A11Y_SYSTEM_PROMPT, A11Y_TOOLS, currentPath, page.html);
    } else if (activeTab === 'dev') {
      void runAgent('dev', DEV_SYSTEM_PROMPT, DEV_TOOLS, currentPath, page.html);
    }
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  if (!open) return null;

  return (
    <aside className="absolute right-0 top-0 h-full w-96 z-20 bg-[color:var(--color-bg)] border-l border-[color:var(--color-border)] shadow-xl flex flex-col">
      <div className="h-10 flex items-center justify-between px-3 border-b border-[color:var(--color-border)]">
        <div className="text-sm font-medium">Agents</div>
        <button
          onClick={onClose}
          className="text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
          aria-label="Close agent drawer"
        >
          ✕
        </button>
      </div>

      <div className="flex border-b border-[color:var(--color-border)] text-xs">
        {AGENT_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 border-r border-[color:var(--color-border)] last:border-r-0 ${
              activeTab === tab.id
                ? 'bg-[color:var(--color-border)] font-semibold'
                : 'hover:bg-[color:var(--color-border)]/50'
            }`}
          >
            {tab.label}
            {tab.auto && (
              <span className="ml-1 text-[10px] text-[color:var(--color-muted)]">auto</span>
            )}
          </button>
        ))}
      </div>

      {!AGENT_TABS.find((t) => t.id === activeTab)?.auto && (
        <div className="px-3 py-2 border-b border-[color:var(--color-border)]">
          <button
            onClick={handleRunAgent}
            disabled={isRunning}
            className="w-full px-3 py-1.5 text-xs rounded bg-[color:var(--color-fg)] text-[color:var(--color-bg)] disabled:opacity-50"
          >
            {isRunning ? `Running ${activeTab}…` : `Run ${capitalize(activeTab)}`}
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {isRunning && (
          <div className="text-xs italic text-[color:var(--color-muted)]">
            {activeTab} reviewing…
          </div>
        )}
        {allIssues.length === 0 && !isRunning && (
          <div className="text-xs italic text-[color:var(--color-muted)]">
            {AGENT_TABS.find((t) => t.id === activeTab)?.auto
              ? 'No issues yet for this page.'
              : `Click "Run ${capitalize(activeTab)}" to analyse this page.`}
          </div>
        )}
        {allIssues.map(({ reportId, issue }) => (
          <CriticIssueCard
            key={`${reportId}:${issue.id}`}
            reportId={reportId}
            issue={issue}
            onFix={(i) => void handleFix(reportId, i)}
          />
        ))}
      </div>
    </aside>
  );
}
