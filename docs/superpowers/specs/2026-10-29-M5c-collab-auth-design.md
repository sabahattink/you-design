# M5c — Collab Auth (Signed Share Links) Design

**Goal:** Knowing a project ID is no longer enough to join its multiplayer room. Every WebSocket join to `apps/collab` must present an HMAC-signed, expiring capability token scoped to one project and one role. The owner can hand out **edit** or **view** links and revoke all of them at once.

**Scope:** Capability tokens (issue + verify), collab enforcement (join, read-only, expiry and revocation on live sockets), per-project revocation via a DB version counter, share-link UX in the web app. **Not** in scope: user accounts, REST API authentication (see §9).

---

## 1. Threat Model (alpha)

| Surface                   | Exposure                                             | M5c stance                                                                                                                                                                                                                             |
| ------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/collab` (WS, :3002) | **Shared with collaborators** — the reason it exists | Requires a valid token per document. This is what M5c secures.                                                                                                                                                                         |
| `apps/api` (REST, :3001)  | Owner-only (the web client calls `localhost:3001`)   | **Trusted, unauthenticated** — unchanged. Every REST route (project CRUD, exports, LLM proxy) is already open to anyone who can reach it, so the token-issuing endpoint is too. Keep the API off untrusted networks; REST auth is M5d. |
| Share link                | Pasted into chat, email, screenshots                 | Token travels in the URL **fragment** (`#share=…`) — never sent to servers, so it stays out of access logs and `Referer`.                                                                                                              |
| Project ID                | Appears in URLs, logs, IndexedDB names               | No longer a secret; worthless without a token.                                                                                                                                                                                         |

Consequence: an attacker who only has a project ID, an expired link, or a revoked link cannot read or write the Y.Doc. An attacker with REST API access can still do anything — exactly as before M5c.

---

## 2. Token Format

```
yd1.<payload>.<signature>
payload   = base64url(JSON { v: 1, pid, role, iat, exp, ver })
signature = base64url(HMAC-SHA256(COLLAB_TOKEN_SECRET, "yd1." + payload))
```

| Claim  | Type                        | Meaning                                                        |
| ------ | --------------------------- | -------------------------------------------------------------- |
| `v`    | `1`                         | Format version.                                                |
| `pid`  | UUID                        | Project ID; must equal the Hocuspocus `documentName`.          |
| `role` | `owner` \| `edit` \| `view` | `view` ⇒ `connection.readOnly = true`. `owner` ≡ `edit` today. |
| `iat`  | unix seconds                | Issued at.                                                     |
| `exp`  | unix seconds                | Expiry; `now >= exp` is rejected.                              |
| `ver`  | int ≥ 0                     | `projects.collab_token_version` at issue time.                 |

Why not JWT: one algorithm, no `alg` header to confuse, no dependency, ~60 lines. The `yd1.` prefix is part of the signed input (domain separation) and lets the format evolve.

**Verification order:** length cap (1 KiB) → shape regex → HMAC recompute → `crypto.timingSafeEqual` on equal-length buffers → JSON parse → Zod (`strict`) → `exp` → `pid` match. Collab then checks `ver` against the DB.

**Secret:** `COLLAB_TOKEN_SECRET`, ≥ 32 chars, required by both `apps/api` and `apps/collab`, validated by Zod at startup (process exits with a clear message otherwise). Generate with `openssl rand -base64 48`.

**TTL bounds:** 5 min ≤ ttl ≤ 30 days. Defaults: owner 12 h, share links 7 days.

**Code location:** browser-safe schemas + unverified decode in `@you-design/shared` (`collab.ts`); Node-only sign/verify in the `@you-design/shared/collab-token` subpath so `node:crypto` never reaches the web bundle.

---

## 3. Revocation

`projects.collab_token_version integer NOT NULL DEFAULT 0` (migration `0004`). Every token carries the version it was minted under. **Revoke all links** = `version + 1` → every outstanding token (owner tokens included) stops verifying. The revoke response carries a fresh owner token so the owner's own tab reconnects transparently.

Live sockets: collab's `beforeHandleMessage` re-checks `exp` on every message and `ver` through a 10-second in-memory cache, closing the document connection (`4401 token-expired` / `4403 token-revoked`). Revocation therefore takes effect within ~10 s for connected clients and immediately for new joins.

---

## 4. API (`apps/api`)

| Route                                            | Body                    | Response                                  |
| ------------------------------------------------ | ----------------------- | ----------------------------------------- |
| `POST /api/v1/projects/:id/collab-tokens`        | `{ role, ttlSeconds? }` | `201 { token, role, expiresAt }`          |
| `POST /api/v1/projects/:id/collab-tokens/revoke` | —                       | `200 { token, role: 'owner', expiresAt }` |

`400 INVALID_PROJECT_ID` (non-UUID), `400 INVALID_BODY` (Zod), `404 NOT_FOUND`. Responses carry `Cache-Control: no-store`. Tokens are never logged (Fastify logs method/URL/status only; tokens live in bodies). The route plugin takes `{ secret, store }` so it is tested with `fastify.inject` and an in-memory store.

---

## 5. Collab (`apps/collab`)

- `config.ts` — Zod env (`COLLAB_PORT`, `DATABASE_URL`, `LOG_LEVEL`, `NODE_ENV`, `COLLAB_TOKEN_SECRET`).
- `auth.ts` (DB-free, unit-tested):
  - `createAuthenticator({ secret, lookupVersion })` → Hocuspocus `onAuthenticate`. Rejections throw an error whose `reason` Hocuspocus forwards to the client: `invalid-token` (malformed / bad signature / wrong project — not distinguished to the client), `token-expired`, `token-revoked`, `project-not-found`. The precise internal reason is logged with `documentName` + `socketId`, **never the token**.
  - `createMessageGuard({ lookupVersion })` → `beforeHandleMessage` (expiry + revocation on live sockets).
  - `cacheVersionLookup(lookup, ttlMs)`.
- `token-versions.ts` — Drizzle lookup of `collab_token_version`.

---

## 6. Web (`apps/web`)

| Piece                      | Behaviour                                                                                                                                                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/collab/tokens.ts`     | Token vault. **Share** tokens (from links) live in `sessionStorage`; **owner** tokens live in memory and are minted from the API on demand (refreshed when < 60 s remain). A project joined via a share link never auto-mints an owner token. |
| `lib/collab/share-link.ts` | `buildShareUrl` → `/app?project=<id>#share=<token>`; `consumeShareLink` stores the token, strips the fragment with `history.replaceState`, returns the project ID.                                                                            |
| `HocuspocusProvider`       | `token: () => vault.resolve(projectId)` — re-evaluated on every reconnect.                                                                                                                                                                    |
| Status                     | `authenticationFailed` → `collabStatus = 'denied'`; `authorizedScope === 'readonly'` → `collabAccess = 'readonly'`. `LiveStatusPill` shows "Access denied" / "View only".                                                                     |
| View-only client           | `bindPagesSync(…, { readOnly: true })` stops pushing local store changes into the Y.Doc (the server would reject them anyway).                                                                                                                |
| `WorkspaceLayout`          | Consumes a share link once on mount (before the project-sync hooks run) and opens the shared project with `openSharedProject`, which keeps BYOK models + analytics config.                                                                    |
| `ShareDialog`              | Role (edit / view) + expiry (1 / 7 / 30 days) → **Create link** → copy. **Revoke all links**. Accessible via `useModalDialog`. Guests see who can share instead of a form.                                                                    |

---

## 7. Config

`.env.example`, `apps/collab/.env.example`: `COLLAB_TOKEN_SECRET=` (empty on purpose — services refuse to start until it is set). Docker compose already passes `.env` to `api` and `collab` via `env_file`.

---

## 8. Tests

| Package | Tests                                                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| shared  | sign → verify round-trip; tampered payload / signature; wrong secret; expiry boundary; wrong project; malformed shapes; TTL bounds; unverified decode. |
| api     | issue (owner / edit / view, default + custom TTL), 400s, 404, revoke bumps version and invalidates old tokens, `no-store`.                             |
| collab  | env schema; authenticate (ok, view ⇒ readOnly, each rejection reason, token never logged); message guard (expiry, revocation, cache TTL).              |
| web     | vault resolve paths; share-link build / parse / consume; `openSharedProject`; read-only `bindPagesSync`.                                               |

---

## 9. Out of Scope → Next (M5d)

- **REST API authentication** (owner identity / API key / NextAuth). Until then the API must not be exposed to untrusted networks.
- Per-link revocation (needs a token ID + deny list) and a "links issued" list.
- Client-side read-only UI lock for viewers (chat, edit panel, code panel stay interactive locally; nothing syncs).
- Role-aware awareness (show viewers differently).
- Secret rotation without invalidating every token (key IDs).

---

## 10. File Map

| Action | File                                                                                            |
| ------ | ----------------------------------------------------------------------------------------------- |
| Create | `packages/shared/src/collab.ts` (+ test)                                                        |
| Create | `packages/shared/src/collab-token.ts` (+ test)                                                  |
| Modify | `packages/shared/src/index.ts`, `package.json` (subpath)                                        |
| Modify | `packages/db/src/schema/projects.ts`                                                            |
| Create | `packages/db/migrations/0004_*.sql` + snapshot                                                  |
| Modify | `apps/api/src/config.ts`, `server.ts`                                                           |
| Create | `apps/api/src/routes/collab-tokens.ts` (+ test)                                                 |
| Create | `apps/api/src/lib/collab-token-store.ts`                                                        |
| Create | `apps/collab/src/config.ts` (+ test)                                                            |
| Modify | `apps/collab/src/auth.ts` (+ test), `server.ts`, `package.json`                                 |
| Create | `apps/collab/src/token-versions.ts`                                                             |
| Create | `apps/web/src/lib/collab/tokens.ts` (+ test)                                                    |
| Create | `apps/web/src/lib/collab/share-link.ts` (+ test)                                                |
| Modify | `apps/web/src/lib/collab/{provider,y-doc,use-collab-sync,sync-pages,types}.ts`                  |
| Modify | `apps/web/src/lib/workspace/store.ts`, `lib/projects/api.ts`                                    |
| Modify | `apps/web/src/components/workspace/{ShareDialog,LiveStatusPill,WorkspaceLayout}.tsx`            |
| Modify | `.env.example`, `apps/collab/.env.example`, `docs/ARCHITECTURE.md`, `README.md`, `CHANGELOG.md` |
