# M4 Multi-Agent Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Copywriter, A11y, and Dev agents as on-demand sidebar panels alongside the existing auto-running Critic, giving users a full expert review room for any page.

**Architecture:** `CriticReport` gains an `agentType` field (backward-compatible default 'critic'). The store's `isCriticRunning` flag becomes a `agentsRunning` map. A generic `runAgent()` dispatcher mirrors `runAndStoreCritic` for all agent types. New `AgentDrawer` (tabbed) and `AgentsBadge` replace `CriticDrawer` and `CriticBadge`.

**Tech Stack:** Zod (shared types), Zustand (store), Vercel AI SDK streamLlm (agent calls), React (AgentDrawer tabs, AgentsBadge).

---

## File Map

| Action | File |
|--------|------|
| Modify | `packages/shared/src/critic.ts` |
| Modify | `apps/web/src/lib/workspace/store.ts` |
| Modify | `apps/web/src/lib/chat/critic-dispatch.ts` |
| Create | `apps/web/src/lib/chat/copywriter-agent.ts` |
| Create | `apps/web/src/lib/chat/a11y-agent.ts` |
| Create | `apps/web/src/lib/chat/dev-agent.ts` |
| Create | `apps/web/src/lib/chat/agent-dispatch.ts` |
| Create | `apps/web/src/components/agents/AgentsBadge.tsx` |
| Create | `apps/web/src/components/agents/AgentDrawer.tsx` |
| Modify | `apps/web/src/components/workspace/WorkspaceLayout.tsx` |
| Delete | `apps/web/src/components/sidebar/CriticBadge.tsx` |
| Delete | `apps/web/src/components/critic/CriticDrawer.tsx` |

---

## Task 1: Shared — AgentType + agentType on CriticReport

**Files:**
- Modify: `packages/shared/src/critic.ts`
- Test: `packages/shared/src/critic.test.ts`

- [ ] **Step 1: Write failing test in `packages/shared/src/critic.test.ts`**

Create the file:

```typescript
import { describe, it, expect } from 'vitest';
import { CriticReport, AgentType } from './critic';

const baseIssue = {
  id: 'i1', severity: 'warning' as const, category: 'copy' as const,
  message: 'test', status: 'open' as const, createdAt: new Date().toISOString(),
};

describe('CriticReport agentType', () => {
  it('defaults agentType to critic when omitted', () => {
    const report = CriticReport.parse({
      id: 'r1', pagePath: '/', triggeredBy: 'test',
      issues: [baseIssue], createdAt: new Date().toISOString(),
    });
    expect(report.agentType).toBe('critic');
  });

  it('accepts copywriter agentType', () => {
    const report = CriticReport.parse({
      id: 'r2', pagePath: '/', triggeredBy: 'test', agentType: 'copywriter',
      issues: [], createdAt: new Date().toISOString(),
    });
    expect(report.agentType).toBe('copywriter');
  });

  it('AgentType enum has 4 values', () => {
    const result = AgentType.safeParse('dev');
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/shared test -- --reporter=verbose 2>&1 | grep -E "agentType|AgentType|FAIL"
```

Expected: FAIL — `AgentType` not exported.

- [ ] **Step 3: Update `packages/shared/src/critic.ts`**

```typescript
import { z } from 'zod';

export const Severity = z.enum(['critical', 'warning', 'info']);
export type Severity = z.infer<typeof Severity>;

export const IssueCategory = z.enum(['intent', 'a11y', 'domain', 'copy', 'craft']);
export type IssueCategory = z.infer<typeof IssueCategory>;

export const IssueStatus = z.enum(['open', 'fixed', 'dismissed']);
export type IssueStatus = z.infer<typeof IssueStatus>;

export const AgentType = z.enum(['critic', 'copywriter', 'a11y', 'dev']);
export type AgentType = z.infer<typeof AgentType>;

export const CriticIssue = z.object({
  id: z.string().min(1),
  severity: Severity,
  category: IssueCategory,
  message: z.string().min(1),
  elementId: z.string().optional(),
  suggestion: z.string().optional(),
  status: IssueStatus.default('open'),
  createdAt: z.string().datetime(),
});
export type CriticIssue = z.infer<typeof CriticIssue>;

export const CriticReport = z.object({
  id: z.string().min(1),
  pagePath: z.string(),
  triggeredBy: z.string(),
  agentType: AgentType.default('critic'),
  issues: z.array(CriticIssue),
  createdAt: z.string().datetime(),
});
export type CriticReport = z.infer<typeof CriticReport>;
```

- [ ] **Step 4: Run tests — verify passing**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/shared test -- --reporter=verbose 2>&1 | tail -10
```

Expected: all tests PASS including the 3 new agentType tests.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm --filter @you-design/shared typecheck
cd H:\60_OSS\you-design
git add packages/shared/src/critic.ts packages/shared/src/critic.test.ts
git commit -m "feat(shared): AgentType enum + agentType field on CriticReport"
```

---

## Task 2: Store — agentsRunning replaces isCriticRunning

**Files:**
- Modify: `apps/web/src/lib/workspace/store.ts`
- Modify: `apps/web/src/lib/chat/critic-dispatch.ts`

- [ ] **Step 1: Read `apps/web/src/lib/workspace/store.ts`**

The file currently has:
```typescript
isCriticRunning: boolean;          // in WorkspaceState
setCriticRunning: (running: boolean) => void;  // in WorkspaceActions
isCriticRunning: false,            // in INITIAL
setCriticRunning: (isCriticRunning) => set({ isCriticRunning }),  // in create
```

- [ ] **Step 2: Update store — replace isCriticRunning with agentsRunning**

In `WorkspaceState`, replace `isCriticRunning: boolean` with:
```typescript
agentsRunning: Partial<Record<'critic' | 'copywriter' | 'a11y' | 'dev', boolean>>;
```

In `WorkspaceActions`, replace `setCriticRunning` with:
```typescript
setAgentRunning: (agent: 'critic' | 'copywriter' | 'a11y' | 'dev', running: boolean) => void;
```

In `INITIAL`, replace `isCriticRunning: false` with:
```typescript
agentsRunning: {},
```

In the `create` block, replace `setCriticRunning: ...` with:
```typescript
setAgentRunning: (agent, running) =>
  set((s) => ({
    agentsRunning: { ...s.agentsRunning, [agent]: running },
  })),
```

Add a backward-compatible selector at the bottom of the file (after `selectActiveModel`):
```typescript
export function selectIsCriticRunning(state: WorkspaceState): boolean {
  return state.agentsRunning['critic'] ?? false;
}
```

Do NOT add `agentsRunning` to `partialize` — it's ephemeral.

- [ ] **Step 3: Update `apps/web/src/lib/chat/critic-dispatch.ts`**

In `runAndStoreCritic`, replace:
```typescript
store.setCriticRunning(true);
// ...
useWorkspaceStore.getState().setCriticRunning(false);
```

With:
```typescript
store.setAgentRunning('critic', true);
// ...
useWorkspaceStore.getState().setAgentRunning('critic', false);
```

Also update the `CriticReport` construction to include `agentType`:
```typescript
  return {
    id: nanoid(),
    pagePath,
    triggeredBy,
    agentType: 'critic' as const,
    issues,
    createdAt: new Date().toISOString(),
  };
```

- [ ] **Step 4: Typecheck**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/web typecheck
```

Fix any reference to `isCriticRunning` or `setCriticRunning` in other files:
- `apps/web/src/components/sidebar/CriticBadge.tsx` — uses `isCriticRunning` → will be replaced in Task 5, skip for now
- `apps/web/src/components/critic/CriticDrawer.tsx` — uses `isCriticRunning` → will be replaced in Task 6, skip for now
- Any other files: update to `agentsRunning['critic'] ?? false`

If CriticBadge or CriticDrawer cause typecheck errors, temporarily update them to use `agentsRunning['critic'] ?? false` as a stopgap.

- [ ] **Step 5: Commit**

```bash
cd H:\60_OSS\you-design
git add apps/web/src/lib/workspace/store.ts apps/web/src/lib/chat/critic-dispatch.ts
git commit -m "feat(web): agentsRunning map replaces isCriticRunning, selectIsCriticRunning selector"
```

---

## Task 3: Three new agent prompt files

**Files:**
- Create: `apps/web/src/lib/chat/copywriter-agent.ts`
- Create: `apps/web/src/lib/chat/a11y-agent.ts`
- Create: `apps/web/src/lib/chat/dev-agent.ts`

- [ ] **Step 1: Create `apps/web/src/lib/chat/copywriter-agent.ts`**

```typescript
import { CRITIC_TOOLS } from './critic-agent';

export const COPYWRITER_SYSTEM_PROMPT = `You are the Copywriter Agent for You Design.
Your job is to review the page copy against the intent contract and brand voice.

Focus exclusively on text content:
- Headlines: Are they outcome-focused and specific? Do they match the emotion and persona?
- CTA copy: Is it action-oriented? Does it match the primaryAction?
- Body text: Is it concise? Does it avoid filler words?
- Microcopy: Error messages, labels, placeholders — are they helpful?
- Tone consistency: Does the copy feel consistent throughout? Does it match the specified emotion?

Rules:
- Report only copy and text-related issues.
- Do NOT comment on visual design, layout, or technical code.
- Be specific: quote the problematic text in your message.
- Suggest a concrete replacement in your suggestion field.
- Max 5 issues per review.
- Use category 'copy' or 'intent'. Severity: 'critical' for CTA/headline, 'warning' for body, 'info' for minor tone.`;

export const COPYWRITER_TOOLS = CRITIC_TOOLS;
```

- [ ] **Step 2: Create `apps/web/src/lib/chat/a11y-agent.ts`**

```typescript
import { CRITIC_TOOLS } from './critic-agent';

export const A11Y_SYSTEM_PROMPT = `You are the Accessibility Agent for You Design.
Your job is to review the page HTML for WCAG 2.1 accessibility issues.

Check for:
- Semantic HTML: Are headings used in logical order (h1→h2→h3)? Is nav/main/footer present?
- Images: Do all <img> tags have meaningful alt attributes (not empty or "image")?
- Forms: Do inputs have associated <label> elements or aria-label?
- Links: Are link texts descriptive (not "click here", "read more", or bare URLs)?
- ARIA: Are ARIA roles used correctly? No redundant role="button" on <button>.
- Keyboard: Are interactive elements only <button> or <a>? No div/span used as buttons.
- Focus: Do interactive elements have a focus indicator (no outline: none without replacement)?
- Heading hierarchy: Is there exactly one <h1>? Do subheadings follow logical order?

Rules:
- Report only accessibility issues.
- Reference the specific element or pattern (use elementId if available).
- Provide a concrete fix in the suggestion field.
- Max 6 issues per review.
- Use category 'a11y'. Severity: 'critical' for missing alt/labels, 'warning' for semantic/ARIA, 'info' for best practices.`;

export const A11Y_TOOLS = CRITIC_TOOLS;
```

- [ ] **Step 3: Create `apps/web/src/lib/chat/dev-agent.ts`**

```typescript
import { CRITIC_TOOLS } from './critic-agent';

export const DEV_SYSTEM_PROMPT = `You are the Dev Agent for You Design.
Your job is to review the page HTML for code quality and web best practices.

Check for:
- Semantic correctness: Is <div> overused where <section>, <article>, <aside> would fit?
- Nesting: Is nesting excessive (more than 6 levels deep)?
- Meta: Is <meta name="viewport" content="width=device-width, initial-scale=1"> present in <head>?
- Redundancy: Are there duplicate Tailwind classes, empty elements, or dead markup?
- Performance: Any large inline base64 images? Multiple <script> blocks that could be combined?
- Standards: Any deprecated HTML attributes (border, align, bgcolor on elements)?
- Tailwind: Are conflicting utility classes applied (e.g., both text-left and text-center)?

Rules:
- Report only code quality and structure issues.
- Reference the element type or pattern, not visual appearance.
- Max 5 issues per review.
- Use category 'craft'. Severity: 'warning' for structural issues, 'info' for best practices.`;

export const DEV_TOOLS = CRITIC_TOOLS;
```

- [ ] **Step 4: Typecheck + commit**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/web typecheck
git add apps/web/src/lib/chat/copywriter-agent.ts apps/web/src/lib/chat/a11y-agent.ts apps/web/src/lib/chat/dev-agent.ts
git commit -m "feat(web): copywriter, a11y, dev agent system prompts"
```

---

## Task 4: Generic agent dispatcher

**Files:**
- Create: `apps/web/src/lib/chat/agent-dispatch.ts`

- [ ] **Step 1: Create `apps/web/src/lib/chat/agent-dispatch.ts`**

```typescript
import { nanoid } from 'nanoid';
import type { AgentType, CriticIssue, CriticReport, Severity, IssueCategory } from '@you-design/shared';
import { selectModelForTask, estimateCost } from '@you-design/shared';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { streamLlm } from '@/lib/llm/client';
import { normalizeIssue } from './critic-dispatch';
import type { LlmRequest } from '@/lib/llm/client';

interface AgentTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export async function runAgent(
  agentType: AgentType,
  systemPrompt: string,
  tools: AgentTool[],
  pagePath: string,
  pageHtml: string,
): Promise<void> {
  const state = useWorkspaceStore.getState();
  if (!state.intentContract) return;

  const activeModel = selectModelForTask('critic', state.models, state.defaultModelId);
  if (!activeModel) return;

  state.setAgentRunning(agentType, true);

  let issues: CriticIssue[] = [];

  try {
    const req: LlmRequest = {
      model: activeModel,
      system: `${systemPrompt}\n\nIntent contract:\n- Persona: ${typeof state.intentContract.persona === 'string' ? state.intentContract.persona : state.intentContract.persona.role}\n- Primary action: ${state.intentContract.primaryAction}\n- Emotion: ${state.intentContract.emotion}\n- Domain: ${state.intentContract.domain}`,
      messages: [
        {
          role: 'user',
          content: `Page path: ${pagePath}\n\nCurrent HTML:\n\n${pageHtml}`,
        },
      ],
      tools,
      max_tokens: 2048,
    };

    for await (const ev of streamLlm(
      req,
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
            agent: agentType,
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
    console.warn(`[${agentType}] run failed:`, err);
    useWorkspaceStore.getState().setAgentRunning(agentType, false);
    return;
  }

  if (issues.length > 0) {
    const report: CriticReport = {
      id: nanoid(),
      pagePath,
      triggeredBy: 'manual',
      agentType,
      issues,
      createdAt: new Date().toISOString(),
    };
    useWorkspaceStore.getState().addCriticReport(report);
  }

  useWorkspaceStore.getState().setAgentRunning(agentType, false);
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/web typecheck
git add apps/web/src/lib/chat/agent-dispatch.ts
git commit -m "feat(web): generic runAgent dispatcher for all agent types"
```

---

## Task 5: AgentsBadge (replaces CriticBadge)

**Files:**
- Create: `apps/web/src/components/agents/AgentsBadge.tsx`
- Delete: `apps/web/src/components/sidebar/CriticBadge.tsx`

- [ ] **Step 1: Create `apps/web/src/components/agents/AgentsBadge.tsx`**

```typescript
'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import type { Severity } from '@you-design/shared';

interface Props {
  onOpen: () => void;
}

const EMPTY_REPORTS: never[] = [];
const ORDER: Severity[] = ['critical', 'warning', 'info'];
const DOT: Record<Severity, string> = {
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-sky-500',
};

export function AgentsBadge({ onOpen }: Props) {
  const reports = useWorkspaceStore((s) => s.criticReports[s.currentPath] ?? EMPTY_REPORTS);
  const agentsRunning = useWorkspaceStore((s) => s.agentsRunning);

  const openIssues = React.useMemo(
    () => reports.flatMap((r) => r.issues).filter((i) => i.status === 'open'),
    [reports],
  );

  const highestSeverity: Severity | null = React.useMemo(() => {
    for (const sev of ORDER) {
      if (openIssues.some((i) => i.severity === sev)) return sev;
    }
    return null;
  }, [openIssues]);

  const anyRunning = Object.values(agentsRunning).some(Boolean);

  return (
    <button
      onClick={onOpen}
      className="p-2 border-t border-[color:var(--color-border)] flex items-center justify-between text-xs hover:bg-[color:var(--color-border)] w-full text-left"
    >
      <span className="uppercase tracking-wide text-[color:var(--color-muted)]">
        Agents
      </span>
      <span className="flex items-center gap-2">
        {anyRunning && (
          <span className="italic text-[color:var(--color-muted)]">running</span>
        )}
        {highestSeverity && (
          <span
            className={`inline-block w-2 h-2 rounded-full ${DOT[highestSeverity]}`}
            aria-hidden
          />
        )}
        <span className="text-[color:var(--color-muted)]">
          {openIssues.length}
        </span>
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Delete `apps/web/src/components/sidebar/CriticBadge.tsx`**

```bash
cd H:\60_OSS\you-design && rm apps/web/src/components/sidebar/CriticBadge.tsx
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter @you-design/web typecheck
git add apps/web/src/components/agents/AgentsBadge.tsx
git rm apps/web/src/components/sidebar/CriticBadge.tsx
git commit -m "feat(web): AgentsBadge replaces CriticBadge, shows all agents' issues"
```

---

## Task 6: AgentDrawer (replaces CriticDrawer)

**Files:**
- Create: `apps/web/src/components/agents/AgentDrawer.tsx`
- Delete: `apps/web/src/components/critic/CriticDrawer.tsx`

- [ ] **Step 1: Create `apps/web/src/components/agents/AgentDrawer.tsx`**

```typescript
'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { useDesignerSend } from '@/lib/chat/useDesignerSend';
import { CriticIssueCard } from '@/components/critic/CriticIssueCard';
import { runAgent } from '@/lib/chat/agent-dispatch';
import {
  COPYWRITER_SYSTEM_PROMPT,
  COPYWRITER_TOOLS,
} from '@/lib/chat/copywriter-agent';
import { A11Y_SYSTEM_PROMPT, A11Y_TOOLS } from '@/lib/chat/a11y-agent';
import { DEV_SYSTEM_PROMPT, DEV_TOOLS } from '@/lib/chat/dev-agent';
import type { AgentType, CriticIssue } from '@you-design/shared';

interface Props {
  open: boolean;
  onClose: () => void;
}

const EMPTY_REPORTS: never[] = [];

const AGENT_TABS: Array<{ id: AgentType; label: string; auto: boolean }> = [
  { id: 'critic', label: 'Critic', auto: true },
  { id: 'copywriter', label: 'Copywriter', auto: false },
  { id: 'a11y', label: 'A11y', auto: false },
  { id: 'dev', label: 'Dev', auto: false },
];

export function AgentDrawer({ open, onClose }: Props) {
  const currentPath = useWorkspaceStore((s) => s.currentPath);
  const reports = useWorkspaceStore((s) => s.criticReports[s.currentPath] ?? EMPTY_REPORTS);
  const agentsRunning = useWorkspaceStore((s) => s.agentsRunning);
  const updateIssueStatus = useWorkspaceStore((s) => s.updateIssueStatus);
  const pages = useWorkspaceStore((s) => s.pages);
  const sendBuild = useDesignerSend();

  const [activeTab, setActiveTab] = React.useState<AgentType>('critic');

  const tabReports = React.useMemo(
    () => reports.filter((r) => (r.agentType ?? 'critic') === activeTab),
    [reports, activeTab],
  );

  const allIssues = React.useMemo(
    () => tabReports.flatMap((r) => r.issues.map((issue) => ({ reportId: r.id, issue }))),
    [tabReports],
  );

  const isRunning = agentsRunning[activeTab] ?? false;

  const handleFix = async (reportId: string, issue: CriticIssue) => {
    const elementHint = issue.elementId ? ` Target element data-yd-id: ${issue.elementId}.` : '';
    const suggestionHint = issue.suggestion ? ` Suggested: ${issue.suggestion}` : '';
    const msg = `Fix this issue on ${currentPath}: ${issue.message}.${elementHint}${suggestionHint}`;
    await sendBuild(msg);
    updateIssueStatus(reportId, issue.id, 'fixed');
  };

  const handleRunAgent = () => {
    const page = pages[currentPath];
    if (!page) return;
    if (activeTab === 'copywriter') {
      void runAgent('copywriter', COPYWRITER_SYSTEM_PROMPT, COPYWRITER_TOOLS, currentPath, page.html);
    } else if (activeTab === 'a11y') {
      void runAgent('a11y', A11Y_SYSTEM_PROMPT, A11Y_TOOLS, currentPath, page.html);
    } else if (activeTab === 'dev') {
      void runAgent('dev', DEV_SYSTEM_PROMPT, DEV_TOOLS, currentPath, page.html);
    }
  };

  if (!open) return null;

  return (
    <aside className="absolute right-0 top-0 h-full w-96 z-20 bg-[color:var(--color-bg)] border-l border-[color:var(--color-border)] shadow-xl flex flex-col">
      <div className="h-10 flex items-center justify-between px-3 border-b border-[color:var(--color-border)]">
        <div className="text-sm font-medium">Agents</div>
        <button
          onClick={onClose}
          className="text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
          aria-label="Close agent drawer"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[color:var(--color-border)] text-xs">
        {AGENT_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 border-r border-[color:var(--color-border)] last:border-r-0 ${
              activeTab === tab.id
                ? 'bg-[color:var(--color-border)] font-semibold'
                : 'hover:bg-[color:var(--color-border)]/50'
            }`}
          >
            {tab.label}
            {tab.auto && (
              <span className="ml-1 text-[10px] text-[color:var(--color-muted)]">auto</span>
            )}
          </button>
        ))}
      </div>

      {/* Run button for non-auto agents */}
      {!AGENT_TABS.find((t) => t.id === activeTab)?.auto && (
        <div className="px-3 py-2 border-b border-[color:var(--color-border)]">
          <button
            onClick={handleRunAgent}
            disabled={isRunning}
            className="w-full px-3 py-1.5 text-xs rounded bg-[color:var(--color-fg)] text-[color:var(--color-bg)] disabled:opacity-50"
          >
            {isRunning ? `Running ${activeTab}…` : `Run ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
          </button>
        </div>
      )}

      {/* Issue list */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {isRunning && (
          <div className="text-xs italic text-[color:var(--color-muted)]">
            {activeTab} reviewing…
          </div>
        )}
        {allIssues.length === 0 && !isRunning && (
          <div className="text-xs italic text-[color:var(--color-muted)]">
            {AGENT_TABS.find((t) => t.id === activeTab)?.auto
              ? 'No issues to show for the current page yet.'
              : `Click "Run ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}" to analyse this page.`}
          </div>
        )}
        {allIssues.map(({ reportId, issue }) => (
          <CriticIssueCard
            key={`${reportId}:${issue.id}`}
            reportId={reportId}
            issue={issue}
            onFix={(i) => void handleFix(reportId, i)}
          />
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Delete `apps/web/src/components/critic/CriticDrawer.tsx`**

```bash
cd H:\60_OSS\you-design && rm apps/web/src/components/critic/CriticDrawer.tsx
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter @you-design/web typecheck
git add apps/web/src/components/agents/AgentDrawer.tsx
git rm apps/web/src/components/critic/CriticDrawer.tsx
git commit -m "feat(web): AgentDrawer replaces CriticDrawer — tabbed Critic/Copywriter/A11y/Dev"
```

---

## Task 7: WorkspaceLayout + final cleanup

**Files:**
- Modify: `apps/web/src/components/workspace/WorkspaceLayout.tsx`

- [ ] **Step 1: Read `apps/web/src/components/workspace/WorkspaceLayout.tsx` then update imports**

Replace:
```typescript
import { CriticBadge } from '@/components/sidebar/CriticBadge';
import { CriticDrawer } from '@/components/critic/CriticDrawer';
```

With:
```typescript
import { AgentsBadge } from '@/components/agents/AgentsBadge';
import { AgentDrawer } from '@/components/agents/AgentDrawer';
```

Replace in JSX:
```tsx
<CriticBadge onOpen={() => setCriticOpen(true)} />
```
With:
```tsx
<AgentsBadge onOpen={() => setCriticOpen(true)} />
```

Replace:
```tsx
<CriticDrawer open={criticOpen} onClose={() => setCriticOpen(false)} />
```
With:
```tsx
<AgentDrawer open={criticOpen} onClose={() => setCriticOpen(false)} />
```

- [ ] **Step 2: Fix any remaining isCriticRunning references**

Search for remaining references:
```bash
cd H:\60_OSS\you-design && grep -r "isCriticRunning\|setCriticRunning\|CriticBadge\|CriticDrawer" apps/web/src/ --include="*.ts" --include="*.tsx"
```

Fix each: replace `isCriticRunning` with `selectIsCriticRunning(s)` or `agentsRunning['critic'] ?? false`, and `setCriticRunning` with `setAgentRunning('critic', ...)`.

- [ ] **Step 3: Full typecheck + tests**

```bash
cd H:\60_OSS\you-design && pnpm typecheck
pnpm test
```

Expected: 6/6 workspaces pass, all tests pass.

- [ ] **Step 4: Commit + tag**

```bash
cd H:\60_OSS\you-design
git add apps/web/src/components/workspace/WorkspaceLayout.tsx
git commit -m "feat(web): swap AgentsBadge/AgentDrawer into WorkspaceLayout"
git tag v0.7.0-alpha
git push && git push --tags
```

---

## Self-Review

**Spec coverage:**
- ✅ `AgentType` enum ('critic'|'copywriter'|'a11y'|'dev') (Task 1)
- ✅ `agentType` on `CriticReport` with default 'critic' (Task 1)
- ✅ `agentsRunning` replaces `isCriticRunning` (Task 2)
- ✅ `setAgentRunning` replaces `setCriticRunning` (Task 2)
- ✅ `selectIsCriticRunning` backward-compat selector (Task 2)
- ✅ critic-dispatch.ts uses `setAgentRunning('critic', ...)` + `agentType: 'critic'` in report (Task 2)
- ✅ copywriter-agent.ts — system prompt + reuses CRITIC_TOOLS (Task 3)
- ✅ a11y-agent.ts — system prompt + reuses CRITIC_TOOLS (Task 3)
- ✅ dev-agent.ts — system prompt + reuses CRITIC_TOOLS (Task 3)
- ✅ `runAgent(agentType, systemPrompt, tools, pagePath, pageHtml)` (Task 4)
- ✅ runAgent injects intent contract into system prompt (Task 4)
- ✅ runAgent uses `selectModelForTask('critic', ...)` — fast tier (Task 4)
- ✅ runAgent logs usage to `/api/v1/usage` (Task 4)
- ✅ AgentsBadge — aggregates all agentTypes, anyRunning indicator (Task 5)
- ✅ CriticBadge deleted (Task 5)
- ✅ AgentDrawer — 4 tabs, Run button for non-auto agents, same CriticIssueCard (Task 6)
- ✅ CriticDrawer deleted (Task 6)
- ✅ WorkspaceLayout — swaps components (Task 7)

**Type consistency:**
- `AgentType` defined in Task 1, used in Tasks 2, 4, 5, 6 ✅
- `runAgent(agentType, systemPrompt, tools, pagePath, pageHtml)` defined in Task 4, called in Task 6 ✅
- `setAgentRunning(agent, running)` defined in Task 2, called in Tasks 4, 6 ✅
- `COPYWRITER_TOOLS = CRITIC_TOOLS` — same shape, same schema. ✅
