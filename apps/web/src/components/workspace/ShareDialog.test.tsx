import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PROJECT = '6f1c2b8e-3d4a-4b5c-9d6e-7f8a9b0c1d2e';

const api = vi.hoisted(() => ({
  issueCollabToken: vi.fn(),
  revokeCollabTokens: vi.fn(),
}));
const vault = vi.hoisted(() => ({
  shareRole: vi.fn<(projectId: string) => 'owner' | 'edit' | 'view' | null>(() => null),
  rememberOwnerToken: vi.fn(),
}));

vi.mock('@/lib/projects/api', () => api);
vi.mock('@/lib/collab/tokens', () => ({ collabTokens: vault }));

import { useWorkspaceStore } from '@/lib/workspace/store';
import { ShareDialog } from './ShareDialog';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  vault.shareRole.mockReturnValue(null);
  localStorage.clear();
  useWorkspaceStore.setState(useWorkspaceStore.getInitialState());
  useWorkspaceStore.getState().setProjectId(PROJECT);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

function render(): void {
  act(() => root.render(<ShareDialog open onClose={() => undefined} />));
}

function button(name: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === name);
  if (!match) throw new Error(`button "${name}" not found`);
  return match;
}

async function click(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
  });
}

function select(label: string): HTMLSelectElement {
  const match = Array.from(document.querySelectorAll('label')).find((l) =>
    l.textContent?.startsWith(label),
  );
  const el = match?.querySelector('select');
  if (!el) throw new Error(`select "${label}" not found`);
  return el;
}

function change(el: HTMLSelectElement, value: string): void {
  act(() => {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('ShareDialog (M5c)', () => {
  it('is a labelled modal dialog without the old "anyone can edit" warning', () => {
    render();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(
      document.getElementById(dialog?.getAttribute('aria-labelledby') ?? '')?.textContent,
    ).toBe('Share project');
    expect(document.body.textContent).not.toMatch(/auth.*M5c/i);
  });

  it('creates a role-scoped, expiring link with the token in the fragment', async () => {
    api.issueCollabToken.mockResolvedValue({
      token: 'yd1.cGF5bG9hZA.c2ln',
      role: 'view',
      expiresAt: '2026-10-30T12:00:00.000Z',
    });
    render();
    change(select('Access'), 'view');
    change(select('Expires after'), String(24 * 3600));
    await click(button('Create link'));

    expect(api.issueCollabToken).toHaveBeenCalledWith(PROJECT, 'view', 24 * 3600);
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Share link"]');
    expect(input?.value).toBe(
      `${window.location.origin}/app?project=${PROJECT}#share=yd1.cGF5bG9hZA.c2ln`,
    );
    expect(document.body.textContent).toContain('Anyone with this link can view this project');
  });

  it('shows an error when the API is unreachable', async () => {
    api.issueCollabToken.mockRejectedValue(new Error('offline'));
    render();
    await click(button('Create link'));
    expect(document.querySelector('[role="status"]')?.textContent).toMatch(
      /Could not create a link/,
    );
  });

  it('revokes all links after confirmation and keeps the owner connected', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.revokeCollabTokens.mockResolvedValue({
      token: 'yd1.b3duZXI.c2ln',
      role: 'owner',
      expiresAt: '2026-10-30T00:00:00.000Z',
    });
    render();
    await click(button('Revoke all links'));

    expect(api.revokeCollabTokens).toHaveBeenCalledWith(PROJECT);
    expect(vault.rememberOwnerToken).toHaveBeenCalledWith(PROJECT, 'yd1.b3duZXI.c2ln');
    expect(document.querySelector('[role="status"]')?.textContent).toMatch(/revoked/);
  });

  it('does nothing when the revoke is not confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render();
    await click(button('Revoke all links'));
    expect(api.revokeCollabTokens).not.toHaveBeenCalled();
  });

  it('tells guests that only the owner can share', () => {
    vault.shareRole.mockReturnValue('view');
    render();
    expect(document.body.textContent).toContain('You joined with a view-only link');
    expect(Array.from(document.querySelectorAll('button')).map((b) => b.textContent)).not.toContain(
      'Create link',
    );
  });
});
