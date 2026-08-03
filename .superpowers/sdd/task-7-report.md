# Task 7 Report: OAuth 2.1 provider for ChatGPT MCP

## Status

DONE

## What was implemented

### Better Auth OAuth provider (`apps/api/src/auth/index.ts`)
- Added `jwt()` and `oauthProvider()` plugins
- `loginPage` / `consentPage` → `${WEB_ORIGIN}/sign-in` and `/consent` (Task 9 pages)
- Dynamic + unauthenticated client registration enabled for ChatGPT DCR
- `validAudiences: [\`${API_PUBLIC_URL}/mcp\`]` — MCP resource allowed as JWT `aud`
- `silenceWarnings.oauthAuthServerConfig` after explicit well-known routes added

### OAuth schema (`apps/api/src/db/schema.ts`)
- Generated via `pnpm dlx auth@latest generate --config ./src/auth/index.ts --yes`
- Merged tables: `jwks`, `oauth_client`, `oauth_refresh_token`, `oauth_access_token`, `oauth_consent`
- `pnpm db:push` applied successfully

### MCP auth helpers (`apps/api/src/mcp/auth.ts`)
- **`MCP_RESOURCE`** = `${API_PUBLIC_URL}/mcp` — audience/resource identifier (used in token verify + metadata)
- **`AUTH_ISSUER`** = `${BETTER_AUTH_URL}/api/auth` — Better Auth default basePath issuer
- **`getProtectedResourceMetadata()`** — builds RFC 9728 metadata via `oauthProviderResourceClient`
- **`verifyMcpAccessToken(req)`** — JWT verify with `issuer: AUTH_ISSUER` + `audience: MCP_RESOURCE`; Bearer-only; maps JWT `sub` → `userId`; returns `null` on failure

### App routes (`apps/api/src/app.ts`)
- `GET /.well-known/oauth-protected-resource`
- `GET /.well-known/oauth-protected-resource/mcp` (RFC 9728 path-aware PRM for `/mcp`)
- `GET /.well-known/oauth-authorization-server` (+ `/api/auth` suffix variant)
- `GET /.well-known/openid-configuration` (+ `/api/auth` suffix variant)
- Removed incorrect `GET /mcp/.well-known/oauth-protected-resource`

### Build fix (`apps/api/tsconfig.json`)
- Disabled `declaration` emit — oauth-provider pulls zod v4 types that break portable `.d.ts` generation

## Audience / resource choice

**`${API_PUBLIC_URL}/mcp`** — matches planned Task 8 mount at `/mcp`. Clients must request this resource at token time; `verifyMcpAccessToken` validates `aud` against the same value.

Authorization server in protected-resource metadata: **`${BETTER_AUTH_URL}/api/auth`** (issuer from Better Auth metadata, not bare `BETTER_AUTH_URL`).

## Test summary

| Test | Result |
|------|--------|
| `pnpm --filter @running-club/api test` | 20/20 passed |
| `pnpm build` | exit 0 |
| `pnpm db:push` | changes applied |

Tests in `apps/api/src/mcp/auth.test.ts`:
- Protected resource metadata at root + RFC 9728 `/.well-known/oauth-protected-resource/mcp`
- Asserts incorrect `/mcp/.well-known/...` is not 200
- Authorization server metadata issuer + authorize endpoint
- `verifyMcpAccessToken` null without bearer / non-Bearer scheme
- Crafted JWT + stubbed JWKS: rejects wrong `aud`, wrong `iss`; accepts matching issuer+audience

## Review fixes (P1 / P2 / P3)

### P1 — `validAudiences`
`oauthProvider({ validAudiences: [\`${API_PUBLIC_URL}/mcp\`] })` so token issuance accepts the MCP resource as `aud` (BA docs: Valid Audiences). Confirmed option on `@better-auth/oauth-provider@1.6.25` types.

### P1 — issuer in verify
`verifyMcpAccessToken` now passes `verifyOptions: { issuer: AUTH_ISSUER, audience: MCP_RESOURCE }` (`AUTH_ISSUER` = `${BETTER_AUTH_URL}/api/auth`).

### P1 — RFC 9728 PRM path
Expose `GET /.well-known/oauth-protected-resource/mcp`; removed `/mcp/.well-known/oauth-protected-resource`.

### P2 — issuer/audience misconfig test
Added crafted-JWT tests with mocked JWKS (`jose` devDep). **Limitation:** does not exercise full BA OAuth authorize/token/DCR flow — only local JWT verify against stubbed JWKS.

### P3 — Bearer scheme
`extractBearerToken` accepts only `Bearer <token>` (RFC 6750); rejects `Basic` and bare tokens.

### Manual curl evidence (API on :8787)

```
curl http://localhost:8787/.well-known/oauth-protected-resource
→ 200 {"resource":"http://localhost:8787/mcp","authorization_servers":["http://localhost:8787/api/auth"]}

curl http://localhost:8787/.well-known/oauth-protected-resource/mcp
→ 200 {"resource":"http://localhost:8787/mcp","authorization_servers":["http://localhost:8787/api/auth"]}

curl http://localhost:8787/mcp/.well-known/oauth-protected-resource
→ 404
```

## MCP Inspector smoke test (manual)

Prerequisites: API on `8787`, Postgres up, `.env` loaded.

1. Start API: `pnpm --filter @running-club/api dev`
2. Verify metadata:
   - `curl http://localhost:8787/.well-known/oauth-protected-resource`
   - `curl http://localhost:8787/.well-known/oauth-protected-resource/mcp`
   - `curl http://localhost:8787/.well-known/oauth-authorization-server/api/auth`
3. Run [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector):
   ```bash
   npx @modelcontextprotocol/inspector
   ```
4. Connect with OAuth:
   - **Server URL**: `http://localhost:8787/mcp` (Task 8 mount; metadata already live)
   - Inspector discovers protected-resource metadata → authorization server at `http://localhost:8787/api/auth`
5. Start OAuth flow → should redirect to `http://localhost:5173/sign-in?...` (404 until Task 9)
6. After Task 9 sign-in/consent: complete flow → copy access token → verify:
   ```bash
   curl -H "Authorization: Bearer <token>" http://localhost:8787/mcp
   ```
   (401 without token; Task 8 wires `verifyMcpAccessToken` on `/mcp`)

**CORS note:** If Inspector hits metadata from browser and gets CORS errors, add `Access-Control-Allow-Origin: *` on well-known GET routes for local testing (per Better Auth docs).

## Commit

```
1cde6b4 feat(api): add Better Auth OAuth provider for MCP clients
fix(api): correct MCP OAuth audience, issuer, and PRM paths
```

## Files changed

| Path | Action |
|------|--------|
| `apps/api/src/auth/index.ts` | Modified — jwt + oauthProvider |
| `apps/api/src/mcp/auth.ts` | Created |
| `apps/api/src/mcp/auth.test.ts` | Created |
| `apps/api/src/app.ts` | Modified — well-known routes |
| `apps/api/src/db/schema.ts` | Modified — OAuth + jwks tables |
| `apps/api/tsconfig.json` | Modified — disable declaration emit |

## Concerns

1. **Full OAuth E2E blocked until Task 9** — authorize redirects to web sign-in/consent pages not yet built; metadata + registration endpoints are ready.
2. **Issuer vs BETTER_AUTH_URL** — env `BETTER_AUTH_URL` is API origin; OAuth issuer is `${BETTER_AUTH_URL}/api/auth`. Document for MCP client config.
3. **Opaque token introspection** — `verifyMcpAccessToken` uses JWT local verify only (recommended by BA). Opaque tokens rejected unless extended with `remoteVerify` + confidential API client.
4. **No MCP tools yet** — Task 8 mounts `/mcp` and consumes `verifyMcpAccessToken`.
