import * as React from 'react';
import type { ChatMessage as ChatMessageT } from '@you-design/shared';

export function ChatMessage({ msg }: { msg: ChatMessageT }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
          isUser ? 'bg-[color:var(--color-accent)] text-white' : 'bg-[color:var(--color-border)]'
        }`}
      >
        {msg.content}
      </div>
    </div>
  );
}
