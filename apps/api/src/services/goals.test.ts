import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db/client";
import { weeklyGoal } from "../db/schema";
import { deleteTestUsers, ensureTestUsers } from "../test/users";
import { getCurrentGoal, upsertCurrentGoal } from "./goals";

const userId = "user_test_goals_1";
const testUserIds = [userId];

describe("goals service", () => {
  beforeAll(async () => {
    await ensureTestUsers(testUserIds);
  });

  afterAll(async () => {
    await deleteTestUsers(testUserIds);
  });

  it("upsert replaces previous active goal", async () => {
    const first = await upsertCurrentGoal(userId, {
      weekStartsOn: 1,
      targetDistanceMeters: 30000,
    });
    const second = await upsertCurrentGoal(userId, {
      weekStartsOn: 1,
      targetDistanceMeters: 40000,
      targetRunCount: 4,
    });
    expect(second.active).toBe(true);
    expect(second.targetDistanceMeters).toBe(40000);
    const current = await getCurrentGoal(userId);
    expect(current?.id).toBe(second.id);
    expect(current?.id).not.toBe(first.id);

    const activeGoals = await db
      .select()
      .from(weeklyGoal)
      .where(and(eq(weeklyGoal.userId, userId), eq(weeklyGoal.active, true)));
    expect(activeGoals).toHaveLength(1);
    expect(activeGoals[0]?.id).toBe(second.id);

    const [firstRow] = await db
      .select()
      .from(weeklyGoal)
      .where(eq(weeklyGoal.id, first.id));
    expect(firstRow?.active).toBe(false);
  });
});
