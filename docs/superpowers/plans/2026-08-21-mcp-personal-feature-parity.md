# MCP Personal Feature Parity Implementation Plan

**Goal:** Expose all personal training data actions through the CUP Run MCP server.

**Scope:** Plan template CRUD and additive batch creation; dated agenda/occurrence updates; gym create/list; nutrition target/progress and meal listing; insights and preferences. Existing run CRUD, goals, summaries, meal draft confirmation, and activity history remain available. Auth/session and raw Intervals credentials stay outside MCP.

**Verification:** Add MCP integration coverage for each tool family, then run full tests, API typecheck, lint, and build.
