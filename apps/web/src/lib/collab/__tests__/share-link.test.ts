import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildShareUrl, consumeShareLink, parseShareLink } from '../share-link.js';

const PROJECT = '6f1c2b8e-3d4a-4b5c-9d6e-7f8a9b0c1d2e';
const TOKEN = 'yd1.eyJ2IjoxfQ.c2lnbmF0dXJl';

describe('buildShareUrl / parseShareLink', () => {
  it('puts the token in the fragment, not the query', () => {
    const url = buildShareUrl('https://design.example', PROJECT, TOKEN);
    expect(url).toBe(`https://design.example/app?project=${PROJECT}#share=${TOKEN}`);
    expect(new URL(url).search).not.toContain(TOKEN);
  });

  it('round-trips', () => {
    expect(parseShareLink(buildShareUrl('http://localhost:3000', PROJECT, TOKEN))).toEqual({
      projectId: PROJECT,
      token: TOKEN,
    });
  });

  it.each([
    ['no fragment', `http://x/app?project=${PROJECT}`],
    ['no project', `http://x/app#share=${TOKEN}`],
    ['non-uuid project', `http://x/app?project=abc#share=${TOKEN}`],
    ['malformed token', `http://x/app?project=${PROJECT}#share=hello`],
    ['not a url', 'definitely not a url'],
  ])('returns null for %s', (_label, href) => {
    expect(parseShareLink(href)).toBeNull();
  });
});

describe('consumeShareLink', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('stores the token, strips the fragment and returns the project id', () => {
    window.history.replaceState(null, '', `/app?project=${PROJECT}#share=${TOKEN}`);
    const rememberShareToken = vi.fn(() => ({
      v: 1 as const,
      pid: PROJECT,
      role: 'view' as const,
      iat: 0,
      exp: 1,
      ver: 0,
    }));

    expect(consumeShareLink({ rememberShareToken })).toBe(PROJECT);
    expect(rememberShareToken).toHaveBeenCalledWith(PROJECT, TOKEN);
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe(`?project=${PROJECT}`);
  });

  it('still strips the fragment when the vault refuses the token', () => {
    window.history.replaceState(null, '', `/app?project=${PROJECT}#share=${TOKEN}`);
    expect(consumeShareLink({ rememberShareToken: () => null })).toBeNull();
    expect(window.location.hash).toBe('');
  });

  it('is a no-op without a share link', () => {
    window.history.replaceState(null, '', '/app');
    const rememberShareToken = vi.fn(() => null);
    expect(consumeShareLink({ rememberShareToken })).toBeNull();
    expect(rememberShareToken).not.toHaveBeenCalled();
  });
});
