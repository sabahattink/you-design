# Contributing to You Design

Currently **pre-alpha** — M0 scaffolding stage. PRs will be officially welcomed starting M1.

Early feedback and issues are appreciated.

## Branches & Commits

- Branch: `feat/short-description`, `fix/short-description`, `docs/...`
- Commits: [Conventional Commits](https://www.conventionalcommits.org/)
  - `feat: add intent quiz step`
  - `fix(api): health endpoint returns 200 on cold start`
  - `docs: clarify M2 critic agent scope`
  - `chore(deps): bump turbo 2.3.4`

## PR Process

1. Open an issue first (or pick an existing one)
2. Feature branch off `main`
3. Local checks: `pnpm typecheck && pnpm test && pnpm format:check`
4. Commit (Conventional Commits)
5. Open PR — fill out the template
6. CI must pass
7. Code review — at least 1 approval

## Code Style

- Prettier (config in `package.json`)
- TypeScript strict mode
- Functional over class (not required, preferred)
- Tests for every new feature (Vitest)

## Local Development

```bash
pnpm install
docker compose -f compose.dev.yml up -d postgres redis
pnpm dev
```

## Code of Conduct

[Contributor Covenant 2.1](CODE_OF_CONDUCT.md) applies.

## License

By contributing you agree your work is licensed under AGPL-3.0-or-later.
