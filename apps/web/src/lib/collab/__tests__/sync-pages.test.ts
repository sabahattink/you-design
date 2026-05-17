import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';

/**
 * Validates the CRDT shape that sync-pages.ts builds:
 * - pages: Y.Map<string, Y.Map> keyed by path
 * - each page has html: Y.Text so concurrent edits converge
 */
describe('M5b CRDT convergence', () => {
  function seedPage(doc: Y.Doc) {
    doc.transact(() => {
      const pages = doc.getMap<Y.Map<unknown>>('pages');
      const page = new Y.Map<unknown>();
      page.set('id', 'p1');
      page.set('path', '/');
      page.set('title', 'Home');
      const html = new Y.Text();
      html.insert(0, '<p>Hello</p>');
      page.set('html', html);
      page.set('createdAt', '2026-05-17T00:00:00.000Z');
      page.set('updatedAt', '2026-05-17T00:00:00.000Z');
      pages.set('/', page);
    });
  }

  function htmlOf(doc: Y.Doc, path: string): string {
    const pages = doc.getMap<Y.Map<unknown>>('pages');
    const page = pages.get(path);
    if (!page) throw new Error(`no page at ${path}`);
    const html = page.get('html');
    if (!(html instanceof Y.Text)) throw new Error('html is not Y.Text');
    return html.toString();
  }

  it('two clients converge after concurrent text insertions', () => {
    const alice = new Y.Doc();
    const bob = new Y.Doc();
    seedPage(alice);

    // Initial sync alice -> bob
    Y.applyUpdate(bob, Y.encodeStateAsUpdate(alice));
    expect(htmlOf(bob, '/')).toBe('<p>Hello</p>');

    // Concurrent edits without any cross-sync in between
    const aliceText = alice.getMap<Y.Map<unknown>>('pages').get('/')!.get('html') as Y.Text;
    const bobText = bob.getMap<Y.Map<unknown>>('pages').get('/')!.get('html') as Y.Text;
    aliceText.insert(3, 'Alice '); // <p>Alice Hello</p>
    bobText.insert(3, 'Bob '); // <p>Bob Hello</p>

    // Bidirectional sync
    Y.applyUpdate(bob, Y.encodeStateAsUpdate(alice));
    Y.applyUpdate(alice, Y.encodeStateAsUpdate(bob));

    const finalAlice = htmlOf(alice, '/');
    const finalBob = htmlOf(bob, '/');
    expect(finalAlice).toBe(finalBob);
    expect(finalAlice).toContain('Alice');
    expect(finalAlice).toContain('Bob');
    expect(finalAlice).toContain('Hello');
  });

  it('adding a page on one client appears on the other', () => {
    const alice = new Y.Doc();
    const bob = new Y.Doc();
    seedPage(alice);
    Y.applyUpdate(bob, Y.encodeStateAsUpdate(alice));

    alice.transact(() => {
      const pages = alice.getMap<Y.Map<unknown>>('pages');
      const pricing = new Y.Map<unknown>();
      pricing.set('id', 'p2');
      pricing.set('path', '/pricing');
      pricing.set('title', 'Pricing');
      const html = new Y.Text();
      html.insert(0, '<h1>Pricing</h1>');
      pricing.set('html', html);
      pricing.set('createdAt', '2026-05-17T00:00:01.000Z');
      pricing.set('updatedAt', '2026-05-17T00:00:01.000Z');
      pages.set('/pricing', pricing);
    });

    Y.applyUpdate(bob, Y.encodeStateAsUpdate(alice));
    expect(htmlOf(bob, '/pricing')).toBe('<h1>Pricing</h1>');
  });

  it('deleting a page on one client removes it on the other', () => {
    const alice = new Y.Doc();
    const bob = new Y.Doc();
    seedPage(alice);
    Y.applyUpdate(bob, Y.encodeStateAsUpdate(alice));

    alice.transact(() => {
      alice.getMap<Y.Map<unknown>>('pages').delete('/');
    });
    Y.applyUpdate(bob, Y.encodeStateAsUpdate(alice));

    expect(bob.getMap<Y.Map<unknown>>('pages').size).toBe(0);
  });
});
