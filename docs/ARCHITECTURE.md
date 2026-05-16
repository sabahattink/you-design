# Architecture

> High-level system design. For the detailed master plan see: `~/.claude/plans/open-design-claude-design-sleepy-cat.md`.

## Wedge

Existing AI design/code tools are "output generators, sycophantic, intent-less." You Design defines a new category: **honest, multi-agent, living, local-first**.

## Product Position

> "Questions the brief, criticizes honestly, navigates across resolutions, covers copy and a11y, works with a multi-agent expert team, iterates on real post-deploy analytics — locally."

## 9 Subsystems

| # | Subsystem | Responsibility | Milestone |
|---|-----------|----------------|-----------|
| 1 | **Workspace Core** | Canvas + code editor + bidirectional sync + file tree | M1 |
| 2 | **LLM Brain** | Multi-LLM smart router + streaming chat + agent tools + pgvector memory + BYOK | M1 (minimal) → M2 (full) |
| 3 | **Multi-Format Pipeline** | Web + PPTX + PDF + MP4/GIF + iOS exporters + Vercel deploy + npm extraction | M3 (web/PPTX/PDF) → M6 (motion/iOS) |
| 4 | **Multiplayer** | Y.js CRDT + Hocuspocus + cursor presence + permissions | M5 |
| 5 | **MCP Plugin Ecosystem** | MCP host runtime + marketplace UI + sandbox | M6 |
| 6 | **Self-Host Distribution** | Docker compose + env validation + admin UI + onboarding | M0 (skeleton) → M2 (BYOK UI) |
| 7 | **Intent Engine + Critic** | Intent quiz + brief guardrail + domain templates + honest critic agent | M1 (minimal) → M2 (full) |
| 8 | **Multi-Agent Room** | 5 specialized agents (designer/copy/a11y/dev/critic) + canvas annotations + arbitration | M4 |
| 9 | **Living Loop** | Analytics integration + design git (branch/merge directions) + feedback synthesis | M5 |

## Data Flow (high level)

```
User brief
   ↓
Intent Engine (Subsystem 7) — quiz + contract
   ↓
LLM Brain (Subsystem 2) — multi-LLM smart routing
   ↓
Workspace Core (Subsystem 1) — canvas + code state
   ↓
Multi-Agent Room (Subsystem 8) — 5 parallel agents
   ↓
User accept/reject + iteration
   ↓
Multi-Format Pipeline (Subsystem 3) — export
   ↓
Deploy
   ↓
Living Loop (Subsystem 9) — analytics feedback
   ↓
(loop back to Intent / Critic)
```

## Stack Summary

- **Frontend:** Next.js 15, React 19, TypeScript, shadcn/ui, Tailwind, Tldraw, Monaco
- **Backend:** Fastify 5, TypeScript, Zod, Pino
- **Realtime:** Y.js + Hocuspocus (CRDT)
- **DB:** Postgres 16 + pgvector, Drizzle ORM
- **Queue:** BullMQ + Redis 7
- **Render:** Playwright (headless Chromium) + FFmpeg
- **LLM:** Vercel AI SDK + custom cost-aware router
- **Plugin:** MCP protocol
- **Self-host:** Docker compose (single file)
- **Desktop (opt):** Tauri

## Monorepo Layout

```
you-design/
├── apps/
│   ├── web/         # Next.js 15 (frontend + marketing)
│   └── api/         # Fastify (REST + SSE + WebSocket)
├── packages/
│   ├── shared/      # types, zod schemas, utils
│   ├── ui/          # shadcn components, Tailwind preset
│   ├── db/          # Drizzle schema + migrations
│   └── llm/         # LLM router (M2)
├── docker/
└── docs/
```

## Multi-LLM Routing (Subsystem 2, M2)

| Task type | Default model | Why |
|-----------|--------------|-----|
| Judgment / honest critic | Claude Opus 4.7 | deepest reasoning |
| Main generation | Claude Sonnet 4.6 | best coding model |
| Fast edits, autocomplete | Claude Haiku 4.5 | 3x cheaper, ~90% capability |
| Vision (canvas screenshot analysis) | Gemini 2.0 Flash | cheapest vision |
| Embeddings (memory) | text-embedding-3-large | pgvector compatible dims |

## License Strategy

- **AGPL-3.0-or-later** — blocks SaaS forks (network use = source release obligation)
- Commercial license available separately (future)
- Brand/logo trademarked separately

## Security

- BYOK → via env or admin UI, encrypted at rest in Postgres
- MCP plugins run isolated in Docker containers, explicit user consent required
- Rate limiting on every endpoint (Redis-backed)
- CORS whitelist from env
- AGPL clause: telemetry opt-in, default off
