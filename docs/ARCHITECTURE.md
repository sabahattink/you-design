# Architecture

> Yüksek seviye sistem tasarımı. Detaylı master plan için: `~/.claude/plans/open-design-claude-design-sleepy-cat.md`.

## Wedge

Mevcut AI tasarım/kod araçları "output üretici, sycophant, niyetsiz". You Design **honest, multi-agent, living, local-first** kategorisi.

## Ürün Konumu

> "Brief'i sorgular, dürüstçe eleştirir, çoklu çözünürlükte gezinir, copy ve a11y'yi de kapsar, multi-agent uzman takımıyla çalışır, deploy sonrası gerçek datayla iterasyon yapar — yerelinde."

## 9 Alt Sistem

| # | Alt Sistem | Sorumluluk | Geldiği Milestone |
|---|-----------|-----------|-------------------|
| 1 | **Workspace Core** | Canvas + kod editor + bidirectional sync + file tree | M1 |
| 2 | **LLM Brain** | Multi-LLM smart router + streaming chat + agent tools + pgvector memory + BYOK | M1 (minimal) → M2 (full) |
| 3 | **Multi-Format Pipeline** | Web + PPTX + PDF + MP4/GIF + iOS exporters + Vercel deploy + npm extraction | M3 (web/PPTX/PDF) → M6 (motion/iOS) |
| 4 | **Multiplayer** | Y.js CRDT + Hocuspocus + cursor presence + permissions | M5 |
| 5 | **MCP Plugin Ecosystem** | MCP host runtime + marketplace UI + sandbox | M6 |
| 6 | **Self-Host Distribution** | Docker compose + env validation + admin UI + onboarding | M0 (skeleton) → M2 (BYOK UI) |
| 7 | **Intent Engine + Critic** | Intent quiz + brief guardrail + domain templates + honest critic agent | M1 (minimal) → M2 (full) |
| 8 | **Multi-Agent Room** | 5 specialized agents (designer/copy/a11y/dev/critic) + canvas annotations + arbitration | M4 |
| 9 | **Living Loop** | Analytics integration + design git (branch/merge directions) + feedback synthesis | M5 |

## Veri Akışı (yüksek seviye)

```
User brief
   ↓
Intent Engine (Subsystem 7) — quiz + contract
   ↓
LLM Brain (Subsystem 2) — multi-LLM smart routing
   ↓
Workspace Core (Subsystem 1) — canvas + code state
   ↓
Multi-Agent Room (Subsystem 8) — 5 paralel ajan
   ↓
User accept/reject + iteration
   ↓
Multi-Format Pipeline (Subsystem 3) — export
   ↓
Deploy
   ↓
Living Loop (Subsystem 9) — analytics geri besleme
   ↓
(loop back to Intent / Critic)
```

## Stack Özet

- **Frontend:** Next.js 15, React 19, TypeScript, shadcn/ui, Tailwind, Tldraw, Monaco
- **Backend:** Fastify 5, TypeScript, Zod, Pino
- **Realtime:** Y.js + Hocuspocus (CRDT)
- **DB:** Postgres 16 + pgvector, Drizzle ORM
- **Queue:** BullMQ + Redis 7
- **Render:** Playwright (headless Chromium) + FFmpeg
- **LLM:** Vercel AI SDK + custom cost-aware router
- **Plugin:** MCP protokolü
- **Self-host:** Docker compose (tek dosya)
- **Desktop (opt):** Tauri

## Monorepo Yapısı

```
you-design/
├── apps/
│   ├── web/         # Next.js 15 (frontend + marketing)
│   └── api/         # Fastify (REST + SSE + WebSocket)
├── packages/
│   ├── shared/      # types, zod schemas, utils
│   ├── ui/          # shadcn components, Tailwind preset
│   ├── db/          # Drizzle schema + migrations
│   └── llm/         # LLM router (M2)
├── docker/
└── docs/
```

## Multi-LLM Routing (Subsystem 2, M2)

| Görev tipi | Default model | Neden |
|-----------|--------------|------|
| Yargı / honest critic | Claude Opus 4.7 | en derin reasoning |
| Ana üretim | Claude Sonnet 4.6 | best coding model |
| Hızlı edit, autocomplete | Claude Haiku 4.5 | 3x ucuz, %90 capability |
| Vision (canvas screenshot analiz) | Gemini 2.0 Flash | en ucuz vision |
| Embedding (memory) | text-embedding-3-large | pgvector için |

## Lisans Stratejisi

- **AGPL-3.0-or-later** — SaaS fork'larını engeller (network use = source release zorunluluğu)
- Commercial license ayrıca satılabilir (gelecek)
- Brand/logo trademark'i ayrı

## Güvenlik

- BYOK → env veya admin UI üzerinden, Postgres'te encrypted at rest
- MCP plugin'leri Docker container'da izole, kullanıcı onayı zorunlu
- Rate limit her endpoint'te (Redis-backed)
- CORS whitelist env'den
- AGPL clause: telemetri opt-in, default off
