# M4 — Multi-Agent Room Design

**Goal:** Add three specialized on-demand agents (Copywriter, A11y, Dev) alongside the existing auto-running Critic, giving users a full expert review panel for any design page.

**Scope:** Hybrid triggering — Critic stays automatic (post-designer-action), new agents are on-demand (sidebar "Run" buttons). All agents share the same `CriticReport/CriticIssue` types and the existing `criticReports` store. New `AgentDrawer` (tabbed) replaces `CriticDrawer`; new `AgentsBadge` replaces `CriticBadge`.

---

## 1. Shared Types — extend `CriticReport`

### Modify `packages/shared/src/critic.ts`

Add `AgentType` enum and `agentType` field to `CriticReport`:

```typescript
export const AgentType = z.enum(['critic', 'copywriter', 'a11y', 'dev']);
export type AgentType = z.infer<typeof AgentType>;

// In CriticReport, add:
agentType: AgentType.default('critic'),
```

This is backward compatible — existing persisted reports without `agentType` default to `'critic'` via Zod's `.default()`.

Export `AgentType` from `packages/shared/src/index.ts` (it re-exports critic.ts already, so no change needed to index.ts).

---

## 2. Store Additions (`apps/web/src/lib/workspace/store.ts`)

Replace `isCriticRunning: boolean` with a per-agent running map:

```typescript
// State
agentsRunning: Partial<Record<AgentType, boolean>>;

// Action (replaces setCriticRunning)
setAgentRunning: (agent: AgentType, running: boolean) => void;
```

Keep backward compatibility for anything reading `isCriticRunning` — add a computed selector:

```typescript
export function selectIsCriticRunning(state: WorkspaceState): boolean {
  return state.agentsRunning['critic'] ?? false;
}
```

`agentsRunning` is NOT persisted (ephemeral — resets on reload).

---

## 3. Three New Agent Prompts

### `apps/web/src/lib/chat/copywriter-agent.ts`

```typescript
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
- Max 5 issues per review.`;

export const COPYWRITER_TOOLS = [
  /* same as CRITIC_TOOLS — report_issues */
];
```

(COPYWRITER_TOOLS is identical to CRITIC_TOOLS — `report_issues` with the same input schema. Export and reuse CRITIC_TOOLS rather than duplicating.)

### `apps/web/src/lib/chat/a11y-agent.ts`

```typescript
export const A11Y_SYSTEM_PROMPT = `You are the Accessibility Agent for You Design.
Your job is to review the page HTML for accessibility issues.

Check for:
- Semantic HTML: Are headings used in logical order (h1→h2→h3)? Is nav/main/footer used?
- Images: Do all <img> tags have meaningful alt attributes?
- Forms: Do inputs have associated <label> elements?
- Links: Are link texts descriptive (not "click here" or "read more")?
- ARIA: Are ARIA roles and labels used correctly where needed?
- Keyboard: Are interactive elements (buttons, links) reachable via keyboard (no div-as-button)?
- Focus: Is there a visible focus ring on interactive elements?
- Color: Flag text on colored backgrounds that likely fails contrast (use judgment, you cannot compute actual contrast).

Rules:
- Report only accessibility issues.
- Reference the specific element (use elementId if available).
- Provide a concrete fix in the suggestion field.
- Max 6 issues per review.`;
```

### `apps/web/src/lib/chat/dev-agent.ts`

```typescript
export const DEV_SYSTEM_PROMPT = `You are the Dev Agent for You Design.
Your job is to review the page HTML for code quality and web best practices.

Check for:
- Semantic correctness: Is <div> overused where semantic elements would fit?
- Performance: Are there large base64 images inline? Unnecessary re-renders?
- Structure: Is nesting excessive (more than 6 levels deep)?
- Meta: Is <meta name="viewport"> present?
- Tailwind: Are utility classes applied sensibly, no conflicts?
- Redundancy: Are there duplicate classes, empty elements, or dead markup?
- Standards: Any deprecated HTML attributes or elements?

Rules:
- Report only code quality and structure issues.
- Reference the element type or pattern, not visual appearance.
- Max 5 issues per review.`;
```

All three agents import and reuse `CRITIC_TOOLS` from `critic-agent.ts` (the `report_issues` tool schema is generic enough).

---

## 4. Generic Agent Runner (`apps/web/src/lib/chat/agent-dispatch.ts`)

```typescript
export async function runAgent(
  agentType: AgentType,
  systemPrompt: string,
  contract: IntentContract,
  pagePath: string,
  pageHtml: string,
): Promise<void>;
```

Implementation mirrors `runAndStoreCritic` exactly:

1. `setAgentRunning(agentType, true)`
2. Call `streamLlm` with the agent's system prompt + `report_issues` tool
3. Parse tool call → normalize issues → build `CriticReport` with `agentType` set
4. `addCriticReport(report)` — same store action, different agentType
5. `setAgentRunning(agentType, false)`

Uses `selectModelForTask('critic', ...)` (same tier — fast).

---

## 5. UI

### `apps/web/src/components/agents/AgentsBadge.tsx`

Replaces `CriticBadge`. Shows combined open issue count + highest severity dot across ALL agent types.

```typescript
// Selector: count open issues across all agentTypes for currentPath
const allIssues = Object.values(reports)
  .flat()
  .flatMap((r) => r.issues)
  .filter((i) => i.status === 'open');
// Show running indicator if ANY agent is running
const anyRunning = Object.values(agentsRunning).some(Boolean);
```

### `apps/web/src/components/agents/AgentDrawer.tsx`

Replaces `CriticDrawer`. Tabbed layout:

```
[ Critic ] [ Copywriter ] [ A11y ] [ Dev ]
```

- **Critic tab**: existing behavior (auto-runs, Fix button)
- **Other tabs**: show "Run [Agent]" button at top + issue list below
  - "Run [Agent]" → calls `runAgent(agentType, ...)`
  - While running: button disabled, shows "Running…"
  - Issues: same `CriticIssueCard` components, Fix button routes to designer

### WorkspaceLayout changes

- Replace `CriticBadge` import with `AgentsBadge`
- Replace `CriticDrawer` import with `AgentDrawer`
- Props unchanged: `onOpen` / `open` / `onClose`

---

## 6. Store Action Updates

`addCriticReport` already accepts a `CriticReport` — since `agentType` is added to the type, reports from all agents go into the same `criticReports` store keyed by `pagePath`.

`CriticBadge` → `AgentsBadge`: reads same store, aggregates across all `agentType` values.

`CriticDrawer` → `AgentDrawer`: filters `reports` by active tab's `agentType`.

---

## 7. Error Handling

| Failure              | Behaviour                                                             |
| -------------------- | --------------------------------------------------------------------- |
| Agent LLM call fails | `setAgentRunning(type, false)`, no report added, console.warn         |
| No issues found      | `setAgentRunning(type, false)`, no report added (empty = no problems) |
| Model not configured | Early return, show "No model configured" in drawer tab                |

---

## 8. File Map

| Action | File                                                                                   |
| ------ | -------------------------------------------------------------------------------------- |
| Modify | `packages/shared/src/critic.ts`                                                        |
| Modify | `apps/web/src/lib/workspace/store.ts`                                                  |
| Create | `apps/web/src/lib/chat/copywriter-agent.ts`                                            |
| Create | `apps/web/src/lib/chat/a11y-agent.ts`                                                  |
| Create | `apps/web/src/lib/chat/dev-agent.ts`                                                   |
| Create | `apps/web/src/lib/chat/agent-dispatch.ts`                                              |
| Create | `apps/web/src/components/agents/AgentsBadge.tsx`                                       |
| Create | `apps/web/src/components/agents/AgentDrawer.tsx`                                       |
| Modify | `apps/web/src/components/workspace/WorkspaceLayout.tsx`                                |
| Modify | `apps/web/src/lib/chat/critic-dispatch.ts` (use setAgentRunning)                       |
| Modify | `apps/web/src/components/chat/ChatPanel.tsx` (isCriticRunning → selectIsCriticRunning) |
| Modify | `apps/web/src/components/sidebar/CriticBadge.tsx` (delete — replaced)                  |
| Modify | `apps/web/src/components/critic/CriticDrawer.tsx` (delete — replaced)                  |
