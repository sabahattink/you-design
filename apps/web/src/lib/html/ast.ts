import { parse, parseFragment, serialize } from 'parse5';
import { nanoid } from 'nanoid';
import type { ElementPatch } from '@you-design/shared';

// parse5's tree-adapter default types are not always exposed cleanly; use minimal
// structural types that match the default adapter shape.
export interface AstAttr {
  name: string;
  value: string;
}

export interface AstNode {
  nodeName: string;
  parentNode?: AstNode | null;
  childNodes?: AstNode[];
  // element-only
  tagName?: string;
  attrs?: AstAttr[];
  // text-only
  value?: string;
}

export type HtmlDoc = AstNode;

export function parseHtml(html: string): HtmlDoc {
  return parse(html) as unknown as HtmlDoc;
}

export function toHtml(doc: HtmlDoc): string {
  return serialize(doc as never);
}

function isElement(node: AstNode): boolean {
  return Array.isArray(node.attrs);
}

function walk(node: AstNode, fn: (el: AstNode) => void): void {
  if (!node.childNodes) return;
  for (const child of node.childNodes) {
    if (isElement(child)) {
      fn(child);
      walk(child, fn);
    } else {
      walk(child, fn);
    }
  }
}

function getAttr(el: AstNode, name: string): string | undefined {
  return el.attrs?.find((a) => a.name === name)?.value;
}

function setAttr(el: AstNode, name: string, value: string): void {
  if (!el.attrs) el.attrs = [];
  const existing = el.attrs.find((a) => a.name === name);
  if (existing) existing.value = value;
  else el.attrs.push({ name, value });
}

export function ensureYdIds(doc: HtmlDoc): void {
  walk(doc, (el) => {
    if (!getAttr(el, 'data-yd-id')) {
      setAttr(el, 'data-yd-id', nanoid(8));
    }
  });
}

export function findElementById(doc: HtmlDoc, id: string): AstNode | null {
  let found: AstNode | null = null;
  walk(doc, (el) => {
    if (getAttr(el, 'data-yd-id') === id) found = el;
  });
  return found;
}

export function updateElement(doc: HtmlDoc, id: string, patch: ElementPatch): void {
  const el = findElementById(doc, id);
  if (!el) return;
  if (patch.text !== undefined) {
    el.childNodes = [{ nodeName: '#text', value: patch.text, parentNode: el }];
  }
  if (patch.classes !== undefined) {
    setAttr(el, 'class', patch.classes.join(' '));
  }
  if (patch.attributes !== undefined) {
    for (const [name, value] of Object.entries(patch.attributes)) {
      setAttr(el, name, value);
    }
  }
}

export function addChild(doc: HtmlDoc, parentId: string, html: string): void {
  const parent = findElementById(doc, parentId);
  if (!parent) return;
  const fragment = parseFragment(html) as unknown as AstNode;
  if (!parent.childNodes) parent.childNodes = [];
  if (fragment.childNodes) {
    for (const node of fragment.childNodes) {
      node.parentNode = parent;
      parent.childNodes.push(node);
    }
  }
  ensureYdIds(doc);
}

export function removeElement(doc: HtmlDoc, id: string): void {
  const target = findElementById(doc, id);
  if (!target) return;
  const parent = target.parentNode;
  if (!parent || !parent.childNodes) return;
  parent.childNodes = parent.childNodes.filter((n) => n !== target);
}
