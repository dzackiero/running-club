import { errorCodes, type ErrorCode } from "@running-club/shared";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Context } from "hono";

export { errorCodes };
export type { ErrorCode };

export function jsonError(
  c: Context,
  status: ContentfulStatusCode,
  code: ErrorCode,
  message: string,
) {
  return c.json({ error: { code, message } }, status);
}
