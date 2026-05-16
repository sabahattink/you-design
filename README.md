# You Design

> **Questions the brief, criticizes honestly, navigates across resolutions — with a multi-agent expert team. Locally.**

Local-first, AGPL-licensed, AI-assisted visual design + code workspace. Picks up where Figma + V0 + Bolt fall short: no sycophancy, domain expertise, multi-format export, post-deploy analytics feedback loop.

> ⚠️ **Alpha — M1 complete.** Workspace shell, intent quiz with honest critic, multi-page HTML designer agent, click-to-edit canvas, Monaco code panel, all wired and persisting to localStorage. Multi-format export (M3), multiplayer (M5), and multi-agent room (M4) ship later.

## Why?

Existing AI design and code tools (Figma AI, V0, Lovable, Bolt.new, Cursor, huashu-design, Claude artifacts, open-design) are good starting points. But they're all **output generators** — sycophantic, intent-less, one-shot.

**You Design** is categorically different:

- 🎯 **Intent-first** — every project begins with: who is this for, what action, what emotion, what success metric. The brief cannot be skipped.
- 🗣 **Honest critic** — no flattery. It can say "this won't ship." Domain expertise (healthcare / fintech / e-commerce planned for M2).
- 👥 **Multi-agent room** — designer + copywriter + a11y + dev + critic agents work in parallel on the same canvas (M4).
- 🎨 **Canvas + code parity** — HTML iframe preview with click-to-edit, Monaco code panel with live sync.
- 📦 **One source, 5+ formats** — same project → web app + PPTX + PDF + motion + iOS (M3+).
- 🔄 **Living loop** — deploy → analytics → critic feedback (M5).
- 🏠 **Local-first** — Docker compose, your LLM keys, your data.
- 🔌 **MCP plugin ecosystem** — extensible custom agents + exporters (M6).

## Quick Start (M1 alpha)

Requires: Node 22, pnpm 9, Docker 25+, an Anthropic API key.

```bash
git clone https://github.com/sabahattink/you-design.git
cd you-design
cp .env.example .env
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env

docker compose -f compose.dev.yml up -d   # Postgres + Redis
pnpm install
pnpm dev                                  # web :3000 + api :3001
```

Open `http://localhost:3000/app` and try the demo flow:

1. Answer "Quick — who is this for?" with a vague reply ("everyone") — observe the critic challenge
2. Refine through 4 slots: persona, action, emotion, success metric
3. Click **Approve & build** when the contract card appears
4. The designer agent generates the homepage; click any element to edit it
5. Switch to the **Code** tab to see / edit the raw HTML in Monaco
6. Ask the chat to "add a pricing page" — sidebar updates, navigate between pages
7. Refresh — your workspace persists in localStorage

## Development

```bash
pnpm install
pnpm dev              # web :3000 + api :3001 hot reload
pnpm typecheck        # tsc across all workspaces
pnpm test             # vitest (unit)
pnpm --filter @you-design/web test:e2e   # Playwright (requires `playwright install chromium` first)
pnpm format           # prettier
```

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15 + React 19 + TypeScript |
| UI | Tailwind v4 |
| Canvas | iframe srcdoc (Tailwind CDN injected) |
| Code editor | Monaco |
| State | Zustand + persist (localStorage) |
| HTML AST | parse5 |
| Backend | Fastify 5 + Zod + Pino |
| DB | Postgres 16 + pgvector + Drizzle (M2+) |
| Queue | BullMQ + Redis 7 (M3+) |
| LLM | Anthropic Claude (Sonnet 4.5 default) |
| Self-host | Docker compose |
| E2E | Playwright (mocked LLM) |

## Roadmap

Detailed milestone plan: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

- **M0** ✅ Foundation
- **M1** ✅ Workspace + Intent (alpha)
- **M2** — Brain + Honest Critic (multi-LLM router, persistent memory, BYOK UI) — 4 weeks
- **M3** — Multi-format export (web + PPTX + PDF) — 3 weeks
- **M4** — Multi-Agent Room (5 specialized agents) — 5 weeks
- **M5** — Multiplayer + Living Loop — 4 weeks
- **M6** — Plugins + Native — 4 weeks

## Contributing

Alpha. Issues and PRs welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

[AGPL-3.0-or-later](LICENSE). SaaS forks require a separate commercial license.

## Community

- 🐦 Twitter: [@youdesigndev](https://twitter.com/youdesigndev) (reserved)
- 💬 GitHub Discussions
- 🐛 GitHub Issues

---

Made with care. Inspired by huashu-design's honest critic model, frustrated with V0's sycophancy.
