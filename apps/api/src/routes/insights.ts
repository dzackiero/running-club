import { summaryQuerySchema } from "@running-club/shared";
import { Hono } from "hono";
import { ZodError } from "zod";
import type { AppEnv } from "../app";
import { jsonError } from "../lib/errors";
import { getSummary, getWeekProgress } from "../services/insights";

export const insightsRoutes = new Hono<AppEnv>();

insightsRoutes.get("/summary", async (c) => {
  const { from, to } = c.req.query();

  try {
    const query = summaryQuerySchema.parse({ from, to });
    const user = c.get("user")!;
    const summary = await getSummary(user.id, query);
    return c.json(summary);
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(c, 400, "VALIDATION_ERROR", err.message);
    }
    throw err;
  }
});

insightsRoutes.get("/week", async (c) => {
  const user = c.get("user")!;
  const progress = await getWeekProgress(user.id);
  return c.json(progress);
});
