'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { PreviewIframe } from '@/components/canvas/PreviewIframe';
import { EditPanel } from '@/components/canvas/EditPanel';
import { CodePanel } from '@/components/canvas/CodePanel';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { PageList } from '@/components/sidebar/PageList';
import { IntentChip } from '@/components/sidebar/IntentChip';
import { ModelPicker } from '@/components/sidebar/ModelPicker';
import { AgentsBadge } from '@/components/agents/AgentsBadge';
import { ProjectSwitcher } from '@/components/sidebar/ProjectSwitcher';
import { AgentDrawer } from '@/components/agents/AgentDrawer';
import { ProjectListModal } from '@/components/projects/ProjectListModal';
import { useProjectSync } from '@/lib/projects/useProjectSync';
import { ExportDialog } from '@/components/export/ExportDialog';
import { AnalyticsPanel } from '@/components/sidebar/AnalyticsPanel';
import { useCollabSync } from '@/lib/collab/use-collab-sync';
import { LiveStatusPill } from './LiveStatusPill';
import { ShareDialog } from './ShareDialog';

export function WorkspaceLayout() {
  const intentPhase = useWorkspaceStore((s) => s.intentPhase);
  const projectId = useWorkspaceStore((s) => s.projectId);
  const sessionCostUsd = useWorkspaceStore((s) => s.sessionCostUsd);
  const [view, setView] = React.useState<'preview' | 'code'>('preview');
  const [criticOpen, setCriticOpen] = React.useState(false);
  const [showProjectModal, setShowProjectModal] = React.useState(!projectId);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);

  useProjectSync();
  const collabHandle = useCollabSync(projectId);

  return (
    <div className="h-screen flex flex-col">
      <header className="h-12 border-b border-[color:var(--color-border)] flex items-center px-4 text-sm">
        <span className="font-semibold">You Design</span>
        <span className="ml-3 text-[color:var(--color-muted)]">Workspace</span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-[color:var(--color-border)]">
          {intentPhase}
        </span>
        <span className="ml-2 text-xs px-2 py-0.5 rounded bg-[color:var(--color-border)] font-mono">
          ${sessionCostUsd.toFixed(4)}
        </span>
        <span className="ml-2">
          <LiveStatusPill />
        </span>
        <button
          onClick={() => setShareOpen(true)}
          className="ml-2 text-xs px-2 py-0.5 rounded border border-[color:var(--color-border)] hover:bg-[color:var(--color-border)]"
          disabled={!projectId}
        >
          Share
        </button>
        <button
          onClick={() => setExportOpen(true)}
          className="ml-2 text-xs px-2 py-0.5 rounded border border-[color:var(--color-border)] hover:bg-[color:var(--color-border)]"
        >
          Export
        </button>
      </header>
      <div className="flex-1 flex min-h-0">
        <aside
          data-testid="sidebar"
          className="w-56 border-r border-[color:var(--color-border)] overflow-y-auto flex flex-col"
        >
          <ProjectSwitcher />
          <PageList />
          <div className="flex-1" />
          <IntentChip />
          <AgentsBadge onOpen={() => setCriticOpen(true)} />
          <ModelPicker />
          <AnalyticsPanel />
        </aside>
        <section
          data-testid="canvas-area"
          className="flex-1 relative bg-white min-w-0 flex flex-col"
        >
          <div className="h-8 border-b border-[color:var(--color-border)] flex items-center text-xs px-2 gap-2 bg-[color:var(--color-bg)]">
            <button
              onClick={() => setView('preview')}
              className={`px-2 py-0.5 rounded ${
                view === 'preview' ? 'bg-[color:var(--color-border)]' : ''
              }`}
            >
              Preview
            </button>
            <button
              onClick={() => setView('code')}
              className={`px-2 py-0.5 rounded ${
                view === 'code' ? 'bg-[color:var(--color-border)]' : ''
              }`}
            >
              Code
            </button>
          </div>
          <div className="flex-1 relative">
            {view === 'preview' ? (
              <PreviewIframe collabProvider={collabHandle?.provider ?? null} />
            ) : (
              <CodePanel />
            )}
            {view === 'preview' && <EditPanel />}
            <AgentDrawer open={criticOpen} onClose={() => setCriticOpen(false)} />
          </div>
        </section>
        <aside
          data-testid="chat-area"
          className="w-80 border-l border-[color:var(--color-border)] flex flex-col min-h-0"
        >
          <ChatPanel />
        </aside>
      </div>

      {showProjectModal && (
        <ProjectListModal onDismiss={() => setShowProjectModal(false)} />
      )}
      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
