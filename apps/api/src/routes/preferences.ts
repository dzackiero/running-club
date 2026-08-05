import { errorCodes, updatePreferencesSchema } from "@running-club/shared";
import { Hono } from "hono";
import { ZodError } from "zod";
import type { AppEnv } from "../app";
import { jsonError } from "../lib/errors";
import { getPreferences, updatePreferences } from "../services/preferences";

export const preferencesRoutes = new Hono<AppEnv>();

preferencesRoutes.get("/", async (c) => {
  const sessionUser = c.get("user")!;
  return c.json(await getPreferences(sessionUser.id));
});

preferencesRoutes.patch("/", async (c) => {
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
    const input = updatePreferencesSchema.parse(body);
    const sessionUser = c.get("user")!;
    return c.json(await updatePreferences(sessionUser.id, input));
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(c, 400, errorCodes.VALIDATION, err.message);
    }
    throw err;
  }
});
