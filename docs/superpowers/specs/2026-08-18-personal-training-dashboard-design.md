# Personal Training Dashboard Design

**Date:** 2026-08-18  
**Status:** Proposed

## Goal

Reposition CUP Run from a social running-club product into a personal training companion. The primary experience is a Today-first dashboard that combines a recurring plan, a concise weekly overview, imported running activity, gym sessions, and nutrition progress.

The product should answer two questions quickly:

1. What should I do today?
2. How is this week going across running, gym, and nutrition?

## Scope

### Included

- Remove the entire clubs domain, including historical club data.
- Replace the existing home screen with a Today-first dashboard and weekly overview.
- Support recurring personal plans for running, gym, and nutrition.
- Support date-specific plan overrides and planned/done/skipped status.
- Add gym workout logging with exercises and sets.
- Add nutrition targets and confirmed meal logging.
- Extend the MCP server with a reviewable meal-draft workflow, intended for photo plus user-supplied portion context.
- Preserve the Intervals.icu running import and connect imported runs to planned sessions when a match is unambiguous.

### Excluded from the first implementation

- Social, sharing, leaderboards, invitations, club email nudges, and all group concepts.
- Fully automatic food recognition that logs meals without user review.
- A browser-first food-photo uploader.
- Advanced strength-program authoring, exercise-library curation, recovery scores, or coaching recommendations.
- Automatic deletion or modification of a recurring template from a one-off date override.

## Product Experience

### Navigation

Authenticated navigation becomes:

- **Today** (`/`): daily agenda and weekly overview.
- **Plan** (`/plan`): recurring templates, weekly targets, and date overrides.
- **History** (`/history`): running, gym, and confirmed nutrition records.
- **Insights** (`/insights`): aggregate trends; initially preserves existing running insights.
- **Connect** (`/connect`): Intervals and MCP connection instructions.

The existing Goal page is replaced by Plan. Settings, auth, consent, and connection flows remain.

### Today

Today is the primary opening screen. It contains, in order:

1. Date and a compact count of unfinished items.
2. Today’s planned running, gym, and nutrition items, each with `planned`, `done`, or `skipped` state.
3. A **This week** section with running distance/session progress, gym session progress, nutrition-target days, and a seven-day schedule strip.
4. Recent activity/history, where appropriate.

Today is actionable: users can complete or skip a scheduled item without opening Plan. A completed imported run may mark a matching scheduled run done automatically; an unmatched run is retained without changing the plan.

### Plan

Plan configures recurring templates. Each template has a weekday, category (`run`, `gym`, or `nutrition`), title, and category-specific lightweight metadata. Typical templates include an easy run, upper-body workout, and daily protein target.

The user may change a single generated date through an override. An override changes only that occurrence and never rewrites the recurrence. Users can also mark an occurrence done or skipped.

### Gym

Gym is intentionally simple initially. A completed workout has a date, optional plan occurrence, notes, exercises, and ordered sets. Each set records reps and load, with optional RPE. Dashboard progress counts completed workouts; detailed volume and personal-best analysis can grow later.

### Nutrition and MCP

Nutrition is primarily logged through MCP rather than a laborious web food diary. The intended conversation flow is:

1. User provides a food photo and text identifying foods and approximate portions (for example, rice 200 g and chicken 120 g).
2. The MCP client estimates ingredients and macros and creates a **draft** meal.
3. The client displays the draft to the user for corrections.
4. The user explicitly confirms it; only then is it a confirmed meal that counts toward daily targets and weekly adherence.

The web app may show confirmed meals and pending drafts, but it does not need photo upload in the first release. Daily targets start with calories and protein, with carbs and fat optional.

## Data Model

All new records are owned by one user. Timestamps use the current application convention and date-based views use the user’s local day consistently.

### `plan_template`

- `id`, `user_id`
- `weekday` (0–6)
- `category` (`run | gym | nutrition`)
- `title`
- `details` (JSONB category metadata)
- `active`, `created_at`, `updated_at`

`details` keeps v1 flexible: a planned run may carry distance/duration guidance, gym may carry a template name, and nutrition may carry target guidance. Validation is category-specific in shared schemas.

### `plan_occurrence`

- `id`, `user_id`, `template_id` (nullable for an ad-hoc item)
- `date`
- `category`, `title`, `details`
- `status` (`planned | done | skipped`)
- `overridden_at`, `completed_at`
- `linked_run_id` (nullable)
- `linked_gym_workout_id` (nullable)
- `created_at`, `updated_at`

An occurrence is materialized lazily for the visible plan window and whenever it is edited. A unique user/date/template constraint prevents duplicate recurring items. Occurrences preserve the scheduled values at creation, so later template changes do not rewrite past history.

### `gym_workout`, `gym_exercise`, and `gym_set`

- Workout: `id`, `user_id`, `occurred_at`, `plan_occurrence_id`, `notes`.
- Exercise: `id`, `workout_id`, `name`, `position`.
- Set: `id`, `exercise_id`, `position`, `reps`, `load_kg`, optional `rpe`.

This normalized model makes editing and future volume/PR calculations reliable.

### `nutrition_day` and `meal`

- Nutrition day: `id`, `user_id`, `date`, calorie/protein/carbs/fat targets.
- Meal: `id`, `user_id`, `occurred_at`, `status` (`draft | confirmed | discarded`), item details JSONB, macro totals, optional image reference, source (`mcp | manual`), and notes.

Only confirmed meals contribute to daily and weekly totals. A unique user/date row for nutrition days gives a stable home for targets and aggregation.

## API and MCP

REST APIs provide CRUD for plan templates, occurrences, gym workouts, nutrition targets, and confirmed/draft meal views. All queries enforce user ownership through the existing session middleware.

The MCP server adds tools conceptually equivalent to:

- `create_meal_draft`: accepts a meal description, portion context, estimated items/macros, and optional image reference from the MCP client.
- `get_meal_draft`: returns a pending draft for review.
- `confirm_meal_draft`: accepts corrections and converts the draft into a confirmed meal.
- `discard_meal_draft`: explicitly abandons a draft.
- Plan and gym logging tools as needed for the same personal workflow.

MCP does not itself need to perform vision inference. The connected client can interpret the provided photo and send the structured estimate and user context. This keeps the server responsible for validation, persistence, and confirmation semantics.

Intervals imports retain their current behavior. After upserting a run, the import service looks for one planned running occurrence for the same local date with compatible guidance. It links and completes that occurrence only when there is exactly one clear candidate; otherwise it leaves the plan untouched.

## Club Removal and Migration

The clubs domain is removed completely:

- Drop club-related tables, foreign keys, indexes, and relations.
- Remove shared club schemas, API routes/services/tests, web pages/routes/navigation, MCP references, and club nudge jobs/email configuration.
- Remove obsolete club documentation and update README/product naming where it describes clubs.
- Run an explicit migration that drops club historical data only. It must not affect users, sessions, runs, goals, integrations, or any newly added personal-training data.

This deletion is intentional and irreversible after migration.

## Reliability and Error Handling

- A failed or ambiguous Intervals-to-plan match never discards a run or marks a plan item complete.
- Draft meals are excluded from nutrition progress until confirmation. Incomplete user portion context remains visible as an estimate rather than silently becoming a trusted record.
- Creation/edit operations validate category-specific fields and ownership. Invalid updates return structured errors without partial writes.
- The Today dashboard can independently load agenda, weekly summary, and recent history so a secondary failure does not hide completed training data.

## Testing

- Shared schema tests for plan, gym, and nutrition validation.
- Service and route tests for user isolation, recurrence generation, occurrence overrides, and status changes.
- Tests for weekly aggregation across all three categories and for confirmed-only nutrition totals.
- Import tests for exact/ambiguous/no run-to-plan matching.
- MCP tests for draft creation, correction, confirmation, discard, and ownership.
- Migration/integration tests showing club data is removed while unrelated account and run data is retained.
- Web tests for Today loading, plan states, and weekly overview rendering.

## Delivery Sequence

1. Remove clubs and introduce the personal dashboard shell.
2. Add recurring plans, occurrences, and weekly aggregation for running/gym/nutrition.
3. Add gym record APIs/UI and plan completion links.
4. Add nutrition storage and MCP draft-confirmation workflow.
5. Extend history/insights and polish imports/matching.

Each phase must ship with its migration and focused tests. The dashboard can initially show empty gym/nutrition states while their logging layers are delivered.
