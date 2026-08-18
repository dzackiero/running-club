import { createGymWorkoutSchema, errorCodes } from "@running-club/shared";
import { Hono } from "hono";
import { ZodError } from "zod";
import type { AppEnv } from "../app";
import { jsonError } from "../lib/errors";
import {
  createGymWorkout,
  GymWorkoutError,
  listGymWorkouts,
} from "../services/gym";

export const gymRoutes = new Hono<AppEnv>();

gymRoutes.get("/workouts", async (c) => {
  const user = c.get("user")!;
  return c.json(await listGymWorkouts(user.id));
});

gymRoutes.post("/workouts", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(
      c,
      400,
      errorCodes.VALIDATION,
      "Request body must be valid JSON",
    );
  }

  try {
    const user = c.get("user")!;
    const workout = await createGymWorkout(
      user.id,
      createGymWorkoutSchema.parse(body),
    );
    return c.json(workout, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(c, 400, errorCodes.VALIDATION, err.message);
    }
    if (err instanceof GymWorkoutError) {
      return jsonError(c, 404, errorCodes.NOT_FOUND, err.message);
    }
    throw err;
  }
});
