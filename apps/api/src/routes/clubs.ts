import {
  clubBoardQuerySchema,
  clubPeriodResultsQuerySchema,
  createClubSchema,
  errorCodes,
  joinClubSchema,
  sendClubPeriodMessageSchema,
  updateClubMembershipSchema,
  updateClubSchema,
} from "@running-club/shared";
import { Hono } from "hono";
import { ZodError } from "zod";
import type { AppEnv } from "../app";
import { jsonError } from "../lib/errors";
import {
  ClubError,
  createClub,
  deleteClub,
  getClub,
  getClubBoard,
  getClubPeriodResults,
  joinClub,
  leaveClub,
  listClubs,
  removeMember,
  sendClubPeriodMissMessage,
  updateClub,
  updateMyMembership,
} from "../services/clubs";

export const clubsRoutes = new Hono<AppEnv>();

function clubErrorResponse(c: Parameters<typeof jsonError>[0], err: unknown) {
  if (err instanceof ZodError) {
    return jsonError(c, 400, errorCodes.VALIDATION, err.message);
  }
  if (err instanceof ClubError) {
    const status =
      err.code === "NOT_FOUND"
        ? 404
        : err.code === "FORBIDDEN"
          ? 403
          : err.code === "CONFLICT"
            ? 409
            : 400;
    return jsonError(c, status, errorCodes[err.code], err.message);
  }
  throw err;
}

clubsRoutes.get("/", async (c) => {
  const user = c.get("user")!;
  return c.json(await listClubs(user.id));
});

clubsRoutes.post("/", async (c) => {
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
    const input = createClubSchema.parse(body);
    const user = c.get("user")!;
    return c.json(await createClub(user.id, input), 201);
  } catch (err) {
    return clubErrorResponse(c, err);
  }
});

clubsRoutes.post("/join", async (c) => {
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
    const input = joinClubSchema.parse(body);
    const user = c.get("user")!;
    return c.json(await joinClub(user.id, input.inviteCode));
  } catch (err) {
    return clubErrorResponse(c, err);
  }
});

clubsRoutes.get("/:id/board", async (c) => {
  try {
    const offsetRaw = c.req.query("offset");
    const query = clubBoardQuerySchema.parse({
      period: c.req.query("period"),
      offset: offsetRaw == null || offsetRaw === "" ? undefined : Number(offsetRaw),
    });
    const user = c.get("user")!;
    return c.json(await getClubBoard(user.id, c.req.param("id"), query));
  } catch (err) {
    return clubErrorResponse(c, err);
  }
});

clubsRoutes.get("/:id/period-results", async (c) => {
  try {
    const offsetRaw = c.req.query("offset");
    const query = clubPeriodResultsQuerySchema.parse({
      period: c.req.query("period"),
      offset: offsetRaw == null || offsetRaw === "" ? undefined : Number(offsetRaw),
    });
    const user = c.get("user")!;
    return c.json(await getClubPeriodResults(user.id, c.req.param("id"), query));
  } catch (err) {
    return clubErrorResponse(c, err);
  }
});

clubsRoutes.post("/:id/period-results/message", async (c) => {
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
    const input = sendClubPeriodMessageSchema.parse(body);
    const user = c.get("user")!;
    return c.json(
      await sendClubPeriodMissMessage(user.id, c.req.param("id"), input),
    );
  } catch (err) {
    return clubErrorResponse(c, err);
  }
});

clubsRoutes.get("/:id", async (c) => {
  try {
    const user = c.get("user")!;
    return c.json(await getClub(user.id, c.req.param("id")));
  } catch (err) {
    return clubErrorResponse(c, err);
  }
});

clubsRoutes.patch("/:id", async (c) => {
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
    const input = updateClubSchema.parse(body);
    const user = c.get("user")!;
    return c.json(await updateClub(user.id, c.req.param("id"), input));
  } catch (err) {
    return clubErrorResponse(c, err);
  }
});

clubsRoutes.delete("/:id", async (c) => {
  try {
    const user = c.get("user")!;
    await deleteClub(user.id, c.req.param("id"));
    return c.body(null, 204);
  } catch (err) {
    return clubErrorResponse(c, err);
  }
});

clubsRoutes.post("/:id/leave", async (c) => {
  try {
    const user = c.get("user")!;
    await leaveClub(user.id, c.req.param("id"));
    return c.body(null, 204);
  } catch (err) {
    return clubErrorResponse(c, err);
  }
});

clubsRoutes.patch("/:id/me", async (c) => {
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
    const input = updateClubMembershipSchema.parse(body);
    const user = c.get("user")!;
    return c.json(
      await updateMyMembership(user.id, c.req.param("id"), input.emailNudges),
    );
  } catch (err) {
    return clubErrorResponse(c, err);
  }
});

clubsRoutes.delete("/:id/members/:userId", async (c) => {
  try {
    const user = c.get("user")!;
    await removeMember(user.id, c.req.param("id"), c.req.param("userId"));
    return c.body(null, 204);
  } catch (err) {
    return clubErrorResponse(c, err);
  }
});
