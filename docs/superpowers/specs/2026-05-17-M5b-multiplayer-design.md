# M5b — Multiplayer Design

**Goal:** Two or more people work in the same You Design project at the same time. Their HTML edits merge automatically (CRDT, no last-write-wins data loss), their cursors are visible on the canvas, and reconnecting after a tab close picks up where things left off.

**Scope:** Y.js CRDT over a Hocuspocus WebSocket server, IndexedDB persistence for offline edits, canvas cursor presence, and a lightweight "share this project" link. **No real auth** — joining a project still only needs the project ID. Production-grade roles + invitations are deferred to **M5c**.

---

## 1. The Loop

```
Alice and Bob open /app?project=<id>
  → Each browser instantiates a Y.Doc for the project
  → Hocuspocus pushes the latest persisted state from Postgres
  → Local edits write to Y.Doc → Y.js broadcasts updates → server fans out
  → Awareness layer broadcasts cursor + selected element + display name + color
  → IndexedDB persists the Y.Doc locally so offline edits sync on reconnect
  → On disconnect, the awareness state for that client is cleared automatically
```

The existing Zustand store keeps the shape it has today. A new sync layer mirrors `pages` and `currentPath` into a `Y.Doc`, and re-publishes Y.Doc changes back into the Zustand store. Nothing else in the workspace needs to know multiplayer exists.

---

## 2. Tech Choices

| Concern             | Choice                                       | Rationale                                                                |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| CRDT                | `yjs` ^13                                    | Battle-tested, small, handles text + maps + arrays. Architecture pin.    |
| Sync server         | `@hocuspocus/server` ^2                      | Y.js-native, Fastify-friendly, has Postgres extension. Architecture pin. |
| Client              | `@hocuspocus/provider` ^2                    | Reconnect, awareness, status events out of the box.                      |
| Local persistence   | `y-indexeddb` ^9                             | Offline-first; works while Hocuspocus is down.                           |
| Awareness           | `y-protocols/awareness` (bundled with `yjs`) | Standard.                                                                |
| HTML representation | `Y.Text` per page                            | True character-level CRDT merges; survives concurrent AI rewrites.       |
| Server transport    | WebSocket on a dedicated app                 | Long-lived connections don't fit Fastify's REST/SSE shape.               |

---

## 3. New App — `apps/collab`

A small Node service whose only job is hosting Hocuspocus. Separate from `apps/api` because:

- WebSocket lifecycle is stateful and long-lived (REST is request/response).
- Scaling profile differs (sticky sessions for collab, stateless for API).
- A future move to Cloudflare Durable Objects / Hocuspocus Cloud should not pull the REST API along.

```
apps/collab/
├── package.json
├── tsconfig.json
├── src/
│   ├── server.ts           # bootstraps Hocuspocus on PORT (default 3002)
│   ├── extensions/
│   │   ├── postgres.ts     # persist Y.Doc updates to project_collab_docs
│   │   └── logger.ts       # pino logger wired into Hocuspocus hooks
│   └── auth.ts             # alpha: project-ID-only join. Real auth in M5c.
└── Dockerfile
```

Default port: `3002`. Exposed via env `NEXT_PUBLIC_COLLAB_URL` (default `ws://localhost:3002`).

---

## 4. Data Model

### New schema — `packages/db/src/schema/project-collab-docs.ts`

```typescript
import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const projectCollabDocs = pgTable('project_collab_docs', {
  projectId: uuid('project_id')
    .primaryKey()
    .references(() => projects.id, { onDelete: 'cascade' }),
  // Hocuspocus stores the Y.Doc binary snapshot here, base64-encoded.
  yjsState: text('yjs_state').notNull(),
  version: integer('version').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ProjectCollabDoc = typeof projectCollabDocs.$inferSelect;
```

One row per project. Hocuspocus's Postgres extension handles writes via a debounced flush on disconnect / interval.

### Migration `0003_project_collab_docs.sql`

Added to `packages/db/migrations/` via `pnpm drizzle:generate`.

### `drizzle.config.ts`

Add `'./src/schema/project-collab-docs.ts'` to the schema list.

---

## 5. Y.Doc Shape

```
yDoc
├── pages: Y.Map<string, Y.Map>          // keyed by path
│   └── <path>
│       ├── id: string                   // mirrors Page.id
│       ├── path: string
│       ├── title: string
│       ├── html: Y.Text                 // ← character-level CRDT
│       ├── createdAt: number
│       └── updatedAt: number
└── meta: Y.Map<string, unknown>
    ├── projectName: string
    └── currentPath: string              // last navigated path (advisory; not personal)
```

`html` as `Y.Text` rather than a string is the key choice. AI-generated HTML changes are insertions / deletions of substantial spans; Y.Text merges them without losing concurrent human edits.

Critic reports, agent state, models, analytics config — **not** synced. They are per-user opinions / local credentials.

---

## 6. Awareness (Presence)

Each client publishes a single awareness state on connect and on movement:

```typescript
interface AwarenessState {
  user: {
    id: string; // browser-generated UUID, persisted in localStorage
    displayName: string; // editable in workspace header
    color: string; // assigned from a 12-color palette
  };
  cursor: {
    pagePath: string;
    elementId: string | null; // selected element on canvas, if any
    x: number | null; // viewport-relative; null if pointer not over canvas
    y: number | null;
  } | null;
  isTyping: boolean; // true while user is actively editing in EditPanel
}
```

`y-protocols/awareness` handles broadcast + automatic cleanup on disconnect.

---

## 7. Client Sync Layer

### New module — `apps/web/src/lib/collab/`

```
collab/
├── y-doc.ts              # singleton getYDoc(projectId): { doc, provider, persistence }
├── provider.ts           # HocuspocusProvider wrapper with reconnect status
├── sync-pages.ts         # bidirectional Y.Doc <-> Zustand store mirror for pages
├── awareness.ts          # publish + subscribe to AwarenessState
└── identity.ts           # localStorage UUID + displayName + color
```

`getYDoc(projectId)` is idempotent. Switching project tears down the previous provider, IndexedDB persistence, and awareness.

### `sync-pages.ts` flow

```typescript
function bindPagesSync(doc: Y.Doc, store: WorkspaceStoreApi): () => void {
  const yPages = doc.getMap<Y.Map<unknown>>('pages');

  // Y.Doc -> store: observe deeply, project to Page[] and call store.setState
  const yObserver = (events: Y.YEvent<any>[]) => {
    store.getState().__hydratePagesFromY(yPages); // see Section 8
  };
  yPages.observeDeep(yObserver);

  // store -> Y.Doc: subscribe and diff
  const unsub = store.subscribe(
    (s) => s.pages,
    (next, prev) => applyPageDiffToY(yPages, prev, next),
    { equalityFn: shallow },
  );

  // Initial hydrate
  store.getState().__hydratePagesFromY(yPages);

  return () => {
    yPages.unobserveDeep(yObserver);
    unsub();
  };
}
```

`applyPageDiffToY` translates additions / removals / HTML changes into Y.js operations inside a single `doc.transact()`. To prevent loops, store updates triggered by `yObserver` carry an `origin` symbol that the subscription filter ignores.

### Store additions

```typescript
interface WorkspaceState {
  // ...existing
  collabStatus: 'idle' | 'connecting' | 'connected' | 'offline';
  remoteCursors: Record<string, AwarenessState>; // keyed by user.id
}

interface WorkspaceActions {
  // ...existing
  __hydratePagesFromY: (yPages: Y.Map<Y.Map<unknown>>) => void;
  setCollabStatus: (s: WorkspaceState['collabStatus']) => void;
  setRemoteCursors: (next: Record<string, AwarenessState>) => void;
}
```

`__hydratePagesFromY` is the only place that mutates `pages` from a remote source; it is double-underscored to signal "internal, not part of the public action API".

---

## 8. Project Load Wiring

`useProjectSync` (existing M2.2 hook) gains a sibling `useCollabSync`:

```typescript
// apps/web/src/lib/collab/use-collab-sync.ts
export function useCollabSync(projectId: string | null): void {
  useEffect(() => {
    if (!projectId) return;
    const { doc, provider, awareness, dispose } = getYDoc(projectId);
    const unbindPages = bindPagesSync(doc, workspaceStore);
    const unbindAwareness = bindAwareness(awareness, workspaceStore);
    return () => {
      unbindPages();
      unbindAwareness();
      dispose();
    };
  }, [projectId]);
}
```

`WorkspaceLayout` mounts `useCollabSync(projectId)` after `useProjectSync(projectId)`. Initial REST load still primes the store; Y.Doc hydration immediately reconciles with the canonical CRDT state.

---

## 9. Canvas Cursor Overlay

New component `apps/web/src/components/canvas/RemoteCursors.tsx`:

```tsx
export function RemoteCursors() {
  const cursors = useWorkspaceStore((s) => s.remoteCursors);
  const currentPath = useWorkspaceStore((s) => s.currentPath);
  return (
    <div className="pointer-events-none absolute inset-0">
      {Object.values(cursors)
        .filter((c) => c.cursor?.pagePath === currentPath && c.cursor.x !== null)
        .map((c) => (
          <CursorDot key={c.user.id} state={c} />
        ))}
    </div>
  );
}
```

Mounted inside `PreviewIframe`'s container at the same coordinate space as the canvas. The local cursor publishes via a throttled `pointermove` listener (50 ms) inside the iframe injection script.

---

## 10. Status UI

A small "Live • 3 people" pill in the workspace header:

| State             | Pill                                       |
| ----------------- | ------------------------------------------ |
| `idle`            | hidden                                     |
| `connecting`      | "Connecting…" (amber dot)                  |
| `connected` (n=1) | "Live" (green dot)                         |
| `connected` (n>1) | "Live • N people" with avatar stack        |
| `offline`         | "Offline (edits saved locally)" (gray dot) |

New component: `apps/web/src/components/workspace/LiveStatusPill.tsx`. Tooltip lists `displayName`s.

---

## 11. Share Flow

The header gains a **Share** button next to **Export**. It opens a `ShareDialog` with:

- The project URL (`<APP_URL>/app?project=<id>`) — copyable.
- A muted note: _"Anyone with this link can edit. Auth + roles arrive in M5c."_
- A toggle "Stop sharing" — for now wired to a no-op (room is still public); the toggle's presence sets the UX expectation for M5c.

---

## 12. Hocuspocus Server

### `apps/collab/src/server.ts`

```typescript
import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { Logger } from '@hocuspocus/extension-logger';
import { db, projectCollabDocs } from '@you-design/db';
import { eq } from 'drizzle-orm';

const server = new Server({
  port: Number(process.env.COLLAB_PORT ?? 3002),
  extensions: [
    new Logger(),
    new Database({
      fetch: async ({ documentName }) => {
        const row = await db.query.projectCollabDocs.findFirst({
          where: eq(projectCollabDocs.projectId, documentName),
        });
        return row?.yjsState ? Buffer.from(row.yjsState, 'base64') : null;
      },
      store: async ({ documentName, state }) => {
        const yjsState = Buffer.from(state).toString('base64');
        await db
          .insert(projectCollabDocs)
          .values({ projectId: documentName, yjsState, version: 1 })
          .onConflictDoUpdate({
            target: projectCollabDocs.projectId,
            set: { yjsState, updatedAt: new Date(), version: 0 /* +1 in SQL */ },
          });
      },
    }),
  ],
  async onAuthenticate({ documentName, token }) {
    // M5b: pass-through. Existence of the project ID is the only check.
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, documentName),
    });
    if (!project) throw new Error('project not found');
    return { projectId: documentName };
  },
});

server.listen();
```

### Docker

`docker-compose.yml` gains a `collab` service:

```yaml
collab:
  build:
    context: .
    dockerfile: apps/collab/Dockerfile
  environment:
    - DATABASE_URL=postgresql://youdesign:youdesign@postgres:5432/youdesign
    - COLLAB_PORT=3002
  ports:
    - '3002:3002'
  depends_on:
    postgres:
      condition: service_healthy
```

---

## 13. Out of Scope (deferred to M5c)

- Real authentication (Clerk / NextAuth / magic-link).
- Per-user roles (owner / editor / viewer / commenter).
- Room expiration / invite tokens.
- Comments + annotations.
- Chat sync across users.
- Critic / agent state sync.
- Y.js-undo-manager wiring (each client gets per-user undo, but no integration yet).

---

## 14. Risks

| Risk                                       | Mitigation                                                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| AI HTML rewrites produce huge Y.Text diffs | Wrap `updateCurrentPageHtml` in a single `doc.transact()`; benchmark with 50 KB HTML before merging.                                   |
| IndexedDB and Y.Doc disagree after a crash | Y.js guarantees convergence — but document recovery steps in `docs/ARCHITECTURE.md`.                                                   |
| Server-side memory growth                  | Hocuspocus keeps in-memory Y.Docs per active room. Cap concurrent rooms via env; document the limit.                                   |
| Drift between Zustand `pages` and Y.Doc    | All page writes go through actions; actions write through to Y.Doc; tests assert that Y.Doc and store stay in lockstep on a fuzz test. |
| Privacy: anyone with project ID joins      | Banner in ShareDialog. Make it impossible to miss.                                                                                     |

---

## 15. File Map

| Action | File                                                                                      |
| ------ | ----------------------------------------------------------------------------------------- |
| Create | `apps/collab/package.json`                                                                |
| Create | `apps/collab/tsconfig.json`                                                               |
| Create | `apps/collab/src/server.ts`                                                               |
| Create | `apps/collab/src/extensions/postgres.ts`                                                  |
| Create | `apps/collab/src/extensions/logger.ts`                                                    |
| Create | `apps/collab/src/auth.ts`                                                                 |
| Create | `apps/collab/Dockerfile`                                                                  |
| Create | `packages/db/src/schema/project-collab-docs.ts`                                           |
| Modify | `packages/db/src/schema/index.ts`                                                         |
| Modify | `packages/db/drizzle.config.ts`                                                           |
| Create | `packages/db/migrations/0003_project_collab_docs.sql`                                     |
| Modify | `apps/web/package.json` (add `yjs`, `@hocuspocus/provider`, `y-indexeddb`, `y-protocols`) |
| Create | `apps/web/src/lib/collab/y-doc.ts`                                                        |
| Create | `apps/web/src/lib/collab/provider.ts`                                                     |
| Create | `apps/web/src/lib/collab/sync-pages.ts`                                                   |
| Create | `apps/web/src/lib/collab/awareness.ts`                                                    |
| Create | `apps/web/src/lib/collab/identity.ts`                                                     |
| Create | `apps/web/src/lib/collab/use-collab-sync.ts`                                              |
| Modify | `apps/web/src/lib/workspace/store.ts` (collabStatus, remoteCursors, hydrate action)       |
| Create | `apps/web/src/components/canvas/RemoteCursors.tsx`                                        |
| Create | `apps/web/src/components/workspace/LiveStatusPill.tsx`                                    |
| Create | `apps/web/src/components/workspace/ShareDialog.tsx`                                       |
| Modify | `apps/web/src/components/workspace/WorkspaceLayout.tsx`                                   |
| Modify | `apps/web/src/components/canvas/PreviewIframe.tsx` (cursor capture)                       |
| Modify | `apps/web/.env.example` (`NEXT_PUBLIC_COLLAB_URL`)                                        |
| Modify | `apps/collab/.env.example`                                                                |
| Modify | `docker-compose.yml` (collab service)                                                     |
| Modify | `docs/ARCHITECTURE.md` (Realtime section, port map)                                       |
| Modify | `README.md` (Quickstart adds `pnpm dev:collab`)                                           |
| Modify | `turbo.json` (pipeline includes `@you-design/collab`)                                     |
| Modify | `pnpm-workspace.yaml` (already globs `apps/*` — verify)                                   |

Estimated: 7 phases, ~28 tasks, 30 file touches. Detailed task breakdown lives in the M5b implementation plan.
