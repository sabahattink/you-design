'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import {
  listProjects,
  createProject,
  loadProject,
  deleteProject,
} from '@/lib/projects/api';
import type { ProjectMetaType } from '@you-design/shared';

export function ProjectSwitcher() {
  const projectId = useWorkspaceStore((s) => s.projectId);
  const projectName = useWorkspaceStore((s) => s.projectName);
  const setProjectId = useWorkspaceStore((s) => s.setProjectId);
  const setProjectName = useWorkspaceStore((s) => s.setProjectName);
  const reset = useWorkspaceStore((s) => s.reset);
  const upsertPage = useWorkspaceStore((s) => s.upsertPage);
  const setIntentPhase = useWorkspaceStore((s) => s.setIntentPhase);
  const setIntentContract = useWorkspaceStore((s) => s.setIntentContract);

  const [open, setOpen] = React.useState(false);
  const [projects, setProjects] = React.useState<ProjectMetaType[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [newName, setNewName] = React.useState('');

  const loadList = React.useCallback(async () => {
    try {
      setProjects(await listProjects());
    } catch {
      // API unreachable
    }
  }, []);

  const handleOpen = () => {
    setOpen(true);
    void loadList();
  };

  const switchTo = async (id: string, name: string) => {
    try {
      const full = await loadProject(id);
      reset();
      setProjectId(id);
      setProjectName(name);
      setIntentPhase(full.intentPhase as 'collecting' | 'contracted' | 'building');
      if (full.intentContract) setIntentContract(full.intentContract);
      for (const p of full.pages) {
        upsertPage({ path: p.path, title: p.title, html: p.html, updatedAt: new Date().toISOString() });
      }
    } finally {
      setOpen(false);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim() || 'Untitled';
    try {
      const meta = await createProject(name);
      reset();
      setProjectId(meta.id);
      setProjectName(meta.name);
    } finally {
      setCreating(false);
      setNewName('');
      setOpen(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this project?')) return;
    await deleteProject(id);
    if (id === projectId) {
      reset();
      setProjectId('');
      setProjectName('');
    }
    void loadList();
  };

  return (
    <div className="relative border-b border-[color:var(--color-border)]">
      <button
        onClick={handleOpen}
        className="w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-[color:var(--color-border)]"
      >
        <span className="font-medium truncate">{projectName || 'No project'}</span>
        <span className="text-[color:var(--color-muted)]">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 w-full bg-[color:var(--color-bg)] border border-[color:var(--color-border)] shadow-lg rounded-b text-xs">
          {projects.map((p) => (
            <div
              key={p.id}
              onClick={() => void switchTo(p.id, p.name)}
              className={`px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-[color:var(--color-border)] ${p.id === projectId ? 'font-semibold' : ''}`}
            >
              <span className="truncate">{p.name}</span>
              <button
                onClick={(e) => void handleDelete(e, p.id)}
                className="text-red-400 hover:text-red-600 ml-2"
                aria-label="Delete project"
              >
                ✕
              </button>
            </div>
          ))}

          {creating ? (
            <div className="px-3 py-2 flex gap-1">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
                placeholder="Project name"
                className="flex-1 border border-[color:var(--color-border)] rounded px-1 bg-[color:var(--color-bg)]"
              />
              <button onClick={() => void handleCreate()} className="px-2 py-0.5 rounded bg-[color:var(--color-fg)] text-[color:var(--color-bg)]">
                Create
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full px-3 py-2 text-left hover:bg-[color:var(--color-border)] text-[color:var(--color-muted)]"
            >
              + New project
            </button>
          )}

          <button
            onClick={() => setOpen(false)}
            className="w-full px-3 py-2 text-center hover:bg-[color:var(--color-border)] text-[color:var(--color-muted)] border-t border-[color:var(--color-border)]"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
