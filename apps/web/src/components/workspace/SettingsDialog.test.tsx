import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The real config panels pull the whole workspace store in; the dialog's
// behaviour only needs something focusable inside each tab panel.
vi.mock('@/components/setup/ProviderConfig', () => ({
  ProviderConfig: () => <input aria-label="Provider stub" />,
}));
vi.mock('@/components/setup/AnalyticsConfig', () => ({
  AnalyticsConfig: () => <input aria-label="Analytics stub" />,
}));

import { SettingsDialog } from './SettingsDialog';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = '';
});

function render(ui: React.ReactElement): void {
  act(() => root.render(ui));
}

function keydown(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const target = document.activeElement ?? document.body;
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function mousedown(target: Element): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  });
}

function getDialog(): HTMLElement {
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
  if (!dialog) throw new Error('dialog not rendered');
  return dialog;
}

function getTab(name: RegExp): HTMLElement {
  const tab = Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]')).find((el) =>
    name.test(el.textContent ?? ''),
  );
  if (!tab) throw new Error(`tab ${name} not found`);
  return tab;
}

function getTabPanel(): HTMLElement {
  const panel = document.querySelector<HTMLElement>('[role="tabpanel"]');
  if (!panel) throw new Error('tabpanel not rendered');
  return panel;
}

describe('SettingsDialog — structure', () => {
  it('renders nothing while closed', () => {
    render(<SettingsDialog open={false} onClose={() => undefined} />);
    expect(container.innerHTML).toBe('');
  });

  it('puts role=dialog + aria-modal on the panel, labelled by its heading', () => {
    render(<SettingsDialog open onClose={() => undefined} />);
    const dialog = getDialog();

    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const labelId = dialog.getAttribute('aria-labelledby');
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId ?? '')?.textContent).toBe('Settings');

    // The backdrop is presentational, not the dialog.
    expect(dialog.parentElement?.getAttribute('role')).toBeNull();
    expect(dialog.parentElement?.getAttribute('aria-modal')).toBeNull();
  });

  it('exposes sections as tabs wired to a tabpanel', () => {
    render(<SettingsDialog open onClose={() => undefined} />);
    const tablist = document.querySelector('[role="tablist"]');
    expect(tablist?.getAttribute('aria-label')).toBe('Settings sections');

    const providers = getTab(/LLM providers/);
    const analytics = getTab(/Analytics/);
    expect(providers.getAttribute('aria-selected')).toBe('true');
    expect(analytics.getAttribute('aria-selected')).toBe('false');

    const panel = getTabPanel();
    expect(providers.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(providers.id);
  });

  it('respects initialSection', () => {
    render(<SettingsDialog open onClose={() => undefined} initialSection="analytics" />);
    expect(getTab(/Analytics/).getAttribute('aria-selected')).toBe('true');
    expect(getTabPanel().querySelector('[aria-label="Analytics stub"]')).not.toBeNull();
  });
});

describe('SettingsDialog — keyboard + focus', () => {
  it('moves initial focus to the active tab', () => {
    render(<SettingsDialog open onClose={() => undefined} />);
    expect(document.activeElement).toBe(getTab(/LLM providers/));
  });

  it('switches sections with arrow keys using a roving tabindex', () => {
    render(<SettingsDialog open onClose={() => undefined} />);
    const providers = getTab(/LLM providers/);
    const analytics = getTab(/Analytics/);
    expect(providers.tabIndex).toBe(0);
    expect(analytics.tabIndex).toBe(-1);

    keydown('ArrowDown');
    expect(document.activeElement).toBe(analytics);
    expect(analytics.getAttribute('aria-selected')).toBe('true');
    expect(analytics.tabIndex).toBe(0);
    expect(providers.tabIndex).toBe(-1);
    expect(getTabPanel().getAttribute('aria-labelledby')).toBe(analytics.id);

    keydown('ArrowDown'); // wraps
    expect(document.activeElement).toBe(providers);

    keydown('End');
    expect(document.activeElement).toBe(analytics);
    keydown('Home');
    expect(document.activeElement).toBe(providers);
    keydown('ArrowUp'); // wraps backwards
    expect(document.activeElement).toBe(analytics);
  });

  it('switches sections on click', () => {
    render(<SettingsDialog open onClose={() => undefined} />);
    act(() => getTab(/Analytics/).click());
    expect(getTabPanel().querySelector('[aria-label="Analytics stub"]')).not.toBeNull();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<SettingsDialog open onClose={onClose} />);
    const event = keydown('Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('traps Tab and Shift+Tab inside the dialog', () => {
    render(<SettingsDialog open onClose={() => undefined} />);
    const first = getTab(/LLM providers/);
    const last = document.querySelector<HTMLElement>('[aria-label="Provider stub"]');
    if (!last) throw new Error('stub missing');

    act(() => last.focus());
    const forward = keydown('Tab');
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    const backward = keydown('Tab', { shiftKey: true });
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it('restores focus to the opener when it closes', () => {
    const opener = document.createElement('button');
    opener.textContent = 'open settings';
    document.body.appendChild(opener);
    opener.focus();

    render(<SettingsDialog open onClose={() => undefined} />);
    expect(document.activeElement).not.toBe(opener);

    render(<SettingsDialog open={false} onClose={() => undefined} />);
    expect(document.activeElement).toBe(opener);
  });

  it('closes on a backdrop press but not on a press inside the panel', () => {
    const onClose = vi.fn();
    render(<SettingsDialog open onClose={onClose} />);
    const dialog = getDialog();

    mousedown(dialog);
    expect(onClose).not.toHaveBeenCalled();

    const backdrop = dialog.parentElement;
    if (!backdrop) throw new Error('backdrop missing');
    mousedown(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
