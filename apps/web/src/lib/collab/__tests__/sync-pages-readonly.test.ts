import { beforeEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import type { Page } from '@you-design/shared';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { bindPagesSync } from '../sync-pages.js';

function page(html: string): Page {
  return {
    id: '/',
    path: '/',
    title: 'Home',
    html,
    createdAt: '2026-10-29T00:00:00.000Z',
    updatedAt: '2026-10-29T00:00:00.000Z',
  };
}

function yHtml(doc: Y.Doc): string | null {
  const html = doc.getMap<Y.Map<unknown>>('pages').get('/')?.get('html');
  return html instanceof Y.Text ? html.toString() : null;
}

describe('bindPagesSync — view-only (M5c)', () => {
  beforeEach(() => {
    localStorage.clear();
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  });

  it('does not seed or push local pages into the Y.Doc', () => {
    useWorkspaceStore.getState().upsertPage(page('<p>local</p>'));
    const doc = new Y.Doc();
    const unbind = bindPagesSync(doc, useWorkspaceStore, { readOnly: true });

    expect(yHtml(doc)).toBeNull();
    useWorkspaceStore.getState().updateCurrentPageHtml('<p>edited locally</p>');
    expect(yHtml(doc)).toBeNull();
    unbind();
  });

  it('still hydrates the store from remote changes', () => {
    const remote = new Y.Doc();
    const local = new Y.Doc();
    const unbind = bindPagesSync(local, useWorkspaceStore, { readOnly: true });

    remote.transact(() => {
      const yPage = new Y.Map<unknown>();
      yPage.set('id', '/');
      yPage.set('path', '/');
      yPage.set('title', 'Home');
      const text = new Y.Text();
      text.insert(0, '<p>from owner</p>');
      yPage.set('html', text);
      remote.getMap<Y.Map<unknown>>('pages').set('/', yPage);
    });
    Y.applyUpdate(local, Y.encodeStateAsUpdate(remote));

    expect(useWorkspaceStore.getState().pages['/']?.html).toBe('<p>from owner</p>');
    unbind();
  });

  it('pushes local edits when not read-only (control)', () => {
    useWorkspaceStore.getState().upsertPage(page('<p>local</p>'));
    const doc = new Y.Doc();
    const unbind = bindPagesSync(doc, useWorkspaceStore);
    expect(yHtml(doc)).toBe('<p>local</p>');
    unbind();
  });
});
