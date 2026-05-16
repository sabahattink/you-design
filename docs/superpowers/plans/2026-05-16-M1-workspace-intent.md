# M1 Workspace + Intent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first demoable workspace where a vague brief becomes an editable multi-page HTML site through an honest critic + designer agent loop, persisted in localStorage.

**Architecture:** Next.js client owns a Zustand store (persisted to localStorage). Iframe renders HTML via `srcdoc` with an injected script that emits click events. Fastify API exposes a single SSE endpoint that proxies LLM calls to Anthropic. parse5 handles all HTML AST transforms. Two LLM agents (intent then designer) drive the workflow via tool calls.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zustand 5, parse5, Vercel AI SDK + @ai-sdk/anthropic, Monaco editor, Fastify 5, nanoid, Vitest, Playwright.

**Spec:** [`docs/superpowers/specs/2026-05-16-M1-workspace-intent-design.md`](../specs/2026-05-16-M1-workspace-intent-design.md)

**Timeline:** 5 weeks, ~40 tasks, ~1 commit per task.

---

## File Plan

### New files (apps/web)

| Path | Responsibility |
|------|----------------|
| `src/lib/workspace/store.ts` | Zustand store + persist middleware |
| `src/lib/workspace/types.ts` | Page, IntentContract, ChatMessage, ToolCall types (re-exports shared) |
| `src/lib/html/ast.ts` | parse5 wrappers: parse, ensureYdIds, findById, update, add, remove, serialize |
| `src/lib/html/tailwind-classes.ts` | Static list (~5KB JSON) of common Tailwind utility classes |
| `src/lib/chat/intent-agent.ts` | Intent agent system prompt + tool definitions + slot tracker |
| `src/lib/chat/designer-agent.ts` | Designer agent system prompt + tool definitions |
| `src/lib/chat/stream.ts` | SSE client (parses Anthropic event stream from API) |
| `src/lib/llm/client.ts` | POST `/api/v1/llm/stream` and yield tokens + tool calls |
| `src/components/canvas/PreviewIframe.tsx` | Iframe wrapper, srcdoc binding, postMessage listener |
| `src/components/canvas/inject-script.ts` | String of JS injected into iframe (click + bounds + nav intercept) |
| `src/components/canvas/SelectionOverlay.tsx` | Absolute-positioned outline drawn over the iframe |
| `src/components/canvas/EditPanel.tsx` | Right-side sliding panel: tag, text, classes for selected element |
| `src/components/canvas/CodePanel.tsx` | Monaco editor bound to current page HTML |
| `src/components/chat/ChatPanel.tsx` | Combined intent+designer chat UI |
| `src/components/chat/ChatMessage.tsx` | Single bubble (user / agent / critic / tool) |
| `src/components/chat/CriticBubble.tsx` | Special styling for `challenge` tool calls |
| `src/components/chat/IntentContractCard.tsx` | Shows summarized contract + Approve button |
| `src/components/chat/Composer.tsx` | Input box with send/enter handling |
| `src/components/sidebar/PageList.tsx` | List of pages with add/select/delete |
| `src/components/sidebar/IntentChip.tsx` | Tiny chip showing locked-in intent contract |
| `src/components/sidebar/AddPageDialog.tsx` | Modal for adding a page with a path |
| `src/components/workspace/WorkspaceLayout.tsx` | Three-pane layout root |

### New files (apps/api)

| Path | Responsibility |
|------|----------------|
| `src/routes/llm.ts` | POST `/api/v1/llm/stream` — SSE proxy to Anthropic |
| `src/lib/anthropic.ts` | Anthropic client init (singleton) |

### New files (packages/shared)

| Path | Responsibility |
|------|----------------|
| `src/chat.ts` | ChatMessage, ToolCall, ToolResult, ElementPatch zod schemas |

### Modified files

| Path | Change |
|------|--------|
| `apps/web/src/app/app/page.tsx` | Replace placeholder with `<WorkspaceLayout />` |
| `apps/web/package.json` | Add deps |
| `apps/api/package.json` | Add deps |
| `apps/api/src/server.ts` | Register `llm` route |
| `apps/api/src/config.ts` | Make `ANTHROPIC_API_KEY` required (was optional) |
| `packages/shared/src/index.ts` | Export `chat.ts` |
| `compose.yml` | Pass `ANTHROPIC_API_KEY` to api service |
| `.env.example` | Already has the key (no change) |

---

## Phase 1 — Week 1: Workspace Shell + Persistence

### Task 1.1: Install web dependencies

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Add deps to apps/web/package.json**

Open `apps/web/package.json` and add to `dependencies`:

```json
"zustand": "^5.0.2",
"parse5": "^7.2.1",
"nanoid": "^5.0.9",
"@monaco-editor/react": "^4.6.0",
"monaco-editor": "^0.52.0",
"ai": "^4.0.20",
"@ai-sdk/anthropic": "^1.0.6"
```

- [ ] **Step 2: Install**

Run from repo root: `pnpm install`
Expected: lockfile updates, no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add zustand, parse5, monaco, ai sdk, nanoid for M1"
```

### Task 1.2: Install API dependencies

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Add deps**

In `apps/api/package.json` add to `dependencies`:

```json
"@anthropic-ai/sdk": "^0.34.0",
"@ai-sdk/anthropic": "^1.0.6",
"ai": "^4.0.20"
```

- [ ] **Step 2: Install**

Run: `pnpm install`

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore(api): add anthropic sdk and ai sdk for M1 LLM proxy"
```

### Task 1.3: Shared chat types

**Files:**
- Create: `packages/shared/src/chat.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write failing test**

Create `packages/shared/src/chat.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { ChatMessage, ToolCall, ElementPatch } from './chat.js';

describe('chat schemas', () => {
  it('parses a user message', () => {
    const parsed = ChatMessage.parse({
      id: 'm1',
      role: 'user',
      content: 'hello',
      createdAt: new Date().toISOString(),
    });
    expect(parsed.role).toBe('user');
  });

  it('parses a tool call', () => {
    const parsed = ToolCall.parse({
      id: 't1',
      name: 'record_slot',
      args: { slot: 'persona', value: 'indie dev' },
    });
    expect(parsed.name).toBe('record_slot');
  });

  it('parses an element patch', () => {
    const parsed = ElementPatch.parse({ text: 'New headline' });
    expect(parsed.text).toBe('New headline');
  });
});
```

- [ ] **Step 2: Verify test fails**

Run: `pnpm --filter @you-design/shared exec vitest run src/chat.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `packages/shared/src/chat.ts`**

```typescript
import { z } from 'zod';

export const Role = z.enum(['user', 'assistant', 'critic', 'tool', 'system']);
export type Role = z.infer<typeof Role>;

export const ToolCall = z.object({
  id: z.string(),
  name: z.string(),
  args: z.record(z.unknown()),
});
export type ToolCall = z.infer<typeof ToolCall>;

export const ToolResult = z.object({
  toolCallId: z.string(),
  result: z.unknown(),
  isError: z.boolean().default(false),
});
export type ToolResult = z.infer<typeof ToolResult>;

export const ChatMessage = z.object({
  id: z.string(),
  role: Role,
  content: z.string(),
  toolCalls: z.array(ToolCall).optional(),
  toolResults: z.array(ToolResult).optional(),
  createdAt: z.string().datetime(),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const ElementPatch = z.object({
  text: z.string().optional(),
  classes: z.array(z.string()).optional(),
  attributes: z.record(z.string()).optional(),
});
export type ElementPatch = z.infer<typeof ElementPatch>;

export const Page = z.object({
  id: z.string(),
  path: z.string().regex(/^\/[a-z0-9\-/]*$/),
  title: z.string(),
  html: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Page = z.infer<typeof Page>;
```

- [ ] **Step 4: Export from index**

In `packages/shared/src/index.ts`:

```typescript
export * from './types.js';
export * from './intent.js';
export * from './chat.js';
```

- [ ] **Step 5: Run tests, expect pass**

Run: `pnpm --filter @you-design/shared exec vitest run`
Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/chat.ts packages/shared/src/chat.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): add chat, ToolCall, ToolResult, ElementPatch, Page schemas"
```

### Task 1.4: Workspace store (Zustand) — types and initial state

**Files:**
- Create: `apps/web/src/lib/workspace/store.ts`
- Create: `apps/web/src/lib/workspace/store.test.ts`

- [ ] **Step 1: Write failing test for initial state**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from './store.js';

describe('workspace store — initial', () => {
  beforeEach(() => {
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  });

  it('starts in intent collecting phase', () => {
    const s = useWorkspaceStore.getState();
    expect(s.intentPhase).toBe('collecting');
    expect(s.intentContract).toBeNull();
    expect(s.intentMessages).toEqual([]);
  });

  it('has no pages initially', () => {
    expect(useWorkspaceStore.getState().pages).toEqual({});
  });

  it('has empty current path', () => {
    expect(useWorkspaceStore.getState().currentPath).toBe('/');
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `pnpm --filter @you-design/web exec vitest run src/lib/workspace/store.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create store**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ChatMessage, Page, ElementPatch } from '@you-design/shared';
import type { IntentContract } from '@you-design/shared';

export type IntentPhase = 'collecting' | 'contracted' | 'building';

export interface WorkspaceState {
  intentPhase: IntentPhase;
  intentMessages: ChatMessage[];
  intentContract: IntentContract | null;

  pages: Record<string, Page>;
  currentPath: string;
  selectedElementId: string | null;

  buildMessages: ChatMessage[];
  isStreaming: boolean;
}

export interface WorkspaceActions {
  reset: () => void;
  setIntentPhase: (phase: IntentPhase) => void;
  appendIntentMessage: (msg: ChatMessage) => void;
  setIntentContract: (c: IntentContract | null) => void;
  appendBuildMessage: (msg: ChatMessage) => void;
  setStreaming: (s: boolean) => void;
  upsertPage: (page: Page) => void;
  removePage: (path: string) => void;
  setCurrentPath: (path: string) => void;
  setSelectedElement: (id: string | null) => void;
  updateCurrentPageHtml: (html: string) => void;
}

const INITIAL: WorkspaceState = {
  intentPhase: 'collecting',
  intentMessages: [],
  intentContract: null,
  pages: {},
  currentPath: '/',
  selectedElementId: null,
  buildMessages: [],
  isStreaming: false,
};

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      reset: () => set(INITIAL),
      setIntentPhase: (intentPhase) => set({ intentPhase }),
      appendIntentMessage: (msg) =>
        set((s) => ({ intentMessages: [...s.intentMessages, msg] })),
      setIntentContract: (intentContract) => set({ intentContract }),
      appendBuildMessage: (msg) =>
        set((s) => ({ buildMessages: [...s.buildMessages, msg] })),
      setStreaming: (isStreaming) => set({ isStreaming }),
      upsertPage: (page) =>
        set((s) => ({ pages: { ...s.pages, [page.path]: page } })),
      removePage: (path) =>
        set((s) => {
          const next = { ...s.pages };
          delete next[path];
          return { pages: next };
        }),
      setCurrentPath: (currentPath) => set({ currentPath, selectedElementId: null }),
      setSelectedElement: (selectedElementId) => set({ selectedElementId }),
      updateCurrentPageHtml: (html) => {
        const path = get().currentPath;
        const page = get().pages[path];
        if (!page) return;
        const updated: Page = {
          ...page,
          html,
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ pages: { ...s.pages, [path]: updated } }));
      },
    }),
    {
      name: 'you-design:workspace:v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        intentPhase: state.intentPhase,
        intentMessages: state.intentMessages,
        intentContract: state.intentContract,
        pages: state.pages,
        currentPath: state.currentPath,
        buildMessages: state.buildMessages,
      }),
    },
  ),
);
```

- [ ] **Step 4: Run, expect pass**

Run: `pnpm --filter @you-design/web exec vitest run src/lib/workspace/store.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/workspace/store.ts apps/web/src/lib/workspace/store.test.ts
git commit -m "feat(web): zustand workspace store with localStorage persistence"
```

### Task 1.5: Workspace store — actions

**Files:**
- Modify: `apps/web/src/lib/workspace/store.test.ts`

- [ ] **Step 1: Add action tests**

Append to `store.test.ts`:

```typescript
import { ulid } from 'nanoid';

describe('workspace store — actions', () => {
  beforeEach(() => {
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  });

  it('upserts a page', () => {
    const page = {
      id: 'p1',
      path: '/',
      title: 'Home',
      html: '<html><body><h1>Hi</h1></body></html>',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    useWorkspaceStore.getState().upsertPage(page);
    expect(useWorkspaceStore.getState().pages['/']).toEqual(page);
  });

  it('updates current page html', () => {
    const page = {
      id: 'p1',
      path: '/',
      title: 'Home',
      html: '<html><body><h1>Old</h1></body></html>',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    useWorkspaceStore.getState().upsertPage(page);
    useWorkspaceStore.getState().updateCurrentPageHtml(
      '<html><body><h1>New</h1></body></html>',
    );
    expect(useWorkspaceStore.getState().pages['/'].html).toContain('New');
  });

  it('reset clears all', () => {
    useWorkspaceStore.getState().upsertPage({
      id: 'p1',
      path: '/x',
      title: 'X',
      html: '<html></html>',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    useWorkspaceStore.getState().reset();
    expect(useWorkspaceStore.getState().pages).toEqual({});
  });
});
```

- [ ] **Step 2: Run, expect pass (actions already defined)**

Run: `pnpm --filter @you-design/web exec vitest run src/lib/workspace/store.test.ts`
Expected: 6 passing.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/workspace/store.test.ts
git commit -m "test(web): cover workspace store actions"
```

### Task 1.6: WorkspaceLayout — three-pane shell

**Files:**
- Create: `apps/web/src/components/workspace/WorkspaceLayout.tsx`
- Modify: `apps/web/src/app/app/page.tsx`

- [ ] **Step 1: Create layout component**

```tsx
'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';

export function WorkspaceLayout() {
  const { intentPhase, pages, currentPath } = useWorkspaceStore();
  return (
    <div className="h-screen flex flex-col">
      <header className="h-12 border-b border-[color:var(--color-border)] flex items-center px-4 text-sm">
        <span className="font-semibold">You Design</span>
        <span className="ml-3 text-[color:var(--color-muted)]">Workspace</span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-[color:var(--color-border)]">
          {intentPhase}
        </span>
      </header>
      <div className="flex-1 flex min-h-0">
        <aside className="w-56 border-r border-[color:var(--color-border)] overflow-y-auto">
          <div data-testid="sidebar">Sidebar</div>
          <div className="p-3 text-xs text-[color:var(--color-muted)]">
            {Object.keys(pages).length} pages · current {currentPath}
          </div>
        </aside>
        <section
          data-testid="canvas-area"
          className="flex-1 grid place-items-center bg-[color:var(--color-bg)] min-w-0"
        >
          <div className="text-[color:var(--color-muted)] text-sm">
            Canvas (will render iframe)
          </div>
        </section>
        <aside
          data-testid="chat-area"
          className="w-80 border-l border-[color:var(--color-border)] overflow-y-auto"
        >
          <div className="p-3 text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
            Chat
          </div>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Use it in `/app` page**

Replace `apps/web/src/app/app/page.tsx` content:

```tsx
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';

export const metadata = { title: 'Workspace' };

export default function AppShellPage() {
  return <WorkspaceLayout />;
}
```

- [ ] **Step 3: Run dev server, verify**

Run: `pnpm --filter @you-design/web dev`
Visit `http://localhost:3000/app`
Expected: three panes visible, status chip says "collecting", "0 pages · current /".

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/workspace/WorkspaceLayout.tsx apps/web/src/app/app/page.tsx
git commit -m "feat(web): three-pane WorkspaceLayout consuming Zustand store"
```

---

## Phase 2 — Week 2: HTML AST + Iframe + Edit

### Task 2.1: parse5 AST helpers — basic parse and serialize

**Files:**
- Create: `apps/web/src/lib/html/ast.ts`
- Create: `apps/web/src/lib/html/ast.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { parseHtml, toHtml } from './ast.js';

describe('html ast — parse/serialize', () => {
  it('round-trips a simple document', () => {
    const input = '<html><body><h1>Hi</h1></body></html>';
    const doc = parseHtml(input);
    const out = toHtml(doc);
    expect(out).toContain('<h1>Hi</h1>');
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `pnpm --filter @you-design/web exec vitest run src/lib/html/ast.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
import { parse, serialize } from 'parse5';
import type { Document } from 'parse5/dist/tree-adapters/default';

export type HtmlDoc = Document;

export function parseHtml(html: string): HtmlDoc {
  return parse(html);
}

export function toHtml(doc: HtmlDoc): string {
  return serialize(doc);
}
```

- [ ] **Step 4: Run, expect pass**

Same command. Expected: 1 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/html/ast.ts apps/web/src/lib/html/ast.test.ts
git commit -m "feat(web): parse5 wrapper for HTML AST parse/serialize"
```

### Task 2.2: ensureYdIds — assign data-yd-id to every element

**Files:**
- Modify: `apps/web/src/lib/html/ast.ts`
- Modify: `apps/web/src/lib/html/ast.test.ts`

- [ ] **Step 1: Add test**

Append:

```typescript
import { ensureYdIds, findElementById } from './ast.js';

describe('html ast — ensureYdIds', () => {
  it('adds data-yd-id to every element', () => {
    const doc = parseHtml('<html><body><h1>Hi</h1><p>X</p></body></html>');
    ensureYdIds(doc);
    const out = toHtml(doc);
    expect((out.match(/data-yd-id=/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('does not duplicate existing ids', () => {
    const doc = parseHtml(
      '<html><body><h1 data-yd-id="abc">Hi</h1></body></html>',
    );
    ensureYdIds(doc);
    const h1 = findElementById(doc, 'abc');
    expect(h1).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect fail**

Expected: FAIL — ensureYdIds not exported.

- [ ] **Step 3: Implement**

Append to `ast.ts`:

```typescript
import type { Element, ChildNode } from 'parse5/dist/tree-adapters/default';
import { nanoid } from 'nanoid';

function isElement(node: ChildNode): node is Element {
  return 'tagName' in node && Array.isArray((node as Element).attrs);
}

function walk(node: ChildNode | HtmlDoc, fn: (el: Element) => void): void {
  if ('childNodes' in node) {
    for (const child of node.childNodes) {
      if (isElement(child)) {
        fn(child);
        walk(child, fn);
      } else {
        walk(child as never, fn);
      }
    }
  }
}

function getAttr(el: Element, name: string): string | undefined {
  return el.attrs.find((a) => a.name === name)?.value;
}

function setAttr(el: Element, name: string, value: string): void {
  const existing = el.attrs.find((a) => a.name === name);
  if (existing) existing.value = value;
  else el.attrs.push({ name, value });
}

export function ensureYdIds(doc: HtmlDoc): void {
  walk(doc, (el) => {
    if (!getAttr(el, 'data-yd-id')) {
      setAttr(el, 'data-yd-id', nanoid(8));
    }
  });
}

export function findElementById(doc: HtmlDoc, id: string): Element | null {
  let found: Element | null = null;
  walk(doc, (el) => {
    if (getAttr(el, 'data-yd-id') === id) found = el;
  });
  return found;
}
```

- [ ] **Step 4: Run, expect pass**

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/html/ast.ts apps/web/src/lib/html/ast.test.ts
git commit -m "feat(web): ensureYdIds and findElementById helpers"
```

### Task 2.3: updateElement, addChild, removeElement

**Files:**
- Modify: `apps/web/src/lib/html/ast.ts`
- Modify: `apps/web/src/lib/html/ast.test.ts`

- [ ] **Step 1: Add tests**

```typescript
import { updateElement, addChild, removeElement } from './ast.js';

describe('html ast — mutations', () => {
  it('updates element text', () => {
    const doc = parseHtml('<html><body><h1 data-yd-id="a">Old</h1></body></html>');
    updateElement(doc, 'a', { text: 'New' });
    expect(toHtml(doc)).toContain('>New<');
  });

  it('updates element classes', () => {
    const doc = parseHtml('<html><body><h1 data-yd-id="a" class="text-xl">X</h1></body></html>');
    updateElement(doc, 'a', { classes: ['text-2xl', 'font-bold'] });
    expect(toHtml(doc)).toMatch(/class="text-2xl font-bold"/);
  });

  it('adds a child', () => {
    const doc = parseHtml('<html><body data-yd-id="body"></body></html>');
    addChild(doc, 'body', '<p>New</p>');
    expect(toHtml(doc)).toContain('<p>New</p>');
  });

  it('removes element', () => {
    const doc = parseHtml('<html><body><h1 data-yd-id="a">Bye</h1></body></html>');
    removeElement(doc, 'a');
    expect(toHtml(doc)).not.toContain('Bye');
  });
});
```

- [ ] **Step 2: Run, expect fail**

- [ ] **Step 3: Implement**

Append to `ast.ts`:

```typescript
import { parseFragment } from 'parse5';
import type { TextNode } from 'parse5/dist/tree-adapters/default';
import type { ElementPatch } from '@you-design/shared';

function isTextNode(node: ChildNode): node is TextNode {
  return (node as TextNode).nodeName === '#text';
}

export function updateElement(doc: HtmlDoc, id: string, patch: ElementPatch): void {
  const el = findElementById(doc, id);
  if (!el) return;
  if (patch.text !== undefined) {
    el.childNodes = [
      {
        nodeName: '#text',
        value: patch.text,
        parentNode: el,
      } as TextNode,
    ];
  }
  if (patch.classes !== undefined) {
    setAttr(el, 'class', patch.classes.join(' '));
  }
  if (patch.attributes !== undefined) {
    for (const [name, value] of Object.entries(patch.attributes)) {
      setAttr(el, name, value);
    }
  }
}

export function addChild(doc: HtmlDoc, parentId: string, html: string): void {
  const parent = findElementById(doc, parentId);
  if (!parent) return;
  const fragment = parseFragment(html);
  for (const node of fragment.childNodes) {
    (node as { parentNode?: unknown }).parentNode = parent;
    parent.childNodes.push(node);
  }
  ensureYdIds(doc);
}

export function removeElement(doc: HtmlDoc, id: string): void {
  const target = findElementById(doc, id);
  if (!target) return;
  const parent = (target as { parentNode?: Element }).parentNode;
  if (!parent || !('childNodes' in parent)) return;
  parent.childNodes = parent.childNodes.filter((n) => n !== target);
}
```

- [ ] **Step 4: Run, expect pass**

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/html/ast.ts apps/web/src/lib/html/ast.test.ts
git commit -m "feat(web): updateElement, addChild, removeElement AST mutators"
```

### Task 2.4: Iframe inject script (click detection + bounds)

**Files:**
- Create: `apps/web/src/components/canvas/inject-script.ts`

- [ ] **Step 1: Implement**

```typescript
export const INJECT_SCRIPT = `
(function () {
  const POST = (msg) => parent.postMessage({ source: 'you-design', ...msg }, '*');

  function getId(el) { return el.getAttribute && el.getAttribute('data-yd-id'); }

  document.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    const id = getId(e.target);
    if (!id) return;
    const r = e.target.getBoundingClientRect();
    POST({
      type: 'select',
      id,
      bounds: { x: r.x, y: r.y, w: r.width, h: r.height },
      tag: e.target.tagName.toLowerCase(),
      text: e.target.textContent || '',
      classes: (e.target.className || '').toString().split(/\\s+/).filter(Boolean),
    });
  }, true);

  document.addEventListener('click', function (e) {
    const a = e.target.closest && e.target.closest('a[href]');
    if (a) {
      e.preventDefault();
      POST({ type: 'navigate', href: a.getAttribute('href') });
    }
  }, false);

  POST({ type: 'ready' });
})();
`;
```

- [ ] **Step 2: Commit (no test — pure string, integration tested in 2.5)**

```bash
git add apps/web/src/components/canvas/inject-script.ts
git commit -m "feat(web): iframe inject script for click + navigate postMessage"
```

### Task 2.5: PreviewIframe component

**Files:**
- Create: `apps/web/src/components/canvas/PreviewIframe.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { INJECT_SCRIPT } from './inject-script';
import { parseHtml, ensureYdIds, toHtml } from '@/lib/html/ast';

const TAILWIND_CDN =
  'https://cdn.tailwindcss.com';

function withTailwindAndScript(html: string): string {
  const doc = parseHtml(html);
  ensureYdIds(doc);
  let body = toHtml(doc);
  if (!body.includes('cdn.tailwindcss.com')) {
    body = body.replace(
      /<head>/,
      `<head><script src="${TAILWIND_CDN}"></script>`,
    );
  }
  body = body.replace(
    /<\/body>/,
    `<script>${INJECT_SCRIPT}</script></body>`,
  );
  return body;
}

export function PreviewIframe() {
  const path = useWorkspaceStore((s) => s.currentPath);
  const page = useWorkspaceStore((s) => s.pages[s.currentPath]);
  const setSelected = useWorkspaceStore((s) => s.setSelectedElement);
  const setCurrentPath = useWorkspaceStore((s) => s.setCurrentPath);

  const ref = React.useRef<HTMLIFrameElement>(null);
  const [bounds, setBounds] = React.useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );

  React.useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.source !== 'you-design') return;
      if (e.data.type === 'select') {
        setSelected(e.data.id);
        setBounds(e.data.bounds);
      } else if (e.data.type === 'navigate') {
        setCurrentPath(e.data.href);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [setSelected, setCurrentPath]);

  if (!page) {
    return (
      <div className="text-sm text-[color:var(--color-muted)] text-center px-6">
        No page yet — finish the intent quiz and the designer agent will generate one.
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <iframe
        ref={ref}
        title="Preview"
        sandbox="allow-scripts allow-same-origin"
        srcDoc={withTailwindAndScript(page.html)}
        className="w-full h-full border-0 bg-white"
        key={path}
      />
      {bounds && (
        <div
          className="absolute pointer-events-none border-2 border-[color:var(--color-accent)] rounded"
          style={{ left: bounds.x, top: bounds.y, width: bounds.w, height: bounds.h }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into WorkspaceLayout**

In `WorkspaceLayout.tsx` replace the canvas area `<section>` body:

```tsx
import { PreviewIframe } from '@/components/canvas/PreviewIframe';

// ... inside layout:
<section data-testid="canvas-area" className="flex-1 relative bg-white min-w-0">
  <PreviewIframe />
</section>
```

- [ ] **Step 3: Manual verify**

Start dev: `pnpm --filter @you-design/web dev`
In browser console at `/app`:

```javascript
useWorkspaceStore = (await import('/_next/static/.../store.js')).useWorkspaceStore;
// or via React DevTools, but easier: temporarily add a button in WorkspaceLayout for now
```

Easier: temporarily add this to layout for manual test:

```tsx
<button
  onClick={() => {
    useWorkspaceStore.getState().upsertPage({
      id: 'demo',
      path: '/',
      title: 'Demo',
      html: '<html><head></head><body><h1 class="text-3xl p-8">Hi</h1></body></html>',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }}
>seed</button>
```

Click → iframe should show "Hi" headline. Click on "Hi" → selection outline appears.

Remove the temporary button before commit.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/canvas/PreviewIframe.tsx apps/web/src/components/workspace/WorkspaceLayout.tsx
git commit -m "feat(web): PreviewIframe with Tailwind CDN + selection overlay"
```

### Task 2.6: EditPanel component

**Files:**
- Create: `apps/web/src/components/canvas/EditPanel.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { parseHtml, updateElement, toHtml, findElementById } from '@/lib/html/ast';

export function EditPanel() {
  const selectedId = useWorkspaceStore((s) => s.selectedElementId);
  const page = useWorkspaceStore((s) => s.pages[s.currentPath]);
  const updateHtml = useWorkspaceStore((s) => s.updateCurrentPageHtml);
  const setSelected = useWorkspaceStore((s) => s.setSelectedElement);

  const [text, setText] = React.useState('');
  const [classes, setClasses] = React.useState('');
  const [tag, setTag] = React.useState('');

  React.useEffect(() => {
    if (!selectedId || !page) {
      setText('');
      setClasses('');
      setTag('');
      return;
    }
    const doc = parseHtml(page.html);
    const el = findElementById(doc, selectedId);
    if (!el) return;
    setTag(el.tagName);
    setClasses(el.attrs.find((a) => a.name === 'class')?.value ?? '');
    const textNode = el.childNodes.find((n) => n.nodeName === '#text') as
      | { value: string }
      | undefined;
    setText(textNode?.value ?? '');
  }, [selectedId, page]);

  if (!selectedId || !page) return null;

  const save = () => {
    const doc = parseHtml(page.html);
    updateElement(doc, selectedId, {
      text,
      classes: classes.split(/\s+/).filter(Boolean),
    });
    updateHtml(toHtml(doc));
  };

  return (
    <div className="absolute right-0 top-0 h-full w-80 bg-[color:var(--color-bg)] border-l border-[color:var(--color-border)] p-4 z-10 shadow-xl flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase text-[color:var(--color-muted)]">Element</div>
          <div className="font-mono text-sm">&lt;{tag}&gt;</div>
        </div>
        <button
          onClick={() => setSelected(null)}
          className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
        >
          ✕
        </button>
      </div>
      <label className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
        Text
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="w-full p-2 text-sm border border-[color:var(--color-border)] rounded bg-transparent"
      />
      <label className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
        Classes
      </label>
      <input
        value={classes}
        onChange={(e) => setClasses(e.target.value)}
        className="w-full p-2 text-sm font-mono border border-[color:var(--color-border)] rounded bg-transparent"
      />
      <button
        onClick={save}
        className="mt-2 px-4 py-2 rounded-md bg-[color:var(--color-fg)] text-[color:var(--color-bg)] text-sm"
      >
        Save
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Wire into WorkspaceLayout (overlay over canvas area)**

In WorkspaceLayout canvas section:

```tsx
<section data-testid="canvas-area" className="flex-1 relative bg-white min-w-0">
  <PreviewIframe />
  <EditPanel />
</section>
```

- [ ] **Step 3: Manual verify**

Seed page, click element → EditPanel opens → change text → Save → iframe updates.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/canvas/EditPanel.tsx apps/web/src/components/workspace/WorkspaceLayout.tsx
git commit -m "feat(web): EditPanel with text and class editing wired to AST"
```

---

## Phase 3 — Week 3: LLM SSE Proxy + Intent Agent

### Task 3.1: API config — require ANTHROPIC_API_KEY

**Files:**
- Modify: `apps/api/src/config.ts`

- [ ] **Step 1: Make key required**

Change in `EnvSchema`:

```typescript
ANTHROPIC_API_KEY: z.string().min(1),
```

- [ ] **Step 2: Update .env.example comment**

Change in `.env.example`:

```
ANTHROPIC_API_KEY=sk-ant-...   # REQUIRED from M1
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/config.ts .env.example
git commit -m "feat(api): require ANTHROPIC_API_KEY for M1"
```

### Task 3.2: Anthropic client singleton

**Files:**
- Create: `apps/api/src/lib/anthropic.ts`

- [ ] **Step 1: Implement**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config.js';

export const anthropic = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/lib/anthropic.ts
git commit -m "feat(api): anthropic client singleton"
```

### Task 3.3: LLM SSE proxy route

**Files:**
- Create: `apps/api/src/routes/llm.ts`
- Modify: `apps/api/src/server.ts`

- [ ] **Step 1: Implement route**

```typescript
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { anthropic } from '../lib/anthropic.js';

const Body = z.object({
  system: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.union([
        z.string(),
        z.array(
          z.object({
            type: z.enum(['text', 'tool_use', 'tool_result']),
            text: z.string().optional(),
            id: z.string().optional(),
            name: z.string().optional(),
            input: z.unknown().optional(),
            tool_use_id: z.string().optional(),
            content: z.unknown().optional(),
          }),
        ),
      ]),
    }),
  ),
  tools: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        input_schema: z.record(z.unknown()),
      }),
    )
    .optional(),
  model: z.string().default('claude-sonnet-4-6'),
  max_tokens: z.number().int().positive().default(4096),
});

export async function llmRoutes(app: FastifyInstance) {
  app.post('/llm/stream', { schema: { body: Body } }, async (req, reply) => {
    const body = req.body as z.infer<typeof Body>;

    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders();

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\n`);
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const stream = await anthropic.messages.stream({
        model: body.model,
        max_tokens: body.max_tokens,
        system: body.system,
        messages: body.messages as never,
        tools: body.tools as never,
      });

      for await (const event of stream) {
        send(event.type, event);
      }

      const final = await stream.finalMessage();
      send('final', final);
      reply.raw.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      send('error', { message });
      reply.raw.end();
    }
  });
}
```

- [ ] **Step 2: Register in server**

In `apps/api/src/server.ts` add import and register:

```typescript
import { llmRoutes } from './routes/llm.js';

// inside main, after projectsRoutes:
await app.register(llmRoutes, { prefix: '/api/v1' });
```

- [ ] **Step 3: Manual smoke**

Set `ANTHROPIC_API_KEY` in `.env`. Start API: `pnpm --filter @you-design/api dev`
Run:

```bash
curl -N -X POST http://localhost:3001/api/v1/llm/stream \
  -H 'Content-Type: application/json' \
  -d '{"system":"You are a test bot.","messages":[{"role":"user","content":"say hi in one word"}]}'
```

Expected: SSE events streaming, final event with assistant reply.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/llm.ts apps/api/src/server.ts
git commit -m "feat(api): SSE proxy /api/v1/llm/stream to Anthropic"
```

### Task 3.4: Client LLM stream consumer

**Files:**
- Create: `apps/web/src/lib/llm/client.ts`

- [ ] **Step 1: Implement**

```typescript
export interface LlmRequest {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: unknown }>;
  tools?: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>;
  model?: string;
  max_tokens?: number;
}

export interface LlmEvent {
  type: string;
  data: unknown;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function* streamLlm(req: LlmRequest, signal?: AbortSignal): AsyncGenerator<LlmEvent> {
  const res = await fetch(`${API_BASE}/api/v1/llm/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.body) throw new Error('No response body');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const raw of events) {
      const lines = raw.split('\n');
      let eventType = '';
      let dataStr = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) eventType = line.slice(7);
        else if (line.startsWith('data: ')) dataStr += line.slice(6);
      }
      if (eventType && dataStr) {
        yield { type: eventType, data: JSON.parse(dataStr) };
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/llm/client.ts
git commit -m "feat(web): SSE consumer for /api/v1/llm/stream"
```

### Task 3.5: Intent agent — system prompt and tool defs

**Files:**
- Create: `apps/web/src/lib/chat/intent-agent.ts`

- [ ] **Step 1: Implement**

```typescript
export const INTENT_SYSTEM_PROMPT = `You are the Intent Agent for You Design.
Your job is to extract a precise intent contract from a vague user brief through conversation.

You have 4 slots to fill: persona, primaryAction, emotion, successMetric.

Rules:
- Ask ONE question at a time. Never multiple in a single reply.
- If the user answers vaguely ("for everyone", "be cool", "make money", "look professional"),
  call the \`challenge\` tool with a specific reason. Then re-ask with sharper framing.
- Once a slot is reasonably specific, record it with \`record_slot\`.
- When all 4 slots are filled, call \`summarize_contract\` with the contract.
- Honest critic mode: do NOT flatter. Push back when answers are too broad.
- Never proceed to design generation. That's the designer agent's job.
- Be concise. No emoji. No exclamation marks.
- If the user is being defensive, briefly explain why specificity matters.

Slot definitions:
- persona: who the design is for. Must include role + context. NOT "everyone" or "users".
- primaryAction: the single most important thing the visitor should do. Verb + object.
- emotion: the feeling in the first 3 seconds. Must be specific adjective(s), not "good".
- successMetric: a measurable outcome. Number or percentage with a name.

Start with: "Quick — who is this for?"`;

export const INTENT_TOOLS = [
  {
    name: 'record_slot',
    description: 'Record a filled intent slot when the user answer is specific enough.',
    input_schema: {
      type: 'object',
      properties: {
        slot: {
          type: 'string',
          enum: ['persona', 'primaryAction', 'emotion', 'successMetric'],
        },
        value: { type: 'string' },
      },
      required: ['slot', 'value'],
    },
  },
  {
    name: 'challenge',
    description: 'Issue a critic challenge when the user answer is too vague. Include a specific reason.',
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string' },
        sharperQuestion: { type: 'string' },
      },
      required: ['reason', 'sharperQuestion'],
    },
  },
  {
    name: 'summarize_contract',
    description: 'Once all four slots are filled, propose the intent contract for user approval.',
    input_schema: {
      type: 'object',
      properties: {
        persona: { type: 'string' },
        primaryAction: { type: 'string' },
        emotion: { type: 'string' },
        successMetric: { type: 'string' },
        domain: { type: 'string', enum: ['general'] },
      },
      required: ['persona', 'primaryAction', 'emotion', 'successMetric', 'domain'],
    },
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/chat/intent-agent.ts
git commit -m "feat(web): intent agent system prompt and tool definitions"
```

### Task 3.6: ChatPanel — render messages

**Files:**
- Create: `apps/web/src/components/chat/ChatPanel.tsx`
- Create: `apps/web/src/components/chat/ChatMessage.tsx`
- Create: `apps/web/src/components/chat/CriticBubble.tsx`
- Create: `apps/web/src/components/chat/Composer.tsx`

- [ ] **Step 1: ChatMessage component**

```tsx
import * as React from 'react';
import type { ChatMessage as ChatMessageT } from '@you-design/shared';

export function ChatMessage({ msg }: { msg: ChatMessageT }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
          isUser
            ? 'bg-[color:var(--color-accent)] text-white'
            : 'bg-[color:var(--color-border)]'
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: CriticBubble**

```tsx
import * as React from 'react';

export function CriticBubble({ reason }: { reason: string }) {
  return (
    <div className="border-l-2 border-orange-500 pl-3 py-1 text-xs text-[color:var(--color-muted)]">
      <span className="font-semibold text-orange-500 uppercase tracking-wider mr-2">
        Critic
      </span>
      {reason}
    </div>
  );
}
```

- [ ] **Step 3: Composer**

```tsx
'use client';

import * as React from 'react';

export function Composer({
  onSend,
  disabled,
  placeholder,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = React.useState('');
  const send = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
  };
  return (
    <form
      className="border-t border-[color:var(--color-border)] p-2 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder ?? 'Answer...'}
        rows={2}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        className="flex-1 px-2 py-1 text-sm border border-[color:var(--color-border)] rounded bg-transparent resize-none"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="px-3 py-1 text-sm rounded bg-[color:var(--color-fg)] text-[color:var(--color-bg)] disabled:opacity-40"
      >
        Send
      </button>
    </form>
  );
}
```

- [ ] **Step 4: ChatPanel shell (intent phase only for now)**

```tsx
'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { ChatMessage } from './ChatMessage';
import { CriticBubble } from './CriticBubble';
import { Composer } from './Composer';

export function ChatPanel() {
  const intentMessages = useWorkspaceStore((s) => s.intentMessages);
  const isStreaming = useWorkspaceStore((s) => s.isStreaming);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {intentMessages.length === 0 && (
          <div className="text-sm text-[color:var(--color-muted)]">
            Quick — who is this for?
          </div>
        )}
        {intentMessages.map((m) =>
          m.role === 'critic' ? (
            <CriticBubble key={m.id} reason={m.content} />
          ) : (
            <ChatMessage key={m.id} msg={m} />
          ),
        )}
        {isStreaming && (
          <div className="text-xs text-[color:var(--color-muted)] italic">thinking...</div>
        )}
      </div>
      <Composer
        onSend={(t) => {
          /* wired in next task */
          console.log('send', t);
        }}
        disabled={isStreaming}
      />
    </div>
  );
}
```

- [ ] **Step 5: Wire into WorkspaceLayout chat-area**

Replace chat area with `<ChatPanel />`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/chat/ apps/web/src/components/workspace/WorkspaceLayout.tsx
git commit -m "feat(web): ChatPanel + ChatMessage + CriticBubble + Composer"
```

### Task 3.7: Wire intent agent — send + tool handlers

**Files:**
- Modify: `apps/web/src/components/chat/ChatPanel.tsx`

- [ ] **Step 1: Implement send + intent loop**

Replace ChatPanel with:

```tsx
'use client';

import * as React from 'react';
import { nanoid } from 'nanoid';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { ChatMessage } from './ChatMessage';
import { CriticBubble } from './CriticBubble';
import { Composer } from './Composer';
import { IntentContractCard } from './IntentContractCard';
import { streamLlm } from '@/lib/llm/client';
import { INTENT_SYSTEM_PROMPT, INTENT_TOOLS } from '@/lib/chat/intent-agent';
import type { ChatMessage as ChatMessageT } from '@you-design/shared';

function toAnthropicMessages(messages: ChatMessageT[]) {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

export function ChatPanel() {
  const intentPhase = useWorkspaceStore((s) => s.intentPhase);
  const intentMessages = useWorkspaceStore((s) => s.intentMessages);
  const isStreaming = useWorkspaceStore((s) => s.isStreaming);
  const append = useWorkspaceStore((s) => s.appendIntentMessage);
  const setStreaming = useWorkspaceStore((s) => s.setStreaming);
  const setContract = useWorkspaceStore((s) => s.setIntentContract);
  const setPhase = useWorkspaceStore((s) => s.setIntentPhase);

  const send = async (text: string) => {
    const userMsg: ChatMessageT = {
      id: nanoid(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    append(userMsg);
    setStreaming(true);

    let assistantText = '';
    try {
      const messages = toAnthropicMessages([...intentMessages, userMsg]);
      for await (const ev of streamLlm({
        system: INTENT_SYSTEM_PROMPT,
        messages,
        tools: INTENT_TOOLS,
      })) {
        if (ev.type === 'content_block_delta') {
          const d = ev.data as { delta?: { text?: string } };
          if (d.delta?.text) assistantText += d.delta.text;
        } else if (ev.type === 'final') {
          const final = ev.data as {
            content: Array<{ type: string; name?: string; input?: Record<string, unknown> }>;
          };
          for (const block of final.content) {
            if (block.type === 'tool_use') {
              if (block.name === 'challenge') {
                append({
                  id: nanoid(),
                  role: 'critic',
                  content: String(block.input?.reason ?? ''),
                  createdAt: new Date().toISOString(),
                });
                if (block.input?.sharperQuestion) {
                  assistantText = String(block.input.sharperQuestion);
                }
              } else if (block.name === 'summarize_contract') {
                setContract(block.input as never);
                setPhase('contracted');
              }
            }
          }
        }
      }
      if (assistantText) {
        append({
          id: nanoid(),
          role: 'assistant',
          content: assistantText,
          createdAt: new Date().toISOString(),
        });
      }
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {intentMessages.length === 0 && (
          <div className="text-sm text-[color:var(--color-muted)]">
            Quick — who is this for?
          </div>
        )}
        {intentMessages.map((m) =>
          m.role === 'critic' ? (
            <CriticBubble key={m.id} reason={m.content} />
          ) : (
            <ChatMessage key={m.id} msg={m} />
          ),
        )}
        {intentPhase === 'contracted' && <IntentContractCard />}
        {isStreaming && (
          <div className="text-xs text-[color:var(--color-muted)] italic">thinking...</div>
        )}
      </div>
      <Composer onSend={send} disabled={isStreaming || intentPhase !== 'collecting'} />
    </div>
  );
}
```

- [ ] **Step 2: Commit (IntentContractCard added next task)**

```bash
git add apps/web/src/components/chat/ChatPanel.tsx
git commit -m "feat(web): wire intent agent — send, stream, handle tool calls"
```

### Task 3.8: IntentContractCard with Approve

**Files:**
- Create: `apps/web/src/components/chat/IntentContractCard.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';

export function IntentContractCard() {
  const contract = useWorkspaceStore((s) => s.intentContract);
  const setPhase = useWorkspaceStore((s) => s.setIntentPhase);

  if (!contract) return null;

  const fields: Array<[string, string]> = [
    ['Persona', contract.persona.role],
    ['Action', contract.primaryAction],
    ['Emotion', contract.emotion],
    ['Success', contract.successMetrics[0]?.name ?? ''],
    ['Domain', contract.domain],
  ];

  return (
    <div className="border border-[color:var(--color-border)] rounded-lg p-3 mt-2 bg-[color:var(--color-bg)]">
      <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted)] mb-2">
        Intent Contract
      </div>
      <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {fields.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="text-[color:var(--color-muted)]">{k}</dt>
            <dd>{v}</dd>
          </React.Fragment>
        ))}
      </dl>
      <button
        onClick={() => setPhase('building')}
        className="mt-3 w-full px-3 py-2 rounded bg-[color:var(--color-fg)] text-[color:var(--color-bg)] text-sm"
      >
        Approve & build
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Note about IntentContract shape**

The intent agent returns a flat object (`persona: string`, etc.) but `IntentContract` in shared expects nested `persona: { role, ... }` etc. Add a coercion in store action `setIntentContract`:

Modify `store.ts` setIntentContract:

```typescript
setIntentContract: (raw: any) => {
  if (!raw) return set({ intentContract: null });
  const normalized = {
    persona: typeof raw.persona === 'string' ? { role: raw.persona } : raw.persona,
    primaryAction: raw.primaryAction,
    emotion: raw.emotion,
    domain: raw.domain ?? 'general',
    successMetrics: raw.successMetric
      ? [{ name: raw.successMetric, target: raw.successMetric }]
      : raw.successMetrics ?? [],
    constraints: raw.constraints ?? [],
  };
  set({ intentContract: normalized });
},
```

- [ ] **Step 3: Test full intent flow manually**

Start API + web. Visit /app. Answer "Quick — who is this for?" with "everyone".
Expected: Critic challenge, asks for specificity.
Continue answering through 4 slots until contract card appears with Approve button.
Click Approve → phase changes to "building".

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/chat/IntentContractCard.tsx apps/web/src/lib/workspace/store.ts
git commit -m "feat(web): IntentContractCard with approve action, normalize contract shape"
```

---

## Phase 4 — Week 4: Designer Agent + Multi-page

### Task 4.1: Designer agent system prompt + tools

**Files:**
- Create: `apps/web/src/lib/chat/designer-agent.ts`

- [ ] **Step 1: Implement**

```typescript
export function designerSystemPrompt(contract: {
  persona: { role: string };
  primaryAction: string;
  emotion: string;
  domain: string;
}): string {
  return `You are the Designer Agent for You Design.

The intent contract has been approved:
- Persona: ${contract.persona.role}
- Primary action: ${contract.primaryAction}
- Emotion: ${contract.emotion}
- Domain: ${contract.domain}

Your job: generate or modify HTML + Tailwind v4 pages that fulfill the contract.

HARD RULES:
- Output complete HTML documents only: <html><head></head><body>...</body></html>.
- Use Tailwind utility classes only. No inline styles. No external CSS. No <style> tags.
- No JSX. No React components. No imports.
- Semantic HTML: <header>, <main>, <section>, <nav>, <footer>, <article> where appropriate.
- Default a11y: alt text on every img, label every input, aria-current on nav, focus-visible classes.
- Use <a href="/path"> for internal navigation. The host runtime intercepts these.
- Every page must reflect the persona, primary action, and emotion above.
- Be opinionated. Make real design choices. Don't ask "what color should the button be" — pick one and justify if asked later.

WHEN MODIFYING:
- If the user asks to change a specific element (text, color, layout), use update_element with the data-yd-id.
- If the user asks to add to a page, use add_element with parentId.
- If the user asks for a new page, use write_page with a path like '/pricing' or '/about'.
- After tool calls, give a one-line summary of what you did. No flattery.

START:
On your first turn after the contract, immediately call write_page with path "/" — the homepage — with a full landing page that nails the persona/action/emotion.`;
}

export const DESIGNER_TOOLS = [
  {
    name: 'write_page',
    description:
      'Create or fully replace a page. Use for new pages or major rewrites. HTML must be a complete document.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path starting with / (e.g. "/", "/pricing")' },
        title: { type: 'string', description: 'Browser tab title' },
        html: { type: 'string', description: 'Complete HTML document' },
      },
      required: ['path', 'title', 'html'],
    },
  },
  {
    name: 'update_element',
    description:
      'Patch a single element identified by its data-yd-id on a given page path.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        elementId: { type: 'string' },
        patch: {
          type: 'object',
          properties: {
            text: { type: 'string' },
            classes: { type: 'array', items: { type: 'string' } },
            attributes: { type: 'object', additionalProperties: { type: 'string' } },
          },
        },
      },
      required: ['path', 'elementId', 'patch'],
    },
  },
  {
    name: 'add_element',
    description:
      'Append a new HTML fragment inside a parent element (by id) on a given page.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        parentId: { type: 'string' },
        html: { type: 'string' },
      },
      required: ['path', 'parentId', 'html'],
    },
  },
  {
    name: 'navigate',
    description: 'Set the active page in the workspace.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/chat/designer-agent.ts
git commit -m "feat(web): designer agent system prompt + tools"
```

### Task 4.2: Designer tool dispatcher

**Files:**
- Create: `apps/web/src/lib/chat/designer-dispatch.ts`

- [ ] **Step 1: Implement**

```typescript
import { nanoid } from 'nanoid';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { parseHtml, ensureYdIds, updateElement, addChild, toHtml } from '@/lib/html/ast';
import type { ElementPatch, Page } from '@you-design/shared';

export function dispatchDesignerTool(
  name: string,
  input: Record<string, unknown>,
): { ok: boolean; note: string } {
  const store = useWorkspaceStore.getState();
  switch (name) {
    case 'write_page': {
      const { path, title, html } = input as { path: string; title: string; html: string };
      const doc = parseHtml(html);
      ensureYdIds(doc);
      const finalHtml = toHtml(doc);
      const existing = store.pages[path];
      const now = new Date().toISOString();
      const page: Page = {
        id: existing?.id ?? nanoid(),
        path,
        title,
        html: finalHtml,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      store.upsertPage(page);
      store.setCurrentPath(path);
      return { ok: true, note: `Wrote ${path}` };
    }
    case 'update_element': {
      const { path, elementId, patch } = input as {
        path: string;
        elementId: string;
        patch: ElementPatch;
      };
      const page = store.pages[path];
      if (!page) return { ok: false, note: `No page at ${path}` };
      const doc = parseHtml(page.html);
      updateElement(doc, elementId, patch);
      const updated = toHtml(doc);
      store.upsertPage({ ...page, html: updated, updatedAt: new Date().toISOString() });
      return { ok: true, note: `Updated ${elementId} on ${path}` };
    }
    case 'add_element': {
      const { path, parentId, html } = input as {
        path: string;
        parentId: string;
        html: string;
      };
      const page = store.pages[path];
      if (!page) return { ok: false, note: `No page at ${path}` };
      const doc = parseHtml(page.html);
      addChild(doc, parentId, html);
      const updated = toHtml(doc);
      store.upsertPage({ ...page, html: updated, updatedAt: new Date().toISOString() });
      return { ok: true, note: `Added to ${parentId} on ${path}` };
    }
    case 'navigate': {
      const { path } = input as { path: string };
      store.setCurrentPath(path);
      return { ok: true, note: `Navigated to ${path}` };
    }
    default:
      return { ok: false, note: `Unknown tool: ${name}` };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/chat/designer-dispatch.ts
git commit -m "feat(web): designer tool dispatcher to workspace store"
```

### Task 4.3: ChatPanel — building phase

**Files:**
- Modify: `apps/web/src/components/chat/ChatPanel.tsx`

- [ ] **Step 1: Add building-phase send handler**

Replace ChatPanel with combined intent + building. The key addition: when `intentPhase === 'building'`, switch to designer agent.

Replace the send function to switch by phase:

```tsx
'use client';

import * as React from 'react';
import { nanoid } from 'nanoid';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { ChatMessage } from './ChatMessage';
import { CriticBubble } from './CriticBubble';
import { Composer } from './Composer';
import { IntentContractCard } from './IntentContractCard';
import { streamLlm } from '@/lib/llm/client';
import { INTENT_SYSTEM_PROMPT, INTENT_TOOLS } from '@/lib/chat/intent-agent';
import { designerSystemPrompt, DESIGNER_TOOLS } from '@/lib/chat/designer-agent';
import { dispatchDesignerTool } from '@/lib/chat/designer-dispatch';
import type { ChatMessage as ChatMessageT } from '@you-design/shared';

function toAnthropicMessages(messages: ChatMessageT[]) {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
}

export function ChatPanel() {
  const intentPhase = useWorkspaceStore((s) => s.intentPhase);
  const intentMessages = useWorkspaceStore((s) => s.intentMessages);
  const buildMessages = useWorkspaceStore((s) => s.buildMessages);
  const isStreaming = useWorkspaceStore((s) => s.isStreaming);
  const contract = useWorkspaceStore((s) => s.intentContract);
  const appendIntent = useWorkspaceStore((s) => s.appendIntentMessage);
  const appendBuild = useWorkspaceStore((s) => s.appendBuildMessage);
  const setStreaming = useWorkspaceStore((s) => s.setStreaming);
  const setContract = useWorkspaceStore((s) => s.setIntentContract);
  const setPhase = useWorkspaceStore((s) => s.setIntentPhase);

  const messages = intentPhase === 'building' ? buildMessages : intentMessages;
  const append = intentPhase === 'building' ? appendBuild : appendIntent;

  const sendIntent = async (text: string) => {
    const userMsg: ChatMessageT = {
      id: nanoid(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    appendIntent(userMsg);
    setStreaming(true);
    let assistantText = '';
    try {
      const history = toAnthropicMessages([...intentMessages, userMsg]);
      for await (const ev of streamLlm({
        system: INTENT_SYSTEM_PROMPT,
        messages: history,
        tools: INTENT_TOOLS,
      })) {
        if (ev.type === 'content_block_delta') {
          const d = ev.data as { delta?: { text?: string } };
          if (d.delta?.text) assistantText += d.delta.text;
        } else if (ev.type === 'final') {
          const final = ev.data as {
            content: Array<{ type: string; name?: string; input?: Record<string, unknown> }>;
          };
          for (const block of final.content) {
            if (block.type === 'tool_use') {
              if (block.name === 'challenge') {
                appendIntent({
                  id: nanoid(),
                  role: 'critic',
                  content: String(block.input?.reason ?? ''),
                  createdAt: new Date().toISOString(),
                });
                if (block.input?.sharperQuestion) {
                  assistantText = String(block.input.sharperQuestion);
                }
              } else if (block.name === 'summarize_contract') {
                setContract(block.input as never);
                setPhase('contracted');
              }
            }
          }
        }
      }
      if (assistantText) {
        appendIntent({
          id: nanoid(),
          role: 'assistant',
          content: assistantText,
          createdAt: new Date().toISOString(),
        });
      }
    } finally {
      setStreaming(false);
    }
  };

  const sendBuild = async (text: string) => {
    if (!contract) return;
    const userMsg: ChatMessageT = {
      id: nanoid(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    appendBuild(userMsg);
    setStreaming(true);
    let assistantText = '';
    try {
      const history = toAnthropicMessages([...buildMessages, userMsg]);
      for await (const ev of streamLlm({
        system: designerSystemPrompt(contract),
        messages: history,
        tools: DESIGNER_TOOLS,
      })) {
        if (ev.type === 'content_block_delta') {
          const d = ev.data as { delta?: { text?: string } };
          if (d.delta?.text) assistantText += d.delta.text;
        } else if (ev.type === 'final') {
          const final = ev.data as {
            content: Array<{ type: string; name?: string; input?: Record<string, unknown> }>;
          };
          for (const block of final.content) {
            if (block.type === 'tool_use') {
              const result = dispatchDesignerTool(
                block.name as string,
                (block.input ?? {}) as Record<string, unknown>,
              );
              appendBuild({
                id: nanoid(),
                role: 'tool',
                content: result.note,
                createdAt: new Date().toISOString(),
              });
            }
          }
        }
      }
      if (assistantText) {
        appendBuild({
          id: nanoid(),
          role: 'assistant',
          content: assistantText,
          createdAt: new Date().toISOString(),
        });
      }
    } finally {
      setStreaming(false);
    }
  };

  // Trigger first-page generation when entering building phase with empty buildMessages
  React.useEffect(() => {
    if (intentPhase === 'building' && buildMessages.length === 0) {
      sendBuild('Generate the homepage now.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentPhase]);

  const send = intentPhase === 'building' ? sendBuild : sendIntent;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {intentPhase !== 'building' && intentMessages.length === 0 && (
          <div className="text-sm text-[color:var(--color-muted)]">
            Quick — who is this for?
          </div>
        )}
        {messages.map((m) =>
          m.role === 'critic' ? (
            <CriticBubble key={m.id} reason={m.content} />
          ) : m.role === 'tool' ? (
            <div
              key={m.id}
              className="text-xs text-[color:var(--color-muted)] italic"
            >
              {m.content}
            </div>
          ) : (
            <ChatMessage key={m.id} msg={m} />
          ),
        )}
        {intentPhase === 'contracted' && <IntentContractCard />}
        {isStreaming && (
          <div className="text-xs text-[color:var(--color-muted)] italic">thinking...</div>
        )}
      </div>
      <Composer
        onSend={send}
        disabled={isStreaming || intentPhase === 'contracted'}
        placeholder={
          intentPhase === 'building' ? 'Refine the page or add a new one...' : 'Answer...'
        }
      />
    </div>
  );
}
```

- [ ] **Step 2: Manual end-to-end smoke**

Visit /app → complete intent quiz → click Approve → designer agent should generate first page → iframe shows it.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/chat/ChatPanel.tsx
git commit -m "feat(web): designer phase in ChatPanel, auto-trigger first-page gen"
```

### Task 4.4: PageList sidebar

**Files:**
- Create: `apps/web/src/components/sidebar/PageList.tsx`
- Create: `apps/web/src/components/sidebar/IntentChip.tsx`
- Modify: `apps/web/src/components/workspace/WorkspaceLayout.tsx`

- [ ] **Step 1: PageList**

```tsx
'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';

export function PageList() {
  const pages = useWorkspaceStore((s) => s.pages);
  const currentPath = useWorkspaceStore((s) => s.currentPath);
  const setCurrentPath = useWorkspaceStore((s) => s.setCurrentPath);
  const removePage = useWorkspaceStore((s) => s.removePage);

  const list = Object.values(pages).sort((a, b) => a.path.localeCompare(b.path));

  return (
    <div className="p-2">
      <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted)] mb-2 px-1">
        Pages
      </div>
      {list.length === 0 && (
        <div className="text-xs italic text-[color:var(--color-muted)] px-1">No pages yet</div>
      )}
      <ul className="flex flex-col gap-0.5">
        {list.map((p) => (
          <li
            key={p.path}
            className={`flex items-center justify-between px-2 py-1 rounded text-sm cursor-pointer ${
              p.path === currentPath
                ? 'bg-[color:var(--color-border)] font-medium'
                : 'hover:bg-[color:var(--color-border)]'
            }`}
            onClick={() => setCurrentPath(p.path)}
          >
            <span className="font-mono truncate">{p.path}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete ${p.path}?`)) removePage(p.path);
              }}
              className="text-xs text-[color:var(--color-muted)] hover:text-red-500 ml-2"
              title="Delete page"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: IntentChip**

```tsx
'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';

export function IntentChip() {
  const contract = useWorkspaceStore((s) => s.intentContract);
  if (!contract) return null;
  return (
    <div className="p-2 border-t border-[color:var(--color-border)]">
      <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted)] mb-1">
        Intent
      </div>
      <div className="text-xs space-y-0.5">
        <div><span className="text-[color:var(--color-muted)]">For:</span> {contract.persona.role}</div>
        <div><span className="text-[color:var(--color-muted)]">Action:</span> {contract.primaryAction}</div>
        <div><span className="text-[color:var(--color-muted)]">Feel:</span> {contract.emotion}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into sidebar**

Replace WorkspaceLayout sidebar:

```tsx
<aside className="w-56 border-r border-[color:var(--color-border)] overflow-y-auto flex flex-col">
  <PageList />
  <div className="flex-1" />
  <IntentChip />
</aside>
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/sidebar/ apps/web/src/components/workspace/WorkspaceLayout.tsx
git commit -m "feat(web): PageList + IntentChip in sidebar"
```

### Task 4.5: Streaming HTML buffering (close-tag heuristic)

**Files:**
- Modify: `apps/web/src/lib/chat/designer-dispatch.ts`

The risk: designer LLM may emit invalid mid-stream HTML if we render token-by-token. Our current dispatch only runs on `final` tool_use, so this is already safe. But add a guard for malformed HTML.

- [ ] **Step 1: Add validation in write_page**

In `dispatchDesignerTool` write_page case, wrap parse in try/catch:

```typescript
case 'write_page': {
  const { path, title, html } = input as { path: string; title: string; html: string };
  let finalHtml: string;
  try {
    const doc = parseHtml(html);
    ensureYdIds(doc);
    finalHtml = toHtml(doc);
  } catch (err) {
    return {
      ok: false,
      note: `Invalid HTML for ${path}: ${err instanceof Error ? err.message : 'parse failed'}`,
    };
  }
  // ... rest same
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/chat/designer-dispatch.ts
git commit -m "fix(web): guard write_page against unparseable HTML"
```

---

## Phase 5 — Week 5: Polish + Code Editor + E2E

### Task 5.1: Tailwind class autocomplete list

**Files:**
- Create: `apps/web/src/lib/html/tailwind-classes.ts`

- [ ] **Step 1: Implement static list**

```typescript
// Curated subset of Tailwind v4 utilities most used by the designer agent + manual edits.
// Full list would be ~10000 classes; this is ~500 of the most common.
export const TAILWIND_CLASSES = [
  // layout
  'flex', 'inline-flex', 'grid', 'block', 'inline', 'inline-block', 'hidden',
  'flex-col', 'flex-row', 'flex-wrap', 'flex-1', 'flex-none',
  'items-start', 'items-center', 'items-end', 'items-stretch',
  'justify-start', 'justify-center', 'justify-end', 'justify-between', 'justify-around',
  'gap-0', 'gap-1', 'gap-2', 'gap-3', 'gap-4', 'gap-5', 'gap-6', 'gap-8', 'gap-10', 'gap-12',

  // spacing
  ...['p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml'].flatMap(
    (p) => ['0', '1', '2', '3', '4', '5', '6', '8', '10', '12', '16', '20', '24', '32'].map((v) => `${p}-${v}`),
  ),
  'mx-auto',

  // sizing
  ...['w', 'h', 'max-w', 'min-h'].flatMap((p) =>
    ['full', 'screen', 'auto', '1/2', '1/3', '2/3', '1/4', '3/4'].map((v) => `${p}-${v}`),
  ),
  'min-h-screen', 'h-screen',

  // typography
  'text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl', 'text-6xl',
  'font-thin', 'font-light', 'font-normal', 'font-medium', 'font-semibold', 'font-bold', 'font-extrabold',
  'text-left', 'text-center', 'text-right',
  'leading-none', 'leading-tight', 'leading-snug', 'leading-normal', 'leading-relaxed',
  'tracking-tight', 'tracking-normal', 'tracking-wide',

  // color
  ...['text', 'bg', 'border'].flatMap((p) =>
    ['black', 'white', 'transparent'].flatMap((c) =>
      [`${p}-${c}`],
    ),
  ),
  ...['text', 'bg', 'border'].flatMap((p) =>
    ['gray', 'red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'purple', 'pink'].flatMap((c) =>
      ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'].map((s) => `${p}-${c}-${s}`),
    ),
  ),

  // border / radius
  'border', 'border-0', 'border-2', 'border-4',
  'rounded', 'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-full',

  // effects
  'shadow', 'shadow-sm', 'shadow-md', 'shadow-lg', 'shadow-xl', 'shadow-2xl', 'shadow-none',
  'opacity-0', 'opacity-25', 'opacity-50', 'opacity-75', 'opacity-100',

  // misc
  'cursor-pointer', 'select-none', 'pointer-events-none',
  'overflow-hidden', 'overflow-auto', 'overflow-y-auto',
  'transition', 'transition-all', 'duration-150', 'duration-300',
] as const;

export type TailwindClass = typeof TAILWIND_CLASSES[number];
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/html/tailwind-classes.ts
git commit -m "feat(web): static Tailwind class autocomplete list"
```

### Task 5.2: Class autocomplete in EditPanel

**Files:**
- Modify: `apps/web/src/components/canvas/EditPanel.tsx`

- [ ] **Step 1: Add basic autocomplete (datalist)**

In EditPanel before the classes input add:

```tsx
import { TAILWIND_CLASSES } from '@/lib/html/tailwind-classes';
```

Replace the classes input with:

```tsx
<input
  value={classes}
  onChange={(e) => setClasses(e.target.value)}
  list="tw-classes"
  className="w-full p-2 text-sm font-mono border border-[color:var(--color-border)] rounded bg-transparent"
/>
<datalist id="tw-classes">
  {TAILWIND_CLASSES.map((c) => (
    <option key={c} value={c} />
  ))}
</datalist>
```

(Note: `datalist` is per-token only with browser support quirks. Acceptable for M1. Real autocomplete later.)

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/canvas/EditPanel.tsx
git commit -m "feat(web): datalist-backed Tailwind class hints in EditPanel"
```

### Task 5.3: CodePanel — Monaco for current page HTML

**Files:**
- Create: `apps/web/src/components/canvas/CodePanel.tsx`
- Modify: `apps/web/src/components/workspace/WorkspaceLayout.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { parseHtml, ensureYdIds, toHtml } from '@/lib/html/ast';

const Editor = dynamic(() => import('@monaco-editor/react').then((m) => m.default), {
  ssr: false,
});

export function CodePanel() {
  const page = useWorkspaceStore((s) => s.pages[s.currentPath]);
  const updateHtml = useWorkspaceStore((s) => s.updateCurrentPageHtml);

  if (!page) return null;

  return (
    <Editor
      height="100%"
      defaultLanguage="html"
      value={page.html}
      onChange={(value) => {
        if (typeof value !== 'string') return;
        try {
          const doc = parseHtml(value);
          ensureYdIds(doc);
          updateHtml(toHtml(doc));
        } catch {
          // ignore mid-typing invalid HTML
        }
      }}
      theme="vs-dark"
      options={{
        minimap: { enabled: false },
        fontSize: 12,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
      }}
    />
  );
}
```

- [ ] **Step 2: Add a code/preview tabs toggle in canvas area**

Replace WorkspaceLayout canvas section:

```tsx
const [view, setView] = React.useState<'preview' | 'code'>('preview');

// inside layout:
<section className="flex-1 relative bg-white min-w-0 flex flex-col">
  <div className="h-8 border-b border-[color:var(--color-border)] flex items-center text-xs px-2 gap-2">
    <button
      onClick={() => setView('preview')}
      className={`px-2 py-0.5 rounded ${view === 'preview' ? 'bg-[color:var(--color-border)]' : ''}`}
    >
      Preview
    </button>
    <button
      onClick={() => setView('code')}
      className={`px-2 py-0.5 rounded ${view === 'code' ? 'bg-[color:var(--color-border)]' : ''}`}
    >
      Code
    </button>
  </div>
  <div className="flex-1 relative">
    {view === 'preview' ? <PreviewIframe /> : <CodePanel />}
    {view === 'preview' && <EditPanel />}
  </div>
</section>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/canvas/CodePanel.tsx apps/web/src/components/workspace/WorkspaceLayout.tsx
git commit -m "feat(web): Monaco-backed CodePanel + preview/code tab toggle"
```

### Task 5.4: Playwright E2E for full demo

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/demo.spec.ts`

- [ ] **Step 1: Install playwright**

Run:

```bash
pnpm --filter @you-design/web add -D @playwright/test
pnpm --filter @you-design/web exec playwright install chromium
```

- [ ] **Step 2: playwright.config.ts**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

- [ ] **Step 3: e2e/demo.spec.ts**

Note: this test mocks LLM responses via a request interception, since CI cannot call Anthropic.

```typescript
import { test, expect } from '@playwright/test';

test('intent quiz -> approve -> mocked designer writes homepage -> click to edit', async ({
  page,
}) => {
  // Mock SSE: intercept POST /api/v1/llm/stream and respond with canned events
  await page.route('**/api/v1/llm/stream', async (route) => {
    const body = route.request().postDataJSON();
    const isIntent = body.system.includes('Intent Agent');

    let payload: string;
    if (isIntent && body.messages.length === 1) {
      payload = sseEvents([
        { event: 'final', data: { content: [{ type: 'text', text: 'And what action?' }] } },
      ]);
    } else if (isIntent && body.messages.length === 3) {
      payload = sseEvents([
        {
          event: 'final',
          data: {
            content: [
              {
                type: 'tool_use',
                name: 'summarize_contract',
                input: {
                  persona: 'indie dev shipping a SaaS',
                  primaryAction: 'start free trial',
                  emotion: 'confident, minimal',
                  successMetric: 'trial CVR > 5%',
                  domain: 'general',
                },
              },
            ],
          },
        },
      ]);
    } else {
      // designer first turn
      payload = sseEvents([
        {
          event: 'final',
          data: {
            content: [
              {
                type: 'tool_use',
                name: 'write_page',
                input: {
                  path: '/',
                  title: 'Home',
                  html: '<html><head></head><body><h1 class="text-3xl p-8">Hello World</h1></body></html>',
                },
              },
            ],
          },
        },
      ]);
    }

    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: payload,
    });
  });

  await page.goto('/app');
  await page.getByRole('textbox').fill('indie devs building SaaS');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('And what action?')).toBeVisible();

  await page.getByRole('textbox').fill('start free trial');
  await page.getByRole('button', { name: 'Send' }).click();

  // Intent contract card appears
  await expect(page.getByText('Intent Contract')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Approve & build' }).click();

  // Designer should auto-trigger; wait for iframe content
  const iframe = page.frameLocator('iframe');
  await expect(iframe.getByText('Hello World')).toBeVisible({ timeout: 10_000 });
});

function sseEvents(events: Array<{ event: string; data: unknown }>): string {
  return events
    .map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join('');
}
```

- [ ] **Step 4: Run**

```bash
pnpm --filter @you-design/web exec playwright test
```

Expected: 1 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/playwright.config.ts apps/web/e2e/demo.spec.ts apps/web/package.json pnpm-lock.yaml
git commit -m "test(web): E2E Playwright for M1 demo path (mocked LLM)"
```

### Task 5.5: README update with M1 demo notes

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace Quick Start section**

Change the Quick Start block to:

```markdown
## Quick Start (M1 — alpha)

Requires: Node 22, pnpm 9, Docker 25+, an Anthropic API key.

```bash
git clone https://github.com/sabahattink/you-design.git
cd you-design
cp .env.example .env
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env   # required for M1
docker compose -f compose.dev.yml up -d        # Postgres + Redis (dev mode)
pnpm install
pnpm dev
```

Open http://localhost:3000/app and try the demo flow:

1. Answer "Quick — who is this for?" with a vague reply ("everyone") — observe the critic
2. Refine through 4 questions: persona, action, emotion, success metric
3. Click **Approve & build** when the contract appears
4. The designer agent generates the homepage; click any element to edit
5. Ask the chat to "add a pricing page"
6. Refresh — your workspace persists in localStorage
```

- [ ] **Step 2: Update Roadmap section**

Change M1 entry from "(5 weeks)" to "(in progress)" — and mark M0 ✅.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: M1 demo instructions in README"
```

### Task 5.6: Tag v0.1.0-alpha

**Files:**
- (no file changes — git tag)

- [ ] **Step 1: Verify CI green on main**

Check `https://github.com/sabahattink/you-design/actions` — last commit on main must show green CI.

- [ ] **Step 2: Tag and push**

```bash
git tag -a v0.1.0-alpha -m "M1: Workspace + Intent — first demoable build"
git push origin v0.1.0-alpha
```

- [ ] **Step 3: Verify release workflow**

GitHub Actions should run `.github/workflows/release.yml` automatically — Docker images published as `ghcr.io/sabahattink/you-design-{web,api}:v0.1.0-alpha`.

- [ ] **Step 4: Done**

GitHub release page should show v0.1.0-alpha with auto-generated notes.

---

## Self-Review (post-write)

Checked against spec:
- ✅ Demo Definition: every step covered by tasks 1.6, 2.5, 2.6, 3.x, 4.x, 5.4
- ✅ Three-pane layout: 1.6
- ✅ HTML AST + data-yd-id: 2.1-2.3
- ✅ Iframe rendering + click selection: 2.4-2.5
- ✅ EditPanel: 2.6
- ✅ LLM SSE proxy: 3.1-3.3
- ✅ Intent agent: 3.5, 3.7, 3.8
- ✅ Designer agent + multi-page: 4.1-4.4
- ✅ localStorage: 1.4 (persist middleware)
- ✅ Monaco code panel: 5.3
- ✅ E2E test: 5.4
- ✅ Performance budget verification → covered by manual smoke + Playwright (no separate Lighthouse task; M1 is alpha)

Placeholder scan: no TBDs, all code shown. The Tailwind class list in 5.1 is finite by design (M1 scope).

Type consistency: `IntentContract` shape mismatch between flat agent output and nested shared type handled in 3.8 normalization step.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-16-M1-workspace-intent.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Good for ~40 tasks across 5 weeks.

2. **Inline Execution** — Execute tasks in this session using executing-plans, batch with checkpoints. Better when you want to watch every step.

Which approach?
