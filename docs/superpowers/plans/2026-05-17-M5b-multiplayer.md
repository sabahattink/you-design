# M5b Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multiple users edit the same project in real time. HTML edits merge via Y.js CRDT, cursors are visible on canvas, offline edits sync on reconnect, sharing is project-ID-link based. No real auth — that's M5c.

**Architecture:** `apps/collab` runs a Hocuspocus WebSocket server backed by Postgres. The web client mirrors the Zustand `pages` map into a `Y.Doc` (with `Y.Text` per page's HTML), persists locally via IndexedDB, and broadcasts cursor presence through `y-protocols/awareness`.

**Tech Stack:** `yjs` ^13, `@hocuspocus/server` ^2, `@hocuspocus/provider` ^2, `@hocuspocus/extension-database`, `@hocuspocus/extension-logger`, `y-indexeddb` ^9, `y-protocols` (bundled), Drizzle ORM (existing), Fastify-free standalone Node service for collab.

---

## File Map

| Action | File |
|--------|------|
| Create | `apps/collab/package.json` |
| Create | `apps/collab/tsconfig.json` |
| Create | `apps/collab/tsconfig.build.json` |
| Create | `apps/collab/Dockerfile` |
| Create | `apps/collab/.env.example` |
| Create | `apps/collab/src/server.ts` |
| Create | `apps/collab/src/extensions/postgres.ts` |
| Create | `apps/collab/src/extensions/logger.ts` |
| Create | `apps/collab/src/auth.ts` |
| Create | `packages/db/src/schema/project-collab-docs.ts` |
| Modify | `packages/db/src/schema/index.ts` |
| Modify | `packages/db/drizzle.config.ts` |
| Create | `packages/db/migrations/0003_project_collab_docs.sql` |
| Modify | `apps/web/package.json` |
| Create | `apps/web/src/lib/collab/identity.ts` |
| Create | `apps/web/src/lib/collab/y-doc.ts` |
| Create | `apps/web/src/lib/collab/provider.ts` |
| Create | `apps/web/src/lib/collab/sync-pages.ts` |
| Create | `apps/web/src/lib/collab/awareness.ts` |
| Create | `apps/web/src/lib/collab/use-collab-sync.ts` |
| Modify | `apps/web/src/lib/workspace/store.ts` |
| Create | `apps/web/src/components/canvas/RemoteCursors.tsx` |
| Create | `apps/web/src/components/workspace/LiveStatusPill.tsx` |
| Create | `apps/web/src/components/workspace/ShareDialog.tsx` |
| Modify | `apps/web/src/components/workspace/WorkspaceLayout.tsx` |
| Modify | `apps/web/src/components/canvas/PreviewIframe.tsx` |
| Modify | `apps/web/.env.example` |
| Modify | `docker-compose.yml` |
| Modify | `docs/ARCHITECTURE.md` |
| Modify | `README.md` |
| Modify | `turbo.json` |
| Modify | `package.json` |

---

## Task 1: DB — project_collab_docs schema + migration

**Files:**
- Create: `packages/db/src/schema/project-collab-docs.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/drizzle.config.ts`
- Create: `packages/db/migrations/0003_project_collab_docs.sql`

- [ ] **Step 1: Create `packages/db/src/schema/project-collab-docs.ts`**

```typescript
import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const projectCollabDocs = pgTable('project_collab_docs', {
  projectId: uuid('project_id')
    .primaryKey()
    .references(() => projects.id, { onDelete: 'cascade' }),
  yjsState: text('yjs_state').notNull(),
  version: integer('version').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ProjectCollabDoc = typeof projectCollabDocs.$inferSelect;
export type NewProjectCollabDoc = typeof projectCollabDocs.$inferInsert;
```

- [ ] **Step 2: Append to `packages/db/src/schema/index.ts`**

```typescript
export * from './project-collab-docs.js';
```

- [ ] **Step 3: Append to `drizzle.config.ts` schema list**

```typescript
'./src/schema/project-collab-docs.ts',
```

- [ ] **Step 4: Generate + verify migration**

```bash
cd H:\60_OSS\you-design\packages\db && pnpm exec drizzle-kit generate --name project_collab_docs
```

Expect file `migrations/0003_project_collab_docs.sql` with `CREATE TABLE project_collab_docs (...)`.

- [ ] **Step 5: Typecheck + commit**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/db typecheck
git add packages/db/src/schema/project-collab-docs.ts packages/db/src/schema/index.ts packages/db/drizzle.config.ts packages/db/migrations/0003_project_collab_docs.sql
git commit -m "feat(db): project_collab_docs schema + migration 0003"
```

---

## Task 2: apps/collab scaffold (Hocuspocus server)

**Files:**
- Create: `apps/collab/package.json`
- Create: `apps/collab/tsconfig.json`
- Create: `apps/collab/tsconfig.build.json`
- Create: `apps/collab/.env.example`
- Create: `apps/collab/src/server.ts`
- Create: `apps/collab/src/extensions/postgres.ts`
- Create: `apps/collab/src/extensions/logger.ts`
- Create: `apps/collab/src/auth.ts`

- [ ] **Step 1: Create `apps/collab/package.json`**

```json
{
  "name": "@you-design/collab",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    "@hocuspocus/server": "^2.13.5",
    "@hocuspocus/extension-database": "^2.13.5",
    "@hocuspocus/extension-logger": "^2.13.5",
    "@you-design/db": "workspace:*",
    "drizzle-orm": "catalog:",
    "pino": "catalog:",
    "yjs": "^13.6.18"
  },
  "devDependencies": {
    "@types/node": "catalog:",
    "tsx": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

(If catalogs aren't set up for a key, use the version already pinned in `apps/api/package.json`.)

- [ ] **Step 2: Create `apps/collab/tsconfig.json` and `tsconfig.build.json`** mirroring `apps/api/tsconfig.json` shape (NodeNext, strict, target ES2022).

- [ ] **Step 3: Create `apps/collab/.env.example`**

```
COLLAB_PORT=3002
DATABASE_URL=postgresql://youdesign:youdesign@localhost:5432/youdesign
LOG_LEVEL=info
```

- [ ] **Step 4: Create `apps/collab/src/extensions/logger.ts`**

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
});
```

- [ ] **Step 5: Create `apps/collab/src/extensions/postgres.ts`**

```typescript
import { Database } from '@hocuspocus/extension-database';
import { db, projectCollabDocs } from '@you-design/db';
import { eq } from 'drizzle-orm';
import { logger } from './logger.js';

export function createPostgresExtension() {
  return new Database({
    fetch: async ({ documentName }) => {
      const row = await db.query.projectCollabDocs.findFirst({
        where: eq(projectCollabDocs.projectId, documentName),
      });
      if (!row?.yjsState) return null;
      return new Uint8Array(Buffer.from(row.yjsState, 'base64'));
    },
    store: async ({ documentName, state }) => {
      const yjsState = Buffer.from(state).toString('base64');
      try {
        await db
          .insert(projectCollabDocs)
          .values({ projectId: documentName, yjsState })
          .onConflictDoUpdate({
            target: projectCollabDocs.projectId,
            set: { yjsState, updatedAt: new Date() },
          });
      } catch (err) {
        logger.error({ err, documentName }, 'failed to persist Y.Doc');
        throw err;
      }
    },
  });
}
```

- [ ] **Step 6: Create `apps/collab/src/auth.ts`**

```typescript
import { db } from '@you-design/db';
import { projects } from '@you-design/db';
import { eq } from 'drizzle-orm';

export async function authenticate({ documentName }: { documentName: string }) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, documentName),
  });
  if (!project) {
    throw new Error(`project ${documentName} not found`);
  }
  return { projectId: documentName };
}
```

- [ ] **Step 7: Create `apps/collab/src/server.ts`**

```typescript
import { Server } from '@hocuspocus/server';
import { Logger } from '@hocuspocus/extension-logger';
import { createPostgresExtension } from './extensions/postgres.js';
import { authenticate } from './auth.js';
import { logger } from './extensions/logger.js';

const port = Number(process.env.COLLAB_PORT ?? 3002);

const server = new Server({
  port,
  extensions: [new Logger(), createPostgresExtension()],
  onAuthenticate: authenticate,
});

server.listen().then(() => logger.info({ port }, 'collab server listening'));
```

- [ ] **Step 8: Install deps + typecheck**

```bash
cd H:\60_OSS\you-design && pnpm install
pnpm --filter @you-design/collab typecheck
```

- [ ] **Step 9: Commit**

```bash
git add apps/collab pnpm-lock.yaml
git commit -m "feat(collab): Hocuspocus WebSocket server backed by Postgres"
```

---

## Task 3: Workspace — collab deps + identity helper

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/collab/identity.ts`

- [ ] **Step 1: Add deps to `apps/web/package.json`**

Under `dependencies`:
```json
"@hocuspocus/provider": "^2.13.5",
"yjs": "^13.6.18",
"y-indexeddb": "^9.0.12",
"y-protocols": "^1.0.6"
```

- [ ] **Step 2: Create `apps/web/src/lib/collab/identity.ts`**

```typescript
const STORAGE_KEY = 'you-design.collab.identity.v1';

const COLORS = [
  '#e11d48', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9',
  '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#64748b', '#84cc16',
] as const;

export interface Identity {
  id: string;
  displayName: string;
  color: string;
}

export function getOrCreateIdentity(): Identity {
  if (typeof window === 'undefined') {
    return { id: 'ssr', displayName: 'You', color: COLORS[0] };
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Identity;
      if (parsed.id && parsed.displayName && parsed.color) return parsed;
    } catch {
      // fall through to regenerate
    }
  }
  const fresh: Identity = {
    id: crypto.randomUUID(),
    displayName: `Guest ${Math.floor(Math.random() * 9000) + 1000}`,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

export function updateDisplayName(name: string): Identity {
  const current = getOrCreateIdentity();
  const next: Identity = { ...current, displayName: name.trim() || current.displayName };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
```

- [ ] **Step 3: Install + typecheck + commit**

```bash
cd H:\60_OSS\you-design && pnpm install
pnpm --filter @you-design/web typecheck
git add apps/web/package.json apps/web/src/lib/collab/identity.ts pnpm-lock.yaml
git commit -m "feat(web): collab deps (yjs, hocuspocus, y-indexeddb) + identity helper"
```

---

## Task 4: Y.Doc singleton + provider

**Files:**
- Create: `apps/web/src/lib/collab/y-doc.ts`
- Create: `apps/web/src/lib/collab/provider.ts`

- [ ] **Step 1: Create `apps/web/src/lib/collab/provider.ts`**

```typescript
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

export interface ProviderBundle {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  persistence: IndexeddbPersistence;
}

const COLLAB_URL =
  process.env.NEXT_PUBLIC_COLLAB_URL ?? 'ws://localhost:3002';

export function createProvider(projectId: string): ProviderBundle {
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(`you-design.project.${projectId}`, doc);
  const provider = new HocuspocusProvider({
    url: COLLAB_URL,
    name: projectId,
    document: doc,
    connect: true,
  });
  return { doc, provider, persistence };
}
```

- [ ] **Step 2: Create `apps/web/src/lib/collab/y-doc.ts`**

```typescript
import { createProvider, type ProviderBundle } from './provider.js';

interface Entry {
  projectId: string;
  bundle: ProviderBundle;
  refCount: number;
}

let current: Entry | null = null;

export interface YDocHandle extends ProviderBundle {
  dispose: () => void;
}

export function acquireYDoc(projectId: string): YDocHandle {
  if (current && current.projectId !== projectId) {
    current.bundle.provider.destroy();
    current.bundle.persistence.destroy();
    current.bundle.doc.destroy();
    current = null;
  }
  if (!current) {
    current = { projectId, bundle: createProvider(projectId), refCount: 0 };
  }
  current.refCount += 1;
  const captured = current;
  return {
    ...captured.bundle,
    dispose: () => {
      captured.refCount -= 1;
      if (captured.refCount <= 0 && current === captured) {
        captured.bundle.provider.destroy();
        captured.bundle.persistence.destroy();
        captured.bundle.doc.destroy();
        current = null;
      }
    },
  };
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/web typecheck
git add apps/web/src/lib/collab/provider.ts apps/web/src/lib/collab/y-doc.ts
git commit -m "feat(web): HocuspocusProvider + Y.Doc singleton with IndexedDB persistence"
```

---

## Task 5: sync-pages — Zustand ↔ Y.Doc mirror

**Files:**
- Modify: `apps/web/src/lib/workspace/store.ts`
- Create: `apps/web/src/lib/collab/sync-pages.ts`

- [ ] **Step 1: Extend store — read `store.ts` first, then add**

To `WorkspaceState`:
```typescript
collabStatus: 'idle' | 'connecting' | 'connected' | 'offline';
remoteCursors: Record<string, RemoteCursor>;
```

To `WorkspaceActions`:
```typescript
__hydratePagesFromY: (next: Record<string, Page>, currentPath: string) => void;
setCollabStatus: (s: WorkspaceState['collabStatus']) => void;
setRemoteCursors: (next: Record<string, RemoteCursor>) => void;
```

Define `RemoteCursor` in a new local type or import from `./collab/awareness.ts` once Task 6 lands. For Task 5, stub it as `interface RemoteCursor { id: string; displayName: string; color: string; }`.

Implementation of `__hydratePagesFromY`:
```typescript
__hydratePagesFromY: (next, currentPath) =>
  set((state) => {
    if (shallowEqualPages(state.pages, next) && state.currentPath === currentPath) {
      return state;
    }
    return { ...state, pages: next, currentPath };
  }),
```

Add a `shallowEqualPages` helper near the bottom of the file.

- [ ] **Step 2: Create `apps/web/src/lib/collab/sync-pages.ts`**

```typescript
import * as Y from 'yjs';
import type { Page } from '@you-design/shared';
import type { UseBoundStore, StoreApi } from 'zustand';
import type { WorkspaceState, WorkspaceActions } from '../workspace/store.js';

type WorkspaceStore = UseBoundStore<StoreApi<WorkspaceState & WorkspaceActions>>;

const Y_ORIGIN_REMOTE = Symbol('remote');

interface YPage {
  id: string;
  path: string;
  title: string;
  html: Y.Text;
  createdAt: number;
  updatedAt: number;
}

function pageFromY(yPage: Y.Map<unknown>): Page {
  return {
    id: yPage.get('id') as string,
    path: yPage.get('path') as string,
    title: yPage.get('title') as string,
    html: (yPage.get('html') as Y.Text).toString(),
    createdAt: yPage.get('createdAt') as number,
    updatedAt: yPage.get('updatedAt') as number,
  };
}

function snapshotPages(yPages: Y.Map<Y.Map<unknown>>): Record<string, Page> {
  const out: Record<string, Page> = {};
  yPages.forEach((yPage, path) => {
    out[path] = pageFromY(yPage);
  });
  return out;
}

function writeLocalPagesToY(
  yPages: Y.Map<Y.Map<unknown>>,
  pages: Record<string, Page>,
): void {
  // Add or update
  Object.entries(pages).forEach(([path, page]) => {
    let yPage = yPages.get(path);
    if (!yPage) {
      yPage = new Y.Map();
      yPage.set('id', page.id);
      yPage.set('path', page.path);
      yPage.set('title', page.title);
      yPage.set('html', new Y.Text(page.html));
      yPage.set('createdAt', page.createdAt);
      yPage.set('updatedAt', page.updatedAt);
      yPages.set(path, yPage);
      return;
    }
    if (yPage.get('title') !== page.title) yPage.set('title', page.title);
    const yText = yPage.get('html') as Y.Text;
    if (yText.toString() !== page.html) {
      yText.delete(0, yText.length);
      yText.insert(0, page.html);
    }
    yPage.set('updatedAt', page.updatedAt);
  });
  // Remove deleted
  yPages.forEach((_, path) => {
    if (!pages[path]) yPages.delete(path);
  });
}

export function bindPagesSync(doc: Y.Doc, store: WorkspaceStore): () => void {
  const yPages = doc.getMap<Y.Map<unknown>>('pages');
  const yMeta = doc.getMap<unknown>('meta');

  const hydrate = () => {
    const next = snapshotPages(yPages);
    const currentPath = (yMeta.get('currentPath') as string) ?? store.getState().currentPath;
    store.getState().__hydratePagesFromY(next, currentPath);
  };

  const observer = (events: Y.YEvent<any>[], txn: Y.Transaction) => {
    if (txn.origin === Y_ORIGIN_REMOTE) return; // already came from store
    hydrate();
  };
  yPages.observeDeep(observer);
  yMeta.observe(observer);

  hydrate();

  const unsub = store.subscribe((state, prev) => {
    if (state.pages === prev.pages && state.currentPath === prev.currentPath) return;
    doc.transact(() => {
      writeLocalPagesToY(yPages, state.pages);
      if (state.currentPath !== yMeta.get('currentPath')) {
        yMeta.set('currentPath', state.currentPath);
      }
    });
  });

  return () => {
    yPages.unobserveDeep(observer);
    yMeta.unobserve(observer);
    unsub();
  };
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/web typecheck
git add apps/web/src/lib/workspace/store.ts apps/web/src/lib/collab/sync-pages.ts
git commit -m "feat(web): bidirectional Zustand <-> Y.Doc page sync"
```

---

## Task 6: Awareness + cursor presence

**Files:**
- Create: `apps/web/src/lib/collab/awareness.ts`
- Create: `apps/web/src/components/canvas/RemoteCursors.tsx`
- Modify: `apps/web/src/components/canvas/PreviewIframe.tsx`

- [ ] **Step 1: Create `apps/web/src/lib/collab/awareness.ts`**

```typescript
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type { UseBoundStore, StoreApi } from 'zustand';
import type { WorkspaceState, WorkspaceActions } from '../workspace/store.js';
import { getOrCreateIdentity, type Identity } from './identity.js';

export interface RemoteCursor {
  user: Identity;
  cursor: {
    pagePath: string;
    elementId: string | null;
    x: number | null;
    y: number | null;
  } | null;
  isTyping: boolean;
}

type WorkspaceStore = UseBoundStore<StoreApi<WorkspaceState & WorkspaceActions>>;

export function bindAwareness(
  provider: HocuspocusProvider,
  store: WorkspaceStore,
): () => void {
  const identity = getOrCreateIdentity();
  const awareness = provider.awareness;
  awareness?.setLocalStateField('user', identity);

  const publishStore = () => {
    const s = store.getState();
    awareness?.setLocalStateField('cursor', {
      pagePath: s.currentPath,
      elementId: s.selectedElementId,
      x: null,
      y: null,
    });
  };
  publishStore();
  const unsub = store.subscribe((s, prev) => {
    if (s.currentPath !== prev.currentPath || s.selectedElementId !== prev.selectedElementId) {
      publishStore();
    }
  });

  const onChange = () => {
    if (!awareness) return;
    const cursors: Record<string, RemoteCursor> = {};
    awareness.getStates().forEach((state, clientId) => {
      if (clientId === awareness.clientID) return;
      const user = state.user as Identity | undefined;
      if (!user?.id) return;
      cursors[user.id] = {
        user,
        cursor: (state.cursor as RemoteCursor['cursor']) ?? null,
        isTyping: Boolean(state.isTyping),
      };
    });
    store.getState().setRemoteCursors(cursors);
  };
  awareness?.on('change', onChange);
  onChange();

  return () => {
    awareness?.off('change', onChange);
    unsub();
  };
}

export function publishLocalCursor(
  provider: HocuspocusProvider,
  pagePath: string,
  x: number | null,
  y: number | null,
): void {
  provider.awareness?.setLocalStateField('cursor', {
    pagePath,
    elementId: null,
    x,
    y,
  });
}
```

- [ ] **Step 2: Create `apps/web/src/components/canvas/RemoteCursors.tsx`**

```tsx
'use client';
import { useWorkspaceStore } from '@/lib/workspace/store';

export function RemoteCursors() {
  const cursors = useWorkspaceStore((s) => s.remoteCursors);
  const currentPath = useWorkspaceStore((s) => s.currentPath);
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {Object.values(cursors)
        .filter((c) => c.cursor?.pagePath === currentPath && c.cursor.x !== null)
        .map((c) => (
          <div
            key={c.user.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-75 ease-linear"
            style={{ left: c.cursor!.x ?? 0, top: c.cursor!.y ?? 0 }}
          >
            <div
              className="h-3 w-3 rounded-full ring-2 ring-white"
              style={{ background: c.user.color }}
            />
            <div
              className="mt-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-white shadow"
              style={{ background: c.user.color }}
            >
              {c.user.displayName}
            </div>
          </div>
        ))}
    </div>
  );
}
```

- [ ] **Step 3: Modify `PreviewIframe.tsx` to publish local cursor**

Inside `PreviewIframe`, throttle a `pointermove` listener on the iframe wrapper (50 ms) and call `publishLocalCursor(provider, currentPath, e.clientX - rect.left, e.clientY - rect.top)`. Add a `pointerleave` that publishes `(null, null)`. Pull `provider` from a new prop (`provider?: HocuspocusProvider`) wired by `WorkspaceLayout` in Task 7.

Render `<RemoteCursors />` as a sibling of the iframe inside the same positioned wrapper.

- [ ] **Step 4: Typecheck + commit**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/web typecheck
git add apps/web/src/lib/collab/awareness.ts apps/web/src/components/canvas/RemoteCursors.tsx apps/web/src/components/canvas/PreviewIframe.tsx
git commit -m "feat(web): awareness layer + remote cursor overlay on canvas"
```

---

## Task 7: useCollabSync + LiveStatusPill + ShareDialog + wiring

**Files:**
- Create: `apps/web/src/lib/collab/use-collab-sync.ts`
- Create: `apps/web/src/components/workspace/LiveStatusPill.tsx`
- Create: `apps/web/src/components/workspace/ShareDialog.tsx`
- Modify: `apps/web/src/components/workspace/WorkspaceLayout.tsx`
- Modify: `apps/web/.env.example`

- [ ] **Step 1: Create `apps/web/src/lib/collab/use-collab-sync.ts`**

```typescript
'use client';
import { useEffect, useRef } from 'react';
import { acquireYDoc, type YDocHandle } from './y-doc.js';
import { bindPagesSync } from './sync-pages.js';
import { bindAwareness } from './awareness.js';
import { useWorkspaceStore } from '@/lib/workspace/store';

export function useCollabSync(projectId: string | null): YDocHandle | null {
  const handleRef = useRef<YDocHandle | null>(null);

  useEffect(() => {
    if (!projectId) {
      handleRef.current = null;
      return;
    }
    const handle = acquireYDoc(projectId);
    handleRef.current = handle;
    const setStatus = useWorkspaceStore.getState().setCollabStatus;
    setStatus('connecting');
    const onStatus = ({ status }: { status: string }) => {
      setStatus(status === 'connected' ? 'connected' : 'connecting');
    };
    const onDisconnect = () => setStatus('offline');
    handle.provider.on('status', onStatus);
    handle.provider.on('disconnect', onDisconnect);

    const unbindPages = bindPagesSync(handle.doc, useWorkspaceStore);
    const unbindAwareness = bindAwareness(handle.provider, useWorkspaceStore);

    return () => {
      handle.provider.off('status', onStatus);
      handle.provider.off('disconnect', onDisconnect);
      unbindPages();
      unbindAwareness();
      handle.dispose();
      setStatus('idle');
      handleRef.current = null;
    };
  }, [projectId]);

  return handleRef.current;
}
```

- [ ] **Step 2: Create `apps/web/src/components/workspace/LiveStatusPill.tsx`**

```tsx
'use client';
import { useWorkspaceStore } from '@/lib/workspace/store';

export function LiveStatusPill() {
  const status = useWorkspaceStore((s) => s.collabStatus);
  const cursors = useWorkspaceStore((s) => s.remoteCursors);
  if (status === 'idle') return null;
  const count = Object.keys(cursors).length + 1;
  const dot =
    status === 'connected' ? 'bg-emerald-500'
    : status === 'connecting' ? 'bg-amber-500'
    : 'bg-zinc-400';
  const label =
    status === 'offline' ? 'Offline (edits saved locally)'
    : status === 'connecting' ? 'Connecting…'
    : count > 1 ? `Live • ${count} people` : 'Live';
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border bg-white/80 px-2 py-0.5 text-xs">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span>{label}</span>
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/web/src/components/workspace/ShareDialog.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShareDialog({ open, onClose }: ShareDialogProps) {
  const projectId = useWorkspaceStore((s) => s.projectId);
  const [copied, setCopied] = useState(false);
  if (!open || !projectId) return null;
  const url = `${window.location.origin}/app?project=${projectId}`;
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-[420px] rounded-lg bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Share project</h2>
        <p className="mt-1 text-sm text-zinc-600">Anyone with this link can edit. Auth + roles arrive in M5c.</p>
        <div className="mt-3 flex gap-2">
          <input readOnly value={url} className="flex-1 rounded border bg-zinc-50 px-2 py-1.5 text-sm" />
          <button onClick={copy} className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <button onClick={onClose} className="mt-4 text-sm text-zinc-500 hover:text-zinc-900">
          Close
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Modify `WorkspaceLayout.tsx`**

- Call `const handle = useCollabSync(projectId);` after `useProjectSync(projectId)`.
- Pass `handle?.provider` down to `PreviewIframe`.
- Render `<LiveStatusPill />` in the header next to the Export button.
- Add a `Share` button beside Export that toggles a `ShareDialog`.

- [ ] **Step 5: Modify `apps/web/.env.example`**

Append:
```
# Multiplayer (M5b)
NEXT_PUBLIC_COLLAB_URL=ws://localhost:3002
```

- [ ] **Step 6: Typecheck + commit**

```bash
cd H:\60_OSS\you-design && pnpm --filter @you-design/web typecheck
git add apps/web/src/lib/collab/use-collab-sync.ts apps/web/src/components/workspace/LiveStatusPill.tsx apps/web/src/components/workspace/ShareDialog.tsx apps/web/src/components/workspace/WorkspaceLayout.tsx apps/web/.env.example
git commit -m "feat(web): useCollabSync, LiveStatusPill, ShareDialog wired into WorkspaceLayout"
```

---

## Task 8: Docker, Turbo, docs, root scripts

**Files:**
- Create: `apps/collab/Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `turbo.json`
- Modify: `package.json` (root)
- Modify: `docs/ARCHITECTURE.md`
- Modify: `README.md`

- [ ] **Step 1: Create `apps/collab/Dockerfile`** following the pattern of `apps/api/Dockerfile`. Multi-stage: builder installs and compiles, runner runs `node dist/server.js`.

- [ ] **Step 2: Append a `collab` service to `docker-compose.yml`**

```yaml
collab:
  build:
    context: .
    dockerfile: apps/collab/Dockerfile
  environment:
    DATABASE_URL: postgresql://youdesign:youdesign@postgres:5432/youdesign
    COLLAB_PORT: 3002
  ports:
    - "3002:3002"
  depends_on:
    postgres:
      condition: service_healthy
  restart: unless-stopped
```

- [ ] **Step 3: Add `@you-design/collab` to `turbo.json`** pipeline (it inherits the default `build` / `typecheck` / `test` tasks; ensure `dev` is marked `persistent: true`).

- [ ] **Step 4: Add root scripts to `package.json`**

```json
"dev:collab": "pnpm --filter @you-design/collab dev",
"dev:all": "pnpm -r --parallel --filter \"./apps/**\" dev"
```

- [ ] **Step 5: Update `docs/ARCHITECTURE.md`**

- Add a "Multiplayer (M5b)" subsection under Realtime describing the Y.Doc shape, sync flow, and the `apps/collab` boundary.
- Update the port map: web 3000, api 3001, collab 3002, postgres 5432, redis 6379.

- [ ] **Step 6: Update `README.md`**

- Quickstart adds: "In a third terminal: `pnpm dev:collab`" — or mention `pnpm dev:all`.
- Mark `M5b` ✅ in the Roadmap section once Task 9 passes.

- [ ] **Step 7: Commit**

```bash
git add apps/collab/Dockerfile docker-compose.yml turbo.json package.json docs/ARCHITECTURE.md README.md
git commit -m "chore(collab): Docker, Turbo, scripts, docs"
```

---

## Task 9: Smoke + tests + tag

**Files:**
- Create: `apps/web/src/lib/collab/__tests__/sync-pages.test.ts`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Smoke test sync-pages with two Y.Docs**

```typescript
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { applyUpdate, encodeStateAsUpdate } from 'yjs';

describe('sync-pages CRDT convergence', () => {
  it('two clients converge after concurrent text edits', () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    const aPages = a.getMap<Y.Map<unknown>>('pages');
    const bPages = b.getMap<Y.Map<unknown>>('pages');

    const seedPage = (doc: Y.Doc, pages: Y.Map<Y.Map<unknown>>) => {
      doc.transact(() => {
        const page = new Y.Map();
        page.set('id', 'p1');
        page.set('path', '/');
        page.set('title', 'Home');
        page.set('html', new Y.Text('<p>Hello</p>'));
        pages.set('/', page);
      });
    };
    seedPage(a, aPages);

    applyUpdate(b, encodeStateAsUpdate(a));

    (aPages.get('/')!.get('html') as Y.Text).insert(3, ' Alice');
    (bPages.get('/')!.get('html') as Y.Text).insert(3, ' Bob');

    applyUpdate(b, encodeStateAsUpdate(a));
    applyUpdate(a, encodeStateAsUpdate(b));

    const final = (aPages.get('/')!.get('html') as Y.Text).toString();
    expect(final).toBe((bPages.get('/')!.get('html') as Y.Text).toString());
    expect(final).toContain('Alice');
    expect(final).toContain('Bob');
  });
});
```

- [ ] **Step 2: Manual smoke**

```bash
pnpm dev:all
# Open two browsers to http://localhost:3000/app?project=<same id>
# Type in EditPanel on one — watch the other update
# Move cursor on one — watch the dot move on the other
# Kill collab server — verify "Offline" pill + edits persist + replay on reconnect
```

- [ ] **Step 3: Update CHANGELOG `[Unreleased]` → `[0.10.0-alpha]` section**

```markdown
## [0.10.0-alpha] — 2026-05-?? — Multiplayer (M5b)

### Added
- `apps/collab` Hocuspocus WebSocket server (port 3002) backed by Postgres.
- `project_collab_docs` Drizzle schema + migration 0003.
- Web collab module: Y.Doc singleton, IndexedDB persistence, identity helper,
  bidirectional Zustand sync, awareness-based remote cursors.
- Workspace header: `LiveStatusPill` and `Share` button → `ShareDialog`.
- Root scripts: `pnpm dev:collab`, `pnpm dev:all`.

### Known limitations
- No real auth — anyone with a project ID can join. (Deferred to M5c.)
- Critic / chat / agent state are per-user only.
```

- [ ] **Step 4: Tag**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): M5b multiplayer (v0.10.0-alpha)"
git tag -a v0.10.0-alpha -m "M5b multiplayer"
```

- [ ] **Step 5: Run full CI locally before pushing**

```bash
pnpm run format:check
pnpm run typecheck
pnpm run test
pnpm run build
```

All must pass. If anything fails, fix and amend the last commit (or add a follow-up commit) before tagging.

---

## Definition of Done

- Opening the same `/app?project=<id>` URL in two browsers and typing in one updates the other within ~200 ms on localhost.
- Disconnecting the collab server: existing tabs go offline-pill, edits keep working, and reconnecting replays missed updates in both directions.
- A remote user's cursor dot tracks pointer movement on the other client.
- All 6 workspaces pass `typecheck`, `test`, `build`.
- The new `project_collab_docs` migration applies cleanly to a fresh Postgres instance.
- CHANGELOG `[Unreleased]` is empty after the M5b commit (or contains only post-M5b housekeeping).
