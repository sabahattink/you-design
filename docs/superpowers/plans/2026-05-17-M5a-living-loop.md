# M5a Living Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the design→deploy→analytics loop: inject PostHog tracking into HTML exports, pull real user metrics via PostHog API, show them in a sidebar panel, and feed them into the Critic agent as context.

**Architecture:** Pull-based PostHog integration — no deploy infrastructure needed. User configures PostHog keys in /setup, exports HTML (script auto-injected), deploys anywhere. You Design pulls metrics from PostHog API on demand and caches them in Zustand. The Critic receives a plain-text analytics summary appended to its system prompt.

**Tech Stack:** Zod (shared types), Zustand (config + cache), PostHog Events API (REST fetch), React (AnalyticsPanel, AnalyticsConfig), Fastify (analytics proxy route).

---

## File Map

| Action | File                                                    |
| ------ | ------------------------------------------------------- |
| Create | `packages/shared/src/analytics.ts`                      |
| Modify | `packages/shared/src/index.ts`                          |
| Modify | `apps/web/src/lib/workspace/store.ts`                   |
| Create | `apps/web/src/components/setup/AnalyticsConfig.tsx`     |
| Modify | `apps/web/src/app/setup/page.tsx`                       |
| Create | `apps/web/src/lib/export/inject-posthog.ts`             |
| Modify | `apps/web/src/lib/export/useExport.ts`                  |
| Modify | `apps/api/src/lib/html-inject.ts`                       |
| Create | `apps/api/src/routes/analytics.ts`                      |
| Modify | `apps/api/src/server.ts`                                |
| Create | `apps/web/src/components/sidebar/AnalyticsPanel.tsx`    |
| Modify | `apps/web/src/components/workspace/WorkspaceLayout.tsx` |
| Modify | `apps/web/src/lib/chat/critic-agent.ts`                 |
| Modify | `apps/web/src/lib/chat/critic-dispatch.ts`              |

---

## Task 1: Shared — analytics types

**Files:**

- Create: `packages/shared/src/analytics.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create `packages/shared/src/analytics.ts`**

```typescript
import { z } from 'zod';

export const AnalyticsSummary = z.object({
  pages: z.array(
    z.object({
      path: z.string(),
      views: z.number().int(),
      clicks: z.number().int(),
      ctr: z.number(),
    }),
  ),
  totalViews: z.number().int(),
  period: z.string(),
  fetchedAt: z.number(),
});
export type AnalyticsSummary = z.infer<typeof AnalyticsSummary>;

export const AnalyticsConfig = z.object({
  postHogApiKey: z.string().min(1),
  postHogProjectId: z.string().min(1),
  postHogHost: z.string().url().default('https://app.posthog.com'),
  deployedBaseUrl: z.string().url().optional(),
});
export type AnalyticsConfig = z.infer<typeof AnalyticsConfig>;
```

- [ ] **Step 2: Append to `packages/shared/src/index.ts`**

```typescript
export * from './analytics.js';
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/shared typecheck
git add packages/shared/src/analytics.ts packages/shared/src/index.ts
git commit -m "feat(shared): AnalyticsConfig + AnalyticsSummary Zod schemas"
```

---

## Task 2: Store — analyticsConfig + analyticsCache

**Files:**

- Modify: `apps/web/src/lib/workspace/store.ts`

- [ ] **Step 1: Read `apps/web/src/lib/workspace/store.ts` then apply changes**

Add to imports at top:

```typescript
import type { AnalyticsConfig, AnalyticsSummary } from '@you-design/shared';
```

Add to `WorkspaceState` interface (after `agentsRunning`):

```typescript
analyticsConfig: AnalyticsConfig | null;
analyticsCache: AnalyticsSummary | null;
```

Add to `WorkspaceActions` (after `setAgentRunning`):

```typescript
  setAnalyticsConfig: (config: AnalyticsConfig | null) => void;
  setAnalyticsCache: (data: AnalyticsSummary | null) => void;
```

Add to `INITIAL` (after `agentsRunning: {}`):

```typescript
  analyticsConfig: null,
  analyticsCache: null,
```

Add to `create` block (after `setAgentRunning`):

```typescript
      setAnalyticsConfig: (analyticsConfig) => set({ analyticsConfig }),
      setAnalyticsCache: (analyticsCache) => set({ analyticsCache }),
```

Add `analyticsConfig` to `partialize` (persisted — user config):

```typescript
        analyticsConfig: state.analyticsConfig,
```

Do NOT add `analyticsCache` to partialize (ephemeral).

- [ ] **Step 2: Typecheck + commit**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/web typecheck
git add apps/web/src/lib/workspace/store.ts
git commit -m "feat(web): analyticsConfig + analyticsCache in workspace store"
```

---

## Task 3: Setup UI — AnalyticsConfig form

**Files:**

- Create: `apps/web/src/components/setup/AnalyticsConfig.tsx`
- Modify: `apps/web/src/app/setup/page.tsx`

- [ ] **Step 1: Create `apps/web/src/components/setup/AnalyticsConfig.tsx`**

```typescript
'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import type { AnalyticsConfig } from '@you-design/shared';

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
    const config: AnalyticsConfig = {
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
        Connect PostHog to see real user metrics in your workspace and enrich Critic
        feedback with live data. Keys stay in your browser.
      </p>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">PostHog Project API Key</label>
        <input type="password" placeholder="phc_..." {...field('postHogApiKey')} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">PostHog Project ID</label>
        <input type="text" placeholder="12345" {...field('postHogProjectId')} className={inputClass} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">PostHog Host</label>
        <input type="url" placeholder="https://app.posthog.com" {...field('postHogHost')} className={inputClass} />
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
```

- [ ] **Step 2: Update `apps/web/src/app/setup/page.tsx`**

```typescript
import { ProviderConfig } from '@/components/setup/ProviderConfig';
import { AnalyticsConfig } from '@/components/setup/AnalyticsConfig';

export const metadata = {
  title: 'Setup',
};

export default function SetupPage() {
  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Setup</h1>
        <p className="text-[color:var(--color-muted)] mb-8">
          Add the LLM providers and models you want to use. Local-first, BYOK —
          your keys never leave this browser and the API server you run.
        </p>
        <ProviderConfig />
        <AnalyticsConfig />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/web typecheck
git add apps/web/src/components/setup/AnalyticsConfig.tsx apps/web/src/app/setup/page.tsx
git commit -m "feat(web): AnalyticsConfig form on setup page"
```

---

## Task 4: PostHog injection — web + API

**Files:**

- Create: `apps/web/src/lib/export/inject-posthog.ts`
- Modify: `apps/web/src/lib/export/useExport.ts`
- Modify: `apps/api/src/lib/html-inject.ts`

- [ ] **Step 1: Create `apps/web/src/lib/export/inject-posthog.ts`**

```typescript
export function injectPostHog(
  html: string,
  postHogKey: string,
  postHogHost: string,
  pagePath: string,
): string {
  const script = `<script>
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]);t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}var u=t.createElement("script");u.type="text/javascript";u.async=!0;u.src=s.api_host+"/static/array.js";var c=t.getElementsByTagName("script")[0];c.parentNode.insertBefore(u,c);var d=e;a!==void 0&&(d=e[a]=[]);d.toString=function(t){return"undefined"!=typeof d&&!0!==t?d:""+(a?a:"posthog")};o=["capture","identify","alias","set_config","unregister","opt_out_capturing","has_opted_out_capturing","opt_in_capturing","reset","isFeatureEnabled","onFeatureFlags","addGroup","setPersonPropertiesForFlags","reloadFeatureFlags","group"];for(n=0;n<o.length;n++)g(d,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init('${postHogKey}',{api_host:'${postHogHost}',capture_pageview:false});
posthog.capture('$pageview',{page_path:'${pagePath}'});
</script>`;

  if (html.includes('</head>')) {
    return html.replace('</head>', `${script}</head>`);
  }
  if (html.includes('<body>')) {
    return html.replace('<body>', `<body>${script}`);
  }
  return script + html;
}
```

- [ ] **Step 2: Update `apps/web/src/lib/export/useExport.ts`**

Read the file then apply changes.

Add import at top:

```typescript
import { injectPostHog } from './inject-posthog';
```

In `exportHtml` (the function inside `useExport`), after reading `pages` and before creating the blob, add PostHog injection:

Find the line:

```typescript
const combined = allPages.map((p) => `<!-- Page: ${p.path} -->\n${p.html}`).join('\n\n');
```

Replace with:

```typescript
const analyticsConfig = useWorkspaceStore.getState().analyticsConfig;
const combined = allPages
  .map((p) => {
    const html = analyticsConfig
      ? injectPostHog(p.html, analyticsConfig.postHogApiKey, analyticsConfig.postHogHost, p.path)
      : p.html;
    return `<!-- Page: ${p.path} -->\n${html}`;
  })
  .join('\n\n');
```

- [ ] **Step 3: Add `injectPostHog` to `apps/api/src/lib/html-inject.ts`**

Append to the existing file (after `injectTailwind`):

```typescript
export function injectPostHogScript(
  html: string,
  postHogKey: string,
  postHogHost: string,
  pagePath: string,
): string {
  const script = `<script>
!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]);t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}var u=t.createElement("script");u.type="text/javascript";u.async=!0;u.src=s.api_host+"/static/array.js";var c=t.getElementsByTagName("script")[0];c.parentNode.insertBefore(u,c);var d=e;a!==void 0&&(d=e[a]=[]);d.toString=function(t){return"undefined"!=typeof d&&!0!==t?d:""+(a?a:"posthog")};o=["capture","identify","alias","set_config","unregister","opt_out_capturing","has_opted_out_capturing","opt_in_capturing","reset","isFeatureEnabled","onFeatureFlags","addGroup","setPersonPropertiesForFlags","reloadFeatureFlags","group"];for(n=0;n<o.length;n++)g(d,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
posthog.init('${postHogKey}',{api_host:'${postHogHost}',capture_pageview:false});
posthog.capture('$pageview',{page_path:'${pagePath}'});
</script>`;

  if (html.includes('</head>')) return html.replace('</head>', `${script}</head>`);
  if (html.includes('<body>')) return html.replace('<body>', `<body>${script}`);
  return script + html;
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
cd H:\60_OSS\you-design && pnpm typecheck
git add apps/web/src/lib/export/inject-posthog.ts apps/web/src/lib/export/useExport.ts apps/api/src/lib/html-inject.ts
git commit -m "feat: PostHog script injection in HTML export (web + API)"
```

---

## Task 5: API — analytics proxy route

**Files:**

- Create: `apps/api/src/routes/analytics.ts`
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Create `apps/api/src/routes/analytics.ts`**

```typescript
import type { FastifyInstance } from 'fastify';

interface PostHogTrend {
  data: number[];
  labels: string[];
  count: number;
  action?: { name: string };
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.get('/analytics/summary', async (req, reply) => {
    const q = req.query as {
      postHogApiKey?: string;
      postHogProjectId?: string;
      postHogHost?: string;
      days?: string;
    };

    if (!q.postHogApiKey || !q.postHogProjectId) {
      reply.code(400);
      return {
        error: 'MISSING_PARAMS',
        message: 'postHogApiKey and postHogProjectId are required',
      };
    }

    const host = q.postHogHost ?? 'https://app.posthog.com';
    const days = parseInt(q.days ?? '7', 10);
    const period = `Last ${days} days`;

    try {
      // Fetch pageview events grouped by $current_url
      const res = await fetch(`${host}/api/projects/${q.postHogProjectId}/insights/trend/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${q.postHogApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          events: [{ id: '$pageview', name: '$pageview', type: 'events' }],
          breakdown: '$current_url',
          breakdown_type: 'event',
          date_from: `-${days}d`,
          display: 'ActionsTable',
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        reply.code(502);
        return {
          error: 'POSTHOG_ERROR',
          message: `PostHog API returned ${res.status}: ${text.slice(0, 200)}`,
        };
      }

      const data = (await res.json()) as { result: PostHogTrend[] };
      const results = data.result ?? [];

      const pages = results.map((r) => {
        const url = r.action?.name ?? '';
        // Extract path from full URL if deployedBaseUrl is in the URL
        let path = url;
        try {
          path = new URL(url).pathname;
        } catch {
          path = url.startsWith('/') ? url : `/${url}`;
        }
        const views = r.count ?? 0;
        // clicks: approximate from total events — PostHog $pageview doesn't track clicks natively
        // We'll treat all events as views for now; clicks require custom event tracking
        return { path, views, clicks: 0, ctr: 0 };
      });

      const totalViews = pages.reduce((sum, p) => sum + p.views, 0);

      return { pages, totalViews, period };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reply.code(502);
      return { error: 'POSTHOG_FETCH_FAILED', message };
    }
  });
}
```

- [ ] **Step 2: Register in `apps/api/src/server.ts`**

Add import:

```typescript
import { analyticsRoutes } from './routes/analytics.js';
```

Add registration after `exportsRoutes`:

```typescript
await app.register(analyticsRoutes, { prefix: '/api/v1' });
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/api typecheck
git add apps/api/src/routes/analytics.ts apps/api/src/server.ts
git commit -m "feat(api): analytics summary proxy route for PostHog"
```

---

## Task 6: AnalyticsPanel sidebar component

**Files:**

- Create: `apps/web/src/components/sidebar/AnalyticsPanel.tsx`
- Modify: `apps/web/src/components/workspace/WorkspaceLayout.tsx`

- [ ] **Step 1: Create `apps/web/src/components/sidebar/AnalyticsPanel.tsx`**

```typescript
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

  const fetch_ = React.useCallback(async () => {
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
    if (stale) void fetch_();
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
          onClick={() => void fetch_()}
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
```

- [ ] **Step 2: Update `apps/web/src/components/workspace/WorkspaceLayout.tsx`**

Read the file, add import:

```typescript
import { AnalyticsPanel } from '@/components/sidebar/AnalyticsPanel';
```

In the sidebar `<aside>`, add `<AnalyticsPanel />` after `<ModelPicker />`:

```tsx
          <ModelPicker />
          <AnalyticsPanel />
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/web typecheck
git add apps/web/src/components/sidebar/AnalyticsPanel.tsx apps/web/src/components/workspace/WorkspaceLayout.tsx
git commit -m "feat(web): AnalyticsPanel sidebar — PostHog metrics with 5-min cache"
```

---

## Task 7: Critic enrichment from analytics

**Files:**

- Modify: `apps/web/src/lib/chat/critic-agent.ts`
- Modify: `apps/web/src/lib/chat/critic-dispatch.ts`

- [ ] **Step 1: Update `apps/web/src/lib/chat/critic-agent.ts`**

Read the file. Find `criticSystemPrompt` — it currently ends with a closing backtick and return statement. Add `analyticsContext` optional param and append it to the prompt.

Change signature from:

```typescript
export function criticSystemPrompt(
  contract: IntentContract,
  domain: DomainTemplate,
  triggeredBy: string,
): string {
```

To:

```typescript
export function criticSystemPrompt(
  contract: IntentContract,
  domain: DomainTemplate,
  triggeredBy: string,
  analyticsContext?: string,
): string {
```

At the end of the returned template string, before the closing backtick, add:

```
${analyticsContext ? `\n\nREAL USER DATA (use this to make data-informed suggestions):\n${analyticsContext}` : ''}`;
```

Example: if the prompt ends with `...Do NOT invent issues to look thorough.\``, change it to:

```typescript
...Do NOT invent issues to look thorough.
${analyticsContext ? `\n\nREAL USER DATA (use this to make data-informed suggestions):\n${analyticsContext}` : ''}\`;
```

- [ ] **Step 2: Update `apps/web/src/lib/chat/critic-dispatch.ts`**

Read the file. In `runCritic`, before calling `criticSystemPrompt`, add analytics context extraction:

After the line `const domain = getDomain(state.intentContract.domain);`, add:

```typescript
// Build analytics context from cache if available
const analyticsContext = buildAnalyticsContext(state.analyticsCache, pagePath);
```

After the closing brace of `runCritic`, add the helper function:

```typescript
function buildAnalyticsContext(
  cache: import('@you-design/shared').AnalyticsSummary | null,
  pagePath: string,
): string | undefined {
  if (!cache) return undefined;
  const page = cache.pages.find((p) => p.path === pagePath);
  if (!page) {
    return `Analytics available (${cache.totalViews.toLocaleString()} total views in ${cache.period}) but no data for this specific page yet.`;
  }
  return (
    `Analytics (${cache.period}): ${page.views.toLocaleString()} pageviews on "${pagePath}".` +
    (page.ctr > 0
      ? ` CTA click rate: ${(page.ctr * 100).toFixed(1)}%.`
      : ' No click tracking configured.')
  );
}
```

Update the `criticSystemPrompt` call to pass the context:

Find:

```typescript
      system: criticSystemPrompt(state.intentContract, domain, triggeredBy),
```

Replace with:

```typescript
      system: criticSystemPrompt(state.intentContract, domain, triggeredBy, analyticsContext),
```

- [ ] **Step 3: Full typecheck + tests**

```bash
cd H:\60_OSS\you-design && pnpm typecheck && pnpm test
```

Expected: 6/6 workspaces pass, all tests pass.

- [ ] **Step 4: Commit + tag**

```bash
cd H:\60_OSS\you-design
git add apps/web/src/lib/chat/critic-agent.ts apps/web/src/lib/chat/critic-dispatch.ts
git commit -m "feat(web): Critic enriched with PostHog analytics context"
git tag v0.8.0-alpha
git push && git push --tags
```

---

## Self-Review

**Spec coverage:**

- ✅ `AnalyticsConfig` + `AnalyticsSummary` Zod schemas (Task 1)
- ✅ `analyticsConfig` persisted in store, `analyticsCache` ephemeral (Task 2)
- ✅ `setAnalyticsConfig` + `setAnalyticsCache` actions (Task 2)
- ✅ AnalyticsConfig form on /setup with save + clear (Task 3)
- ✅ PostHog script injection in HTML export (web-side) (Task 4)
- ✅ PostHog script injection helper for API-side export (Task 4)
- ✅ `GET /api/v1/analytics/summary` PostHog proxy route (Task 5)
- ✅ AnalyticsPanel — auto-fetches on mount, 5-min cache, page list, refresh button (Task 6)
- ✅ WorkspaceLayout includes AnalyticsPanel (Task 6)
- ✅ `criticSystemPrompt` accepts optional `analyticsContext` (Task 7)
- ✅ `buildAnalyticsContext` helper reads from `analyticsCache` (Task 7)
- ✅ Critic dispatch passes analytics context (Task 7)

**Type consistency:**

- `AnalyticsConfig` defined Task 1, used in Tasks 2, 3, 4, 6 ✅
- `AnalyticsSummary` defined Task 1, used in Tasks 2, 6, 7 ✅
- `setAnalyticsCache(data)` defined Task 2, called in Task 6 ✅
- `analyticsContext?: string` param on `criticSystemPrompt` defined Task 7 Step 1, passed in Task 7 Step 2 ✅
- `buildAnalyticsContext(cache, pagePath)` defined and called in same file (critic-dispatch.ts) ✅
