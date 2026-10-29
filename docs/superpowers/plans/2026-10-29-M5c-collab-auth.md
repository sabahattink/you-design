# M5c Collab Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Joining a multiplayer room requires an HMAC-signed, expiring, role-scoped capability token. Owners create edit / view links and can revoke all of them.

**Architecture:** `@you-design/shared` owns the token format (browser-safe schemas + Node-only sign/verify). `apps/api` issues and revokes; `apps/collab` verifies on join and on every message; `apps/web` resolves tokens (share link → `sessionStorage`, owner → minted in memory) and passes them to `HocuspocusProvider`.

**Tech Stack:** `node:crypto` (HMAC-SHA256, `timingSafeEqual`), Zod, Fastify, Hocuspocus v2 hooks (`onAuthenticate`, `beforeHandleMessage`, `connection.readOnly`), Drizzle.

Spec: [`docs/superpowers/specs/2026-10-29-M5c-collab-auth-design.md`](../specs/2026-10-29-M5c-collab-auth-design.md)

---

## Task 1: Token format (`packages/shared`) — TDD

**Files:** `src/collab.ts`, `src/collab-token.ts`, `src/collab-token.test.ts`, `src/index.ts`, `package.json`

- [x] Tests first: round-trip, wrong secret, tampered payload / signature, claim swap, expiry boundary (`now >= exp`), wrong project, malformed shapes (prefix, part count, charset, whitespace, length cap), short signature, validly signed but invalid claims, unverified decode, TTL defaults.
- [x] `collab.ts` (exported from the index): `CollabRole`, `ShareRole`, `CollabTokenClaims` (strict), `IssueCollabTokenBody`, `CollabTokenResponse`, TTL bounds, `splitCollabToken`, `decodeCollabTokenClaims` (unverified, UI only).
- [x] `collab-token.ts` (subpath `@you-design/shared/collab-token`, Node-only): `signCollabToken`, `verifyCollabToken`.
- [x] `@types/node` devDependency for `node:crypto` typings.

```bash
pnpm --filter @you-design/shared exec vitest run src/collab-token.test.ts
```

## Task 2: Revocation column (`packages/db`)

- [x] `projects.collab_token_version integer NOT NULL DEFAULT 0`.
- [x] Migration `0004_collab_token_version.sql` generated offline. `drizzle-kit generate` cannot resolve the schema's `.js` imports by itself; run it with tsx's CJS resolver:

```bash
cd packages/db
NODE_OPTIONS="--require <repo>/apps/api/node_modules/tsx/dist/cjs/index.cjs" \
  pnpm exec drizzle-kit generate --name <name>
```

Because the previous snapshot was `0000`, the generator re-emitted the (identical) tables from hand-written `0001`–`0003`; those statements were trimmed. `0004_snapshot.json` restores the snapshot chain, so the next `generate` diffs cleanly. **Not applied to any database** — run `pnpm db:migrate` yourself.

## Task 3: Issue + revoke (`apps/api`) — TDD

- [x] Tests first (`routes/collab-tokens.test.ts`, `fastify.inject` + in-memory store): role defaults, explicit TTL, invalid bodies, non-UUID id, 404, revoke bumps version and returns an owner token, `Cache-Control: no-store`.
- [x] `routes/collab-tokens.ts` plugin taking `{ secret, store, now? }`; `lib/collab-token-store.ts` (Drizzle; atomic `UPDATE … RETURNING` for the bump).
- [x] `COLLAB_TOKEN_SECRET` (≥ 32) in `config.ts`; register the plugin in `server.ts`.

## Task 4: Enforcement (`apps/collab`) — TDD

- [x] Tests first (`auth.test.ts`, `config.test.ts`): owner/edit read-write, view read-only, each rejection reason, no DB hit for unverifiable tokens, token never logged; message guard (expiry, revocation, missing context); version cache TTL; env schema.
- [x] `auth.ts` (DB-free): `createAuthenticator`, `createMessageGuard`, `cacheVersionLookup`, `CollabAccessError` (`reason` + close `code`).
- [x] `token-versions.ts` (Drizzle lookup), `config.ts` (Zod env), `server.ts` wiring, `.env.example`.

## Task 5: Web

- [x] `lib/collab/tokens.ts` — vault (share tokens in `sessionStorage`, owner tokens in memory, 60 s refresh margin, no owner fallback for share-joined projects) + tests.
- [x] `lib/collab/share-link.ts` — build / parse / consume (fragment stripped) + tests.
- [x] `lib/projects/api.ts` — `issueCollabToken`, `revokeCollabTokens` (Zod-validated responses).
- [x] Provider `token` callback; `authenticated` → `collabAccess`; `authenticationFailed` → `collabStatus = 'denied'`.
- [x] `bindPagesSync(…, { readOnly })` for view links + tests.
- [x] Store: `collabAccess`, `openSharedProject` (keeps BYOK models / analytics) + test.
- [x] `WorkspaceLayout` consumes the share link before the shell's sync hooks mount.
- [x] `ShareDialog` rewrite (role, expiry, create, copy, revoke all, guest notice; `useModalDialog`) + tests. `LiveStatusPill` "Access denied" / "View only".

## Task 6: Docs + config

- [x] Root `.env.example`, ARCHITECTURE (Multiplayer → Access control), CHANGELOG, README.

## Verification

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Manual (needs Postgres + `COLLAB_TOKEN_SECRET` in `.env`, `pnpm db:migrate`): create a project → Share → view link → open in a private window → edits there do not sync, pill says "View only" → Revoke all links → private window shows "Access denied" within ~10 s.

---

## Notes found while implementing

- `0001`–`0003` journal `when` values (2025-05) are older than `0000` (2026-05). Drizzle's migrator only applies entries newer than the latest applied one, so a database that ran **only** `0000` would skip `0001`–`0003`. Fresh databases are unaffected (all run in one pass). `0004` has a current timestamp and applies everywhere. Worth a follow-up fix.
- Opening a project whose `intentPhase` is `building` with no build messages auto-triggers "Generate the homepage now." (`ChatPanel`). For an edit-link guest on the owner's machine this can rewrite the shared page. Pre-existing; out of scope here.

## Next steps (M5d)

1. **REST API authentication** — owner identity (session or API key). Then gate `collab-tokens` and `revoke` on it; today they are as open as every other REST route.
2. Per-link revocation: token ID (`jti`) + deny list, and a "links issued" list in the Share dialog.
3. Client-side read-only lock for viewers (disable chat build, edit panel, code panel).
4. Secret rotation via key IDs instead of invalidating all tokens.
5. Show role in presence (viewer badge on remote cursors).
