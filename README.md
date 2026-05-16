# You Design

> **Brief'i sorgular, dürüstçe eleştirir, çoklu çözünürlükte gezinir — multi-agent uzman takımıyla. Yerelinde.**

Local-first, AGPL-lisanslı, AI destekli görsel tasarım + kod çalışma alanı. Figma + V0 + Bolt'un eksik bıraktığı yerden başlar: yağcılık yok, domain expertise var, multi-format export, deploy sonrası analytics geri besleme.

> ⚠️ **Pre-alpha.** M0 scaffolding aşaması. v0.1 demosu için M1 (Workspace + Intent) bekleniyor.

## Neden?

Mevcut AI tasarım ve kodlama araçları (Figma AI, V0, Lovable, Bolt.new, Cursor, huashu-design, Claude artifacts, open-design) iyi başlangıç. Ama hepsi **output üretici** — "yağcı, niyetsiz, tek seferlik".

**You Design** kategorik olarak farklı:

- 🎯 **Intent-first** — her project "kim için, hangi aksiyonu istetiyoruz, success metric ne" sorularıyla başlar
- 🗣 **Honest critic** — "bu brief kötü", "bu shipped olamaz" diyebilir. Yağcılık yok.
- 👥 **Multi-agent room** — designer + copywriter + a11y + dev + critic ajanları aynı canvas'ta paralel çalışır
- 🎨 **Canvas + kod parite** — Figma tarzı editable canvas, bidirectional sync ile kod
- 📦 **Tek kaynak, 5+ format** — aynı proje → web app + PPTX + PDF + motion + iOS
- 🔄 **Living loop** — deploy → analytics → critic'e geri akar
- 🏠 **Local-first** — Docker compose, kendi LLM key'lerin, kendi data'n
- 🔌 **MCP plugin** — extensible custom agent + exporter

## Hızlı Başlangıç (M0 — boş iskelet)

```bash
git clone https://github.com/sabahattink/you-design.git
cd you-design
cp .env.example .env
docker compose up -d
```

Açılınca:
- Web: http://localhost:3000
- API: http://localhost:3001/health

> Şu anda boş bir landing var. M1 (~5 hafta sonra) ilk gerçek özelliklerle gelecek.

## Geliştirme

Gerekenler: Node 22, pnpm 9, Docker 25+

```bash
pnpm install
pnpm dev          # web :3000 + api :3001 hot reload
pnpm typecheck    # tsc her workspace
pnpm test         # vitest
pnpm format       # prettier
```

## Stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Next.js 15 + React 19 + TypeScript |
| UI | shadcn/ui + Tailwind |
| Canvas | Tldraw (M1'de eklenir) |
| Code editor | Monaco (M1) |
| Multiplayer | Y.js + Hocuspocus (M5) |
| Backend | Fastify 5 + Zod + Pino |
| DB | Postgres 16 + pgvector + Drizzle |
| Queue | BullMQ + Redis 7 |
| Render | Playwright + FFmpeg (M3) |
| LLM | Vercel AI SDK + custom router (M2) |
| Plugins | MCP protokolü (M6) |
| Self-host | Docker compose |

## Yol Haritası

Detaylı milestone planı: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

- **M0** — Foundation (şu anda, 1-2 hafta)
- **M1** — Workspace + Intent (5 hafta)
- **M2** — Brain + Honest Critic (4 hafta)
- **M3** — Multi-format export (3 hafta)
- **M4** — Multi-Agent Room (5 hafta)
- **M5** — Multiplayer + Living Loop (4 hafta)
- **M6** — Plugins + Native (4 hafta)

**Toplam v1:** ~6 ay.

## Katkı

Henüz pre-alpha. M1'den itibaren PR'lar açık olacak. Bkz: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Lisans

[AGPL-3.0-or-later](LICENSE). SaaS forku için ayrı ticari lisans gerekir.

## Topluluk

- 🐦 Twitter: [@youdesigndev](https://twitter.com/youdesigndev) (rezerv)
- 💬 Discussions: GitHub Discussions
- 🐛 Issues: GitHub Issues

---

Made with care. Inspired by huashu-design's honest critic model, frustrated with V0's sycophancy.
