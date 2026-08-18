import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../db/client";
import {
  gymExercise,
  gymSet,
  gymWorkout,
  planOccurrence,
} from "../db/schema";
import { deleteTestUsers, ensureTestUsers } from "../test/users";
import { createGymWorkout } from "./gym";

const userId = "user_test_gym";
const otherUserId = "user_test_gym_other";

describe("gym service", () => {
  beforeAll(async () => {
    await ensureTestUsers([userId, otherUserId]);
  });

  afterAll(async () => {
    await deleteTestUsers([userId, otherUserId]);
  });

  it("creates exercises and sets while completing its linked gym occurrence", async () => {
    const occurrenceId = crypto.randomUUID();
    await db.insert(planOccurrence).values({
      id: occurrenceId,
      userId,
      date: "2026-08-18",
      category: "gym",
      title: "Upper body",
      details: { focus: "upper" },
    });

    const created = await createGymWorkout(userId, {
      occurredAt: "2026-08-18T06:30:00.000Z",
      planOccurrenceId: occurrenceId,
      notes: "Steady session",
      exercises: [
        {
          name: "Bench press",
          position: 0,
          sets: [
            { position: 0, reps: 8, loadKg: 60, rpe: 7 },
            { position: 1, reps: 8, loadKg: 62.5 },
          ],
        },
      ],
    });

    expect(created.planOccurrenceId).toBe(occurrenceId);
    expect(created.exercises).toEqual([
      expect.objectContaining({
        name: "Bench press",
        position: 0,
        sets: [
          expect.objectContaining({ position: 0, reps: 8, loadKg: 60, rpe: 7 }),
          expect.objectContaining({ position: 1, reps: 8, loadKg: 62.5, rpe: null }),
        ],
      }),
    ]);

    const [storedWorkout] = await db
      .select()
      .from(gymWorkout)
      .where(eq(gymWorkout.id, created.id));
    const exercises = await db
      .select()
      .from(gymExercise)
      .where(eq(gymExercise.workoutId, created.id));
    const sets = await db
      .select()
      .from(gymSet)
      .where(eq(gymSet.exerciseId, exercises[0]!.id));
    const [occurrence] = await db
      .select()
      .from(planOccurrence)
      .where(eq(planOccurrence.id, occurrenceId));

    expect(storedWorkout?.planOccurrenceId).toBe(occurrenceId);
    expect(exercises).toHaveLength(1);
    expect(sets).toHaveLength(2);
    expect(occurrence).toMatchObject({
      status: "done",
      linkedGymWorkoutId: created.id,
    });
    expect(occurrence?.completedAt).toBeInstanceOf(Date);
  });

  it("rejects a linked occurrence that is not the user's gym plan", async () => {
    const runOccurrenceId = crypto.randomUUID();
    const otherOccurrenceId = crypto.randomUUID();
    await db.insert(planOccurrence).values([
      {
        id: runOccurrenceId,
        userId,
        date: "2026-08-19",
        category: "run",
        title: "Easy run",
        details: {},
      },
      {
        id: otherOccurrenceId,
        userId: otherUserId,
        date: "2026-08-19",
        category: "gym",
        title: "Other user's gym",
        details: {},
      },
    ]);

    const input = {
      occurredAt: "2026-08-19T06:30:00.000Z",
      exercises: [
        {
          name: "Squat",
          position: 0,
          sets: [{ position: 0, reps: 5, loadKg: 100 }],
        },
      ],
    };

    await expect(
      createGymWorkout(userId, { ...input, planOccurrenceId: runOccurrenceId }),
    ).rejects.toThrow("gym plan occurrence");
    await expect(
      createGymWorkout(userId, { ...input, planOccurrenceId: otherOccurrenceId }),
    ).rejects.toThrow("gym plan occurrence");

    const workouts = await db
      .select()
      .from(gymWorkout)
      .where(
        and(
          eq(gymWorkout.userId, userId),
          eq(gymWorkout.occurredAt, new Date(input.occurredAt)),
        ),
      );
    expect(workouts).toHaveLength(0);
  });
});
