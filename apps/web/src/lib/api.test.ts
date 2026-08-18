import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "./api";

const dashboard = {
  date: "2026-08-18",
  items: [],
  week: {
    start: "2026-08-17",
    end: "2026-08-23",
    days: [],
    running: { distanceMeters: 0, completedSessions: 0, plannedSessions: 0 },
    gym: { completedSessions: 0, plannedSessions: 0 },
    nutrition: { targetDays: 0, achievedDays: 0 },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("personal training API client", () => {
  it("requests the selected day dashboard", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(dashboard), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const getTodayDashboard = (api as Record<string, unknown>)[
      "getTodayDashboard"
    ] as (at?: string) => Promise<unknown>;

    await expect(getTodayDashboard("2026-08-18")).resolves.toEqual(dashboard);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8787/insights/today?at=2026-08-18",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
