# Changelog

All notable changes to **You Design** are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

While the project is in `alpha`, breaking changes may land in any minor version.

## [Unreleased]

(empty)

## [0.10.0-alpha] — 2026-05-17 — Multiplayer (M5b)

### Added

- **`apps/collab`** — a standalone Hocuspocus WebSocket server on **port 3002**,
  backed by Postgres via `@hocuspocus/extension-database`. Authenticates by
  checking the project ID exists (alpha — real auth in M5c).
- **`project_collab_docs`** Drizzle schema + migration 0003. One row per
  project, holds the base64 Y.Doc snapshot, cascade-deletes with the project.
- **Web collab module** (`apps/web/src/lib/collab`):
  - `acquireYDoc(projectId)` — refcounted singleton that wires `yjs` +
    `HocuspocusProvider` + `y-indexeddb` together. Switching project tears
    the previous bundle down deterministically.
  - `bindPagesSync` — bidirectional mirror between the Zustand `pages` map
    and a Y.Doc. HTML body of each page is a `Y.Text` so concurrent edits
    CRDT-merge. Transaction origin tags prevent observer/subscriber loops.
  - `bindAwareness` + `publishLocalCursor` — present cursor + selected
    element + display name + color through `y-protocols/awareness`.
  - `useCollabSync(projectId)` — React hook that drives `collabStatus`
    (`idle` / `connecting` / `connected` / `offline`) from provider events.
- **Workspace UI**:
  - `LiveStatusPill` in the header: hidden when idle, dot + label
    otherwise ("Live", "Live • N people", "Connecting…",
    "Offline (edits saved locally)").
  - `Share` button + `ShareDialog`: copy a `/app?project=<id>` URL with an
    explicit "anyone with this link can edit; auth in M5c" notice.
  - `RemoteCursors` overlay inside `PreviewIframe`: dot + display-name pill
    per remote user, filtered by current page.
  - Preview iframe inject script now emits throttled (50 ms) `pointermove`
    - `pointerleave` so the parent can relay cursor coordinates to awareness.
- **Identity** — per-browser UUID + display name + color from a 12-color
  palette, persisted in `localStorage`.
- **Root scripts**: `dev:web`, `dev:api`, `dev:collab`, `dev:all`.
- **CRDT convergence tests** — `sync-pages.test.ts` covers concurrent text
  insertions, page additions, and page deletions across two Y.Docs.
- **Docs**: `docs/ARCHITECTURE.md` gains a Multiplayer section with the
  Y.Doc shape, the port map, and the persistence model.

### Known limitations

- No real authentication — anyone with a project ID can join (M5c).
- Critic / chat / agents / models / analytics stay per-user; only
  page content and current path sync.

## [0.9.0-alpha] — 2026-05-17 — Motion Export (M6a)

### Added

- **MP4 / GIF slideshow export** — capture every page with Playwright,
  stitch with FFmpeg using `xfade` transitions.
- `MotionExportOptions` Zod schema in `@you-design/shared` (FPS, transition,
  duration per slide).
- `ffmpeg` baked into the API runner Docker image.
- Inline "Motion settings" panel in the export dialog with format-aware fields.

### Fixed

- Input validation + FFmpeg error context surfaced through `runMotionExport`.

## [0.8.0-alpha] — 2026-05-17 — Living Loop (M5a)

### Added

- **PostHog analytics integration** — script auto-injected into HTML exports
  (web and API paths).
- `/analytics/summary` proxy route on the API for safe browser → PostHog calls.
- `AnalyticsConfig` setup form, workspace-store cache (5 min TTL), and an
  `AnalyticsPanel` sidebar in the workspace.
- Critic agent receives analytics summary as context, turning real usage data
  into feedback loops.

## [0.7.0-alpha] — 2026-05-17 — Multi-Agent Room (M4)

### Added

- **Five-agent room**: Designer, Copywriter, A11y, Dev, and the existing Critic
  share the same canvas surface.
- `AgentType` enum + `agentType` field on `CriticReport`.
- Generic `runAgent` dispatcher replaces per-agent wiring.
- `AgentDrawer` (tabbed Critic / Copywriter / A11y / Dev) and an `AgentsBadge`
  summarising open issues across all agents.
- System prompts for Copywriter, A11y, and Dev agents.

### Changed

- Workspace store: `isCriticRunning` boolean replaced by an `agentsRunning` map
  with a `selectIsCriticRunning` selector for compatibility.

## [0.6.0-alpha] — 2026-05-17 — Multi-Format Export (M3)

### Added

- **Export jobs** for HTML, PPTX, and PDF.
- API export worker using Playwright + `pdf-lib` + `pptxgenjs`.
- API routes: `POST /exports`, `GET /exports/:id` status, `GET /exports/:id/download`.
- `export_jobs` Drizzle schema + migration 0002.
- Web `useExport` hook and `ExportDialog` wired to the header Export button.
- API runner Docker image switched to Debian-slim with Playwright Chromium.

## [0.5.0-alpha] — 2026-05-17 — Smart Router + Cost Tracking (M2.3)

### Added

- **Per-task tier routing** (`fast` / `balanced` / `deep`) in
  `selectModelForTask`, with a pricing table for cost estimates.
- `usage_logs` Drizzle schema + migration 0001.
- API `POST /usage` and `GET /usage` endpoints.
- Web client: `streamLlm` reports usage; workspace store tracks `sessionCostUsd`.
- Tier badges in `ModelPicker`, tier selector in `ProviderConfig`, running
  session cost shown in the workspace header.
- Designer / Critic / Intent agents now route through the smart router and emit
  usage logs.

### Fixed

- API `vitest` runs with `passWithNoTests` to avoid CI exit-1 on empty suites.

## [0.4.0-alpha] — 2026-05-17 — Persistent Memory (M2.2)

### Added

- **Postgres + pgvector** schema for users, projects, project pages, and
  project memories (migration 0000).
- Full projects CRUD on the API, plus `project_pages` upsert and memory
  endpoints.
- Web `useProjectSync` hook (load on mount, debounced auto-save), project
  switcher and first-run modal.
- Workspace store gains `projectId` / `projectName` and a project API client.
- Semantic memory: snippets stored on each build, recalled before designer
  requests.

### Security

- Memory search switched to `POST` so OpenAI API keys never appear in URLs or
  logs.

## [0.3.0-alpha] — 2026-05-16 — Build-Phase Critic + Domain Templates (M2.1)

### Added

- **Honest critic agent** that runs after every Designer build and reports
  issues against the active domain template.
- Four starter domain templates with a small registry.
- `useDesignerSend` hook, critic UI surface, and Playwright E2E for the
  critic flow.

## [0.2.0-alpha] — 2026-05-16 — Multi-provider BYOK

### Added

- **Vercel AI SDK** as the LLM abstraction layer.
- `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, plus an
  OpenAI-compatible adapter (Ollama / Groq / OpenRouter / LM Studio / vLLM /
  custom endpoints).
- `ModelConfig` Zod schema and `PROVIDERS` catalog in `@you-design/shared`.
- Web `/setup` page with provider configuration CRUD and a `ModelPicker`
  in the workspace sidebar.
- Provider keys are stored in browser `localStorage` and sent per-request to
  the local API — never persisted on the server.

## [0.1.0-alpha] — 2026-05-16 — Workspace + Intent (M1)

### Added

- Three-column workspace (Chat / Canvas / Edit) with bidirectional canvas-code
  sync via an iframe injection script and HTML AST helpers.
- **Intent agent** end-to-end: streaming chat, intent contract card, and
  Designer hand-off.
- Zustand workspace store with full action test coverage.
- Anthropic streaming Server-Sent Events route on the API.

## [0.0.0] — 2026-05-16 — Foundation (M0)

### Added

- Monorepo scaffold (`pnpm` workspaces + Turborepo).
- `apps/web` (Next.js 15), `apps/api` (Fastify 5), shared packages
  (`@you-design/shared`, `@you-design/ui`, `@you-design/db`).
- Tooling: TypeScript strict mode, Biome, ESLint, Prettier, Vitest.
- Docker Compose, GitHub Actions (CI / docker / release workflows),
  `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `ARCHITECTURE.md`.

[Unreleased]: https://github.com/sabahattink/you-design/compare/v0.10.0-alpha...HEAD
[0.10.0-alpha]: https://github.com/sabahattink/you-design/compare/v0.9.0-alpha...v0.10.0-alpha
[0.9.0-alpha]: https://github.com/sabahattink/you-design/compare/v0.8.0-alpha...v0.9.0-alpha
[0.8.0-alpha]: https://github.com/sabahattink/you-design/compare/v0.7.0-alpha...v0.8.0-alpha
[0.7.0-alpha]: https://github.com/sabahattink/you-design/compare/v0.6.0-alpha...v0.7.0-alpha
[0.6.0-alpha]: https://github.com/sabahattink/you-design/compare/v0.5.0-alpha...v0.6.0-alpha
[0.5.0-alpha]: https://github.com/sabahattink/you-design/compare/v0.4.0-alpha...v0.5.0-alpha
[0.4.0-alpha]: https://github.com/sabahattink/you-design/compare/v0.3.0-alpha...v0.4.0-alpha
[0.3.0-alpha]: https://github.com/sabahattink/you-design/compare/v0.2.0-alpha...v0.3.0-alpha
[0.2.0-alpha]: https://github.com/sabahattink/you-design/compare/v0.1.0-alpha...v0.2.0-alpha
[0.1.0-alpha]: https://github.com/sabahattink/you-design/releases/tag/v0.1.0-alpha
