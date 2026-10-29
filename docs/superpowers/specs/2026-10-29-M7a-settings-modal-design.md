# M7a — In-Workspace Settings Modal Design

**Goal:** Change LLM providers and analytics config without leaving `/app`. A gear button in the workspace header opens a settings modal that reuses the existing `/setup` panels. The modal is keyboard- and screen-reader-accessible and works on phone-sized viewports.

**Scope:** One modal (`SettingsDialog`) with two sections — **LLM providers** (`ProviderConfig`) and **Analytics** (`AnalyticsConfig`). `/setup` stays for bookmarks and first-run links. More categories (local CLI runtime, theme, language) come in M7b/M7c.

---

## 1. The Loop

```
User clicks ⚙ (header, next to Export)
  → SettingsDialog mounts; focus moves to the active section tab
  → Arrow keys / click switch sections; panel content is the existing config component
  → Changes write straight to the Zustand store (same as /setup)
  → Escape, ✕, or a backdrop press closes; focus returns to ⚙
```

No new state, no new API calls. The modal is presentation only.

---

## 2. Accessibility Contract

| Concern          | Behaviour                                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Dialog semantics | `role="dialog"` + `aria-modal="true"` on the **panel** (not the backdrop), `aria-labelledby` → the "Settings" heading.                    |
| Initial focus    | First tabbable element in the panel — the active section tab.                                                                             |
| Focus trap       | Tab / Shift+Tab wrap at the panel edges.                                                                                                  |
| Escape           | Closes the dialog (`preventDefault`, so nothing else handles it).                                                                         |
| Focus restore    | On close, focus returns to the element that had it before opening (the ⚙ button).                                                         |
| Backdrop         | Closes only when the press **starts** on the backdrop (`mousedown` target check), so drag-selecting text out of the panel does not close. |
| Section nav      | WAI-ARIA Tabs: `tablist` / `tab` / `tabpanel`, `aria-selected`, `aria-controls`, roving `tabindex`; arrows move + activate, Home / End.   |
| Decorative icons | Emoji icons are `aria-hidden`.                                                                                                            |

The focus/escape logic is a reusable hook, `useModalDialog(onClose)` in `apps/web/src/lib/a11y/use-modal-dialog.ts`. It is active for the lifetime of the component that calls it, so `SettingsDialog` renders its panel only while `open` (each open starts at `initialSection`). M5c reuses the hook for `ShareDialog`.

---

## 3. Layout

| Viewport       | Layout                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| `< sm` (phone) | Panel fills the viewport minus an 8 px gutter; tabs are a horizontal row on top, descriptions hidden.      |
| `≥ sm`         | Sidebar (256 px) + content. Panel is `w-full max-w-[920px]`, `h-full max-h-[640px]` inside a 24 px gutter. |

The content area is the only scroll container (`min-h-0 flex-1 overflow-y-auto`). Colours use the theme CSS variables (`--color-bg`, `--color-fg`, `--color-muted`, `--color-border`) so dark mode works.

---

## 4. Tests

- **Vitest (jsdom)** — `SettingsDialog.test.tsx` renders with `react-dom/client` + `act` (no new test dependencies) and covers: dialog semantics, tab wiring, initial focus, roving tabindex + arrows/Home/End, Escape, Tab trap at both edges, focus restore, backdrop vs. panel press.
- **Playwright** — `e2e/settings.spec.ts` (mocked LLM + projects API, same pattern as `demo.spec.ts`): open from ⚙, switch sections by mouse and keyboard, Escape closes and focus returns to ⚙; a 375×667 viewport case asserts the panel fits.

---

## 5. File Map

| Action | File                                                        |
| ------ | ----------------------------------------------------------- |
| Create | `apps/web/src/components/workspace/SettingsDialog.tsx`      |
| Create | `apps/web/src/components/workspace/SettingsDialog.test.tsx` |
| Create | `apps/web/src/lib/a11y/use-modal-dialog.ts`                 |
| Create | `apps/web/e2e/settings.spec.ts`                             |
| Modify | `apps/web/src/components/workspace/WorkspaceLayout.tsx` (⚙) |
| Modify | `apps/web/src/app/setup/page.tsx` (link back to workspace)  |
| Modify | `apps/web/vitest.config.ts` (automatic JSX runtime for TSX) |
| Create | `.prettierignore`                                           |

---

## 6. Out of Scope

- Local CLI runtime settings (M7b), theme + language (M7c).
- Making `ExportDialog` / `ProjectListModal` use `useModalDialog` (they predate it; follow-up).
- Background `inert` — `aria-modal` + the focus trap cover keyboard and AT users for now.
