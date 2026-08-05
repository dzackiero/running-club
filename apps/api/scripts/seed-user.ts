import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { run, user } from "../src/db/schema";
import { createRun } from "../src/services/runs";
import { upsertCurrentGoal } from "../src/services/goals";

const userId = process.argv[2];

if (!userId) {
  console.error("Usage: tsx scripts/seed-user.ts <userId>");
  process.exit(1);
}

function atLocal(daysAgo: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

const seeds: Array<{
  daysAgo: number;
  hour: number;
  km: number;
  minutes: number;
  activityType: "run" | "walk" | "trail" | "treadmill";
  notes?: string;
  perceivedEffort?: number;
}> = [
  { daysAgo: 1, hour: 6, km: 5.2, minutes: 28, activityType: "run", notes: "Easy morning loop", perceivedEffort: 4 },
  { daysAgo: 2, hour: 18, km: 8.0, minutes: 44, activityType: "run", notes: "Tempo after work", perceivedEffort: 7 },
  { daysAgo: 4, hour: 7, km: 3.5, minutes: 32, activityType: "walk", notes: "Recovery walk" },
  { daysAgo: 5, hour: 6, km: 10.1, minutes: 55, activityType: "run", notes: "Longer Sunday-ish", perceivedEffort: 6 },
  { daysAgo: 8, hour: 6, km: 6.0, minutes: 33, activityType: "run", perceivedEffort: 5 },
  { daysAgo: 9, hour: 17, km: 4.2, minutes: 24, activityType: "treadmill", notes: "Indoor rain day", perceivedEffort: 5 },
  { daysAgo: 11, hour: 7, km: 12.0, minutes: 68, activityType: "trail", notes: "Hills", perceivedEffort: 8 },
  { daysAgo: 14, hour: 6, km: 5.0, minutes: 27, activityType: "run", perceivedEffort: 4 },
  { daysAgo: 16, hour: 18, km: 7.5, minutes: 41, activityType: "run", notes: "Steady", perceivedEffort: 6 },
  { daysAgo: 18, hour: 7, km: 4.0, minutes: 22, activityType: "run", perceivedEffort: 5 },
  { daysAgo: 21, hour: 6, km: 9.0, minutes: 50, activityType: "run", notes: "Good week", perceivedEffort: 6 },
  { daysAgo: 23, hour: 17, km: 5.5, minutes: 30, activityType: "run", perceivedEffort: 5 },
  { daysAgo: 25, hour: 6, km: 3.0, minutes: 28, activityType: "walk" },
  { daysAgo: 28, hour: 7, km: 6.5, minutes: 36, activityType: "run", perceivedEffort: 5 },
  { daysAgo: 32, hour: 6, km: 8.5, minutes: 47, activityType: "run", notes: "Prior block", perceivedEffort: 6 },
  { daysAgo: 35, hour: 18, km: 4.8, minutes: 26, activityType: "run", perceivedEffort: 4 },
  { daysAgo: 39, hour: 7, km: 11.0, minutes: 62, activityType: "trail", perceivedEffort: 7 },
  { daysAgo: 42, hour: 6, km: 5.0, minutes: 28, activityType: "run", perceivedEffort: 5 },
  { daysAgo: 46, hour: 17, km: 7.0, minutes: 39, activityType: "run", perceivedEffort: 6 },
  { daysAgo: 49, hour: 6, km: 4.5, minutes: 25, activityType: "run", perceivedEffort: 4 },
];

async function main() {
  const [existing] = await db.select().from(user).where(eq(user.id, userId));
  if (!existing) {
    console.error(`User not found: ${userId}`);
    process.exit(1);
  }

  console.log(`Seeding ${existing.email} (${existing.id})…`);

  await upsertCurrentGoal(userId, {
    weekStartsOn: 1,
    targetDistanceMeters: 20000,
    targetRunCount: 3,
  });
  console.log("Weekly goal: 20 km · 3 runs · week starts Monday");

  const existingRuns = await db.select({ id: run.id }).from(run).where(eq(run.userId, userId));
  if (existingRuns.length > 0) {
    console.log(`User already has ${existingRuns.length} runs — adding seed runs on top.`);
  }

  let created = 0;
  for (const seed of seeds) {
    await createRun(userId, {
      startedAt: atLocal(seed.daysAgo, seed.hour),
      distanceMeters: Math.round(seed.km * 1000),
      durationSeconds: Math.round(seed.minutes * 60),
      activityType: seed.activityType,
      notes: seed.notes,
      perceivedEffort: seed.perceivedEffort,
      source: "manual",
    });
    created += 1;
  }

  console.log(`Created ${created} runs across ~7 weeks.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
