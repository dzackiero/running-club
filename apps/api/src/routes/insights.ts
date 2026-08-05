import {
  errorCodes,
  overviewQuerySchema,
  summaryQuerySchema,
  weekQuerySchema,
} from "@running-club/shared";
import { Hono } from "hono";
import { ZodError } from "zod";
import type { AppEnv } from "../app";
import { jsonError } from "../lib/errors";
import { getSummary, getWeekProgress, getInsightsOverview } from "../services/insights";

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
      return jsonError(c, 400, errorCodes.VALIDATION, err.message);
    }
    throw err;
  }
});

insightsRoutes.get("/week", async (c) => {
  const { at } = c.req.query();

  try {
    const query = weekQuerySchema.parse({ at: at || undefined });
    const user = c.get("user")!;
    const now = query.at ? new Date(query.at) : new Date();
    const progress = await getWeekProgress(user.id, now);
    return c.json(progress);
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(c, 400, errorCodes.VALIDATION, err.message);
    }
    throw err;
  }
});

insightsRoutes.get("/overview", async (c) => {
  const { from, to } = c.req.query();

  try {
    const query = overviewQuerySchema.parse({
      from: from || undefined,
      to: to || undefined,
    });
    const user = c.get("user")!;
    const overview = await getInsightsOverview(user.id, {
      from: query.from,
      to: query.to,
    });
    return c.json(overview);
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(c, 400, errorCodes.VALIDATION, err.message);
    }
    throw err;
  }
});
