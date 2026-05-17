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

  const activeSection = SECTIONS.find((s) => s.id === active);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div
        className="flex h-[640px] w-[920px] max-w-[94vw] overflow-hidden rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] text-[color:var(--color-fg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <aside className="flex w-64 flex-col border-r border-[color:var(--color-border)] bg-black/5 p-3 dark:bg-white/5">
          <div className="mb-3 px-2 pt-1">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-muted)]">
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
                      ? 'bg-[color:var(--color-bg)] ring-1 ring-[color:var(--color-border)]'
                      : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="text-base leading-5">{section.icon}</span>
                  <span className="flex flex-col">
                    <span className="font-medium text-[color:var(--color-fg)]">{section.label}</span>
                    <span className="text-[11px] text-[color:var(--color-muted)]">
                      {section.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
          <div className="mt-auto px-2 pb-1 pt-3">
            <p className="text-[10px] leading-snug text-[color:var(--color-muted)]">
              More categories (Local CLI runtime, theme, language) arrive in M7b/M7c.
            </p>
          </div>
        </aside>

        {/* Main */}
        <main className="flex flex-1 flex-col bg-[color:var(--color-bg)]">
          <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-5 py-3">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[color:var(--color-muted)]">
                Settings
              </p>
              <h3 className="text-lg font-semibold text-[color:var(--color-fg)]">
                {activeSection?.label}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="rounded p-1 text-[color:var(--color-muted)] hover:bg-black/5 hover:text-[color:var(--color-fg)] dark:hover:bg-white/5"
              aria-label="Close settings"
            >
              ✕
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4 text-[color:var(--color-fg)]">
            {active === 'providers' && <ProviderConfig />}
            {active === 'analytics' && <AnalyticsConfig />}
          </div>
        </main>
      </div>
    </div>
  );
}
