import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { clubNudge } from "../db/schema";
import { env } from "../env";
import { sendEmail } from "../lib/resend";
import { logger } from "../lib/logger";
import {
  getPreviousMonthBounds,
  getPreviousWeekBounds,
} from "../lib/period";
import {
  captureClosedPeriodResults,
  listClubMembersForNudge,
  listClubPeriodSnapshots,
  listClubsWithTargets,
} from "../services/clubs";

export const CLUB_NUDGE_INTERVAL_MS = 60 * 60 * 1000;

export type ClubNudgeMailer = (input: {
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

async function alreadySent(
  clubId: string,
  userId: string,
  period: "week" | "month",
  periodStart: Date,
): Promise<boolean> {
  const rows = await db
    .select({ periodStart: clubNudge.periodStart })
    .from(clubNudge)
    .where(
      and(
        eq(clubNudge.clubId, clubId),
        eq(clubNudge.userId, userId),
        eq(clubNudge.period, period),
      ),
    );
  return rows.some((row) => row.periodStart.getTime() === periodStart.getTime());
}

async function markSent(
  clubId: string,
  userId: string,
  period: "week" | "month",
  periodStart: Date,
) {
  await db.insert(clubNudge).values({
    id: crypto.randomUUID(),
    clubId,
    userId,
    period,
    periodStart,
  });
}

export async function sendDueClubNudges(
  now: Date = new Date(),
  mailer: ClubNudgeMailer = sendEmail,
  onlyClubId?: string,
): Promise<{ sent: number; skipped: number }> {
  await captureClosedPeriodResults(now, onlyClubId);

  let sent = 0;
  let skipped = 0;
  const clubs = (await listClubsWithTargets()).filter(
    (row) => !onlyClubId || row.id === onlyClubId,
  );

  for (const row of clubs) {
    const members = await listClubMembersForNudge(row.id);
    const memberById = new Map(members.map((member) => [member.userId, member]));
    const windows: Array<{
      period: "week" | "month";
      start: Date;
    }> = [];

    if (row.weeklyTargetDistanceMeters != null) {
      windows.push({
        period: "week",
        start: getPreviousWeekBounds(now, row.weekStartsOn).weekStart,
      });
    }
    if (row.monthlyTargetDistanceMeters != null) {
      windows.push({
        period: "month",
        start: getPreviousMonthBounds(now).monthStart,
      });
    }

    for (const window of windows) {
      const snapshots = await listClubPeriodSnapshots(
        row.id,
        window.period,
        window.start,
      );
      for (const snap of snapshots) {
        if (snap.hit || snap.targetDistanceMeters == null || snap.targetDistanceMeters <= 0) {
          skipped += 1;
          continue;
        }
        const member = memberById.get(snap.userId);
        if (!member?.emailNotifications || !member.emailNudges || !member.email) {
          skipped += 1;
          continue;
        }
        if (await alreadySent(row.id, member.userId, window.period, window.start)) {
          skipped += 1;
          continue;
        }

        const clubUrl = `${env.WEB_ORIGIN}/clubs/${row.id}`;
        const text = [
          `Hey ${member.name?.trim() || "runner"},`,
          "",
          `Last ${window.period} in ${row.name} you ran ${formatKm(snap.distanceMeters)} km of the ${formatKm(snap.targetDistanceMeters)} km club target (${periodLabel(snap.periodStart, snap.periodEnd)}).`,
          "",
          `See the board: ${clubUrl}`,
        ].join("\n");

        const ok = await mailer({
          to: member.email,
          subject: `${row.name}: missed last ${window.period}'s target`,
          text,
        });
        if (!ok) {
          skipped += 1;
          continue;
        }
        try {
          await markSent(row.id, member.userId, window.period, window.start);
          sent += 1;
        } catch (err) {
          logger.warn({ err, clubId: row.id, userId: member.userId }, "Nudge already recorded");
          skipped += 1;
        }
      }
    }
  }

  return { sent, skipped };
}

export function startClubNudgePoller(
  intervalMs = CLUB_NUDGE_INTERVAL_MS,
): void {
  const tick = async () => {
    const result = await sendDueClubNudges();
    logger.info({ ...result, intervalMs }, "Club nudge poll finished");
  };

  const initial = setTimeout(() => {
    void tick();
    const repeating = setInterval(() => {
      void tick();
    }, intervalMs);
    repeating.unref?.();
  }, intervalMs);

  initial.unref?.();
  logger.info({ intervalMs }, "Club nudge poller scheduled");
}
