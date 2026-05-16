'use client';

import * as React from 'react';
import { useExport } from '@/lib/export/useExport';
import type { ExportFormat } from '@you-design/shared';

interface Props {
  onClose: () => void;
}

const FORMATS: Array<{ id: ExportFormat; label: string; desc: string }> = [
  { id: 'html', label: 'HTML', desc: 'Single file, instant download' },
  { id: 'pdf', label: 'PDF', desc: 'Print-ready, all pages' },
  { id: 'pptx', label: 'PPTX', desc: 'Slide deck, one slide per page' },
];

const STATUS_MSG: Record<string, string> = {
  pending: 'Queued…',
  processing: 'Rendering…',
  done: 'Done — downloading…',
  failed: 'Export failed.',
};

export function ExportDialog({ onClose }: Props) {
  const [selected, setSelected] = React.useState<ExportFormat>('html');
  const { startExport, status, error, reset } = useExport();

  const isWorking = status === 'pending' || status === 'processing';
  const isDone = status === 'done';

  const handleExport = () => void startExport(selected);

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-[color:var(--color-bg)] border border-[color:var(--color-border)] rounded-lg shadow-2xl w-80 flex flex-col">
        <div className="p-4 border-b border-[color:var(--color-border)] flex items-center justify-between">
          <h2 className="font-semibold text-sm">Export Project</h2>
          <button
            onClick={handleClose}
            className="text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-4 flex flex-col gap-2">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelected(f.id)}
              disabled={isWorking}
              className={`px-3 py-2 rounded border text-left text-sm transition-colors ${
                selected === f.id
                  ? 'border-[color:var(--color-fg)] bg-[color:var(--color-border)]'
                  : 'border-[color:var(--color-border)]'
              } disabled:opacity-50`}
            >
              <span className="font-medium">{f.label}</span>
              <span className="ml-2 text-xs text-[color:var(--color-muted)]">{f.desc}</span>
            </button>
          ))}
        </div>

        {status !== 'idle' && (
          <div className="px-4 pb-2 text-xs text-[color:var(--color-muted)]">
            {error ?? STATUS_MSG[status]}
          </div>
        )}

        <div className="p-4 border-t border-[color:var(--color-border)] flex gap-2">
          <button
            onClick={handleExport}
            disabled={isWorking || isDone}
            className="flex-1 px-3 py-1.5 rounded bg-[color:var(--color-fg)] text-[color:var(--color-bg)] text-sm disabled:opacity-50"
          >
            {isWorking ? 'Exporting…' : 'Export'}
          </button>
          <button
            onClick={handleClose}
            className="px-3 py-1.5 rounded border border-[color:var(--color-border)] text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
