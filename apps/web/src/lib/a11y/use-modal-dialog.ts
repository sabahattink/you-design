'use client';

import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable="true"]',
  '[tabindex]',
].join(',');

/**
 * Elements reachable with Tab inside `root`, in DOM order. Elements with a
 * negative tabindex (e.g. inactive tabs in a roving-tabindex group) are
 * excluded because the browser skips them too.
 */
export function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.tabIndex >= 0 && !el.closest('[inert], [hidden], [aria-hidden="true"]'),
  );
}

/**
 * Keeps Tab / Shift+Tab inside `root` by wrapping at both ends. Focus moves
 * natively between the ends, so only the edges are intercepted.
 */
export function trapTabKey(event: KeyboardEvent, root: HTMLElement): void {
  const focusables = getFocusableElements(root);
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (!first || !last) {
    event.preventDefault();
    root.focus();
    return;
  }

  const active = document.activeElement;
  const isInside = active instanceof Node && root.contains(active);

  if (event.shiftKey) {
    if (!isInside || active === first || active === root) {
      event.preventDefault();
      last.focus();
    }
    return;
  }
  if (!isInside || active === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Modal dialog behaviour for the lifetime of the calling component:
 * - moves focus to the first tabbable element inside the dialog (or the
 *   dialog itself) on mount,
 * - traps Tab / Shift+Tab inside it,
 * - calls `onClose` on Escape,
 * - restores focus to whatever was focused before the dialog opened.
 *
 * Mount the component only while the dialog is open; attach the returned ref
 * to the element that carries `role="dialog"` (give it `tabIndex={-1}`).
 */
export function useModalDialog<T extends HTMLElement>(onClose: () => void): RefObject<T | null> {
  const dialogRef = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (getFocusableElements(dialog)[0] ?? dialog).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (event.defaultPrevented) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key === 'Tab') {
        trapTabKey(event, dialog);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);

  return dialogRef;
}
