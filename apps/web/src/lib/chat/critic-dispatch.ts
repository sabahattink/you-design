import { nanoid } from 'nanoid';
import type {
  CriticIssue,
  CriticReport,
  Severity,
  IssueCategory,
} from '@you-design/shared';
import { selectModelForTask, estimateCost } from '@you-design/shared';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { streamLlm } from '@/lib/llm/client';
import { criticSystemPrompt, CRITIC_TOOLS } from './critic-agent';
import { getDomain } from '@/lib/domains';

const VALID_SEVERITY: Severity[] = ['critical', 'warning', 'info'];
const VALID_CATEGORY: IssueCategory[] = ['intent', 'a11y', 'domain', 'copy', 'craft'];

export function normalizeIssue(raw: unknown): CriticIssue {
  const r = (raw ?? {}) as Record<string, unknown>;
  const severity = VALID_SEVERITY.includes(r.severity as Severity)
    ? (r.severity as Severity)
    : 'warning';
  const category = VALID_CATEGORY.includes(r.category as IssueCategory)
    ? (r.category as IssueCategory)
    : 'craft';
  return {
    id: typeof r.id === 'string' && r.id ? r.id : nanoid(),
    severity,
    category,
    message: String(r.message ?? '').trim() || 'unspecified issue',
    elementId: typeof r.elementId === 'string' ? r.elementId : undefined,
    suggestion: typeof r.suggestion === 'string' ? r.suggestion : undefined,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
}

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

export async function runCritic(
  triggeredBy: string,
  pagePath: string,
  pageHtml: string,
): Promise<CriticReport | null> {
  const state = useWorkspaceStore.getState();
  if (!state.intentContract) return null;
  const activeModel = selectModelForTask('critic', state.models, state.defaultModelId);
  if (!activeModel) return null;

  const domain = getDomain(state.intentContract.domain);
  const analyticsContext = buildAnalyticsContext(state.analyticsCache, pagePath);

  let issues: CriticIssue[] = [];
  try {
    for await (const ev of streamLlm(
      {
        model: activeModel,
        system: criticSystemPrompt(state.intentContract, domain, triggeredBy, analyticsContext),
        messages: [
          {
            role: 'user',
            content: `Page path: ${pagePath}\n\nCurrent HTML:\n\n${pageHtml}`,
          },
        ],
        tools: CRITIC_TOOLS,
        max_tokens: 2048,
      },
      undefined,
      (usage) => {
        const cost = estimateCost(activeModel.modelName, usage.promptTokens, usage.completionTokens);
        const store = useWorkspaceStore.getState();
        if (cost !== null) store.appendSessionCost(cost);
        void fetch('http://localhost:3001/api/v1/usage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: store.projectId ?? undefined,
            agent: 'critic',
            modelName: activeModel.modelName,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
          }),
        }).catch(() => {});
      },
    )) {
      if (ev.type === 'tool-call') {
        const part = ev.data as {
          input?: { issues?: unknown[] };
          args?: { issues?: unknown[] };
        };
        const raw = part.input?.issues ?? part.args?.issues ?? [];
        if (Array.isArray(raw)) {
          issues = raw.map(normalizeIssue);
        }
      }
    }
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[critic] run failed:', err);
    }
    return null;
  }

  if (issues.length === 0) return null;
  return {
    id: nanoid(),
    pagePath,
    triggeredBy,
    agentType: 'critic' as const,
    issues,
    createdAt: new Date().toISOString(),
  };
}

export async function runAndStoreCritic(
  triggeredBy: string,
  pagePath: string,
  pageHtml: string,
): Promise<void> {
  const store = useWorkspaceStore.getState();
  store.setAgentRunning('critic', true);
  try {
    const report = await runCritic(triggeredBy, pagePath, pageHtml);
    if (report) {
      store.addCriticReport(report);
    }
  } finally {
    useWorkspaceStore.getState().setAgentRunning('critic', false);
  }
}
