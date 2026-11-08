# M7a Settings Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A gear button in the workspace header opens an accessible, responsive settings modal that hosts the existing `ProviderConfig` and `AnalyticsConfig` panels.

**Architecture:** Presentation-only. `SettingsDialog` renders a WAI-ARIA tabs layout inside a modal panel; `useModalDialog` supplies initial focus, focus trap, Escape and focus restore. No store or API changes.

**Tech Stack:** React 19, Tailwind v4, Vitest + jsdom (`react-dom/client` + `act`), Playwright.

Spec: [`docs/superpowers/specs/2026-10-29-M7a-settings-modal-design.md`](../specs/2026-10-29-M7a-settings-modal-design.md)

---

## Task 1: Modal + gear button (done — `4f080f6`, `3fce779`)

- [x] `SettingsDialog` with Providers / Analytics sections reusing the `/setup` components.
- [x] ⚙ button in `WorkspaceLayout` header, next to Export.
- [x] `/setup` links back to the workspace.
- [x] Theme CSS variables for dark-mode contrast.

## Task 2: Lint green

- [x] Add `.prettierignore` (lockfiles, build/cache dirs, Playwright artefacts, `packages/db/migrations/meta/`).
- [x] `prettier --write` `SettingsDialog.tsx`.
- [x] `pnpm lint` passes.

## Task 3: Accessibility (TDD)

**Files:** `SettingsDialog.test.tsx`, `SettingsDialog.tsx`, `lib/a11y/use-modal-dialog.ts`, `vitest.config.ts`

- [x] **RED** — write `SettingsDialog.test.tsx` (dialog semantics, tabs wiring, initial focus, arrows/Home/End, Escape, Tab trap, focus restore, backdrop press). Enable `esbuild.jsx = 'automatic'` in `vitest.config.ts` (tsconfig keeps `jsx: preserve` for Next). Confirm 10/11 fail against the old dialog.
- [x] **GREEN** — `useModalDialog(onClose)` hook; move `role="dialog"`/`aria-modal`/`aria-labelledby` to the panel; tabs with roving tabindex; mount the panel only while open.
- [x] Responsive layout: `h-full max-h-[640px] w-full max-w-[920px]`, stacked tabs below `sm`.

```bash
pnpm --filter @you-design/web exec vitest run src/components/workspace/SettingsDialog.test.tsx
```

## Task 4: E2E

- [x] `apps/web/e2e/settings.spec.ts` — mock `**/api/v1/llm/stream` and `**/api/v1/projects`, dismiss the first-run project picker, open ⚙, switch sections (click + ArrowUp), Escape closes, focus back on ⚙; phone viewport fits.

```bash
pnpm --filter @you-design/web test:e2e -- settings.spec.ts
```

## Task 5: Docs

- [x] This plan + the spec.
- [x] CHANGELOG `[Unreleased]` entry.
- [x] README: alpha banner + roadmap (M5b shipped, M7a).

## Verification

```bash
pnpm typecheck && pnpm lint && pnpm test
```

## Next steps

- Reuse `useModalDialog` in `ExportDialog` and `ProjectListModal`.
- M7b: local CLI runtime section. M7c: theme + language.
