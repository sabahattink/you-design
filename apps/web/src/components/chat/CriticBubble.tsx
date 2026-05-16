import * as React from 'react';

export function CriticBubble({ reason }: { reason: string }) {
  return (
    <div className="border-l-2 border-orange-500 pl-3 py-1 text-xs text-[color:var(--color-muted)]">
      <span className="font-semibold text-orange-500 uppercase tracking-wider mr-2">
        Critic
      </span>
      {reason}
    </div>
  );
}
