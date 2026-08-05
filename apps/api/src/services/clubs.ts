import type {
  ClubBoardHighlight,
  ClubBoardView,
  ClubDetail,
  ClubLeaderboardEntry,
  ClubPeriod,
  ClubPeriodBoard,
  ClubPeriodResultsView,
  ClubSummary,
  CreateClubInput,
  SendClubPeriodMessageInput,
  SendClubPeriodMessageResult,
  UpdateClubInput,
} from "@running-club/shared";
import { clubMissMessageTemplates } from "@running-club/shared";
import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { db } from "../db/client";
import { club, clubMember, clubPeriodResult, run, user } from "../db/schema";
import { env } from "../env";
import { sendEmail } from "../lib/resend";
import {
  getMonthBounds,
  getMonthBoundsForOffset,
  getPreviousMonthBounds,
  getPreviousWeekBounds,
  getWeekBounds,
  getWeekBoundsForOffset,
} from "../lib/period";

export class ClubError extends Error {
  constructor(
    public code: "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "VALIDATION",
    message: string,
  ) {
    super(message);
    this.name = "ClubError";
  }
}

type ClubRow = typeof club.$inferSelect;
type MemberRow = typeof clubMember.$inferSelect;

function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Buffer.from(bytes).toString("base64url").replace(/[-_]/g, "x").slice(0, 8).toUpperCase();
}

function toSummary(
  row: ClubRow,
  membership: MemberRow,
  memberCount: number,
  revealInvite: boolean,
): ClubSummary {
  return {
    id: row.id,
    name: row.name,
    inviteCode: revealInvite ? row.inviteCode : null,
    ownerUserId: row.ownerUserId,
    weekStartsOn: row.weekStartsOn,
    weeklyTargetDistanceMeters: row.weeklyTargetDistanceMeters,
    monthlyTargetDistanceMeters: row.monthlyTargetDistanceMeters,
    role: membership.role === "owner" ? "owner" : "member",
    emailNudges: membership.emailNudges,
    memberCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function countMembers(clubId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clubMember)
    .where(eq(clubMember.clubId, clubId));
  return row?.count ?? 0;
}

async function getMembership(
  clubId: string,
  userId: string,
): Promise<MemberRow | null> {
  const [row] = await db
    .select()
    .from(clubMember)
    .where(and(eq(clubMember.clubId, clubId), eq(clubMember.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function listClubs(userId: string): Promise<ClubSummary[]> {
  const rows = await db
    .select({ club, membership: clubMember })
    .from(clubMember)
    .innerJoin(club, eq(club.id, clubMember.clubId))
    .where(eq(clubMember.userId, userId));

  const summaries: ClubSummary[] = [];
  for (const row of rows) {
    const memberCount = await countMembers(row.club.id);
    summaries.push(
      toSummary(row.club, row.membership, memberCount, row.membership.role === "owner"),
    );
  }
  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createClub(
  userId: string,
  input: CreateClubInput,
): Promise<ClubSummary> {
  const parsedName = input.name.trim();
  const weekStartsOn = input.weekStartsOn ?? 1;
  const id = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const inviteCode = generateInviteCode();

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(club)
      .values({
        id,
        name: parsedName,
        inviteCode,
        ownerUserId: userId,
        weekStartsOn,
      })
      .returning();
    const [membership] = await tx
      .insert(clubMember)
      .values({
        id: memberId,
        clubId: id,
        userId,
        role: "owner",
        emailNudges: true,
      })
      .returning();
    return { row, membership };
  });

  return toSummary(created.row, created.membership, 1, true);
}

export async function joinClub(
  userId: string,
  inviteCode: string,
): Promise<ClubSummary> {
  const code = inviteCode.trim().toUpperCase();
  const [existing] = await db
    .select()
    .from(club)
    .where(eq(club.inviteCode, code))
    .limit(1);
  if (!existing) {
    throw new ClubError("NOT_FOUND", "Invite code not found");
  }

  const already = await getMembership(existing.id, userId);
  if (already) {
    throw new ClubError("CONFLICT", "Already in this club");
  }

  const [membership] = await db
    .insert(clubMember)
    .values({
      id: crypto.randomUUID(),
      clubId: existing.id,
      userId,
      role: "member",
      emailNudges: true,
    })
    .returning();

  const memberCount = await countMembers(existing.id);
  return toSummary(existing, membership, memberCount, false);
}

async function leaderboard(
  clubId: string,
  from: Date,
  to: Date,
): Promise<{ board: ClubLeaderboardEntry[]; highlights: ClubBoardHighlight[] }> {
  const members = await db
    .select({
      userId: clubMember.userId,
      name: user.name,
    })
    .from(clubMember)
    .innerJoin(user, eq(user.id, clubMember.userId))
    .where(eq(clubMember.clubId, clubId));

  const memberIds = members.map((member) => member.userId);
  const totals =
    memberIds.length === 0
      ? []
      : await db
          .select({
            userId: run.userId,
            distanceMeters: sql<number>`coalesce(sum(${run.distanceMeters}), 0)`,
            runCount: sql<number>`count(*)::int`,
            longestMeters: sql<number>`coalesce(max(${run.distanceMeters}), 0)`,
            dayCount: sql<number>`count(distinct ((${run.startedAt} at time zone 'utc')::date))::int`,
          })
          .from(run)
          .where(
            and(
              inArray(run.userId, memberIds),
              gte(run.startedAt, from),
              lte(run.startedAt, to),
            ),
          )
          .groupBy(run.userId);

  const byUser = new Map(
    totals.map((row) => [
      row.userId,
      {
        distanceMeters: Number(row.distanceMeters) || 0,
        runCount: Number(row.runCount) || 0,
        longestMeters: Number(row.longestMeters) || 0,
        dayCount: Number(row.dayCount) || 0,
      },
    ]),
  );

  const ranked = members
    .map((member) => ({
      userId: member.userId,
      name: member.name?.trim() || "Runner",
      distanceMeters: byUser.get(member.userId)?.distanceMeters ?? 0,
      runCount: byUser.get(member.userId)?.runCount ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.distanceMeters - a.distanceMeters || a.name.localeCompare(b.name));

  const board = ranked.map((entry, index) => ({ ...entry, rank: index + 1 }));

  const withStats = members.map((member) => {
    const stats = byUser.get(member.userId);
    return {
      userId: member.userId,
      name: member.name?.trim() || "Runner",
      distanceMeters: stats?.distanceMeters ?? 0,
      runCount: stats?.runCount ?? 0,
      longestMeters: stats?.longestMeters ?? 0,
      dayCount: stats?.dayCount ?? 0,
    };
  });

  const pick = (
    kind: ClubBoardHighlight["kind"],
    score: (row: (typeof withStats)[number]) => number,
  ): ClubBoardHighlight | null => {
    const winner = [...withStats]
      .filter((row) => score(row) > 0)
      .sort(
        (a, b) =>
          score(b) - score(a) ||
          b.distanceMeters - a.distanceMeters ||
          a.name.localeCompare(b.name),
      )[0];
    if (!winner) return null;
    return {
      kind,
      userId: winner.userId,
      name: winner.name,
      value: score(winner),
    };
  };

  const highlights = [
    pick("runs", (row) => row.runCount),
    pick("longest", (row) => row.longestMeters),
    pick("days", (row) => row.dayCount),
  ].filter((row): row is ClubBoardHighlight => row != null);

  return { board, highlights };
}

function toPeriodBoard(
  start: Date,
  end: Date,
  targetDistanceMeters: number | null,
  loaded: { board: ClubLeaderboardEntry[]; highlights: ClubBoardHighlight[] },
): ClubPeriodBoard {
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    targetDistanceMeters,
    board: loaded.board,
    highlights: loaded.highlights,
  };
}

export async function getClub(
  userId: string,
  clubId: string,
  now: Date = new Date(),
): Promise<ClubDetail> {
  const [row] = await db.select().from(club).where(eq(club.id, clubId)).limit(1);
  if (!row) throw new ClubError("NOT_FOUND", "Club not found");

  const membership = await getMembership(clubId, userId);
  if (!membership) throw new ClubError("NOT_FOUND", "Club not found");

  const memberCount = await countMembers(clubId);
  const { weekStart, weekEnd } = getWeekBounds(now, row.weekStartsOn);
  const { monthStart, monthEnd } = getMonthBounds(now);
  const [weekBoard, monthBoard, viewer] = await Promise.all([
    leaderboard(clubId, weekStart, weekEnd),
    leaderboard(clubId, monthStart, monthEnd),
    db
      .select({ emailNotifications: user.emailNotifications })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  return {
    ...toSummary(row, membership, memberCount, membership.role === "owner"),
    emailNotifications: viewer?.emailNotifications ?? true,
    week: toPeriodBoard(
      weekStart,
      weekEnd,
      row.weeklyTargetDistanceMeters,
      weekBoard,
    ),
    month: toPeriodBoard(
      monthStart,
      monthEnd,
      row.monthlyTargetDistanceMeters,
      monthBoard,
    ),
  };
}

export async function getClubBoard(
  userId: string,
  clubId: string,
  query: { period: ClubPeriod; offset?: number },
  now: Date = new Date(),
): Promise<ClubBoardView> {
  const offset = query.offset ?? 0;
  if (!Number.isInteger(offset) || offset > 0) {
    throw new ClubError("VALIDATION", "Offset cannot be in the future");
  }

  const [row] = await db.select().from(club).where(eq(club.id, clubId)).limit(1);
  if (!row) throw new ClubError("NOT_FOUND", "Club not found");

  const membership = await getMembership(clubId, userId);
  if (!membership) throw new ClubError("NOT_FOUND", "Club not found");

  const period = query.period;
  if (period === "week") {
    const { weekStart, weekEnd } = getWeekBoundsForOffset(
      now,
      row.weekStartsOn,
      offset,
    );
    const loaded = await leaderboard(clubId, weekStart, weekEnd);
    return {
      period,
      offset,
      start: weekStart.toISOString(),
      end: weekEnd.toISOString(),
      targetDistanceMeters: row.weeklyTargetDistanceMeters,
      board: loaded.board,
      highlights: loaded.highlights,
    };
  }

  const { monthStart, monthEnd } = getMonthBoundsForOffset(now, offset);
  const loaded = await leaderboard(clubId, monthStart, monthEnd);
  return {
    period,
    offset,
    start: monthStart.toISOString(),
    end: monthEnd.toISOString(),
    targetDistanceMeters: row.monthlyTargetDistanceMeters,
    board: loaded.board,
    highlights: loaded.highlights,
  };
}

export async function updateClub(
  userId: string,
  clubId: string,
  input: UpdateClubInput,
): Promise<ClubSummary> {
  const membership = await getMembership(clubId, userId);
  if (!membership) throw new ClubError("NOT_FOUND", "Club not found");
  if (membership.role !== "owner") {
    throw new ClubError("FORBIDDEN", "Only the owner can update this club");
  }

  const patch: Partial<ClubRow> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.weekStartsOn !== undefined) patch.weekStartsOn = input.weekStartsOn;
  if (input.weeklyTargetDistanceMeters !== undefined) {
    patch.weeklyTargetDistanceMeters = input.weeklyTargetDistanceMeters;
  }
  if (input.monthlyTargetDistanceMeters !== undefined) {
    patch.monthlyTargetDistanceMeters = input.monthlyTargetDistanceMeters;
  }
  if (input.rotateInviteCode) {
    patch.inviteCode = generateInviteCode();
  }

  const [row] = await db
    .update(club)
    .set(patch)
    .where(eq(club.id, clubId))
    .returning();
  if (!row) throw new ClubError("NOT_FOUND", "Club not found");

  return toSummary(row, membership, await countMembers(clubId), true);
}

export async function deleteClub(userId: string, clubId: string): Promise<void> {
  const membership = await getMembership(clubId, userId);
  if (!membership) throw new ClubError("NOT_FOUND", "Club not found");
  if (membership.role !== "owner") {
    throw new ClubError("FORBIDDEN", "Only the owner can delete this club");
  }
  await db.delete(club).where(eq(club.id, clubId));
}

export async function leaveClub(userId: string, clubId: string): Promise<void> {
  const membership = await getMembership(clubId, userId);
  if (!membership) throw new ClubError("NOT_FOUND", "Club not found");
  if (membership.role === "owner") {
    throw new ClubError("VALIDATION", "Owner cannot leave — delete the club instead");
  }
  await db
    .delete(clubMember)
    .where(and(eq(clubMember.clubId, clubId), eq(clubMember.userId, userId)));
}

export async function updateMyMembership(
  userId: string,
  clubId: string,
  emailNudges: boolean,
): Promise<ClubSummary> {
  const [row] = await db.select().from(club).where(eq(club.id, clubId)).limit(1);
  if (!row) throw new ClubError("NOT_FOUND", "Club not found");
  const membership = await getMembership(clubId, userId);
  if (!membership) throw new ClubError("NOT_FOUND", "Club not found");

  const [updated] = await db
    .update(clubMember)
    .set({ emailNudges })
    .where(and(eq(clubMember.clubId, clubId), eq(clubMember.userId, userId)))
    .returning();

  return toSummary(
    row,
    updated,
    await countMembers(clubId),
    updated.role === "owner",
  );
}

export async function removeMember(
  actorUserId: string,
  clubId: string,
  targetUserId: string,
): Promise<void> {
  if (actorUserId === targetUserId) {
    throw new ClubError("VALIDATION", "Use leave to remove yourself");
  }
  const actor = await getMembership(clubId, actorUserId);
  if (!actor) throw new ClubError("NOT_FOUND", "Club not found");
  if (actor.role !== "owner") {
    throw new ClubError("FORBIDDEN", "Only the owner can remove members");
  }
  const target = await getMembership(clubId, targetUserId);
  if (!target) throw new ClubError("NOT_FOUND", "Member not found");
  if (target.role === "owner") {
    throw new ClubError("VALIDATION", "Cannot remove the owner");
  }
  await db
    .delete(clubMember)
    .where(
      and(eq(clubMember.clubId, clubId), eq(clubMember.userId, targetUserId)),
    );
}

export async function listClubMembersForNudge(clubId: string) {
  return db
    .select({
      userId: clubMember.userId,
      emailNudges: clubMember.emailNudges,
      emailNotifications: user.emailNotifications,
      email: user.email,
      name: user.name,
    })
    .from(clubMember)
    .innerJoin(user, eq(user.id, clubMember.userId))
    .where(eq(clubMember.clubId, clubId));
}

export async function listClubsWithTargets() {
  return db.select().from(club);
}

export async function memberDistanceInRange(
  userId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const [row] = await db
    .select({
      distanceMeters: sql<number>`coalesce(sum(${run.distanceMeters}), 0)`,
    })
    .from(run)
    .where(
      and(eq(run.userId, userId), gte(run.startedAt, from), lte(run.startedAt, to)),
    );
  return Number(row?.distanceMeters) || 0;
}

export type ClubMailer = (input: {
  to: string;
  subject: string;
  text: string;
}) => Promise<boolean>;

function formatKm(meters: number): string {
  return (meters / 1000).toFixed(1);
}

function periodLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  };
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}`;
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

async function snapshotClubPeriod(
  clubId: string,
  period: ClubPeriod,
  start: Date,
  end: Date,
  targetDistanceMeters: number | null,
): Promise<number> {
  const { board } = await leaderboard(clubId, start, end);
  if (board.length === 0) return 0;

  const target =
    targetDistanceMeters != null && targetDistanceMeters > 0
      ? targetDistanceMeters
      : null;
  const rows = board.map((entry) => ({
    id: crypto.randomUUID(),
    clubId,
    userId: entry.userId,
    period,
    periodStart: start,
    periodEnd: end,
    targetDistanceMeters: target,
    distanceMeters: entry.distanceMeters,
    hit: target != null && entry.distanceMeters >= target,
  }));

  const inserted = await db
    .insert(clubPeriodResult)
    .values(rows)
    .onConflictDoNothing({
      target: [
        clubPeriodResult.clubId,
        clubPeriodResult.userId,
        clubPeriodResult.period,
        clubPeriodResult.periodStart,
      ],
    })
    .returning({ id: clubPeriodResult.id });
  return inserted.length;
}

export async function captureClosedPeriodResults(
  now: Date = new Date(),
  onlyClubId?: string,
): Promise<{ written: number }> {
  const clubs = (await listClubsWithTargets()).filter(
    (row) => !onlyClubId || row.id === onlyClubId,
  );
  let written = 0;
  for (const row of clubs) {
    const week = getPreviousWeekBounds(now, row.weekStartsOn);
    const month = getPreviousMonthBounds(now);
    written += await snapshotClubPeriod(
      row.id,
      "week",
      week.weekStart,
      week.weekEnd,
      row.weeklyTargetDistanceMeters,
    );
    written += await snapshotClubPeriod(
      row.id,
      "month",
      month.monthStart,
      month.monthEnd,
      row.monthlyTargetDistanceMeters,
    );
  }
  return { written };
}

export async function listClubPeriodSnapshots(
  clubId: string,
  period: ClubPeriod,
  periodStart: Date,
) {
  return db
    .select()
    .from(clubPeriodResult)
    .where(
      and(
        eq(clubPeriodResult.clubId, clubId),
        eq(clubPeriodResult.period, period),
      ),
    )
    .then((rows) =>
      rows.filter((row) => row.periodStart.getTime() === periodStart.getTime()),
    );
}

export async function getClubPeriodResults(
  userId: string,
  clubId: string,
  query: { period: ClubPeriod; offset?: number },
  now: Date = new Date(),
): Promise<ClubPeriodResultsView> {
  const offset = query.offset ?? -1;
  if (!Number.isInteger(offset) || offset >= 0) {
    throw new ClubError("VALIDATION", "Only closed periods can be loaded");
  }

  const [row] = await db.select().from(club).where(eq(club.id, clubId)).limit(1);
  if (!row) throw new ClubError("NOT_FOUND", "Club not found");

  const membership = await getMembership(clubId, userId);
  if (!membership) throw new ClubError("NOT_FOUND", "Club not found");
  if (membership.role !== "owner") {
    throw new ClubError("FORBIDDEN", "Only the owner can view period results");
  }

  const period = query.period;
  let start: Date;
  let end: Date;
  if (period === "week") {
    const bounds = getWeekBoundsForOffset(now, row.weekStartsOn, offset);
    start = bounds.weekStart;
    end = bounds.weekEnd;
  } else {
    const bounds = getMonthBoundsForOffset(now, offset);
    start = bounds.monthStart;
    end = bounds.monthEnd;
  }

  const snapshots = await listClubPeriodSnapshots(clubId, period, start);
  const userIds = [...new Set(snapshots.map((snap) => snap.userId))];
  const names =
    userIds.length === 0
      ? []
      : await db
          .select({ id: user.id, name: user.name })
          .from(user)
          .where(inArray(user.id, userIds));
  const nameById = new Map(
    names.map((entry) => [entry.id, entry.name?.trim() || "Runner"]),
  );

  const members = snapshots
    .map((snap) => ({
      userId: snap.userId,
      name: nameById.get(snap.userId) ?? "Runner",
      distanceMeters: snap.distanceMeters,
      hit: snap.hit,
      targetDistanceMeters: snap.targetDistanceMeters,
      lastManualNudgeAt: snap.lastManualNudgeAt?.toISOString() ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const noTarget = members.filter((entry) => entry.targetDistanceMeters == null).length;
  const hit = members.filter((entry) => entry.hit).length;
  const missed = members.filter(
    (entry) => entry.targetDistanceMeters != null && !entry.hit,
  ).length;
  const targetDistanceMeters =
    members.find((entry) => entry.targetDistanceMeters != null)
      ?.targetDistanceMeters ?? null;

  return {
    period,
    offset,
    start: start.toISOString(),
    end: end.toISOString(),
    targetDistanceMeters,
    captured: snapshots.length > 0,
    counts: {
      memberCount: members.length,
      hit,
      missed,
      noTarget,
    },
    members,
  };
}

export async function sendClubPeriodMissMessage(
  actorUserId: string,
  clubId: string,
  input: SendClubPeriodMessageInput,
  mailer: ClubMailer = sendEmail,
): Promise<SendClubPeriodMessageResult> {
  const membership = await getMembership(clubId, actorUserId);
  if (!membership) throw new ClubError("NOT_FOUND", "Club not found");
  if (membership.role !== "owner") {
    throw new ClubError("FORBIDDEN", "Only the owner can message misses");
  }

  const [row] = await db.select().from(club).where(eq(club.id, clubId)).limit(1);
  if (!row) throw new ClubError("NOT_FOUND", "Club not found");

  const periodStart = new Date(input.periodStart);
  if (Number.isNaN(periodStart.getTime())) {
    throw new ClubError("VALIDATION", "Invalid period start");
  }

  const snapshots = await listClubPeriodSnapshots(
    clubId,
    input.period,
    periodStart,
  );
  if (snapshots.length === 0) {
    throw new ClubError("NOT_FOUND", "No snapshot for that period");
  }

  const template =
    clubMissMessageTemplates.find((item) => item.id === input.templateId) ??
    clubMissMessageTemplates[0]!;
  const bodyTemplate = input.body?.trim() || template.body;
  const clubUrl = `${env.WEB_ORIGIN}/clubs/${clubId}`;

  const recipients = snapshots.filter(
    (snap) =>
      snap.targetDistanceMeters != null &&
      snap.targetDistanceMeters > 0 &&
      !snap.hit &&
      snap.lastManualNudgeAt == null,
  );
  if (recipients.length === 0) {
    return { sent: 0, skipped: snapshots.length };
  }

  const users = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      emailNotifications: user.emailNotifications,
    })
    .from(user)
    .where(
      inArray(
        user.id,
        recipients.map((snap) => snap.userId),
      ),
    );
  const userById = new Map(users.map((entry) => [entry.id, entry]));

  let sent = 0;
  let skipped = 0;
  for (const snap of recipients) {
    const member = userById.get(snap.userId);
    if (!member?.emailNotifications || !member.email) {
      skipped += 1;
      continue;
    }

    const vars = {
      name: member.name?.trim() || "runner",
      clubName: row.name,
      period: input.period,
      distanceKm: formatKm(snap.distanceMeters),
      targetKm: formatKm(snap.targetDistanceMeters ?? 0),
      dates: periodLabel(snap.periodStart, snap.periodEnd),
      clubUrl,
    };
    const text = [`Hey ${vars.name},`, "", renderTemplate(bodyTemplate, vars)].join(
      "\n",
    );
    const ok = await mailer({
      to: member.email,
      subject: `${row.name}: last ${input.period} target`,
      text,
    });
    if (!ok) {
      skipped += 1;
      continue;
    }

    const updated = await db
      .update(clubPeriodResult)
      .set({ lastManualNudgeAt: new Date() })
      .where(
        and(
          eq(clubPeriodResult.id, snap.id),
          isNull(clubPeriodResult.lastManualNudgeAt),
        ),
      )
      .returning({ id: clubPeriodResult.id });
    if (updated.length === 0) {
      skipped += 1;
      continue;
    }
    sent += 1;
  }

  return { sent, skipped };
}
