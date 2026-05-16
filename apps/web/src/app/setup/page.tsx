export const metadata = {
  title: 'Setup',
};

export default function SetupPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-lg w-full">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Setup</h1>
        <p className="text-[color:var(--color-muted)] mb-8">
          BYOK (Bring Your Own Keys) onboarding — M2'de aktif.
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
          Şu an M0 — boş iskelet. Setup wizard M2 (~7 hafta sonra).
        </p>
      </div>
    </main>
  );
}

const STEPS = [
  { title: '1. LLM Keys', desc: 'Anthropic / OpenAI / Gemini API keys (BYOK)' },
  { title: '2. Brand Kit', desc: 'Logo, fontlar, renk paleti — assetler için fallback' },
  { title: '3. Domain Templates', desc: 'Sağlık, fintek, e-ticaret — uzmanlık katmanı seç' },
  { title: '4. Analytics (opt)', desc: 'PostHog / Plausible / Umami — Living loop için' },
];
