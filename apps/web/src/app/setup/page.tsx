export const metadata = {
  title: 'Setup',
};

export default function SetupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-lg w-full">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Setup</h1>
        <p className="text-[color:var(--color-muted)] mb-8">
          BYOK (Bring Your Own Keys) onboarding — active in M2.
        </p>

        <div className="space-y-4">
          {STEPS.map((s) => (
            <div
              key={s.title}
              className="p-4 rounded-lg border border-[color:var(--color-border)] opacity-50"
            >
              <div className="font-medium">{s.title}</div>
              <div className="text-sm text-[color:var(--color-muted)]">{s.desc}</div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-[color:var(--color-muted)]">
          Currently M0 — empty skeleton. Setup wizard arrives in M2 (~7 weeks).
        </p>
      </div>
    </main>
  );
}

const STEPS = [
  { title: '1. LLM Keys', desc: 'Anthropic / OpenAI / Gemini API keys (BYOK)' },
  { title: '2. Brand Kit', desc: 'Logo, fonts, color palette — fallback assets' },
  { title: '3. Domain Templates', desc: 'Healthcare, fintech, e-commerce — pick your expertise layer' },
  { title: '4. Analytics (opt)', desc: 'PostHog / Plausible / Umami — for Living Loop' },
];
