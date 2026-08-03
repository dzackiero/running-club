import { upsertWeeklyGoalSchema } from "@running-club/shared";
import { Hono } from "hono";
import { ZodError } from "zod";
import type { AppEnv } from "../app";
import { jsonError } from "../lib/errors";
import { getCurrentGoal, upsertCurrentGoal } from "../services/goals";

export const goalsRoutes = new Hono<AppEnv>();

goalsRoutes.get("/current", async (c) => {
  const user = c.get("user")!;
  const goal = await getCurrentGoal(user.id);
  return c.json(goal);
});

goalsRoutes.put("/current", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, "INVALID_JSON", "Request body must be valid JSON");
  }

  try {
    const input = upsertWeeklyGoalSchema.parse(body);
    const user = c.get("user")!;
    const goal = await upsertCurrentGoal(user.id, input);
    return c.json(goal);
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(c, 400, "VALIDATION_ERROR", err.message);
    }
    throw err;
  }
});
