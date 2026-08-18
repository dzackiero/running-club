import { describe, expect, it } from "vitest";
import { createGymWorkoutSchema } from "./gym";

const workout = {
  occurredAt: "2026-08-18T06:30:00.000Z",
  notes: "Steady session",
  exercises: [
    {
      name: "Back squat",
      position: 0,
      sets: [
        { position: 0, reps: 5, loadKg: 80, rpe: 7 },
        { position: 1, reps: 5, loadKg: 82.5, rpe: 8 },
      ],
    },
    {
      name: "Bench press",
      position: 1,
      sets: [{ position: 0, reps: 8, loadKg: 60 }],
    },
  ],
};

describe("createGymWorkoutSchema", () => {
  it("accepts a workout with ordered exercises and sets", () => {
    const parsed = createGymWorkoutSchema.parse(workout);

    expect(parsed.exercises.map((exercise) => exercise.position)).toEqual([0, 1]);
    expect(parsed.exercises[0]?.sets.map((set) => set.position)).toEqual([0, 1]);
  });

  it("rejects a set with zero reps", () => {
    expect(() =>
      createGymWorkoutSchema.parse({
        ...workout,
        exercises: [
          { ...workout.exercises[0]!, sets: [{ position: 0, reps: 0, loadKg: 80 }] },
        ],
      }),
    ).toThrow();
  });

  it("rejects a set with a negative load", () => {
    expect(() =>
      createGymWorkoutSchema.parse({
        ...workout,
        exercises: [
          { ...workout.exercises[0]!, sets: [{ position: 0, reps: 5, loadKg: -1 }] },
        ],
      }),
    ).toThrow();
  });

  it("rejects duplicate exercise positions", () => {
    expect(() =>
      createGymWorkoutSchema.parse({
        ...workout,
        exercises: [
          workout.exercises[0]!,
          { ...workout.exercises[1]!, position: 0 },
        ],
      }),
    ).toThrow();
  });

  it("rejects duplicate set positions within an exercise", () => {
    expect(() =>
      createGymWorkoutSchema.parse({
        ...workout,
        exercises: [
          {
            ...workout.exercises[0]!,
            sets: [
              { position: 0, reps: 5, loadKg: 80 },
              { position: 0, reps: 5, loadKg: 82.5 },
            ],
          },
        ],
      }),
    ).toThrow();
  });
});
