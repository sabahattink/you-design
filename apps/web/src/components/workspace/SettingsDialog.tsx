'use client';

import { useState } from 'react';
import { ProviderConfig } from '@/components/setup/ProviderConfig';
import { AnalyticsConfig } from '@/components/setup/AnalyticsConfig';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  initialSection?: SettingsSectionId;
}

type SettingsSectionId = 'providers' | 'analytics';

interface SettingsSection {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: string;
}

const SECTIONS: readonly SettingsSection[] = [
  {
    id: 'providers',
    label: 'LLM providers',
    description: 'Bring your own keys — local + cloud',
    icon: '🔑',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'PostHog integration for the Living Loop',
    icon: '📈',
  },
] as const;

export function SettingsDialog({ open, onClose, initialSection = 'providers' }: SettingsDialogProps) {
  const [active, setActive] = useState<SettingsSectionId>(initialSection);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div
        className="flex h-[640px] w-[920px] overflow-hidden rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <aside className="flex w-64 flex-col border-r border-zinc-200 bg-zinc-50/60 p-3">
          <div className="mb-3 px-2 pt-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Settings
            </h2>
          </div>
          <nav className="flex flex-col gap-1">
            {SECTIONS.map((section) => {
              const isActive = section.id === active;
              return (
                <button
                  key={section.id}
                  onClick={() => setActive(section.id)}
                  className={`flex items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-white shadow-sm ring-1 ring-zinc-200'
                      : 'hover:bg-white/60'
                  }`}
                >
                  <span className="text-base leading-5">{section.icon}</span>
                  <span className="flex flex-col">
                    <span className="font-medium text-zinc-900">{section.label}</span>
                    <span className="text-[11px] text-zinc-500">{section.description}</span>
                  </span>
                </button>
              );
            })}
          </nav>
          <div className="mt-auto px-2 pb-1 pt-3">
            <p className="text-[10px] leading-snug text-zinc-400">
              More categories (Local CLI runtime, theme, language) arrive in M7b/M7c.
            </p>
          </div>
        </aside>

        {/* Main */}
        <main className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500">Settings</p>
              <h3 className="text-lg font-semibold text-zinc-900">
                {SECTIONS.find((s) => s.id === active)?.label}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Close settings"
            >
              ✕
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {active === 'providers' && <ProviderConfig />}
            {active === 'analytics' && <AnalyticsConfig />}
          </div>
        </main>
      </div>
    </div>
  );
}
