import { createRunSchema, updateRunSchema } from "@running-club/shared";
import { Hono } from "hono";
import { ZodError } from "zod";
import type { AppEnv } from "../app";
import { jsonError } from "../lib/errors";
import {
  createRun,
  deleteRun,
  getRun,
  listRuns,
  updateRun,
} from "../services/runs";

export const runsRoutes = new Hono<AppEnv>();

runsRoutes.post("/", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, "INVALID_JSON", "Request body must be valid JSON");
  }

  try {
    const input = createRunSchema.parse(body);
    const user = c.get("user")!;
    const run = await createRun(user.id, input);
    return c.json(run, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(c, 400, "VALIDATION_ERROR", err.message);
    }
    throw err;
  }
});

runsRoutes.get("/", async (c) => {
  const user = c.get("user")!;
  const { from, to, activityType, limit, cursor } = c.req.query();

  const runs = await listRuns(user.id, {
    from,
    to,
    activityType,
    limit: limit ? Number(limit) : undefined,
    cursor,
  });

  return c.json(runs);
});

runsRoutes.get("/:id", async (c) => {
  const user = c.get("user")!;
  const run = await getRun(user.id, c.req.param("id"));

  if (!run) {
    return jsonError(c, 404, "NOT_FOUND", "Run not found");
  }

  return c.json(run);
});

runsRoutes.patch("/:id", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, "INVALID_JSON", "Request body must be valid JSON");
  }

  try {
    const input = updateRunSchema.parse(body);
    const user = c.get("user")!;
    const run = await updateRun(user.id, c.req.param("id"), input);

    if (!run) {
      return jsonError(c, 404, "NOT_FOUND", "Run not found");
    }

    return c.json(run);
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(c, 400, "VALIDATION_ERROR", err.message);
    }
    throw err;
  }
});

runsRoutes.delete("/:id", async (c) => {
  const user = c.get("user")!;
  const deleted = await deleteRun(user.id, c.req.param("id"));

  if (!deleted) {
    return jsonError(c, 404, "NOT_FOUND", "Run not found");
  }

  return c.body(null, 204);
});
