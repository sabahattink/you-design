# You Design

> **Questions the brief, criticizes honestly, navigates across resolutions — with a multi-agent expert team. Locally.**

Local-first, AGPL-licensed, AI-assisted visual design + code workspace. Picks up where Figma + V0 + Bolt fall short: no sycophancy, domain expertise, multi-format export, post-deploy analytics feedback loop.

> ⚠️ **Alpha — M2.1 (critic + domains) shipped.** Workspace shell, intent quiz, multi-page HTML designer agent, click-to-edit canvas, Monaco code panel, all wired and persisting to localStorage. **Bring any LLM** — built-in Anthropic / OpenAI / Gemini support plus any OpenAI-compatible endpoint (Ollama, Groq, OpenRouter, LM Studio, vLLM, ...). **Honest critic now runs in build phase too** — reviews every designer action, structured issues with severity / category / Fix button, never blocks. **4 domain templates**: general / SaaS landing / e-commerce product / healthcare appointment. Multi-format export (M3), multiplayer (M5), full multi-agent room (M4) ship later.

## Why?

Existing AI design and code tools (Figma AI, V0, Lovable, Bolt.new, Cursor, huashu-design, Claude artifacts, open-design) are good starting points. But they're all **output generators** — sycophantic, intent-less, one-shot.

**You Design** is categorically different:

- 🎯 **Intent-first** — every project begins with: who is this for, what action, what emotion, what success metric, **and what domain**. The brief cannot be skipped.
- 🗣 **Honest critic (now in build phase too)** — runs automatically after every designer action. Structured issues (severity / category / message / element / suggestion). One-click Fix routes back to the designer. Suggest-only — never blocks.
- 🏛 **Domain templates** — pick from general / SaaS landing / e-commerce product / healthcare appointment. Designer and critic specialize their rules accordingly.
- 👥 **Multi-agent room** — designer + critic land in M2.1 (this release). Copywriter / a11y / dev as separate agents land in M4.
- 🎨 **Canvas + code parity** — HTML iframe preview with click-to-edit, Monaco code panel with live sync.
- 📦 **One source, 5+ formats** — same project → web app + PPTX + PDF + motion + iOS (M3+).
- 🔄 **Living loop** — deploy → analytics → critic feedback (M5).
- 🏠 **Local-first** — Docker compose, your LLM keys, your data.
- 🔌 **MCP plugin ecosystem** — extensible custom agents + exporters (M6).

## Quick Start (alpha)

Requires: Node 22, pnpm 9, Docker 25+, **and any LLM you can reach** — see the provider list below.

```bash
git clone https://github.com/sabahattink/you-design.git
cd you-design
cp .env.example .env
# Optional: set an env key as a server-side fallback. The UI works without it too.
# echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env

docker compose -f compose.dev.yml up -d   # Postgres + Redis
pnpm install
pnpm dev                                  # web :3000 + api :3001
```

Open `http://localhost:3000/setup` and add the model you want to use. Then visit `/app`.

### Supported providers

| Provider | How |
|----------|-----|
| **Anthropic Claude** | API key (built-in) |
| **OpenAI** | API key (built-in) |
| **Google Gemini** | API key (built-in) |
| **Ollama** | OpenAI-compatible, base URL `http://localhost:11434/v1` |
| **Groq** | OpenAI-compatible, base URL `https://api.groq.com/openai/v1` |
| **OpenRouter** | OpenAI-compatible, base URL `https://openrouter.ai/api/v1` |
| **LM Studio** | OpenAI-compatible, base URL `http://localhost:1234/v1` |
| **vLLM / Text Generation WebUI / any OpenAI-shaped server** | Custom base URL |

Keys are stored in your browser's localStorage and sent per request to the local API server. Nothing is written to disk on the server unless you set them as env vars.

### Demo flow

1. `/setup` → add a model (e.g. Anthropic Claude with your key)
2. `/app` → answer "Quick — who is this for?" with a vague reply ("everyone") — observe the critic challenge
3. Refine through 5 slots: persona, action, emotion, success metric, **domain** (general / saas-landing / ecommerce-product / healthcare-appointment)
4. Click **Approve & build** when the contract card appears
5. Designer generates the homepage using the domain's rules; **critic runs automatically** in the background
6. Open the **Critic** drawer (sidebar bottom) — filter by severity, click **Fix** to send the issue back through the designer
7. Click any canvas element to edit it; switch to **Code** tab for Monaco
8. Ask the chat to "add a pricing page" — sidebar updates, navigate between pages
9. Sidebar **Model** dropdown switches providers/models on the fly
10. Refresh — your workspace persists in localStorage

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
| LLM | Vercel AI SDK + @ai-sdk/{anthropic,openai,google} + any OpenAI-compatible endpoint |
| Self-host | Docker compose |
| E2E | Playwright (mocked LLM) |

## Roadmap

Detailed milestone plan: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

- **M0** ✅ Foundation
- **M1** ✅ Workspace + Intent (alpha) — v0.1.0-alpha
- **multi-provider BYOK** ✅ — v0.2.0-alpha
- **M2.1** ✅ Build-phase critic + Domain templates — v0.3.0-alpha
- **M2.2** ✅ Semantic memory (recall on designer requests) — v0.4.0-alpha
- **M2.3** ✅ Smart router + cost tracking (per-task tier routing, usage logs) — v0.5.0-alpha
- **M3** ✅ Multi-format export (web + PPTX + PDF) — v0.6.0-alpha
- **M4** ✅ Multi-Agent Room (designer / copywriter / a11y / dev / critic) — v0.7.0-alpha
- **M5a** ✅ Living Loop (PostHog analytics → Critic feedback) — v0.8.0-alpha
- **M6a** ✅ Motion export (MP4/GIF slideshow via Playwright + FFmpeg) — v0.9.0-alpha
- **M5b** — Multiplayer (Y.js CRDT + Hocuspocus + presence) — 4 weeks
- **M6b** — Plugins (MCP host runtime + marketplace + sandbox) — 3 weeks
- **M6c** — Native exporters (iOS) — 2 weeks

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
