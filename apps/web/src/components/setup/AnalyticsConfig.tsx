'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import type { AnalyticsConfig as AnalyticsConfigData } from '@you-design/shared';

interface FormState {
  postHogApiKey: string;
  postHogProjectId: string;
  postHogHost: string;
  deployedBaseUrl: string;
}

const EMPTY: FormState = {
  postHogApiKey: '',
  postHogProjectId: '',
  postHogHost: 'https://app.posthog.com',
  deployedBaseUrl: '',
};

export function AnalyticsConfig() {
  const analyticsConfig = useWorkspaceStore((s) => s.analyticsConfig);
  const setAnalyticsConfig = useWorkspaceStore((s) => s.setAnalyticsConfig);

  const [form, setForm] = React.useState<FormState>(
    analyticsConfig
      ? {
          postHogApiKey: analyticsConfig.postHogApiKey,
          postHogProjectId: analyticsConfig.postHogProjectId,
          postHogHost: analyticsConfig.postHogHost,
          deployedBaseUrl: analyticsConfig.deployedBaseUrl ?? '',
        }
      : EMPTY,
  );
  const [saved, setSaved] = React.useState(false);

  const field = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setSaved(false);
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.postHogApiKey.trim() || !form.postHogProjectId.trim()) return;
    const config: AnalyticsConfigData = {
      postHogApiKey: form.postHogApiKey.trim(),
      postHogProjectId: form.postHogProjectId.trim(),
      postHogHost: form.postHogHost.trim() || 'https://app.posthog.com',
      deployedBaseUrl: form.deployedBaseUrl.trim() || undefined,
    };
    setAnalyticsConfig(config);
    setSaved(true);
  };

  const handleClear = () => {
    setAnalyticsConfig(null);
    setForm(EMPTY);
    setSaved(false);
  };

  const inputClass =
    'w-full border border-[color:var(--color-border)] rounded px-3 py-2 text-sm bg-[color:var(--color-bg)] focus:outline-none';

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4 mt-8">
      <h2 className="text-lg font-semibold">Analytics (PostHog)</h2>
      <p className="text-sm text-[color:var(--color-muted)]">
        Connect PostHog to see real user metrics and enrich Critic feedback with live data. Keys
        stay in your browser.
      </p>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">PostHog Project API Key</label>
        <input
          type="password"
          placeholder="phc_..."
          {...field('postHogApiKey')}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">PostHog Project ID</label>
        <input
          type="text"
          placeholder="12345"
          {...field('postHogProjectId')}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">PostHog Host</label>
        <input
          type="url"
          placeholder="https://app.posthog.com"
          {...field('postHogHost')}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Deployed Base URL (optional)</label>
        <input
          type="url"
          placeholder="https://mysite.github.io"
          {...field('deployedBaseUrl')}
          className={inputClass}
        />
        <p className="text-xs text-[color:var(--color-muted)]">
          Where you deployed the exported HTML. Used to filter analytics by site.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 rounded bg-[color:var(--color-fg)] text-[color:var(--color-bg)] text-sm"
        >
          {saved ? 'Saved ✓' : 'Save'}
        </button>
        {analyticsConfig && (
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 rounded border border-[color:var(--color-border)] text-sm"
          >
            Clear
          </button>
        )}
      </div>
    </form>
  );
}
