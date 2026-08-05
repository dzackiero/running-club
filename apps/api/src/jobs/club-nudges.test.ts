import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { user } from "../db/schema";
import { createRun } from "../services/runs";
import {
  createClub,
  getClubPeriodResults,
  joinClub,
  updateClub,
  updateMyMembership,
} from "../services/clubs";
import { deleteTestUsers, ensureTestUsers } from "../test/users";
import { sendDueClubNudges } from "./club-nudges";

const ownerId = "user_nudge_owner";
const behindId = "user_nudge_behind";
const hitId = "user_nudge_hit";
const mutedId = "user_nudge_muted";

describe("sendDueClubNudges", () => {
  beforeAll(async () => {
    await ensureTestUsers([ownerId, behindId, hitId, mutedId]);
  });

  afterAll(async () => {
    await deleteTestUsers([ownerId, behindId, hitId, mutedId]);
  });

  it("emails members who missed last week's club target once", async () => {
    const created = await createClub(ownerId, { name: "Nudge Club" });
    await joinClub(behindId, created.inviteCode!);
    await joinClub(hitId, created.inviteCode!);
    await updateClub(ownerId, created.id, {
      weeklyTargetDistanceMeters: 10_000,
    });
    await updateMyMembership(ownerId, created.id, false);

    await createRun(behindId, {
      startedAt: "2026-07-28T08:00:00.000Z",
      distanceMeters: 4000,
      durationSeconds: 1200,
      activityType: "run",
    });
    await createRun(hitId, {
      startedAt: "2026-07-28T08:00:00.000Z",
      distanceMeters: 12_000,
      durationSeconds: 3600,
      activityType: "run",
    });

    const sentTo: string[] = [];
    const mailer = async ({ to }: { to: string }) => {
      sentTo.push(to);
      return true;
    };

    const now = new Date("2026-08-05T12:00:00.000Z");
    const first = await sendDueClubNudges(now, mailer, created.id);
    expect(first.sent).toBe(1);
    expect(sentTo).toEqual(["user_nudge_behind@test.local"]);

    sentTo.length = 0;
    const second = await sendDueClubNudges(now, mailer, created.id);
    expect(second.sent).toBe(0);
    expect(sentTo).toEqual([]);
  });

  it("skips members with global email notifications off", async () => {
    const created = await createClub(ownerId, { name: "Muted Club" });
    await joinClub(mutedId, created.inviteCode!);
    await updateClub(ownerId, created.id, {
      weeklyTargetDistanceMeters: 10_000,
    });
    await updateMyMembership(ownerId, created.id, false);
    await db
      .update(user)
      .set({ emailNotifications: false })
      .where(eq(user.id, mutedId));

    await createRun(mutedId, {
      startedAt: "2026-07-28T08:00:00.000Z",
      distanceMeters: 2000,
      durationSeconds: 600,
      activityType: "run",
    });

    const sentTo: string[] = [];
    const first = await sendDueClubNudges(
      new Date("2026-08-05T12:00:00.000Z"),
      async ({ to }) => {
        sentTo.push(to);
        return true;
      },
      created.id,
    );

    expect(first.sent).toBe(0);
    expect(sentTo).toEqual([]);
  });

  it("snapshots every member before sending miss emails", async () => {
    const created = await createClub(ownerId, { name: "Snap Nudge Club" });
    await joinClub(behindId, created.inviteCode!);
    await joinClub(hitId, created.inviteCode!);
    await updateClub(ownerId, created.id, {
      weeklyTargetDistanceMeters: 10_000,
    });
    await updateMyMembership(ownerId, created.id, false);

    await createRun(behindId, {
      startedAt: "2026-07-28T08:00:00.000Z",
      distanceMeters: 3000,
      durationSeconds: 900,
      activityType: "run",
    });
    await createRun(hitId, {
      startedAt: "2026-07-28T08:00:00.000Z",
      distanceMeters: 15_000,
      durationSeconds: 4200,
      activityType: "run",
    });

    const now = new Date("2026-08-05T12:00:00.000Z");
    const sentTo: string[] = [];
    await sendDueClubNudges(
      now,
      async ({ to }) => {
        sentTo.push(to);
        return true;
      },
      created.id,
    );

    const results = await getClubPeriodResults(
      ownerId,
      created.id,
      { period: "week", offset: -1 },
      now,
    );
    expect(results.captured).toBe(true);
    expect(results.counts.hit).toBe(1);
    expect(results.counts.missed).toBe(2);
    expect(sentTo).toEqual(["user_nudge_behind@test.local"]);
  });
});
