import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from './store.js';

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
