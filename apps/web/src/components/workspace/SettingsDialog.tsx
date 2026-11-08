'use client';

import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { ProviderConfig } from '@/components/setup/ProviderConfig';
import { AnalyticsConfig } from '@/components/setup/AnalyticsConfig';
import { useModalDialog } from '@/lib/a11y/use-modal-dialog';

type SettingsSectionId = 'providers' | 'analytics';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  initialSection?: SettingsSectionId;
}

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
];

export function SettingsDialog({
  open,
  onClose,
  initialSection = 'providers',
}: SettingsDialogProps) {
  if (!open) return null;
  // Mounted only while open: focus moves in on open and back out on close,
  // and every open starts at `initialSection`.
  return <SettingsDialogPanel onClose={onClose} initialSection={initialSection} />;
}

interface SettingsDialogPanelProps {
  onClose: () => void;
  initialSection: SettingsSectionId;
}

function SettingsDialogPanel({ onClose, initialSection }: SettingsDialogPanelProps) {
  const [active, setActive] = useState<SettingsSectionId>(initialSection);
  const dialogRef = useModalDialog<HTMLDivElement>(onClose);
  const tabRefs = useRef<Partial<Record<SettingsSectionId, HTMLButtonElement | null>>>({});

  const baseId = useId();
  const titleId = `${baseId}-title`;
  const tabId = (id: SettingsSectionId) => `${baseId}-tab-${id}`;
  const panelId = (id: SettingsSectionId) => `${baseId}-panel-${id}`;

  const activeSection = SECTIONS.find((s) => s.id === active) ?? SECTIONS[0];

  const activateTabAt = (index: number) => {
    const section = SECTIONS[(index + SECTIONS.length) % SECTIONS.length];
    if (!section) return;
    setActive(section.id);
    tabRefs.current[section.id]?.focus();
  };

  // Tabs pattern (WAI-ARIA APG): arrows move + activate, Home/End jump.
  // Both axes are handled because the list is a row on narrow screens and a
  // column from `sm` up.
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = {
      ArrowDown: index + 1,
      ArrowRight: index + 1,
      ArrowUp: index - 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: SECTIONS.length - 1,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    activateTabAt(target);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => {
        // Only a press that starts on the backdrop itself closes the dialog,
        // so a text selection dragged out of the panel does not.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex h-full max-h-[640px] w-full max-w-[920px] flex-col overflow-hidden rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] text-[color:var(--color-fg)] shadow-2xl outline-none sm:flex-row"
      >
        <aside className="flex shrink-0 flex-col border-b border-[color:var(--color-border)] bg-black/5 p-2 sm:w-64 sm:border-b-0 sm:border-r sm:p-3 dark:bg-white/5">
          <h2
            id={titleId}
            className="mb-2 px-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-muted)] sm:mb-3"
          >
            Settings
          </h2>
          <div
            role="tablist"
            aria-label="Settings sections"
            aria-orientation="vertical"
            className="flex gap-1 overflow-x-auto sm:flex-col sm:overflow-visible"
          >
            {SECTIONS.map((section, index) => {
              const isActive = section.id === active;
              return (
                <button
                  key={section.id}
                  ref={(el) => {
                    tabRefs.current[section.id] = el;
                  }}
                  type="button"
                  role="tab"
                  id={tabId(section.id)}
                  aria-selected={isActive}
                  aria-controls={panelId(section.id)}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActive(section.id)}
                  onKeyDown={(e) => onTabKeyDown(e, index)}
                  className={`flex shrink-0 items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--color-accent)] ${
                    isActive
                      ? 'bg-[color:var(--color-bg)] ring-1 ring-[color:var(--color-border)]'
                      : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <span aria-hidden="true" className="text-base leading-5">
                    {section.icon}
                  </span>
                  <span className="flex flex-col">
                    <span className="font-medium text-[color:var(--color-fg)]">
                      {section.label}
                    </span>
                    <span className="hidden text-[11px] text-[color:var(--color-muted)] sm:block">
                      {section.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-auto hidden px-2 pb-1 pt-3 text-[10px] leading-snug text-[color:var(--color-muted)] sm:block">
            More categories (Local CLI runtime, theme, language) arrive in M7b/M7c.
          </p>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-[color:var(--color-border)] px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p
                aria-hidden="true"
                className="text-[11px] uppercase tracking-wider text-[color:var(--color-muted)]"
              >
                Settings
              </p>
              <h3 className="truncate text-lg font-semibold text-[color:var(--color-fg)]">
                {activeSection?.label}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded p-1 text-[color:var(--color-muted)] hover:bg-black/5 hover:text-[color:var(--color-fg)] dark:hover:bg-white/5"
              aria-label="Close settings"
            >
              ✕
            </button>
          </header>
          <div
            role="tabpanel"
            id={panelId(active)}
            aria-labelledby={tabId(active)}
            tabIndex={0}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-[color:var(--color-fg)] sm:px-5"
          >
            {active === 'providers' && <ProviderConfig />}
            {active === 'analytics' && <AnalyticsConfig />}
          </div>
        </div>
      </div>
    </div>
  );
}
