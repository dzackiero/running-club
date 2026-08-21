import {
  createPlanTemplateSchema,
  errorCodes,
  updatePlanOccurrenceSchema,
  updatePlanTemplateSchema,
} from "@running-club/shared";
import { Hono } from "hono";
import { ZodError } from "zod";
import type { AppEnv } from "../app";
import { jsonError } from "../lib/errors";
import {
  createPlanTemplate,
  deletePlanTemplate,
  listPlanTemplates,
  updatePlanOccurrence,
  updatePlanTemplate,
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

plansRoutes.put("/templates/:id", async (c) => {
  let body: unknown;
  try { body = await c.req.json(); } catch { return jsonError(c, 400, errorCodes.VALIDATION, "Request body must be valid JSON"); }
  try {
    const template = await updatePlanTemplate(c.get("user")!.id, c.req.param("id"), updatePlanTemplateSchema.parse(body));
    if (!template) return jsonError(c, 404, errorCodes.NOT_FOUND, "Plan template not found");
    return c.json(template);
  } catch (err) {
    if (err instanceof ZodError) return jsonError(c, 400, errorCodes.VALIDATION, err.message);
    throw err;
  }
});

plansRoutes.delete("/templates/:id", async (c) => {
  const deleted = await deletePlanTemplate(c.get("user")!.id, c.req.param("id"));
  if (!deleted) return jsonError(c, 404, errorCodes.NOT_FOUND, "Plan template not found");
  return c.body(null, 204);
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
