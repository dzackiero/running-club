# Club UI: list chrome, Home-style board, period history

**Date:** 2026-08-05  
**Status:** Approved (conversation) — pending user review of this file  
**Product:** CUP Run  
**Supersedes UI notes in:** `2026-08-05-clubs-leaderboards-nudges-design.md` (data model, membership, nudges unchanged)

## Problem

Club list and club detail stack every action on one page. Tabs helped on detail, but the list does not need tabs, invite should not be its own tab, members should not see owner chrome, and the board does not show the club target the way Home shows a personal week goal. Past weeks and months are not available.

## Goals

1. Clubs list is only the list. Create and join live in a header menu + dialogs.
2. Invite lives in Settings. Owners see Board | Settings. Members see no tabs; a header Settings link opens their settings.
3. Board feels like Home: big personal km vs club target, progress bar, then ranked list.
4. History via Home-style prev/next arrows (not tabs). Week and month are a period-type switch, then arrows move within that type.

## Non-goals

- Podium / race chrome, avatars, kudos
- Changing club targets, invite rules, or nudge behavior
- Timezone-aware club weeks (still UTC + `weekStartsOn`)
- Infinite history caps beyond “don’t go into the future”; no hard oldest-week limit in v1
- Changing the Clubs index tabs on other pages (Connect stays as-is)

## Clubs list (`/clubs`)

- Header: title **Clubs**, subtitle unchanged, **+** button top-right.
- **+** menu: **Create club** / **Join with code**.
- Each item opens a small dialog with only that form.
  - Create: name → Create club → toast → `/clubs/:id`
  - Join: invite code → Join club → toast → `/clubs/:id`
- Body: club list (name + member count) or empty copy: “You’re not in a club yet.”
- No Yours / Create / Join tabs. No create/join forms on the page itself.

## Club detail chrome (`/clubs/:id`)

- Breadcrumb **Clubs**, club name, member count.
- **Owner:** Connect-style segments **Board | Settings**. Default Board.
- **Member:** no segments. Header control **Settings** (text link or gear) swaps the page to member settings (same route, local view state — not a new URL required).
- Invite tab is removed. Invite code (copy + rotate) is the first block on owner Settings.

### Owner Settings order

1. Invite code (copy, rotate)
2. Miss emails toggle
3. Club form: name, week starts, weekly km target, monthly km target, save
4. Members list (others only) with Remove
5. Delete club

### Member Settings

1. Miss emails toggle
2. Leave club

Back from member Settings: the Settings control becomes a way back to the board (label **Board** or closing the settings view). Owners use the Board tab.

## Board

Period type (not history): compact **Week | Month** segmented control.

History chrome: same pattern as Home `WeekSnapshot`.

- Center: year (if useful), **This week** / **Last week** / or just the range; month: **This month** / **Last month** / `August 2026`.
- Left/right icon buttons. Next disabled at offset `0` (current period). Prev unbounded in v1.
- Switching Week ↔ Month resets offset to `0` (current).

Hero (you):

- Big athletic km (`stat-hero`) for the signed-in member’s distance this period.
- If club target set: “of X km · N%” and a progress bar (same target for everyone).
- If no target and offset is current: “No club target set.” Owner gets a control that switches to Settings. Members see the line only.
- If you have 0 km, still show `0 km` and your row on the list.

Ranked list under the hero:

- Rank, name, “(you)”, km, run count.
- Per-row bar vs the same club target when set; omit bars when no target.
- Thin dividers, no cards.

Past offsets use the same hero + list for that period’s totals. Target shown is the club’s **current** target (we do not snapshot historical targets).

## API

Existing `GET /clubs/:id` still returns summary + **current** week and month boards (used for settings and initial paint).

New:

```
GET /clubs/:id/board?period=week|month&offset=0
```

- `period` required: `week` | `month`
- `offset` integer, default `0`. `0` = current period, `-1` = previous, etc. Positive offsets rejected (`400`).
- Auth: club member only.
- Response: `{ period, offset, start, end, targetDistanceMeters, board: ClubLeaderboardEntry[] }`
- Week bounds: club `weekStartsOn`, UTC, via existing `getWeekBounds` shifted by `offset` weeks.
- Month bounds: calendar month UTC shifted by `offset` months.
- Target: current club weekly or monthly target (not historical snapshot).

Web: arrows call this endpoint; do not refetch full club summary on every arrow click.

## Testing

- Board service/route: current week/month, `offset=-1` totals, reject `offset>0`, non-member `403`.
- Web: no list-page tabs; + menu dialogs; owner tabs vs member Settings link; invite only on owner settings.

## Out of scope follow-ups

- Deep-link `?period=&offset=` on the club URL
- Snapshotting targets per period
- Oldest-period stop based on club `createdAt`
