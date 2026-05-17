# M1 — Workspace Core + Intent (Design Spec)

**Date:** 2026-05-16
**Milestone:** M1 (5 weeks)
**Subsystems:** Workspace Core (full) + Intent Engine (minimal) + LLM Brain (minimal)
**Status:** Draft — pending user review

---

## Context

M0 shipped an empty scaffold (Next.js + Fastify + Docker + AGPL). M1 is the first **demoable** milestone. It must prove the product's core promise — a brief is questioned, critic challenges vague answers, then a real working HTML preview emerges that the user can edit both visually and in code.

Without M1, the project is just a README. With M1, it's a tool that any solo maker can try in a browser and immediately feel the difference from V0 / Lovable / Bolt.

## Demo Definition (the only thing that matters)

> A first-time visitor opens `/app`. A chat asks: "Who is this for? What action should they take? What emotion should it produce? How will you know it worked?" The user answers casually. The critic agent challenges vague answers ("'everyone' isn't a persona — narrow it down"). After 4-6 turns the intent contract is summarized and shown. The user approves. The workspace generates the first HTML page on the canvas. The user clicks an element on the canvas — an edit panel opens with that element's attributes. They change the headline text. The canvas updates instantly. They open the code panel — the HTML reflects the same change. They ask the chat to "add a second page for pricing". A new page appears in the sidebar. They click between pages. They close the browser. They come back tomorrow — everything is still there (localStorage).

Five weeks. No multiplayer. No domain templates. No PPTX export. No multi-LLM. Just this one loop, tight.

## Non-Goals (explicit)

- ❌ Multiplayer / CRDT (M5)
- ❌ Multi-LLM smart routing (M2)
- ❌ Persistent project memory across sessions on different devices (M2 with auth)
- ❌ Domain expertise templates beyond "general" (M2)
- ❌ Multi-agent room — only critic + designer agents (M4 brings copywriter/a11y/dev)
- ❌ PPTX/PDF/MP4 export (M3)
- ❌ Custom MCP plugins (M6)
- ❌ React/JSX output — only HTML + Tailwind (M3 introduces Next.js export)
- ❌ Auth — anonymous localStorage only

## Architecture Decisions (resolved during brainstorm)

| Decision       | Choice                                             | Reason                                                       |
| -------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| Canvas model   | **HTML iframe rendering**                          | Code is single source of truth; pixel-perfect preview        |
| Iframe runtime | **Plain HTML + Tailwind via srcdoc**               | Instant render, low RAM, perfect alignment with M3 exporters |
| AST tooling    | **parse5 / hast**                                  | Battle-tested HTML AST, immutable transforms                 |
| Intent quiz UX | **Conversational chat**                            | Honest critic can challenge vague answers naturally          |
| First domain   | **General (no domain)**                            | Reduce scope; critic still works on intent semantics         |
| Page structure | **Multi-page HTML files + path-based routing**     | More realistic; navigation between pages is core UX          |
| Persistence    | **localStorage (anonymous)**                       | No auth complexity; refresh-safe; device-isolated            |
| Code editor    | **Monaco**                                         | Standard, low-friction                                       |
| LLM            | **Claude Sonnet 4.6 only** (single provider in M1) | Best coding model; router comes in M2                        |

## System Components

### 1. `apps/web/src/app/app/page.tsx` — Workspace shell

Three-pane layout:

- **Left sidebar (224px):** Page list, file tree, intent contract chip
- **Center:** Canvas iframe (full width minus panels) with edit overlay
- **Right (320px):** Chat panel (intent agent, then designer agent, with critic interrupts)

State management: Zustand store, single workspace per browser, persisted to localStorage via `zustand/middleware`.

### 2. `apps/web/src/lib/workspace/store.ts` — Zustand store

```typescript
interface WorkspaceStore {
  // Intent phase
  intentPhase: 'collecting' | 'contracted' | 'building';
  intentMessages: ChatMessage[];
  intentContract: IntentContract | null;

  // Building phase
  pages: Record<string, Page>; // key = path ("/", "/about", "/pricing")
  currentPath: string;
  selectedElementId: string | null; // data-yd-id of clicked element

  // Chat
  buildMessages: ChatMessage[];
  isStreaming: boolean;

  // Actions
  sendIntentReply: (text: string) => Promise<void>;
  approveIntent: () => Promise<void>;
  sendBuildPrompt: (text: string) => Promise<void>;
  selectElement: (id: string | null) => void;
  updateElement: (id: string, patch: ElementPatch) => void;
  navigateTo: (path: string) => void;
  addPage: (path: string) => void;
}
```

### 3. `apps/web/src/components/canvas/PreviewIframe.tsx` — Canvas

The iframe renders the current page's HTML via `srcdoc`. A small injected script:

- Walks the DOM, assigns `data-yd-id` to every element (UUID generated client-side if not present in source)
- Listens for clicks → `postMessage({ type: 'select', id })` to parent
- Listens for `parent.postMessage({ type: 'highlight', id })` → draws a styled outline

The parent component shows an absolute-positioned overlay on top of the iframe with selection handles (top-left coords from iframe via postMessage `bounds`).

### 4. `apps/web/src/components/canvas/EditPanel.tsx` — Inline element editor

When `selectedElementId` is set:

- Shows the selected element's tag, classes, text content
- Allows editing inline (text input, class autocomplete from Tailwind list)
- Save → `store.updateElement(id, patch)` → store re-renders HTML → iframe srcdoc updates

### 5. `apps/web/src/lib/html/ast.ts` — HTML AST utilities

```typescript
import { parse, serialize } from 'parse5';

export function parseHtml(html: string): Document;
export function ensureYdIds(doc: Document): Document; // adds data-yd-id to every element
export function findElementById(doc: Document, id: string): Element | null;
export function updateElement(doc: Document, id: string, patch: ElementPatch): Document;
export function addChild(doc: Document, parentId: string, html: string): Document;
export function removeElement(doc: Document, id: string): Document;
export function toHtml(doc: Document): string;
```

All transforms return new documents (immutable).

### 6. `apps/web/src/lib/chat/intent-agent.ts` — Intent agent (M1 minimal)

A system prompt that:

- Asks one question at a time, conversationally
- Has 4 internal slots: `persona`, `primaryAction`, `emotion`, `successMetric`
- After each user reply, parses to fill slots, asks follow-up if unclear
- Critic mode: if answer is generic ("everyone", "be successful"), challenges it
- Once all 4 slots are filled, summarizes contract and offers approval

Tool calls:

- `record_slot(slot: string, value: string)` — fills a slot
- `challenge(reason: string)` — emits a critic warning, asks for refinement
- `summarize_contract(contract: IntentContract)` — proposes contract for approval

### 7. `apps/web/src/lib/chat/designer-agent.ts` — Designer agent

After intent approval, takes over the chat. Generates HTML pages.

Tool calls:

- `write_page(path: string, html: string)` — creates/replaces a page
- `update_element(pageId: string, elementId: string, patch: ElementPatch)`
- `add_element(pageId: string, parentId: string, html: string)`
- `navigate(path: string)` — change current page
- `list_pages()` — for self-awareness

System prompt emphasizes:

- Output is HTML + Tailwind only (no JSX, no external CSS)
- Respect the intent contract (persona, emotion, primary action)
- Generate semantic HTML (h1/h2/section/nav/main/footer)
- Default a11y: alt text, ARIA where needed, keyboard-navigable
- Tailwind classes only (no inline styles)

### 8. `apps/api/src/routes/llm.ts` — LLM proxy endpoint

POST `/api/v1/llm/stream` — SSE endpoint that proxies to Anthropic.

- Body: `{ messages: ChatMessage[], tools: ToolDef[], system: string }`
- Streams tokens + tool calls back to client
- API key from env (M1 server-side only; M2 introduces BYOK from UI)

This route handles all LLM traffic. The client never sees the API key.

### 9. localStorage schema

Key: `you-design:workspace:v1`
Value: serialized `WorkspaceStore` state (omitting transient fields like `isStreaming`).

Migration: on load, version mismatch → reset workspace (with confirm dialog).

## Data Flow — First Project End-to-End

```
1. User visits /app
   → Empty workspace shell. Chat opens with: "What are we building?"

2. User: "A landing page for my project management app for solo founders"
   → Intent agent: parses → persona slot tentatively "solo founder", asks: "Solo founder of what kind of business?"

3. User: "Indie devs building SaaS products"
   → persona slot: "Indie dev building SaaS, solo, time-constrained"
   → Next q: "When they land on the page, what one action do you want them to take?"

4. User: "Start a free trial"
   → primaryAction: "start free trial"
   → Next: "What feeling should the page give them in the first 3 seconds?"

5. User: "Confident, no BS, fast"
   → emotion: "confident, minimal, urgent"
   → Last: "How will you know the page worked? What's the metric?"

6. User: "Free trial signups per visitor over 5%"
   → successMetric: "trial signup CVR > 5%"
   → Agent: "Here's your contract — [shows summary]. Approve to start building?"

7. User clicks Approve
   → Intent stored, designer agent activates
   → Designer agent says: "Building your first page..." and starts streaming HTML to the canvas
   → Canvas shows progressively: nav, hero, features, CTA, footer

8. User clicks the hero headline
   → Edit panel slides in with element text, classes
   → User changes headline, clicks save
   → Iframe re-renders instantly

9. User in chat: "Add a pricing page"
   → Designer agent: write_page("/pricing", "<...>")
   → Sidebar adds "/pricing"
   → Designer auto-navigates to /pricing to show it

10. User closes browser, reopens tomorrow
    → localStorage restores workspace
    → Sees same pages, same intent contract, can resume chat
```

## File Changes

### New files

```
apps/web/src/
├── app/app/page.tsx                          # MODIFIED — full workspace shell
├── components/
│   ├── canvas/
│   │   ├── PreviewIframe.tsx
│   │   ├── EditPanel.tsx
│   │   └── inject-script.ts                  # script injected into iframe
│   ├── chat/
│   │   ├── ChatPanel.tsx
│   │   ├── ChatMessage.tsx
│   │   ├── CriticBubble.tsx                  # special styling for critic challenges
│   │   └── IntentContractCard.tsx
│   └── sidebar/
│       ├── PageList.tsx
│       └── IntentChip.tsx
├── lib/
│   ├── workspace/
│   │   ├── store.ts                          # Zustand store
│   │   └── persistence.ts                    # localStorage adapter
│   ├── html/
│   │   ├── ast.ts                            # parse5 helpers
│   │   └── tailwind-classes.ts               # autocomplete list
│   ├── chat/
│   │   ├── intent-agent.ts                   # system prompt + tool handlers
│   │   ├── designer-agent.ts
│   │   └── stream.ts                         # SSE client
│   └── llm/
│       └── client.ts                         # POSTs to /api/v1/llm/stream

apps/api/src/
└── routes/
    └── llm.ts                                # SSE proxy to Anthropic

packages/shared/src/
└── chat.ts                                   # ChatMessage, ToolCall, ElementPatch types
```

### Modified files

- `apps/web/package.json` — adds: `zustand`, `parse5`, `@ai-sdk/anthropic`, `ai` (Vercel AI SDK), `monaco-editor`, `nanoid`
- `apps/api/package.json` — adds: `@anthropic-ai/sdk`, `@ai-sdk/anthropic`, `ai`
- `apps/web/src/app/app/page.tsx` — replaced by full implementation
- `packages/shared/src/index.ts` — exports `chat.ts`

### Dependencies summary

```jsonc
// apps/web
"zustand": "^5.0.2",
"parse5": "^7.2.1",
"@ai-sdk/anthropic": "^1.0.6",
"ai": "^4.0.20",
"monaco-editor": "^0.52.0",
"@monaco-editor/react": "^4.6.0",
"nanoid": "^5.0.9",

// apps/api
"@anthropic-ai/sdk": "^0.34.0",
"@ai-sdk/anthropic": "^1.0.6",
"ai": "^4.0.20"
```

## LLM Prompt Strategy

### Intent agent system prompt (sketch)

> You are the Intent Agent for You Design. Your job is to extract a precise intent contract from a vague user brief through conversation. You have 4 slots: persona, primaryAction, emotion, successMetric.
>
> Rules:
>
> - Ask ONE question at a time. Never multiple.
> - If the user answers vaguely ("for everyone", "be cool", "make money"), call the `challenge` tool with a specific reason. Then re-ask with sharper framing.
> - Once a slot is reasonably specific, record it with `record_slot`.
> - When all 4 slots are filled, call `summarize_contract` with the contract.
> - Honest critic mode: do NOT flatter. Push back when answers are too broad.
> - Never proceed to design generation. That's the designer agent's job.

### Designer agent system prompt (sketch)

> You are the Designer Agent for You Design. The intent contract has been approved. Your job is to generate HTML+Tailwind pages that fulfill it.
>
> Rules:
>
> - Output HTML + Tailwind v4 classes only. No inline styles. No external CSS. No JSX.
> - Semantic HTML: use `<header>`, `<main>`, `<section>`, `<nav>`, `<footer>` correctly.
> - Default a11y: alt text on images, ARIA where appropriate, sufficient color contrast.
> - Every page is a complete HTML document with `<html>`, `<head>`, `<body>`. No `<!DOCTYPE>` (added by us).
> - Use `<a href="/path">` for internal links. The runtime intercepts these.
> - Respect the intent contract: persona (audience), primaryAction (CTA focus), emotion (visual tone).
> - When user asks to change something specific, use `update_element` not `write_page` (preserve other parts).
> - When user asks for a new page, use `write_page` with a sensible path.

## Verification Plan

### Functional verification (manual demo path)

1. ✅ Visit `/app` cold — see empty workspace + opening chat prompt
2. ✅ Answer intent questions; verify critic challenges "everyone" / "make money"
3. ✅ See contract summary, click Approve
4. ✅ See designer generating first HTML, streaming on canvas
5. ✅ Click hero headline; edit text; verify canvas + code panel update
6. ✅ Add Tailwind class via edit panel; verify it applies
7. ✅ Ask chat to add "/pricing" page; verify sidebar updates, navigation works
8. ✅ Close browser, reopen; verify state restored
9. ✅ Refresh page mid-stream; verify graceful recovery (last successful state)
10. ✅ Iframe XSS check: malicious LLM output cannot escape sandbox

### Performance verification

- LLM first token < 2s
- Iframe srcdoc render < 100ms after HTML change
- Edit panel save → canvas reflect < 200ms
- localStorage write debounced 500ms
- Total workspace bundle < 1.5MB gzipped (excl. Monaco lazy load)

### Tests

- `lib/html/ast.test.ts` — parse5 helpers (ensureYdIds, updateElement, etc.) — vitest
- `lib/workspace/store.test.ts` — Zustand actions, localStorage persistence — vitest
- `lib/chat/intent-agent.test.ts` — system prompt + tool dispatch with mocked LLM — vitest
- E2E: Playwright script that completes the demo path end-to-end (mocked LLM responses)

## Risks & Open Questions

| Risk                                                       | Mitigation                                                           |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| LLM streams malformed HTML mid-stream → iframe broken      | Buffer until each tag closes; or render only on tool call boundaries |
| Tailwind v4 JIT requires build step (canvas can't compile) | Ship Tailwind CDN script inside iframe srcdoc + safelist of classes  |
| `data-yd-id` collisions across page re-renders             | nanoid + stable across edits (preserve id on update)                 |
| Iframe-to-parent postMessage origin spoofing               | Use unique random token per session, validate every message          |
| Chat context grows unbounded                               | Trim to last N turns; M2 adds vector memory                          |
| User pastes own HTML — yd-ids missing                      | `ensureYdIds()` runs on every page load + every external write       |
| Tool call schema drift between client and agent            | Generate schemas from shared Zod types (single source)               |
| Anthropic rate limits                                      | Server-side queue; surface friendly error in chat                    |

### Open questions (defer to implementation, decide as encountered)

1. Monaco file editor — show all pages as tabs, or one at a time? (Likely tabs.)
2. Edit panel UX — sliding right-side panel, or inline popover near selection? (Likely sliding.)
3. Class autocomplete — fetch Tailwind classes statically, or via API? (Static; ~5KB JSON.)
4. Streaming HTML preview — debounce or buffer until tag close? (Buffer to closing tag.)
5. Multi-page navigation in iframe — intercept `<a href>` clicks and update store, or let iframe fully reload? (Intercept.)
6. Element delete UX — keyboard shortcut, or button in edit panel? (Both.)
7. Chat history retention across iterations on same intent — keep full history or summarize? (Keep full for M1, summarize in M2.)
8. Error recovery if iframe srcdoc crashes — show error overlay with "report" button? (Yes.)

## Out-of-scope discoveries (parking lot for M2+)

- Component reuse across pages (header/footer)
- Theme tokens (currently inline Tailwind colors)
- Image asset management (upload, browse)
- Brand kit upload (logo, fonts)
- Multi-LLM routing (Claude Opus for critic, Haiku for fast edits)
- pgvector memory for long projects
- Export to Next.js project (M3)
- Multiplayer cursors (M5)

## Timeline (5 weeks)

| Week | Focus                                                                      |
| ---- | -------------------------------------------------------------------------- |
| 1    | Workspace shell + Zustand store + localStorage + iframe rendering          |
| 2    | parse5 AST utilities + data-yd-id injection + click-to-select + edit panel |
| 3    | LLM SSE proxy + Vercel AI SDK + intent agent (chat + tool calls)           |
| 4    | Designer agent + multi-page support + sidebar page list + navigation       |
| 5    | Polish: streaming buffering, error recovery, E2E test, demo recording      |

Each week ends with a `feat:` commit and a tagged checkpoint on GitHub.

## Approval Required Before Implementation

- [ ] User confirms demo definition matches expectation
- [ ] User confirms non-goals (no multiplayer, single LLM, etc.) are acceptable
- [ ] User confirms localStorage-only is acceptable for M1
- [ ] User confirms Multi-page over Single page (already confirmed)

If approved, next step: invoke `writing-plans` skill to produce a numbered, executable task list (Week-by-week, agent-friendly).
