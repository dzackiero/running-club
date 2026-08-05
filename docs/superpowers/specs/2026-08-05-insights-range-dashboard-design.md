# Insights range + dashboard hierarchy

**Date:** 2026-08-05  
**Status:** Approved / implemented

## Summary

Insights defaults to **this calendar month (UTC, so far)** with presets and custom dates. UI follows a dashboard hierarchy: filter header → KPI band → primary chart → quiet secondary strip.

## Range

- Presets: This month · Last month · Last 3 months · Year to date · Custom
- API: `GET /insights/overview?from=&to=` (ISO datetime; both or neither)
- Default: month start → end of today (UTC)
- Vs prior: equal-length period immediately before
- Chart grain: weeks if ≤ 42 days, else months
- Goals hit/missed always evaluated on week boundaries inside the range

## UI hierarchy

1. Title + range label + preset select (+ custom date inputs)
2. One KPI band (Distance hero, Runs/Pace secondary) — no nested cards
3. One chart panel (By week / By month)
4. Consistency + Goals as prose secondary row
