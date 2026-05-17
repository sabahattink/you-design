'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';

export function IntentChip() {
  const contract = useWorkspaceStore((s) => s.intentContract);
  if (!contract) return null;
  return (
    <div className="p-2 border-t border-[color:var(--color-border)]">
      <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted)] mb-1">
        Intent
      </div>
      <div className="text-xs space-y-0.5">
        <div>
          <span className="text-[color:var(--color-muted)]">For:</span> {contract.persona.role}
        </div>
        <div>
          <span className="text-[color:var(--color-muted)]">Action:</span> {contract.primaryAction}
        </div>
        <div>
          <span className="text-[color:var(--color-muted)]">Feel:</span> {contract.emotion}
        </div>
      </div>
    </div>
  );
}
