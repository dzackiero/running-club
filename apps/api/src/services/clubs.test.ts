import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { user } from "../db/schema";
import { createRun } from "./runs";
import {
  ClubError,
  captureClosedPeriodResults,
  createClub,
  getClub,
  getClubBoard,
  getClubPeriodResults,
  joinClub,
  leaveClub,
  listClubs,
  removeMember,
  sendClubPeriodMissMessage,
  updateClub,
  updateMyMembership,
} from "./clubs";
import { deleteTestUsers, ensureTestUsers } from "../test/users";

const ownerId = "user_club_owner";
const memberId = "user_club_member";
const outsiderId = "user_club_outsider";
const historyOwnerId = "user_club_history_owner";
const snapOwnerId = "user_club_snap_owner";
const snapHitId = "user_club_snap_hit";
const snapMissId = "user_club_snap_miss";
const msgOwnerId = "user_club_msg_owner";
const msgHitId = "user_club_msg_hit";
const msgMissId = "user_club_msg_miss";
const msgMutedId = "user_club_msg_muted";
const funOwnerId = "user_club_fun_owner";
const funBusyId = "user_club_fun_busy";
const funLongId = "user_club_fun_long";

describe("clubs service", () => {
  beforeAll(async () => {
    await ensureTestUsers([
      ownerId,
      memberId,
      outsiderId,
      historyOwnerId,
      snapOwnerId,
      snapHitId,
      snapMissId,
      msgOwnerId,
      msgHitId,
      msgMissId,
      msgMutedId,
      funOwnerId,
      funBusyId,
      funLongId,
    ]);
  });

  afterAll(async () => {
    await deleteTestUsers([
      ownerId,
      memberId,
      outsiderId,
      historyOwnerId,
      snapOwnerId,
      snapHitId,
      snapMissId,
      msgOwnerId,
      msgHitId,
      msgMissId,
      msgMutedId,
      funOwnerId,
      funBusyId,
      funLongId,
    ]);
  });

  it("creates, joins, and ranks members by weekly distance", async () => {
    const created = await createClub(ownerId, { name: "Dawn Patrol" });
    expect(created.role).toBe("owner");
    expect(created.inviteCode).toBeTruthy();
    expect(created.memberCount).toBe(1);

    const joined = await joinClub(memberId, created.inviteCode!);
    expect(joined.role).toBe("member");
    expect(joined.inviteCode).toBeNull();
    expect(joined.memberCount).toBe(2);

    await expect(joinClub(memberId, created.inviteCode!)).rejects.toMatchObject({
      code: "CONFLICT",
    });

    await createRun(ownerId, {
      startedAt: "2026-08-04T06:00:00.000Z",
      distanceMeters: 5000,
      durationSeconds: 1500,
      activityType: "run",
    });
    await createRun(memberId, {
      startedAt: "2026-08-04T07:00:00.000Z",
      distanceMeters: 12000,
      durationSeconds: 3600,
      activityType: "run",
    });

    const detail = await getClub(memberId, created.id, new Date("2026-08-05T12:00:00.000Z"));
    expect(detail.week.board[0]?.userId).toBe(memberId);
    expect(detail.week.board[0]?.distanceMeters).toBe(12000);
    expect(detail.week.board[1]?.userId).toBe(ownerId);
    expect(detail.inviteCode).toBeNull();

    const ownerView = await getClub(ownerId, created.id, new Date("2026-08-05T12:00:00.000Z"));
    expect(ownerView.inviteCode).toBe(created.inviteCode);
  });

  it("restricts owner updates and lets members leave", async () => {
    const created = await createClub(ownerId, { name: "Track Club" });
    await joinClub(memberId, created.inviteCode!);

    await expect(
      updateClub(memberId, created.id, { name: "Hijack" }),
    ).rejects.toBeInstanceOf(ClubError);

    const updated = await updateClub(ownerId, created.id, {
      weeklyTargetDistanceMeters: 30_000,
      monthlyTargetDistanceMeters: 100_000,
    });
    expect(updated.weeklyTargetDistanceMeters).toBe(30_000);

    await updateMyMembership(memberId, created.id, false);
    const after = await getClub(memberId, created.id);
    expect(after.emailNudges).toBe(false);

    await leaveClub(memberId, created.id);
    const listed = await listClubs(memberId);
    expect(listed.some((row) => row.id === created.id)).toBe(false);

    await joinClub(memberId, created.inviteCode!);
    await removeMember(ownerId, created.id, memberId);
    await expect(getClub(memberId, created.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("hides clubs from outsiders", async () => {
    const created = await createClub(ownerId, { name: "Private" });
    await expect(getClub(outsiderId, created.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("returns a historical week board and rejects future offsets", async () => {
    const created = await createClub(historyOwnerId, { name: "History Club" });
    await updateClub(historyOwnerId, created.id, {
      weeklyTargetDistanceMeters: 20_000,
    });

    await createRun(historyOwnerId, {
      startedAt: "2026-07-29T06:00:00.000Z",
      distanceMeters: 8000,
      durationSeconds: 2400,
      activityType: "run",
    });
    await createRun(historyOwnerId, {
      startedAt: "2026-08-04T06:00:00.000Z",
      distanceMeters: 3000,
      durationSeconds: 900,
      activityType: "run",
    });

    const now = new Date("2026-08-05T12:00:00.000Z");
    const current = await getClubBoard(
      historyOwnerId,
      created.id,
      { period: "week", offset: 0 },
      now,
    );
    expect(current.period).toBe("week");
    expect(current.offset).toBe(0);
    expect(current.targetDistanceMeters).toBe(20_000);
    expect(current.start).toBe("2026-08-03T00:00:00.000Z");
    expect(current.board[0]?.distanceMeters).toBe(3000);

    const previous = await getClubBoard(
      historyOwnerId,
      created.id,
      { period: "week", offset: -1 },
      now,
    );
    expect(previous.start).toBe("2026-07-27T00:00:00.000Z");
    expect(previous.board[0]?.distanceMeters).toBe(8000);
    expect(previous.targetDistanceMeters).toBe(20_000);

    await expect(
      getClubBoard(historyOwnerId, created.id, { period: "week", offset: 1 }, now),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    await expect(
      getClubBoard(outsiderId, created.id, { period: "week", offset: 0 }, now),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("snapshots hit vs miss at period end and keeps stats frozen", async () => {
    const created = await createClub(snapOwnerId, { name: "Snapshot Club" });
    await joinClub(snapHitId, created.inviteCode!);
    await joinClub(snapMissId, created.inviteCode!);
    await updateClub(snapOwnerId, created.id, {
      weeklyTargetDistanceMeters: 10_000,
    });

    await createRun(snapHitId, {
      startedAt: "2026-07-28T08:00:00.000Z",
      distanceMeters: 12_000,
      durationSeconds: 3600,
      activityType: "run",
    });
    await createRun(snapMissId, {
      startedAt: "2026-07-28T08:00:00.000Z",
      distanceMeters: 4000,
      durationSeconds: 1200,
      activityType: "run",
    });

    const now = new Date("2026-08-05T12:00:00.000Z");
    const captured = await captureClosedPeriodResults(now, created.id);
    expect(captured.written).toBeGreaterThanOrEqual(3);

    const results = await getClubPeriodResults(
      snapOwnerId,
      created.id,
      { period: "week", offset: -1 },
      now,
    );
    expect(results.captured).toBe(true);
    expect(results.targetDistanceMeters).toBe(10_000);
    expect(results.counts).toEqual({
      memberCount: 3,
      hit: 1,
      missed: 2,
      noTarget: 0,
    });
    expect(results.members.find((row) => row.userId === snapHitId)?.hit).toBe(
      true,
    );
    expect(results.members.find((row) => row.userId === snapMissId)).toMatchObject(
      {
        hit: false,
        distanceMeters: 4000,
      },
    );

    await createRun(snapMissId, {
      startedAt: "2026-07-29T08:00:00.000Z",
      distanceMeters: 20_000,
      durationSeconds: 6000,
      activityType: "run",
    });

    const frozen = await getClubPeriodResults(
      snapOwnerId,
      created.id,
      { period: "week", offset: -1 },
      now,
    );
    expect(frozen.counts.missed).toBe(2);
    expect(frozen.members.find((row) => row.userId === snapMissId)?.distanceMeters).toBe(
      4000,
    );

    await expect(
      getClubPeriodResults(snapMissId, created.id, { period: "week" }, now),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("sends an owner template only to members who missed and allow email", async () => {
    const created = await createClub(msgOwnerId, { name: "Message Club" });
    await joinClub(msgHitId, created.inviteCode!);
    await joinClub(msgMissId, created.inviteCode!);
    await joinClub(msgMutedId, created.inviteCode!);
    await updateClub(msgOwnerId, created.id, {
      weeklyTargetDistanceMeters: 10_000,
    });
    await updateMyMembership(msgOwnerId, created.id, false);

    await db
      .update(user)
      .set({ emailNotifications: false })
      .where(eq(user.id, msgMutedId));

    await createRun(msgOwnerId, {
      startedAt: "2026-07-28T08:00:00.000Z",
      distanceMeters: 12_000,
      durationSeconds: 3600,
      activityType: "run",
    });
    await createRun(msgHitId, {
      startedAt: "2026-07-28T08:00:00.000Z",
      distanceMeters: 11_000,
      durationSeconds: 3300,
      activityType: "run",
    });
    await createRun(msgMissId, {
      startedAt: "2026-07-28T08:00:00.000Z",
      distanceMeters: 2000,
      durationSeconds: 600,
      activityType: "run",
    });
    await createRun(msgMutedId, {
      startedAt: "2026-07-28T08:00:00.000Z",
      distanceMeters: 1000,
      durationSeconds: 400,
      activityType: "run",
    });

    const now = new Date("2026-08-05T12:00:00.000Z");
    await captureClosedPeriodResults(now, created.id);
    const results = await getClubPeriodResults(
      msgOwnerId,
      created.id,
      { period: "week", offset: -1 },
      now,
    );

    const sentTo: string[] = [];
    const mailer = async ({ to }: { to: string }) => {
      sentTo.push(to);
      return true;
    };

    await expect(
      sendClubPeriodMissMessage(
        msgMissId,
        created.id,
        {
          period: "week",
          periodStart: results.start,
          templateId: "encourage",
        },
        mailer,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const first = await sendClubPeriodMissMessage(
      msgOwnerId,
      created.id,
      {
        period: "week",
        periodStart: results.start,
        templateId: "encourage",
      },
      mailer,
    );
    expect(first.sent).toBe(1);
    expect(sentTo).toEqual(["user_club_msg_miss@test.local"]);

    sentTo.length = 0;
    const second = await sendClubPeriodMissMessage(
      msgOwnerId,
      created.id,
      {
        period: "week",
        periodStart: results.start,
        templateId: "encourage",
      },
      mailer,
    );
    expect(second.sent).toBe(0);
    expect(sentTo).toEqual([]);
  });

  it("returns celebratory board highlights for the period", async () => {
    const created = await createClub(funOwnerId, { name: "Fun Club" });
    await joinClub(funBusyId, created.inviteCode!);
    await joinClub(funLongId, created.inviteCode!);

    await createRun(funOwnerId, {
      startedAt: "2026-08-04T07:00:00.000Z",
      distanceMeters: 5000,
      durationSeconds: 1500,
      activityType: "run",
    });
    await createRun(funBusyId, {
      startedAt: "2026-08-03T07:00:00.000Z",
      distanceMeters: 1000,
      durationSeconds: 400,
      activityType: "run",
    });
    await createRun(funBusyId, {
      startedAt: "2026-08-04T07:00:00.000Z",
      distanceMeters: 1000,
      durationSeconds: 400,
      activityType: "run",
    });
    await createRun(funBusyId, {
      startedAt: "2026-08-05T07:00:00.000Z",
      distanceMeters: 1000,
      durationSeconds: 400,
      activityType: "run",
    });
    await createRun(funLongId, {
      startedAt: "2026-08-04T08:00:00.000Z",
      distanceMeters: 20_000,
      durationSeconds: 5400,
      activityType: "run",
    });

    const now = new Date("2026-08-05T12:00:00.000Z");
    const board = await getClubBoard(
      funOwnerId,
      created.id,
      { period: "week", offset: 0 },
      now,
    );
    expect(board.board[0]?.userId).toBe(funLongId);
    expect(board.highlights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "runs",
          userId: funBusyId,
          value: 3,
        }),
        expect.objectContaining({
          kind: "longest",
          userId: funLongId,
          value: 20_000,
        }),
        expect.objectContaining({
          kind: "days",
          userId: funBusyId,
          value: 3,
        }),
      ]),
    );

    const detail = await getClub(funOwnerId, created.id, now);
    expect(detail.week.highlights.some((row) => row.kind === "longest")).toBe(
      true,
    );
  });
});
