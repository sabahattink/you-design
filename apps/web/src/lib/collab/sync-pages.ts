import * as Y from 'yjs';
import type { Page } from '@you-design/shared';
import type { useWorkspaceStore } from '@/lib/workspace/store';

type WorkspaceStore = typeof useWorkspaceStore;

const STORE_ORIGIN = Symbol('you-design.store');

function readPageFromY(yPage: Y.Map<unknown>): Page {
  const html = yPage.get('html');
  const htmlString = html instanceof Y.Text ? html.toString() : String(html ?? '');
  return {
    id: String(yPage.get('id') ?? ''),
    path: String(yPage.get('path') ?? ''),
    title: String(yPage.get('title') ?? ''),
    html: htmlString,
    createdAt: String(yPage.get('createdAt') ?? new Date().toISOString()),
    updatedAt: String(yPage.get('updatedAt') ?? new Date().toISOString()),
  };
}

function snapshotPages(yPages: Y.Map<Y.Map<unknown>>): Record<string, Page> {
  const out: Record<string, Page> = {};
  yPages.forEach((yPage, path) => {
    out[path] = readPageFromY(yPage);
  });
  return out;
}

function buildYPage(page: Page): Y.Map<unknown> {
  const yPage = new Y.Map<unknown>();
  yPage.set('id', page.id);
  yPage.set('path', page.path);
  yPage.set('title', page.title);
  const text = new Y.Text();
  text.insert(0, page.html);
  yPage.set('html', text);
  yPage.set('createdAt', page.createdAt);
  yPage.set('updatedAt', page.updatedAt);
  return yPage;
}

function applyPagesToY(yPages: Y.Map<Y.Map<unknown>>, pages: Record<string, Page>): void {
  // Add or update
  for (const [path, page] of Object.entries(pages)) {
    const existing = yPages.get(path);
    if (!existing) {
      yPages.set(path, buildYPage(page));
      continue;
    }
    if (existing.get('title') !== page.title) {
      existing.set('title', page.title);
    }
    if (existing.get('id') !== page.id) {
      existing.set('id', page.id);
    }
    const yText = existing.get('html');
    if (yText instanceof Y.Text) {
      const current = yText.toString();
      if (current !== page.html) {
        yText.delete(0, yText.length);
        yText.insert(0, page.html);
      }
    } else {
      const fresh = new Y.Text();
      fresh.insert(0, page.html);
      existing.set('html', fresh);
    }
    if (existing.get('updatedAt') !== page.updatedAt) {
      existing.set('updatedAt', page.updatedAt);
    }
  }
  // Remove pages that disappeared locally
  const pathsToRemove: string[] = [];
  yPages.forEach((_, path) => {
    if (!pages[path]) pathsToRemove.push(path);
  });
  for (const path of pathsToRemove) {
    yPages.delete(path);
  }
}

export function bindPagesSync(doc: Y.Doc, store: WorkspaceStore): () => void {
  const yPages = doc.getMap<Y.Map<unknown>>('pages');
  const yMeta = doc.getMap<unknown>('meta');

  const hydrateStore = () => {
    const snapshot = snapshotPages(yPages);
    const metaPath = yMeta.get('currentPath');
    const currentPath =
      typeof metaPath === 'string' && metaPath.length > 0 ? metaPath : store.getState().currentPath;
    store.getState().__hydratePagesFromY(snapshot, currentPath);
  };

  // Y.Doc -> store
  const onDeep = (_events: Array<Y.YEvent<Y.AbstractType<unknown>>>, txn: Y.Transaction) => {
    if (txn.origin === STORE_ORIGIN) return;
    hydrateStore();
  };
  const onMeta = (_event: Y.YMapEvent<unknown>, txn: Y.Transaction) => {
    if (txn.origin === STORE_ORIGIN) return;
    hydrateStore();
  };
  yPages.observeDeep(onDeep);
  yMeta.observe(onMeta);

  // Seed: if Y.Doc empty and store has pages, push local first; else hydrate.
  const local = store.getState();
  const yHasPages = yPages.size > 0;
  const localHasPages = Object.keys(local.pages).length > 0;
  if (!yHasPages && localHasPages) {
    doc.transact(() => {
      applyPagesToY(yPages, local.pages);
      yMeta.set('currentPath', local.currentPath);
    }, STORE_ORIGIN);
  } else {
    hydrateStore();
  }

  // store -> Y.Doc
  const unsub = store.subscribe((next, prev) => {
    if (next.pages === prev.pages && next.currentPath === prev.currentPath) {
      return;
    }
    doc.transact(() => {
      if (next.pages !== prev.pages) {
        applyPagesToY(yPages, next.pages);
      }
      if (next.currentPath !== prev.currentPath) {
        yMeta.set('currentPath', next.currentPath);
      }
    }, STORE_ORIGIN);
  });

  return () => {
    yPages.unobserveDeep(onDeep);
    yMeta.unobserve(onMeta);
    unsub();
  };
}
