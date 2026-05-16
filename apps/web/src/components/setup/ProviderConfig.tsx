'use client';

import * as React from 'react';
import { useWorkspaceStore } from '@/lib/workspace/store';
import {
  PROVIDERS,
  ProviderType,
  getProviderInfo,
  newModelId,
  type ModelConfig,
} from '@you-design/shared';

interface FormState {
  label: string;
  provider: ProviderType;
  modelName: string;
  apiKey: string;
  baseURL: string;
}

const EMPTY_FORM: FormState = {
  label: '',
  provider: 'anthropic',
  modelName: 'claude-sonnet-4-5',
  apiKey: '',
  baseURL: '',
};

export function ProviderConfig() {
  const models = useWorkspaceStore((s) => s.models);
  const defaultModelId = useWorkspaceStore((s) => s.defaultModelId);
  const upsertModel = useWorkspaceStore((s) => s.upsertModel);
  const removeModel = useWorkspaceStore((s) => s.removeModel);
  const setDefaultModel = useWorkspaceStore((s) => s.setDefaultModel);

  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const providerInfo = getProviderInfo(form.provider);

  const startEdit = (m: ModelConfig): void => {
    setEditingId(m.id);
    setForm({
      label: m.label,
      provider: m.provider,
      modelName: m.modelName,
      apiKey: m.apiKey ?? '',
      baseURL: m.baseURL ?? '',
    });
  };

  const cancelEdit = (): void => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const save = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!form.label.trim() || !form.modelName.trim()) return;
    if (providerInfo.needsBaseURL && !form.baseURL.trim()) return;
    const model: ModelConfig = {
      id: editingId ?? newModelId(),
      label: form.label.trim(),
      provider: form.provider,
      modelName: form.modelName.trim(),
      ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
      ...(form.baseURL.trim() ? { baseURL: form.baseURL.trim() } : {}),
    };
    upsertModel(model);
    cancelEdit();
  };

  const onProviderChange = (provider: ProviderType): void => {
    const info = getProviderInfo(provider);
    setForm((f) => ({
      ...f,
      provider,
      modelName: info.exampleModels[0] ?? f.modelName,
    }));
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold mb-3">Configured models</h2>
        {models.length === 0 && (
          <div className="text-sm text-[color:var(--color-muted)] italic">
            No models configured yet — add one below.
          </div>
        )}
        <ul className="space-y-2">
          {models.map((m) => {
            const isDefault = m.id === defaultModelId;
            return (
              <li
                key={m.id}
                className="p-3 border border-[color:var(--color-border)] rounded flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.label}</span>
                    {isDefault && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[color:var(--color-accent)] text-white">
                        active
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[color:var(--color-muted)] mt-1 font-mono">
                    {m.provider} · {m.modelName}
                    {m.baseURL ? ` · ${m.baseURL}` : ''}
                  </div>
                  <div className="text-xs text-[color:var(--color-muted)] mt-1">
                    Key: {m.apiKey ? 'set in browser' : 'server env fallback'}
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  {!isDefault && (
                    <button
                      onClick={() => setDefaultModel(m.id)}
                      className="hover:underline"
                    >
                      Activate
                    </button>
                  )}
                  <button
                    onClick={() => startEdit(m)}
                    className="hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Remove "${m.label}"?`)) removeModel(m.id);
                    }}
                    className="hover:underline text-red-500"
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">
          {editingId ? 'Edit model' : 'Add a model'}
        </h2>
        <form onSubmit={save} className="space-y-3">
          <Field label="Display label">
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="e.g. Claude Sonnet (work)"
              className="input"
              required
            />
          </Field>
          <Field label="Provider">
            <select
              value={form.provider}
              onChange={(e) => onProviderChange(e.target.value as ProviderType)}
              className="input"
            >
              {PROVIDERS.map((p) => (
                <option key={p.type} value={p.type}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Model name"
            hint={
              providerInfo.exampleModels.length > 0
                ? `e.g. ${providerInfo.exampleModels.join(', ')}`
                : undefined
            }
          >
            <input
              value={form.modelName}
              onChange={(e) => setForm({ ...form, modelName: e.target.value })}
              className="input font-mono"
              required
            />
          </Field>
          <Field
            label="API key"
            hint={
              form.provider === 'openai-compatible'
                ? 'Optional. Many local servers (Ollama, LM Studio) ignore this.'
                : 'Leave blank to use the server-side env var.'
            }
          >
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              className="input font-mono"
              autoComplete="off"
            />
          </Field>
          {providerInfo.needsBaseURL && (
            <Field
              label="Base URL"
              hint="e.g. http://localhost:11434/v1 (Ollama), https://api.groq.com/openai/v1 (Groq)"
            >
              <input
                value={form.baseURL}
                onChange={(e) => setForm({ ...form, baseURL: e.target.value })}
                className="input font-mono"
                required
              />
            </Field>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded bg-[color:var(--color-fg)] text-[color:var(--color-bg)] text-sm"
            >
              {editingId ? 'Save changes' : 'Add model'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2 rounded border border-[color:var(--color-border)] text-sm"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <p className="text-xs text-[color:var(--color-muted)]">
        Keys are stored only in this browser&apos;s localStorage and sent per request to the
        local API. They are never written to the server unless you explicitly add them
        as env vars.
      </p>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 0.5rem 0.625rem;
          font-size: 0.875rem;
          background: transparent;
          border: 1px solid var(--color-border);
          border-radius: 0.375rem;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted)] mb-1">
        {label}
      </div>
      {children}
      {hint && (
        <div className="text-xs text-[color:var(--color-muted)] mt-1">{hint}</div>
      )}
    </label>
  );
}
