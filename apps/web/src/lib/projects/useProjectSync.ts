'use client';

import { useEffect, useRef } from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { loadProject, saveProject } from './api';
import type { ProjectPatchType } from '@you-design/shared';

const DEBOUNCE_MS = 1500;

export function useProjectSync(): void {
  const projectId = useWorkspaceStore((s) => s.projectId);
  const intentPhase = useWorkspaceStore((s) => s.intentPhase);
  const intentContract = useWorkspaceStore((s) => s.intentContract);
  const pages = useWorkspaceStore((s) => s.pages);
  const projectName = useWorkspaceStore((s) => s.projectName);
  const upsertPage = useWorkspaceStore((s) => s.upsertPage);
  const setIntentPhase = useWorkspaceStore((s) => s.setIntentPhase);
  const setIntentContract = useWorkspaceStore((s) => s.setIntentContract);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  // Load from API on mount when projectId is set
  useEffect(() => {
    if (!projectId || loadedRef.current) return;
    loadedRef.current = true;

    loadProject(projectId)
      .then((full) => {
        setIntentPhase(full.intentPhase as 'collecting' | 'contracted' | 'building');
        if (full.intentContract) setIntentContract(full.intentContract);
        for (const p of full.pages) {
          upsertPage({
            id: p.path,
            path: p.path,
            title: p.title,
            html: p.html,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      })
      .catch(() => {
        // API unreachable — continue with localStorage data
      });
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced auto-save on state changes
  useEffect(() => {
    if (!projectId) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const patch: ProjectPatchType = {
        name: projectName || undefined,
        intentPhase,
        intentContract: intentContract ?? undefined,
        pages: Object.values(pages).map((p) => ({
          path: p.path,
          title: p.title,
          html: p.html,
        })),
      };

      saveProject(projectId, patch).catch(() => {
        // Silently ignore — localStorage still intact
      });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [projectId, projectName, intentPhase, intentContract, pages]);
}
