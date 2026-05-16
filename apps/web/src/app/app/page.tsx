export const metadata = {
  title: 'Workspace',
};

export default function AppShellPage() {
  return (
    <div className="h-screen flex flex-col">
      <div className="h-12 border-b border-[color:var(--color-border)] flex items-center px-4 text-sm">
        <span className="font-semibold">You Design</span>
        <span className="ml-3 text-[color:var(--color-muted)]">Workspace</span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded bg-[color:var(--color-border)]">
          M0 · empty shell
        </span>
      </div>

      <div className="flex-1 flex">
        <aside className="w-56 border-r border-[color:var(--color-border)] p-3 text-sm">
          <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted)] mb-2">
            Files
          </div>
          <div className="text-[color:var(--color-muted)] italic">
            Empty — M1'de file tree gelir
          </div>
        </aside>

        <section className="flex-1 grid place-items-center bg-[color:var(--color-bg)]">
          <div className="text-center max-w-md px-6">
            <div className="text-5xl mb-4">🎨</div>
            <h2 className="text-xl font-semibold mb-2">Canvas yer tutucusu</h2>
            <p className="text-sm text-[color:var(--color-muted)]">
              M1'de Tldraw entegrasyonu + AST ↔ Canvas sync + ilk LLM chat panel gelecek.
            </p>
          </div>
        </section>

        <aside className="w-80 border-l border-[color:var(--color-border)] p-3 text-sm">
          <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted)] mb-2">
            Chat (M1)
          </div>
          <div className="text-[color:var(--color-muted)] italic">
            LLM chat panel — M1'de aktif
          </div>
        </aside>
      </div>
    </div>
  );
}
