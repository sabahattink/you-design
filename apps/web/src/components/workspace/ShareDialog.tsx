'use client';

import { useId, useState } from 'react';
import type { ShareRole } from '@you-design/shared';
import { useWorkspaceStore } from '@/lib/workspace/store';
import { useModalDialog } from '@/lib/a11y/use-modal-dialog';
import { issueCollabToken, revokeCollabTokens } from '@/lib/projects/api';
import { collabTokens } from '@/lib/collab/tokens';
import { buildShareUrl } from '@/lib/collab/share-link';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
}

const DAY_SECONDS = 24 * 3600;
const EXPIRY_OPTIONS = [
  { label: '1 day', seconds: DAY_SECONDS },
  { label: '7 days', seconds: 7 * DAY_SECONDS },
  { label: '30 days', seconds: 30 * DAY_SECONDS },
] as const;
const DEFAULT_EXPIRY_SECONDS = 7 * DAY_SECONDS;
const COPIED_FEEDBACK_MS = 1500;

type LinkState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'ready'; url: string; role: ShareRole; expiresAt: string }
  | { kind: 'revoked' }
  | { kind: 'error'; message: string };

export function ShareDialog({ open, onClose }: ShareDialogProps) {
  if (!open) return null;
  return <ShareDialogPanel onClose={onClose} />;
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function ShareDialogPanel({ onClose }: { onClose: () => void }) {
  const projectId = useWorkspaceStore((s) => s.projectId);
  const dialogRef = useModalDialog<HTMLDivElement>(onClose);
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const descriptionId = `${baseId}-description`;

  const [role, setRole] = useState<ShareRole>('edit');
  const [ttlSeconds, setTtlSeconds] = useState<number>(DEFAULT_EXPIRY_SECONDS);
  const [state, setState] = useState<LinkState>({ kind: 'idle' });
  const [isCopied, setIsCopied] = useState(false);

  const guestRole = projectId ? collabTokens.shareRole(projectId) : null;
  const isBusy = state.kind === 'busy';

  const createLink = async () => {
    if (!projectId) return;
    setState({ kind: 'busy' });
    try {
      const issued = await issueCollabToken(projectId, role, ttlSeconds);
      setState({
        kind: 'ready',
        url: buildShareUrl(window.location.origin, projectId, issued.token),
        role,
        expiresAt: issued.expiresAt,
      });
    } catch {
      setState({ kind: 'error', message: 'Could not create a link. Is the API server running?' });
    }
  };

  const revokeAll = async () => {
    if (!projectId) return;
    const isConfirmed = window.confirm(
      'Revoke every share link for this project? People using them are disconnected within about 10 seconds.',
    );
    if (!isConfirmed) return;
    setState({ kind: 'busy' });
    try {
      const fresh = await revokeCollabTokens(projectId);
      // Our own connection was minted under the old version too.
      collabTokens.rememberOwnerToken(projectId, fresh.token);
      setState({ kind: 'revoked' });
    } catch {
      setState({ kind: 'error', message: 'Could not revoke links. Is the API server running?' });
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), COPIED_FEEDBACK_MS);
    } catch {
      // Clipboard blocked — the field is selectable, the user can copy manually.
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-2 sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="max-h-full w-full max-w-[460px] overflow-y-auto rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-5 text-[color:var(--color-fg)] shadow-xl outline-none"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          Share project
        </h2>
        <p id={descriptionId} className="mt-1 text-sm text-[color:var(--color-muted)]">
          Share links are signed, expire, and can be revoked. They grant access to this
          project&apos;s live room only.
        </p>

        {!projectId ? (
          <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Save the project first — sharing needs a project ID.
          </p>
        ) : guestRole ? (
          <p className="mt-3 rounded bg-black/5 px-3 py-2 text-sm dark:bg-white/5">
            You joined with {guestRole === 'view' ? 'a view-only' : 'an edit'} link. Only the
            project owner can create or revoke links.
          </p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Access</span>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value === 'view' ? 'view' : 'edit')}
                  className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-2 py-1.5"
                >
                  <option value="edit">Can edit</option>
                  <option value="view">Can view</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Expires after</span>
                <select
                  value={ttlSeconds}
                  onChange={(e) => setTtlSeconds(Number(e.target.value))}
                  className="rounded border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-2 py-1.5"
                >
                  {EXPIRY_OPTIONS.map((o) => (
                    <option key={o.seconds} value={o.seconds}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={() => void createLink()}
              disabled={isBusy}
              className="mt-3 rounded bg-[color:var(--color-fg)] px-3 py-1.5 text-sm text-[color:var(--color-bg)] disabled:opacity-50"
            >
              {isBusy ? 'Working…' : 'Create link'}
            </button>

            {state.kind === 'ready' && (
              <div className="mt-4">
                <div className="flex gap-2">
                  <input
                    readOnly
                    aria-label="Share link"
                    value={state.url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 rounded border border-[color:var(--color-border)] bg-black/5 px-2 py-1.5 font-mono text-xs dark:bg-white/5"
                  />
                  <button
                    type="button"
                    onClick={() => void copy(state.url)}
                    className="shrink-0 rounded border border-[color:var(--color-border)] px-3 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    {isCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-[color:var(--color-muted)]">
                  Anyone with this link can {state.role === 'view' ? 'view' : 'edit'} this project
                  until {formatExpiry(state.expiresAt)}.
                </p>
              </div>
            )}
          </>
        )}

        <p role="status" className="mt-3 min-h-[1.25rem] text-sm">
          {state.kind === 'revoked' && 'All share links revoked. Create a new one to re-invite.'}
          {state.kind === 'error' && <span className="text-red-600">{state.message}</span>}
        </p>

        <div className="mt-2 flex items-center justify-between gap-2">
          {projectId && !guestRole ? (
            <button
              type="button"
              onClick={() => void revokeAll()}
              disabled={isBusy}
              className="text-sm text-red-600 hover:underline disabled:opacity-50"
            >
              Revoke all links
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
