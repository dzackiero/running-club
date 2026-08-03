import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../app";
import { jsonError } from "../lib/errors";

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return jsonError(c, 401, "UNAUTHORIZED", "Authentication required");
  }
  await next();
};
