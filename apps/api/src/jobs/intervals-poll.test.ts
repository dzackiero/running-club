import { describe, expect, it, vi } from "vitest";
import {
  INTERVALS_POLL_INITIAL_DELAY_MS,
  INTERVALS_POLL_INTERVAL_MS,
  INTERVALS_SYNC_DUE_AFTER_MS,
  pollAllIntervalsImports,
} from "./intervals-poll";

describe("intervals poller schedule", () => {
  it("ticks every 10 minutes after a 30 second boot delay, and syncs when last sync is 2 hours old", () => {
    expect(INTERVALS_POLL_INTERVAL_MS).toBe(10 * 60 * 1000);
    expect(INTERVALS_POLL_INITIAL_DELAY_MS).toBe(30 * 1000);
    expect(INTERVALS_SYNC_DUE_AFTER_MS).toBe(2 * 60 * 60 * 1000);
  });
});

describe("pollAllIntervalsImports", () => {
  const now = new Date("2026-08-05T12:00:00.000Z");

  it("skips a user synced 30 minutes ago", async () => {
    const importUser = vi.fn();

    const result = await pollAllIntervalsImports({
      listCredentials: async () => [
        {
          userId: "u1",
          apiKey: "k1",
          lastSyncedAt: new Date("2026-08-05T11:30:00.000Z"),
        },
      ],
      importUser,
      now: () => now,
    });

    expect(importUser).not.toHaveBeenCalled();
    expect(result).toEqual({ users: 1, due: 0, failures: 0 });
  });

  it("imports a user who has never synced", async () => {
    const importUser = vi.fn().mockResolvedValue({
      imported: 1,
      updated: 0,
      skipped: 0,
    });

    const result = await pollAllIntervalsImports({
      listCredentials: async () => [
        { userId: "u1", apiKey: "k1", lastSyncedAt: null },
      ],
      importUser,
      now: () => now,
    });

    expect(importUser).toHaveBeenCalledWith("u1", "k1");
    expect(result).toEqual({ users: 1, due: 1, failures: 0 });
  });

  it("imports a user synced 3 hours ago", async () => {
    const importUser = vi.fn().mockResolvedValue({
      imported: 0,
      updated: 1,
      skipped: 0,
    });

    const result = await pollAllIntervalsImports({
      listCredentials: async () => [
        {
          userId: "u1",
          apiKey: "k1",
          lastSyncedAt: new Date("2026-08-05T09:00:00.000Z"),
        },
      ],
      importUser,
      now: () => now,
    });

    expect(importUser).toHaveBeenCalledWith("u1", "k1");
    expect(result).toEqual({ users: 1, due: 1, failures: 0 });
  });

  it("imports each connected due user and continues after a failure", async () => {
    const importUser = vi
      .fn()
      .mockResolvedValueOnce({ imported: 1, updated: 0, skipped: 0 })
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ imported: 0, updated: 2, skipped: 1 });

    const result = await pollAllIntervalsImports({
      listCredentials: async () => [
        { userId: "u1", apiKey: "k1", lastSyncedAt: null },
        { userId: "u2", apiKey: "k2", lastSyncedAt: null },
        { userId: "u3", apiKey: "k3", lastSyncedAt: null },
      ],
      importUser,
      now: () => now,
    });

    expect(importUser).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ users: 3, due: 3, failures: 1 });
  });
});
