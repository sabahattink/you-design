import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from './store.js';
import type { Page } from '@you-design/shared';

function makePage(overrides: Partial<Page> = {}): Page {
  const now = new Date().toISOString();
  return {
    id: 'p1',
    path: '/',
    title: 'Home',
    html: '<html><body><h1>Hi</h1></body></html>',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('workspace store — initial', () => {
  beforeEach(() => {
    localStorage.clear();
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  });

  it('starts in intent collecting phase', () => {
    const s = useWorkspaceStore.getState();
    expect(s.intentPhase).toBe('collecting');
    expect(s.intentContract).toBeNull();
    expect(s.intentMessages).toEqual([]);
  });

  it('has no pages initially', () => {
    expect(useWorkspaceStore.getState().pages).toEqual({});
  });

  it('has root current path', () => {
    expect(useWorkspaceStore.getState().currentPath).toBe('/');
  });
});

describe('workspace store — actions', () => {
  beforeEach(() => {
    localStorage.clear();
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  });

  it('upserts a page', () => {
    const page = makePage();
    useWorkspaceStore.getState().upsertPage(page);
    expect(useWorkspaceStore.getState().pages['/']).toEqual(page);
  });

  it('updates current page html', () => {
    useWorkspaceStore.getState().upsertPage(makePage());
    useWorkspaceStore.getState().updateCurrentPageHtml('<html><body><h1>New</h1></body></html>');
    const page = useWorkspaceStore.getState().pages['/'];
    expect(page).toBeDefined();
    expect(page?.html).toContain('New');
    expect(page?.updatedAt).toBeTruthy();
  });

  it('removes a page', () => {
    useWorkspaceStore.getState().upsertPage(makePage({ path: '/about' }));
    useWorkspaceStore.getState().removePage('/about');
    expect(useWorkspaceStore.getState().pages['/about']).toBeUndefined();
  });

  it('reset clears pages', () => {
    useWorkspaceStore.getState().upsertPage(makePage({ path: '/x' }));
    useWorkspaceStore.getState().reset();
    expect(useWorkspaceStore.getState().pages).toEqual({});
  });

  it('setCurrentPath clears selection', () => {
    useWorkspaceStore.getState().setSelectedElement('abc123');
    useWorkspaceStore.getState().setCurrentPath('/x');
    expect(useWorkspaceStore.getState().selectedElementId).toBeNull();
  });

  it('normalizes flat contract from LLM into nested persona shape', () => {
    useWorkspaceStore.getState().setIntentContract({
      persona: 'indie dev shipping SaaS',
      primaryAction: 'start free trial',
      emotion: 'minimal',
      successMetric: 'trial CVR > 5%',
      domain: 'general',
    });
    const c = useWorkspaceStore.getState().intentContract;
    expect(c?.persona).toEqual({ role: 'indie dev shipping SaaS' });
    expect(c?.successMetrics[0]?.name).toBe('trial CVR > 5%');
  });
});
