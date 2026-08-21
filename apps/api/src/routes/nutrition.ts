import {
  confirmMealDraftSchema,
  createMealDraftSchema,
  errorCodes,
  updateNutritionDaySchema,
} from "@running-club/shared";
import { Hono } from "hono";
import { ZodError, z } from "zod";
import type { AppEnv } from "../app";
import { jsonError } from "../lib/errors";
import {
  NutritionError,
  confirmMealDraft,
  createMealDraft,
  discardMealDraft,
  getNutritionProgress,
  listRecentConfirmedMeals,
  listMeals,
  updateNutritionDay,
} from "../services/nutrition";

export const nutritionRoutes = new Hono<AppEnv>();

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((date) => new Date(`${date}T00:00:00.000Z`).toISOString().startsWith(date), {
    message: "Expected a valid YYYY-MM-DD date",
  });

function validationError(c: Parameters<typeof jsonError>[0], err: ZodError) {
  return jsonError(c, 400, errorCodes.VALIDATION, err.message);
}

async function requestJson(c: Parameters<typeof jsonError>[0]) {
  try {
    return await c.req.json();
  } catch {
    return jsonError(c, 400, errorCodes.VALIDATION, "Request body must be valid JSON");
  }
}

nutritionRoutes.get("/days/:date", async (c) => {
  try {
    const date = dateSchema.parse(c.req.param("date"));
    return c.json(await getNutritionProgress(c.get("user")!.id, date));
  } catch (err) {
    if (err instanceof ZodError) return validationError(c, err);
    throw err;
  }
});

nutritionRoutes.put("/days/:date", async (c) => {
  const body = await requestJson(c);
  if (body instanceof Response) return body;

  try {
    const date = dateSchema.parse(c.req.param("date"));
    const input = updateNutritionDaySchema.parse(body);
    return c.json(await updateNutritionDay(c.get("user")!.id, date, input));
  } catch (err) {
    if (err instanceof ZodError) return validationError(c, err);
    throw err;
  }
});

nutritionRoutes.get("/meals", async (c) => {
  try {
    const date = dateSchema.parse(c.req.query("date"));
    return c.json(await listMeals(c.get("user")!.id, date));
  } catch (err) {
    if (err instanceof ZodError) return validationError(c, err);
    throw err;
  }
});

nutritionRoutes.get("/meals/recent", async (c) => {
  try {
    const limit = z.coerce.number().int().positive().max(100).catch(30).parse(
      c.req.query("limit"),
    );
    return c.json(await listRecentConfirmedMeals(c.get("user")!.id, limit));
  } catch (err) {
    if (err instanceof ZodError) return validationError(c, err);
    throw err;
  }
});

nutritionRoutes.post("/meals", async (c) => {
  const body = await requestJson(c);
  if (body instanceof Response) return body;

  try {
    const input = createMealDraftSchema.parse(body);
    return c.json(await createMealDraft(c.get("user")!.id, input), 201);
  } catch (err) {
    if (err instanceof ZodError) return validationError(c, err);
    throw err;
  }
});

nutritionRoutes.post("/meals/:id/confirm", async (c) => {
  const body = await requestJson(c);
  if (body instanceof Response) return body;

  try {
    const input = confirmMealDraftSchema.parse(body);
    return c.json(await confirmMealDraft(c.get("user")!.id, c.req.param("id"), input));
  } catch (err) {
    if (err instanceof ZodError) return validationError(c, err);
    if (err instanceof NutritionError) {
      return jsonError(c, 404, errorCodes.NOT_FOUND, "Meal draft not found");
    }
    throw err;
  }
});

nutritionRoutes.post("/meals/:id/discard", async (c) => {
  try {
    return c.json(await discardMealDraft(c.get("user")!.id, c.req.param("id")));
  } catch (err) {
    if (err instanceof NutritionError) {
      return jsonError(c, 404, errorCodes.NOT_FOUND, "Meal draft not found");
    }
    throw err;
  }
});
