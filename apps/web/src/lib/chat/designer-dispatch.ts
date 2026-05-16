import { nanoid } from 'nanoid';
import { useWorkspaceStore } from '@/lib/workspace/store';
import {
  parseHtml,
  ensureYdIds,
  updateElement,
  addChild,
  toHtml,
} from '@/lib/html/ast';
import type { ElementPatch, Page } from '@you-design/shared';

export interface DispatchResult {
  ok: boolean;
  note: string;
}

export function dispatchDesignerTool(
  name: string,
  input: Record<string, unknown>,
): DispatchResult {
  const store = useWorkspaceStore.getState();
  switch (name) {
    case 'write_page': {
      const path = String(input.path ?? '/');
      const title = String(input.title ?? 'Untitled');
      const html = String(input.html ?? '');
      let finalHtml: string;
      try {
        const doc = parseHtml(html);
        ensureYdIds(doc);
        finalHtml = toHtml(doc);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'parse failed';
        return { ok: false, note: `Invalid HTML for ${path}: ${message}` };
      }
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
      const path = String(input.path ?? '/');
      const elementId = String(input.elementId ?? '');
      const patch = (input.patch ?? {}) as ElementPatch;
      const page = store.pages[path];
      if (!page) return { ok: false, note: `No page at ${path}` };
      try {
        const doc = parseHtml(page.html);
        updateElement(doc, elementId, patch);
        const updated = toHtml(doc);
        store.upsertPage({
          ...page,
          html: updated,
          updatedAt: new Date().toISOString(),
        });
        return { ok: true, note: `Updated ${elementId} on ${path}` };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'update failed';
        return { ok: false, note: `update_element: ${message}` };
      }
    }
    case 'add_element': {
      const path = String(input.path ?? '/');
      const parentId = String(input.parentId ?? '');
      const html = String(input.html ?? '');
      const page = store.pages[path];
      if (!page) return { ok: false, note: `No page at ${path}` };
      try {
        const doc = parseHtml(page.html);
        addChild(doc, parentId, html);
        const updated = toHtml(doc);
        store.upsertPage({
          ...page,
          html: updated,
          updatedAt: new Date().toISOString(),
        });
        return { ok: true, note: `Added to ${parentId} on ${path}` };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'add failed';
        return { ok: false, note: `add_element: ${message}` };
      }
    }
    case 'navigate': {
      const path = String(input.path ?? '/');
      store.setCurrentPath(path);
      return { ok: true, note: `Navigated to ${path}` };
    }
    default:
      return { ok: false, note: `Unknown tool: ${name}` };
  }
}
