# Dokploy + Railpack deploy config

**Date:** 2026-08-04  
**Status:** Approved (option A)

## Goal

Make this pnpm monorepo easy to deploy on Dokploy with Railpack as two apps (API + web), with minimal per-app overrides.

## Approach

- Root `package.json` scripts: `build:api`, `start:api`, `build:web`
- `railpack.api.json` and `railpack.web.json` at repo root
- Dokploy sets `RAILPACK_CONFIG_FILE` per app (plus runtime/build env and domains)
- Short README deploy section

## Out of scope

Dockerfiles, auto `db:push` on boot, CI-built images.

## Dokploy mapping

| App | Config file | Port |
|-----|-------------|------|
| API | `railpack.api.json` | 8787 |
| Web | `railpack.web.json` | 80 (static SPA via `serve`) |
