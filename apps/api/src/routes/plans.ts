import {
  createPlanTemplateSchema,
  errorCodes,
  updatePlanOccurrenceSchema,
} from "@running-club/shared";
import { Hono } from "hono";
import { ZodError } from "zod";
import type { AppEnv } from "../app";
import { jsonError } from "../lib/errors";
import {
  createPlanTemplate,
  listPlanTemplates,
  updatePlanOccurrence,
} from "../services/plans";

export const plansRoutes = new Hono<AppEnv>();

plansRoutes.get("/templates", async (c) => {
  const user = c.get("user")!;
  return c.json(await listPlanTemplates(user.id));
});

plansRoutes.post("/templates", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, errorCodes.VALIDATION, "Request body must be valid JSON");
  }

  try {
    const user = c.get("user")!;
    const template = await createPlanTemplate(
      user.id,
      createPlanTemplateSchema.parse(body),
    );
    return c.json(template, 201);
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(c, 400, errorCodes.VALIDATION, err.message);
    }
    throw err;
  }
});

plansRoutes.patch("/occurrences/:id", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, errorCodes.VALIDATION, "Request body must be valid JSON");
  }

  try {
    const user = c.get("user")!;
    const occurrence = await updatePlanOccurrence(
      user.id,
      c.req.param("id"),
      updatePlanOccurrenceSchema.parse(body),
    );
    if (!occurrence) {
      return jsonError(c, 404, errorCodes.NOT_FOUND, "Plan occurrence not found");
    }
    return c.json(occurrence);
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(c, 400, errorCodes.VALIDATION, err.message);
    }
    throw err;
  }
});
