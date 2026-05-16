import { describe, it, expect } from 'vitest';
import { ChatMessage, ToolCall, ElementPatch, Page } from './chat.js';

describe('chat schemas', () => {
  it('parses a user message', () => {
    const parsed = ChatMessage.parse({
      id: 'm1',
      role: 'user',
      content: 'hello',
      createdAt: new Date().toISOString(),
    });
    expect(parsed.role).toBe('user');
  });

  it('parses a tool call', () => {
    const parsed = ToolCall.parse({
      id: 't1',
      name: 'record_slot',
      args: { slot: 'persona', value: 'indie dev' },
    });
    expect(parsed.name).toBe('record_slot');
  });

  it('parses an element patch', () => {
    const parsed = ElementPatch.parse({ text: 'New headline' });
    expect(parsed.text).toBe('New headline');
  });

  it('rejects invalid path on Page', () => {
    expect(() =>
      Page.parse({
        id: 'p1',
        path: 'INVALID PATH',
        title: 'X',
        html: '<html></html>',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    ).toThrow();
  });
});
