'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';

export function IntentContractCard() {
  const contract = useWorkspaceStore((s) => s.intentContract);
  const setPhase = useWorkspaceStore((s) => s.setIntentPhase);

  if (!contract) return null;

  const fields: Array<[string, string]> = [
    ['Persona', contract.persona.role],
    ['Action', contract.primaryAction],
    ['Emotion', contract.emotion],
    ['Success', contract.successMetrics[0]?.name ?? '—'],
    ['Domain', contract.domain],
  ];

  return (
    <div className="border border-[color:var(--color-border)] rounded-lg p-3 mt-2 bg-[color:var(--color-bg)]">
      <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted)] mb-2">
        Intent Contract
      </div>
      <dl className="text-xs grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {fields.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="text-[color:var(--color-muted)]">{k}</dt>
            <dd>{v}</dd>
          </React.Fragment>
        ))}
      </dl>
      <button
        onClick={() => setPhase('building')}
        className="mt-3 w-full px-3 py-2 rounded bg-[color:var(--color-fg)] text-[color:var(--color-bg)] text-sm"
      >
        Approve & build
      </button>
    </div>
  );
}
