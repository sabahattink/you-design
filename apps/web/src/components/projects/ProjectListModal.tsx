'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { listProjects, createProject, loadProject } from '@/lib/projects/api';
import type { ProjectMetaType } from '@you-design/shared';

interface Props {
  onDismiss: () => void;
}

export function ProjectListModal({ onDismiss }: Props) {
  const setProjectId = useWorkspaceStore((s) => s.setProjectId);
  const setProjectName = useWorkspaceStore((s) => s.setProjectName);
  const upsertPage = useWorkspaceStore((s) => s.upsertPage);
  const setIntentPhase = useWorkspaceStore((s) => s.setIntentPhase);
  const setIntentContract = useWorkspaceStore((s) => s.setIntentContract);

  const [projects, setProjects] = React.useState<ProjectMetaType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newName, setNewName] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  const openProject = async (id: string, name: string) => {
    const full = await loadProject(id);
    setProjectId(id);
    setProjectName(name);
    setIntentPhase(full.intentPhase as 'collecting' | 'contracted' | 'building');
    if (full.intentContract) setIntentContract(full.intentContract);
    for (const p of full.pages) {
      upsertPage({ path: p.path, title: p.title, html: p.html, updatedAt: new Date().toISOString() });
    }
    onDismiss();
  };

  const handleCreate = async () => {
    const name = newName.trim() || 'Untitled';
    setCreating(true);
    try {
      const meta = await createProject(name);
      setProjectId(meta.id);
      setProjectName(meta.name);
      onDismiss();
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded-lg shadow-2xl w-96 max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-[color:var(--color-border)]">
          <h2 className="font-semibold text-sm">Your Projects</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading && <p className="text-xs p-2 text-[color:var(--color-muted)]">Loading…</p>}
          {!loading && projects.length === 0 && (
            <p className="text-xs p-2 text-[color:var(--color-muted)]">No projects yet. Create one below.</p>
          )}
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => void openProject(p.id, p.name)}
              className="w-full text-left px-3 py-2 rounded hover:bg-[color:var(--color-border)] text-sm"
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-[color:var(--color-muted)]">
                {p.pageCount} page{p.pageCount !== 1 ? 's' : ''}
              </div>
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-[color:var(--color-border)] flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
            placeholder="New project name…"
            className="flex-1 border border-[color:var(--color-border)] rounded px-2 py-1 text-sm bg-[color:var(--color-bg)]"
          />
          <button
            onClick={() => void handleCreate()}
            disabled={creating}
            className="px-3 py-1 rounded bg-[color:var(--color-fg)] text-[color:var(--color-bg)] text-sm disabled:opacity-50"
          >
            {creating ? '…' : 'Create'}
          </button>
        </div>

        <div className="px-3 pb-3">
          <button
            onClick={onDismiss}
            className="w-full text-xs text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
          >
            Continue without saving
          </button>
        </div>
      </div>
    </div>
  );
}
