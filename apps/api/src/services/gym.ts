import type {
  CreateGymWorkoutInput,
  GymExerciseRecord,
  GymSetRecord,
  GymWorkoutRecord,
} from "@running-club/shared";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import {
  gymExercise,
  gymSet,
  gymWorkout,
  planOccurrence,
} from "../db/schema";

export class GymWorkoutError extends Error {}

type GymWorkoutRow = typeof gymWorkout.$inferSelect;
type GymExerciseRow = typeof gymExercise.$inferSelect;
type GymSetRow = typeof gymSet.$inferSelect;

function toGymSetRecord(row: GymSetRow): GymSetRecord {
  return {
    id: row.id,
    exerciseId: row.exerciseId,
    position: row.position,
    reps: row.reps,
    loadKg: row.loadKg,
    rpe: row.rpe,
  };
}

function toGymWorkoutRecord(
  row: GymWorkoutRow,
  exercises: GymExerciseRow[],
  sets: GymSetRow[],
): GymWorkoutRecord {
  const setsByExerciseId = new Map<string, GymSetRecord[]>();
  for (const set of sets) {
    const current = setsByExerciseId.get(set.exerciseId) ?? [];
    current.push(toGymSetRecord(set));
    setsByExerciseId.set(set.exerciseId, current);
  }

  const records: GymExerciseRecord[] = exercises.map((exercise) => ({
    id: exercise.id,
    workoutId: exercise.workoutId,
    name: exercise.name,
    position: exercise.position,
    sets: (setsByExerciseId.get(exercise.id) ?? []).sort(
      (left, right) => left.position - right.position,
    ),
  }));

  return {
    id: row.id,
    userId: row.userId,
    occurredAt: row.occurredAt.toISOString(),
    planOccurrenceId: row.planOccurrenceId,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    exercises: records.sort((left, right) => left.position - right.position),
  };
}

export async function createGymWorkout(
  userId: string,
  input: CreateGymWorkoutInput,
): Promise<GymWorkoutRecord> {
  return db.transaction(async (tx) => {
    const workoutId = crypto.randomUUID();
    const now = new Date();

    if (input.planOccurrenceId) {
      const [occurrence] = await tx
        .select({ id: planOccurrence.id })
        .from(planOccurrence)
        .where(
          and(
            eq(planOccurrence.id, input.planOccurrenceId),
            eq(planOccurrence.userId, userId),
            eq(planOccurrence.category, "gym"),
          ),
        )
        .limit(1);
      if (!occurrence) {
        throw new GymWorkoutError("Linked gym plan occurrence was not found");
      }
    }

    const [workout] = await tx
      .insert(gymWorkout)
      .values({
        id: workoutId,
        userId,
        occurredAt: new Date(input.occurredAt),
        planOccurrenceId: input.planOccurrenceId,
        notes: input.notes,
      })
      .returning();

    const exercises = input.exercises.map((exercise) => ({
      id: crypto.randomUUID(),
      workoutId,
      name: exercise.name,
      position: exercise.position,
    }));
    const insertedExercises = await tx
      .insert(gymExercise)
      .values(exercises)
      .returning();

    const exerciseIdsByPosition = new Map(
      exercises.map((exercise) => [exercise.position, exercise.id]),
    );
    const sets = input.exercises.flatMap((exercise) =>
      exercise.sets.map((set) => ({
        id: crypto.randomUUID(),
        exerciseId: exerciseIdsByPosition.get(exercise.position)!,
        position: set.position,
        reps: set.reps,
        loadKg: set.loadKg,
        rpe: set.rpe,
      })),
    );
    const insertedSets = await tx.insert(gymSet).values(sets).returning();

    if (input.planOccurrenceId) {
      const [completed] = await tx
        .update(planOccurrence)
        .set({
          status: "done",
          linkedGymWorkoutId: workoutId,
          completedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(planOccurrence.id, input.planOccurrenceId),
            eq(planOccurrence.userId, userId),
            eq(planOccurrence.category, "gym"),
          ),
        )
        .returning({ id: planOccurrence.id });
      if (!completed) {
        throw new GymWorkoutError("Linked gym plan occurrence was not found");
      }
    }

    return toGymWorkoutRecord(workout!, insertedExercises, insertedSets);
  });
}

export async function listGymWorkouts(
  userId: string,
): Promise<GymWorkoutRecord[]> {
  const workouts = await db
    .select()
    .from(gymWorkout)
    .where(eq(gymWorkout.userId, userId))
    .orderBy(desc(gymWorkout.occurredAt));
  if (workouts.length === 0) return [];

  const exercises = await db
    .select()
    .from(gymExercise)
    .where(inArray(gymExercise.workoutId, workouts.map((workout) => workout.id)))
    .orderBy(asc(gymExercise.position));
  const sets = exercises.length
    ? await db
        .select()
        .from(gymSet)
        .where(inArray(gymSet.exerciseId, exercises.map((exercise) => exercise.id)))
        .orderBy(asc(gymSet.position))
    : [];

  const exercisesByWorkoutId = new Map<string, GymExerciseRow[]>();
  for (const exercise of exercises) {
    const current = exercisesByWorkoutId.get(exercise.workoutId) ?? [];
    current.push(exercise);
    exercisesByWorkoutId.set(exercise.workoutId, current);
  }

  return workouts.map((workout) =>
    toGymWorkoutRecord(
      workout,
      exercisesByWorkoutId.get(workout.id) ?? [],
      sets,
    ),
  );
}
