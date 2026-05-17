'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import type { AnalyticsSummary } from '@you-design/shared';

const API_BASE = 'http://localhost:3001/api/v1';
const CACHE_TTL_MS = 5 * 60 * 1000;

export function AnalyticsPanel() {
  const analyticsConfig = useWorkspaceStore((s) => s.analyticsConfig);
  const analyticsCache = useWorkspaceStore((s) => s.analyticsCache);
  const setAnalyticsCache = useWorkspaceStore((s) => s.setAnalyticsCache);
  const setCurrentPath = useWorkspaceStore((s) => s.setCurrentPath);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!analyticsConfig) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        postHogApiKey: analyticsConfig.postHogApiKey,
        postHogProjectId: analyticsConfig.postHogProjectId,
        postHogHost: analyticsConfig.postHogHost,
        days: '7',
      });
      const res = await fetch(`${API_BASE}/analytics/summary?${params}`);
      const data = (await res.json()) as AnalyticsSummary & { error?: string; message?: string };
      if (data.error) {
        setError(data.message ?? data.error);
      } else {
        setAnalyticsCache({ ...data, fetchedAt: Date.now() });
      }
    } catch {
      setError('Could not reach analytics API.');
    } finally {
      setLoading(false);
    }
  }, [analyticsConfig, setAnalyticsCache]);

  React.useEffect(() => {
    if (!analyticsConfig) return;
    const stale =
      !analyticsCache ||
      Date.now() - analyticsCache.fetchedAt > CACHE_TTL_MS;
    if (stale) void fetchData();
  }, [analyticsConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!analyticsConfig) {
    return (
      <div className="p-2 border-t border-[color:var(--color-border)] text-xs text-[color:var(--color-muted)]">
        <a href="/setup" className="hover:underline">Configure analytics →</a>
      </div>
    );
  }

  return (
    <div className="border-t border-[color:var(--color-border)] p-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
          Analytics
        </span>
        <button
          onClick={() => void fetchData()}
          disabled={loading}
          className="text-[10px] text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)] disabled:opacity-50"
          aria-label="Refresh analytics"
        >
          {loading ? '⟳' : '↺'}
        </button>
      </div>

      {error && (
        <p className="text-[10px] text-red-500 break-words">{error}</p>
      )}

      {analyticsCache && !error && (
        <div className="flex flex-col gap-0.5">
          {analyticsCache.pages.slice(0, 5).map((p) => (
            <button
              key={p.path}
              onClick={() => setCurrentPath(p.path)}
              className="flex items-center justify-between text-[10px] hover:bg-[color:var(--color-border)] px-1 rounded w-full text-left"
            >
              <span className="truncate text-[color:var(--color-muted)]">{p.path}</span>
              <span className="shrink-0 text-[color:var(--color-fg)]">{p.views.toLocaleString()} views</span>
            </button>
          ))}
          <div className="text-[10px] text-[color:var(--color-muted)] mt-1">
            Total: {analyticsCache.totalViews.toLocaleString()} · {analyticsCache.period}
          </div>
        </div>
      )}
    </div>
  );
}
