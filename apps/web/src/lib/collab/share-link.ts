import { splitCollabToken } from '@you-design/shared';
import type { CollabTokenVault } from './tokens.js';

// Share links: `/app?project=<uuid>#share=<token>`. The token lives in the
// fragment, which browsers never send to servers (no access logs, no
// Referer leak), and is stripped from the address bar as soon as it is read.

const SHARE_FRAGMENT_KEY = 'share';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ShareLink {
  projectId: string;
  token: string;
}

export function buildShareUrl(origin: string, projectId: string, token: string): string {
  return `${origin}/app?project=${encodeURIComponent(projectId)}#${SHARE_FRAGMENT_KEY}=${token}`;
}

export function parseShareLink(href: string): ShareLink | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const projectId = url.searchParams.get('project');
  const token = new URLSearchParams(url.hash.slice(1)).get(SHARE_FRAGMENT_KEY);
  if (!projectId || !token || !UUID_RE.test(projectId) || !splitCollabToken(token)) return null;
  return { projectId, token };
}

/**
 * Reads a share link from the current location, hands the token to the vault
 * and removes the fragment. Returns the project id when the token was
 * accepted.
 */
export function consumeShareLink(
  vault: Pick<CollabTokenVault, 'rememberShareToken'>,
  win: Pick<Window, 'location' | 'history'> = window,
): string | null {
  const link = parseShareLink(win.location.href);
  if (!link) return null;

  const claims = vault.rememberShareToken(link.projectId, link.token);

  const clean = new URL(win.location.href);
  clean.hash = '';
  win.history.replaceState(win.history.state, '', `${clean.pathname}${clean.search}`);

  return claims ? link.projectId : null;
}
