# Contributing to You Design

Şu an **pre-alpha** — M0 scaffolding aşaması. M1'den itibaren PR'lar resmi olarak açılacak.

Yine de erken feedback ve issue'lar için teşekkürler.

## Branş & Commit

- Branş: `feat/short-description`, `fix/short-description`, `docs/...`
- Commit: [Conventional Commits](https://www.conventionalcommits.org/)
  - `feat: add intent quiz step`
  - `fix(api): health endpoint returns 200 on cold start`
  - `docs: clarify M2 critic agent scope`
  - `chore(deps): bump turbo 2.3.4`

## PR Süreci

1. Issue aç (varsa onu fix'le)
2. Feature branch
3. Local: `pnpm typecheck && pnpm test && pnpm format:check`
4. Commit (Conventional Commits)
5. PR aç — şablonu doldur
6. CI yeşil olmalı
7. Code review — en az 1 onay

## Code Style

- Prettier (ayarlar `package.json`'da)
- TypeScript strict mode
- Functional > class (zorunlu değil ama tercih)
- Test her yeni feature için (Vitest)

## Yerel Geliştirme

```bash
pnpm install
docker compose -f compose.dev.yml up -d postgres redis
pnpm dev
```

## Code of Conduct

[Contributor Covenant 2.1](CODE_OF_CONDUCT.md) geçerli.

## Lisans

Katkı yaparken AGPL-3.0-or-later'a tabi olduğunu kabul etmiş olursun.
