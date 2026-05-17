'use client';

import { useState, useRef, useCallback } from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import type { ExportFormat, MotionExportOptions } from '@you-design/shared';
import { injectPostHog } from './inject-posthog';

const API_BASE = 'http://localhost:3001/api/v1';
const POLL_INTERVAL = 2000;
const POLL_TIMEOUT = 5 * 60 * 1000;

export type ExportStatus = 'idle' | 'pending' | 'processing' | 'done' | 'failed';

export function useExport() {
  const pages = useWorkspaceStore((s) => s.pages);
  const projectId = useWorkspaceStore((s) => s.projectId);
  const projectName = useWorkspaceStore((s) => s.projectName);

  const [status, setStatus] = useState<ExportStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef<number>(0);

  const stopPolling = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const exportHtml = useCallback(() => {
    const allPages = Object.values(pages);
    const analyticsConfig = useWorkspaceStore.getState().analyticsConfig;
    const combined = allPages
      .map((p) => {
        const html = analyticsConfig
          ? injectPostHog(p.html, analyticsConfig.postHogApiKey, analyticsConfig.postHogHost, p.path)
          : p.html;
        return `<!-- Page: ${p.path} -->\n${html}`;
      })
      .join('\n\n');
    const blob = new Blob([combined], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName || 'export'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pages, projectName]);

  const pollJob = useCallback((jobId: string) => {
    const poll = async () => {
      if (Date.now() - startedAt.current > POLL_TIMEOUT) {
        setStatus('failed');
        setError('Export timed out after 5 minutes.');
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/exports/${jobId}`);
        const data = (await res.json()) as { status: string; errorMsg?: string | null };

        if (data.status === 'done') {
          setStatus('done');
          const a = document.createElement('a');
          a.href = `${API_BASE}/exports/${jobId}/download`;
          a.click();
        } else if (data.status === 'failed') {
          setStatus('failed');
          setError(data.errorMsg ?? 'Export failed.');
        } else {
          setStatus(data.status as ExportStatus);
          timerRef.current = setTimeout(() => void poll(), POLL_INTERVAL);
        }
      } catch {
        setStatus('failed');
        setError('Could not reach export API.');
      }
    };
    void poll();
  }, []);

  const startExport = useCallback(
    async (format: ExportFormat, motionOptions?: MotionExportOptions) => {
      setError(null);

      if (format === 'html') {
        exportHtml();
        return;
      }

      if (!projectId) {
        setError('Save the project first before exporting.');
        return;
      }

      setStatus('pending');
      startedAt.current = Date.now();

      try {
        const body: { projectId: string; format: ExportFormat; motionOptions?: MotionExportOptions } = {
          projectId,
          format,
        };
        if (motionOptions) {
          body.motionOptions = motionOptions;
        }

        const res = await fetch(`${API_BASE}/exports`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as { jobId?: string; error?: string };
        if (!data.jobId) {
          setStatus('failed');
          setError(data.error ?? 'Failed to create export job.');
          return;
        }
        pollJob(data.jobId);
      } catch {
        setStatus('failed');
        setError('Could not reach export API.');
      }
    },
    [projectId, exportHtml, pollJob],
  );

  const reset = useCallback(() => {
    stopPolling();
    setStatus('idle');
    setError(null);
  }, [stopPolling]);

  return { startExport, status, error, reset };
}
