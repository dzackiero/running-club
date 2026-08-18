import { z } from "zod";

export const gymSetSchema = z.object({
  position: z.number().int().nonnegative(),
  reps: z.number().int().positive(),
  loadKg: z.number().nonnegative(),
  rpe: z.number().min(1).max(10).optional(),
});
export type GymSetInput = z.infer<typeof gymSetSchema>;

export const gymExerciseSchema = z
  .object({
    name: z.string().min(1).max(200),
    position: z.number().int().nonnegative(),
    sets: z.array(gymSetSchema).min(1),
  })
  .superRefine((exercise, context) => {
    const positions = new Set(exercise.sets.map((set) => set.position));
    if (positions.size !== exercise.sets.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "set positions must be unique",
        path: ["sets"],
      });
    }
  });
export type GymExerciseInput = z.infer<typeof gymExerciseSchema>;

export const createGymWorkoutSchema = z
  .object({
    occurredAt: z.string().datetime(),
    planOccurrenceId: z.string().min(1).optional(),
    notes: z.string().max(2000).optional(),
    exercises: z.array(gymExerciseSchema).min(1),
  })
  .superRefine((workout, context) => {
    const positions = new Set(workout.exercises.map((exercise) => exercise.position));
    if (positions.size !== workout.exercises.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "exercise positions must be unique",
        path: ["exercises"],
      });
    }
  });
export type CreateGymWorkoutInput = z.infer<typeof createGymWorkoutSchema>;

export type GymSetRecord = {
  id: string;
  exerciseId: string;
  position: number;
  reps: number;
  loadKg: number;
  rpe: number | null;
};

export type GymExerciseRecord = {
  id: string;
  workoutId: string;
  name: string;
  position: number;
  sets: GymSetRecord[];
};

export type GymWorkoutRecord = {
  id: string;
  userId: string;
  occurredAt: string;
  planOccurrenceId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  exercises: GymExerciseRecord[];
};
