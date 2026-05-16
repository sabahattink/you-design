import { describe, it, expect } from 'vitest';
import {
  parseHtml,
  toHtml,
  ensureYdIds,
  findElementById,
  updateElement,
  addChild,
  removeElement,
} from './ast.js';

describe('html ast — parse/serialize', () => {
  it('round-trips a simple document', () => {
    const input = '<html><body><h1>Hi</h1></body></html>';
    const doc = parseHtml(input);
    const out = toHtml(doc);
    expect(out).toContain('<h1>Hi</h1>');
  });
});

describe('html ast — ensureYdIds', () => {
  it('adds data-yd-id to every element', () => {
    const doc = parseHtml('<html><body><h1>Hi</h1><p>X</p></body></html>');
    ensureYdIds(doc);
    const out = toHtml(doc);
    expect((out.match(/data-yd-id=/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('does not overwrite existing ids', () => {
    const doc = parseHtml(
      '<html><body><h1 data-yd-id="abc">Hi</h1></body></html>',
    );
    ensureYdIds(doc);
    const h1 = findElementById(doc, 'abc');
    expect(h1).not.toBeNull();
  });
});

describe('html ast — mutations', () => {
  it('updates element text', () => {
    const doc = parseHtml(
      '<html><body><h1 data-yd-id="a">Old</h1></body></html>',
    );
    updateElement(doc, 'a', { text: 'New' });
    expect(toHtml(doc)).toContain('>New<');
  });

  it('updates element classes', () => {
    const doc = parseHtml(
      '<html><body><h1 data-yd-id="a" class="text-xl">X</h1></body></html>',
    );
    updateElement(doc, 'a', { classes: ['text-2xl', 'font-bold'] });
    expect(toHtml(doc)).toMatch(/class="text-2xl font-bold"/);
  });

  it('adds a child', () => {
    const doc = parseHtml(
      '<html><body data-yd-id="body"></body></html>',
    );
    addChild(doc, 'body', '<p>New</p>');
    expect(toHtml(doc)).toContain('<p');
    expect(toHtml(doc)).toContain('New');
  });

  it('removes element', () => {
    const doc = parseHtml(
      '<html><body><h1 data-yd-id="a">Bye</h1></body></html>',
    );
    removeElement(doc, 'a');
    expect(toHtml(doc)).not.toContain('Bye');
  });
});
