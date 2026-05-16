import { nanoid } from 'nanoid';
import type {
  CriticIssue,
  CriticReport,
  Severity,
  IssueCategory,
} from '@you-design/shared';
import { useWorkspaceStore, selectActiveModel } from '@/lib/workspace/store';
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

export async function runCritic(
  triggeredBy: string,
  pagePath: string,
  pageHtml: string,
): Promise<CriticReport | null> {
  const state = useWorkspaceStore.getState();
  if (!state.intentContract) return null;
  const activeModel = selectActiveModel(state);
  if (!activeModel) return null;

  const domain = getDomain(state.intentContract.domain);

  let issues: CriticIssue[] = [];
  try {
    for await (const ev of streamLlm({
      model: activeModel,
      system: criticSystemPrompt(state.intentContract, domain, triggeredBy),
      messages: [
        {
          role: 'user',
          content: `Page path: ${pagePath}\n\nCurrent HTML:\n\n${pageHtml}`,
        },
      ],
      tools: CRITIC_TOOLS,
      max_tokens: 2048,
    })) {
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
  store.setCriticRunning(true);
  try {
    const report = await runCritic(triggeredBy, pagePath, pageHtml);
    if (report) {
      store.addCriticReport(report);
    }
  } finally {
    useWorkspaceStore.getState().setCriticRunning(false);
  }
}
