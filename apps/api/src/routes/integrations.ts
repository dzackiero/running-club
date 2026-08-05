import { errorCodes } from "@running-club/shared";
import { Hono } from "hono";
import { z, ZodError } from "zod";
import type { AppEnv } from "../app";
import { createIntervalsClient } from "../integrations/intervals/client";
import { jsonError } from "../lib/errors";
import {
  deleteUserIntegration,
  getUserIntegrationSecret,
  getUserIntegrationStatus,
  markIntegrationSynced,
  upsertUserIntegration,
} from "../services/integrations";
import { importFromIntervals } from "../services/intervals-import";

export const integrationsRoutes = new Hono<AppEnv>();

const saveIntervalsSchema = z.object({
  apiKey: z.string().trim().min(8).max(200),
});

integrationsRoutes.get("/intervals", async (c) => {
  const user = c.get("user")!;
  return c.json(await getUserIntegrationStatus(user.id, "intervals"));
});

integrationsRoutes.put("/intervals", async (c) => {
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
    const input = saveIntervalsSchema.parse(body);
    const user = c.get("user")!;
    const status = await upsertUserIntegration(user.id, "intervals", input.apiKey);
    return c.json(status);
  } catch (err) {
    if (err instanceof ZodError) {
      return jsonError(c, 400, errorCodes.VALIDATION, "Enter a valid API key");
    }
    throw err;
  }
});

integrationsRoutes.delete("/intervals", async (c) => {
  const user = c.get("user")!;
  await deleteUserIntegration(user.id, "intervals");
  return c.body(null, 204);
});

integrationsRoutes.post("/intervals/import", async (c) => {
  const user = c.get("user")!;
  const apiKey = await getUserIntegrationSecret(user.id, "intervals");
  if (!apiKey) {
    return jsonError(
      c,
      400,
      errorCodes.VALIDATION,
      "Save your Intervals.icu API key first",
    );
  }

  const result = await importFromIntervals(
    user.id,
    createIntervalsClient(apiKey),
  );
  await markIntegrationSynced(user.id, "intervals");
  return c.json(result);
});
