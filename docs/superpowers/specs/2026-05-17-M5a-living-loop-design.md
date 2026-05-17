# M5a — Living Loop Design

**Goal:** Close the design-deploy-analytics loop. Users export HTML with PostHog tracking injected, deploy anywhere, and see real user metrics back in the workspace. Critic gets analytics context to make data-informed suggestions.

**Scope:** Pull-based PostHog integration only. No deploy infrastructure — user deploys the exported file themselves. No WebSocket, no auth required.

---

## 1. The Loop

```
Build in You Design
  → Export HTML (PostHog script auto-injected)
  → User deploys to GitHub Pages / Netlify / any static host
  → PostHog collects pageview + click events
  → You Design pulls metrics via PostHog API (using user's key)
  → Analytics panel shows: views, CTA click rate, last 7 days
  → Critic agent receives enriched context: "CTA clicked 2.3% — below average"
  → User improves design → re-exports → loop repeats
```

---

## 2. PostHog Configuration

### New Zod schema (`packages/shared/src/analytics.ts`)

```typescript
export const AnalyticsSummary = z.object({
  pages: z.array(z.object({
    path: z.string(),
    views: z.number().int(),
    clicks: z.number().int(),
    ctr: z.number(),
  })),
  totalViews: z.number().int(),
  period: z.string(),
  fetchedAt: z.number(),
});
export type AnalyticsSummary = z.infer<typeof AnalyticsSummary>;

export const AnalyticsConfig = z.object({
  postHogApiKey: z.string().min(1),       // phc_xxx... (project API key)
  postHogProjectId: z.string().min(1),    // numeric project ID from PostHog
  postHogHost: z.string().url().default('https://app.posthog.com'),  // or self-hosted
  deployedBaseUrl: z.string().url().optional(),  // where the exported site lives
});
export type AnalyticsConfig = z.infer<typeof AnalyticsConfig>;
```

Export from `packages/shared/src/index.ts`.

### Store additions (`apps/web/src/lib/workspace/store.ts`)

```typescript
analyticsConfig: AnalyticsConfig | null;
setAnalyticsConfig: (config: AnalyticsConfig | null) => void;
```

Persisted in `partialize` (user-level config like models).

### Setup page UI (`apps/web/src/components/setup/AnalyticsConfig.tsx`)

New section on `/setup` page below ProviderConfig. Fields:
- PostHog API Key (text input, type=password)
- PostHog Project ID (text input)
- PostHog Host (text input, default: https://app.posthog.com)
- Deployed Base URL (text input, optional — where the exported site lives)

"Save" button → `setAnalyticsConfig(...)`.
"Clear" button → `setAnalyticsConfig(null)`.

---

## 3. HTML Export — PostHog Script Injection

### Modify `apps/api/src/lib/html-inject.ts`

Add a new export function alongside the existing `injectTailwind`:

```typescript
export function injectPostHog(html: string, postHogKey: string, postHogHost: string, pagePath: string): string {
  const script = `<script>
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]);t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}var u=t.createElement("script");u.type="text/javascript";u.async=!0;u.src=s.api_host+"/static/array.js";var c=t.getElementsByTagName("script")[0];c.parentNode.insertBefore(u,c);var d=e;a!==undefined&&(d=e[a]=[]);d.toString=function(t){return"undefined"!=typeof d&&!0!==t?d:""+(a?a:"posthog")};o=["capture","identify","alias","set_config","unregister","opt_out_capturing","has_opted_out_capturing","opt_in_capturing","reset","isFeatureEnabled","onFeatureFlags","addGroup","setPersonPropertiesForFlags","reloadFeatureFlags","group"];for(n=0;n<o.length;n++)g(d,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    posthog.init('${postHogKey}', {api_host:'${postHogHost}',capture_pageview:false});
    posthog.capture('$pageview', {page_path:'${pagePath}'});
  </script>`;
  if (html.includes('</head>')) {
    return html.replace('</head>', `${script}</head>`);
  }
  return html.replace('<body>', `<body>${script}`);
}
```

### Modify `apps/web/src/lib/export/useExport.ts`

In `exportHtml`, check if `analyticsConfig` is set in store. If so, call `injectPostHog` on each page's HTML before combining:

```typescript
// In exportHtml():
const { analyticsConfig } = useWorkspaceStore.getState();
const combined = allPages
  .map((p) => {
    const html = analyticsConfig
      ? injectPostHogClient(p.html, analyticsConfig.postHogApiKey, analyticsConfig.postHogHost, p.path)
      : p.html;
    return `<!-- Page: ${p.path} -->\n${html}`;
  })
  .join('\n\n');
```

`injectPostHogClient` is a client-side version of the same injection function (imported from a shared utility `apps/web/src/lib/export/inject-posthog.ts`).

### PDF/PPTX export

The API-side PDF/PPTX render also injects tracking (for analytics completeness). In `apps/api/src/lib/html-inject.ts`, the existing `injectTailwind` pipeline is used. Add optional PostHog injection: the POST `/api/v1/exports` body may include `postHogKey` and `postHogHost` — if present, inject tracking script before rendering.

---

## 4. Analytics API Route

### New route (`apps/api/src/routes/analytics.ts`)

```
GET /api/v1/analytics/summary
  Query: postHogApiKey, postHogProjectId, postHogHost, deployedBaseUrl, days=7
  Action: Call PostHog API → aggregate pageview + click metrics per page
  Response: {
    pages: Array<{
      path: string;
      views: number;
      clicks: number;
      ctr: number;  // clicks / views
    }>;
    totalViews: number;
    period: string;  // "Last 7 days"
  }
```

**PostHog API call:**
```
GET {postHogHost}/api/projects/{projectId}/insights/trend/
  Authorization: Bearer {postHogApiKey}
  Body: { events: [{ id: '$pageview' }], date_from: -7d }
```

Filter by `deployedBaseUrl` if provided (match page URLs). Return per-page aggregates.

Error handling: if PostHog API fails → return `{ error: 'POSTHOG_ERROR', message }` with 502.

---

## 5. Analytics Panel UI

### New component (`apps/web/src/components/sidebar/AnalyticsPanel.tsx`)

Renders at the bottom of the sidebar (below ModelPicker, above nothing).

**Empty state** (no config): "Configure analytics in /setup"

**Loading state**: simple spinner

**Data state**:
```
Analytics (last 7d)
─────────────────
/ (home)    1,240 views  42 clicks  3.4%
/pricing      580 views  18 clicks  3.1%
/contact      210 views   6 clicks  2.9%
─────────────────
Total: 2,030 views
```

Clicking a row navigates to that page (calls `setCurrentPath`).

**Refresh button**: re-fetches from PostHog API.

### Trigger

`AnalyticsPanel` auto-fetches on mount if `analyticsConfig` is set. It uses a 5-minute cache (refetch if last fetch > 5 min ago). No auto-polling.

---

## 6. Critic Enrichment

### Modify `apps/web/src/lib/chat/critic-agent.ts`

`criticSystemPrompt` receives optional `analyticsContext`:

```typescript
export function criticSystemPrompt(
  contract: IntentContract,
  domain: DomainConfig,
  triggeredBy: string,
  analyticsContext?: string,
): string
```

`analyticsContext` example:
```
Analytics (last 7d): 1,240 pageviews. CTA click rate: 3.4% (target: 5%+).
Low-performing: /pricing page has 2.1% CTA rate.
```

Appended to system prompt: `\n\nReal user data:\n${analyticsContext}`

### In `critic-dispatch.ts`

Before calling `criticSystemPrompt`, check if analytics data is available in the store:

```typescript
const analyticsData = getWorkspaceAnalyticsSummary(); // reads from store cache
const analyticsContext = analyticsData
  ? formatAnalyticsContext(analyticsData, pagePath)
  : undefined;
```

`formatAnalyticsContext` builds the plain-text summary string.

### Store: analytics cache

```typescript
analyticsCache: AnalyticsSummary | null;
analyticsLastFetchedAt: number | null;
setAnalyticsCache: (data: AnalyticsSummary | null) => void;
```

NOT persisted (session-only, fetched fresh each session).

---

## 7. File Map

| Action | File |
|--------|------|
| Create | `packages/shared/src/analytics.ts` |
| Modify | `packages/shared/src/index.ts` |
| Modify | `apps/web/src/lib/workspace/store.ts` |
| Create | `apps/web/src/components/setup/AnalyticsConfig.tsx` |
| Modify | `apps/web/src/app/setup/page.tsx` |
| Create | `apps/web/src/lib/export/inject-posthog.ts` |
| Modify | `apps/web/src/lib/export/useExport.ts` |
| Modify | `apps/api/src/lib/html-inject.ts` |
| Create | `apps/api/src/routes/analytics.ts` |
| Modify | `apps/api/src/server.ts` |
| Create | `apps/web/src/components/sidebar/AnalyticsPanel.tsx` |
| Modify | `apps/web/src/components/workspace/WorkspaceLayout.tsx` |
| Modify | `apps/web/src/lib/chat/critic-agent.ts` |
| Modify | `apps/web/src/lib/chat/critic-dispatch.ts` |
