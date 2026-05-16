# Docker

## Production self-host

```bash
cp .env.example .env
# edit .env
docker compose up -d
```

Services:
- `web` — Next.js standalone, port 3000
- `api` — Fastify, port 3001
- `worker` — BullMQ worker (export queue + llm queue)
- `postgres` — pgvector/pg16, port 5432
- `redis` — redis 7-alpine, port 6379

## Development (only DB + Redis, dev hot reload outside Docker)

```bash
docker compose -f compose.dev.yml up -d
pnpm dev  # apps run on host
```

## Build images locally

```bash
docker compose build
```

Images are tagged `ghcr.io/sabahattink/you-design-{web,api}:latest`.

Published from main branch via `.github/workflows/docker.yml`.
