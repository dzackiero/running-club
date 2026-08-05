# Private clubs, leaderboards, and miss emails

**Date:** 2026-08-05  
**Status:** Approved  
**Product:** CUP Run

## Problem

CUP Run is a personal log. Friends who train together have no shared board or nudge when someone misses a club target. Clubs and Resend mail were explicit v1 non-goals.

## Goals

1. Private invite-only clubs (many per user).
2. In-club weekly and monthly km leaderboards.
3. Same per-member distance target for the club week and/or month (not a shared pool, not personal Goal-page targets).
4. After a period ends, email members who missed the club target (Resend).
5. Share period totals only — not runs, routes, or streams.

## Non-goals

- Public clubs / discovery
- Geo / city leaderboards
- Shared-pool group mileage
- Mid-week reminder emails
- Chat, feed, kudos
- Owner transfer
- MCP club tools
- User timezone column

## Decisions

| Choice | Decision |
|---|---|
| Membership | Invite code; creator is owner |
| Ranking | Distance desc; show run count |
| Goals | Club `weeklyTargetDistanceMeters` / `monthlyTargetDistanceMeters`; same bar for every member |
| Week window | UTC + club `weekStartsOn` (independent of Settings) |
| Month window | Calendar month UTC |
| Mail | After previous week/month ends; once per member per period |
| Labels | `user.name` only (no emails, no avatars) |

## Data model

- `club` — `id`, `name`, `inviteCode` (unique), `ownerUserId`, `weekStartsOn`, `weeklyTargetDistanceMeters`, `monthlyTargetDistanceMeters`, timestamps
- `club_member` — `clubId`, `userId`, `role` (`owner` \| `member`), `emailNudges`, `joinedAt`; unique `(clubId, userId)`
- `club_nudge` — `clubId`, `userId`, `period` (`week` \| `month`), `periodStart`, `sentAt`; unique `(clubId, userId, period, periodStart)`

Personal `weekly_goal` is unchanged.

## API

Session auth:

- `GET/POST /clubs`
- `POST /clubs/join` `{ inviteCode }`
- `GET /clubs/:id` — summary + current week/month boards (invite code only for owner)
- `PATCH /clubs/:id` — owner: name, week start, targets, `rotateInviteCode`
- `DELETE /clubs/:id` — owner
- `POST /clubs/:id/leave` — members only (owner deletes the club)
- `PATCH /clubs/:id/me` `{ emailNudges }`
- `DELETE /clubs/:id/members/:userId` — owner kick (not self)

## Web

- Nav: **Clubs**
- `/clubs` — list, create, join by code
- `/clubs/:id` — boards, targets, progress, nudge toggle, owner invite + settings

Thin list UI per DESIGN.md. No social chrome.

## Resend

- `RESEND_API_KEY`, `EMAIL_FROM`, link base `WEB_ORIGIN`
- Hourly in-process poller (same pattern as Intervals)
- Skip if key unset; idempotent via `club_nudge`
- Copy: club name, km vs target, period dates, link to the club page

## Testing

- Shared Zod schemas
- Club service: join, unique membership, boards, permissions
- Nudge job: miss detection + idempotency (mock Resend)
- HTTP create / join / board / owner patch
