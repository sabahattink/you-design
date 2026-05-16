# You Design

> **Questions the brief, criticizes honestly, navigates across resolutions — with a multi-agent expert team. Locally.**

Local-first, AGPL-licensed, AI-assisted visual design + code workspace. Picks up where Figma + V0 + Bolt fall short: no sycophancy, domain expertise, multi-format export, post-deploy analytics feedback loop.

> ⚠️ **Pre-alpha.** Currently in M0 scaffolding. First demo (v0.1) lands with M1 (Workspace + Intent).

## Why?

Existing AI design and code tools (Figma AI, V0, Lovable, Bolt.new, Cursor, huashu-design, Claude artifacts, open-design) are good starting points. But they're all **output generators** — sycophantic, intent-less, one-shot.

**You Design** is categorically different:

- 🎯 **Intent-first** — every project begins with: who is this for, what action, what emotion, what success metric. The brief cannot be skipped.
- 🗣 **Honest critic** — no flattery. It can say "this won't ship." Domain expertise (healthcare / fintech / e-commerce).
- 👥 **Multi-agent room** — designer + copywriter + a11y + dev + critic agents work in parallel on the same canvas.
- 🎨 **Canvas + code parity** — Figma-style editable canvas with bidirectional code sync.
- 📦 **One source, 5+ formats** — same project → web app + PPTX + PDF + motion + iOS.
- 🔄 **Living loop** — deploy → analytics → critic feedback.
- 🏠 **Local-first** — Docker compose, your LLM keys, your data.
- 🔌 **MCP plugin ecosystem** — extensible custom agents + exporters.

## Quick Start (M0 — empty skeleton)

```bash
git clone https://github.com/sabahattink/you-design.git
cd you-design
cp .env.example .env
docker compose up -d
```

Then:
- Web: http://localhost:3000
- API: http://localhost:3001/health

> Currently shows an empty landing. M1 (~5 weeks out) brings the first real features.

## Development

Requires: Node 22, pnpm 9, Docker 25+

```bash
pnpm install
pnpm dev          # web :3000 + api :3001 hot reload
pnpm typecheck    # tsc across all workspaces
pnpm test         # vitest
pnpm format       # prettier
```

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 + React 19 + TypeScript |
| UI | shadcn/ui + Tailwind |
| Canvas | Tldraw (lands in M1) |
| Code editor | Monaco (M1) |
| Multiplayer | Y.js + Hocuspocus (M5) |
| Backend | Fastify 5 + Zod + Pino |
| DB | Postgres 16 + pgvector + Drizzle |
| Queue | BullMQ + Redis 7 |
| Render | Playwright + FFmpeg (M3) |
| LLM | Vercel AI SDK + custom router (M2) |
| Plugins | MCP protocol (M6) |
| Self-host | Docker compose |

## Roadmap

Detailed milestone plan: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

- **M0** — Foundation (current, 1-2 weeks)
- **M1** — Workspace + Intent (5 weeks)
- **M2** — Brain + Honest Critic (4 weeks)
- **M3** — Multi-format export (3 weeks)
- **M4** — Multi-Agent Room (5 weeks)
- **M5** — Multiplayer + Living Loop (4 weeks)
- **M6** — Plugins + Native (4 weeks)

**Total v1:** ~6 months.

## Contributing

Currently pre-alpha. PRs will be officially welcomed from M1. See: [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

[AGPL-3.0-or-later](LICENSE). SaaS forks require a separate commercial license.

## Community

- 🐦 Twitter: [@youdesigndev](https://twitter.com/youdesigndev) (reserved)
- 💬 Discussions: GitHub Discussions
- 🐛 Issues: GitHub Issues

---

Made with care. Inspired by huashu-design's honest critic model, frustrated with V0's sycophancy.
