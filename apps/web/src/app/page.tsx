import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-[color:var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-[color:var(--color-accent)]" />
            <span className="font-semibold tracking-tight">You Design</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[color:var(--color-border)] text-[color:var(--color-muted)]">
              pre-alpha
            </span>
          </div>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/app" className="hover:underline">
              App
            </Link>
            <Link href="/setup" className="hover:underline">
              Setup
            </Link>
            <a
              href="https://github.com/sabahattink/you-design"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              GitHub
            </a>
          </nav>
        </div>
      </header>

      <section className="flex-1 flex items-center">
        <div className="max-w-4xl mx-auto px-6 py-24">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            Brief'i sorgular,
            <br />
            dürüstçe eleştirir,
            <br />
            <span className="text-[color:var(--color-accent)]">multi-agent</span> ile çalışır.
          </h1>
          <p className="mt-8 text-lg text-[color:var(--color-muted)] max-w-2xl">
            Yerelinde çalışan, AGPL lisanslı, AI destekli görsel tasarım + kod çalışma alanı.
            Figma + V0 + Bolt'un eksik bıraktığı yerden başlar: yağcılık yok, multi-format export,
            deploy sonrası analytics geri besleme.
          </p>

          <div className="mt-12 flex flex-wrap gap-3">
            <Link
              href="/app"
              className="px-6 py-3 rounded-md bg-[color:var(--color-fg)] text-[color:var(--color-bg)] text-sm font-medium hover:opacity-90"
            >
              Workspace'i Aç →
            </Link>
            <a
              href="https://github.com/sabahattink/you-design"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-md border border-[color:var(--color-border)] text-sm font-medium hover:bg-[color:var(--color-border)]"
            >
              GitHub
            </a>
          </div>

          <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-lg border border-[color:var(--color-border)]"
              >
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-[color:var(--color-muted)]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[color:var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6 py-6 text-sm text-[color:var(--color-muted)] flex flex-wrap items-center justify-between gap-2">
          <span>You Design · AGPL-3.0 · Pre-alpha</span>
          <span>Roadmap: M0 → M6 (~6 ay)</span>
        </div>
      </footer>
    </main>
  );
}

const FEATURES = [
  {
    icon: '🎯',
    title: 'Intent-first',
    desc: 'Her project: kim için, hangi aksiyon, hangi duygu, success metric. Brief boş geçilemez.',
  },
  {
    icon: '🗣',
    title: 'Honest critic',
    desc: 'Yağcılık yok. "Bu shipped olamaz" diyebilir. Domain expertise (sağlık/fintek/e-ticaret).',
  },
  {
    icon: '👥',
    title: 'Multi-agent room',
    desc: 'Designer + copy + a11y + dev + critic ajanları aynı canvas\'ta paralel. Sen arbiter.',
  },
];
