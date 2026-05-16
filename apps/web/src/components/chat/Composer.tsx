'use client';

import * as React from 'react';

export function Composer({
  onSend,
  disabled,
  placeholder,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = React.useState('');
  const send = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
  };
  return (
    <form
      className="border-t border-[color:var(--color-border)] p-2 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder ?? 'Answer...'}
        rows={2}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        className="flex-1 px-2 py-1 text-sm border border-[color:var(--color-border)] rounded bg-transparent resize-none"
      />
      <button
        type="submit"
        disabled={disabled || !text.trim()}
        className="px-3 py-1 text-sm rounded bg-[color:var(--color-fg)] text-[color:var(--color-bg)] disabled:opacity-40"
      >
        Send
      </button>
    </form>
  );
}
