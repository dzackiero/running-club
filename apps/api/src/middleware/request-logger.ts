import { createMiddleware } from "hono/factory";
import { logger } from "../lib/logger";

type RequestLogEnv = {
  Variables: {
    requestId: string;
  };
};

export const requestLogger = createMiddleware<RequestLogEnv>(async (c, next) => {
  const requestId =
    c.req.header("x-request-id")?.trim() || crypto.randomUUID();
  const start = performance.now();

  c.set("requestId", requestId);

  const reqLog = logger.child({ requestId });

  await next();

  c.header("x-request-id", requestId);

  const durationMs = Math.round(performance.now() - start);
  const status = c.res.status;
  const payload = {
    method: c.req.method,
    path: c.req.path,
    status,
    durationMs,
    userAgent: c.req.header("user-agent"),
  };

  if (status >= 500) {
    reqLog.error(payload, "request completed");
  } else if (status >= 400) {
    reqLog.warn(payload, "request completed");
  } else {
    reqLog.info(payload, "request completed");
  }
});
