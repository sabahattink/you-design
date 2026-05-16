'use client';

import * as React from 'react';
import Link from 'next/link';
import { useWorkspaceStore } from '@/lib/workspace/store';

const TIER_LABEL: Record<string, string> = {
  fast: 'fast',
  standard: 'std',
  best: 'best',
};

const TIER_COLOR: Record<string, string> = {
  fast: 'text-green-600',
  standard: 'text-blue-600',
  best: 'text-purple-600',
};

export function ModelPicker() {
  const models = useWorkspaceStore((s) => s.models);
  const defaultModelId = useWorkspaceStore((s) => s.defaultModelId);
  const setDefaultModel = useWorkspaceStore((s) => s.setDefaultModel);

  const activeModel = models.find((m) => m.id === defaultModelId);
  const activeTier = activeModel?.tier ?? 'standard';

  return (
    <div className="p-2 border-t border-[color:var(--color-border)]">
      <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted)] mb-1">
        Model
      </div>
      <select
        value={defaultModelId ?? ''}
        onChange={(e) => setDefaultModel(e.target.value)}
        className="w-full text-xs px-2 py-1 rounded border border-[color:var(--color-border)] bg-transparent"
      >
        {models.length === 0 && <option value="">— no models —</option>}
        {models.map((m) => {
          const tier = m.tier ?? 'standard';
          return (
            <option key={m.id} value={m.id}>
              {m.label} [{TIER_LABEL[tier] ?? tier}]
            </option>
          );
        })}
      </select>
      {activeModel && (
        <div className={`text-xs mt-1 ${TIER_COLOR[activeTier] ?? ''}`}>
          Default tier: {activeTier}
        </div>
      )}
      <Link
        href="/setup"
        className="block mt-1 text-xs text-[color:var(--color-muted)] hover:underline"
      >
        Manage providers →
      </Link>
    </div>
  );
}
