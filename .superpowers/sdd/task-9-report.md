# Task 9 Report: Vite web app (auth, history, goal, connect, consent)

## Status

DONE

## What was implemented

### Scaffold (`apps/web`)
- Vite React TS app as `@running-club/web`
- `VITE_API_URL=http://localhost:8787` in `.env` / `.env.example`
- Deps: `better-auth`, `@better-auth/oauth-provider`, `react-router-dom`

### Auth (`src/lib/auth-client.ts`)
- `createAuthClient` from `better-auth/react` with `oauthProviderClient()` plugin
- Cookie sessions via `credentials: "include"` on REST helpers

### REST helpers (`src/lib/api.ts`)
- `listRuns`, `getWeekProgress`, `getCurrentGoal`, `putCurrentGoal`, `createRun`

### Pages
| Route | Component | Notes |
|-------|-----------|-------|
| `/sign-in` | `SignIn` | Email sign-in; `returnTo` query for OAuth resume |
| `/sign-up` | `SignUp` | Email sign-up |
| `/consent` | `Consent` | Loads `oauth2.publicClient`; approve/deny via `oauth2.consent` |
| `/` | `Home` | Week snapshot + recent runs list |
| `/goal` | `Goal` | km ↔ meters, minutes ↔ seconds, run count, week starts on |
| `/connect` | `Connect` | MCP URL + ChatGPT OAuth setup steps (no PAT) |

### Layout
- Thin CSS (no card dashboard)
- `Layout` nav + `RequireAuth` guard for protected routes

## Verification

| Check | Result |
|-------|--------|
| `pnpm --filter @running-club/web build` | Pass |
| Web dev server `http://localhost:5173` | 200, title "Running Club" |
| Sign up → PUT goal → POST run → GET runs/week (curl + cookies) | Pass |
| Unauthenticated `/oauth2/authorize` | 302 → `http://localhost:5173/sign-in?...` |
| Authenticated `/oauth2/authorize` | 302 → `http://localhost:5173/consent?...` |
| OAuth DCR `/api/auth/oauth2/register` | Returns `client_id` |
| MCP Inspector full OAuth E2E | **Not run** — requires browser UI; API redirects confirmed |

### Manual E2E (API + redirects)
1. Created user via `POST /api/auth/sign-up/email` with `Origin: http://localhost:5173`
2. Set goal: `PUT /goals/current` → 30 km / 4 runs
3. Logged run: `POST /runs` → 5 km
4. Home data: `GET /runs?limit=5` (1 run), `GET /insights/week` (16.7% distance, 25% runs)
5. OAuth: DCR client → authorize unauthenticated → `/sign-in`; with session → `/consent`

## Commit

```
feat(web): add auth, history, goal, and ChatGPT connect pages
```

Includes `apps/web/**` and `pnpm-lock.yaml`.

## Concerns / follow-ups

1. **Browser consent flow** — `oauth2.consent` requires `oauth_query` from signed URL params; `oauthProviderClient` injects this automatically in browser. Not verified end-to-end with MCP Inspector.
2. **No in-app run logging** — v1 home is read-only; runs via API/MCP only (per thin UI spec).
3. **`VITE_API_URL` in root `.env.example`** — deferred to Task 10 README polish.

## P1 fix: OAuth resume through SignIn / SignUp

### Problem
After ChatGPT `/oauth2/authorize` redirects to `loginPage` with signed query params, SignIn always `navigate(returnTo || "/")`, racing Better Auth’s `redirectPlugin` (`window.location` → consent). SignUp ↔ SignIn links dropped `location.search`, so first-time signup lost the signed OAuth query; SignUp always navigated home after `signUp.email`.

### Fix
- `shouldDeferToOAuthContinue(data, search)` — skip SPA navigate when response has `redirect: true` or URL has `sig` (signed OAuth query).
- SignIn / SignUp: after email auth success, defer to `oauthProviderClient` + redirect plugin when OAuth continue applies.
- SignIn ↔ SignUp links preserve `location.search` so ChatGPT signed params survive account creation.

### Verification
- `pnpm --filter @running-club/web build` — pass

### Commit
```
fix(web): preserve OAuth query through sign-in and sign-up
```
