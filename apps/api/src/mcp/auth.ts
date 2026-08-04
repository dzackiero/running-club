import { verifyJwsAccessToken } from "better-auth/oauth2";
import { decodeJwt } from "jose";
import { auth } from "../auth";
import { env } from "../env";
import { logger } from "../lib/logger";

/** OAuth authorization server issuer (Better Auth default basePath `/api/auth`). */
export const AUTH_ISSUER = `${env.BETTER_AUTH_URL}/api/auth`;

/** MCP resource identifier — must match `aud` claim in issued access tokens. */
export const MCP_RESOURCE = `${env.API_PUBLIC_URL}/mcp`;

const JWKS_PATH = "/api/auth/jwks";

const PROTECTED_RESOURCE_CACHE_CONTROL =
  "public, max-age=15, stale-while-revalidate=15, stale-if-error=86400";

function extractBearerToken(req: Request): string | undefined {
  const authorization = req.headers.get("authorization");
  if (!authorization) return undefined;
  // RFC 6750: only the Bearer scheme is accepted for MCP access tokens
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization);
  return match?.[1];
}

/** Serve JWKS via the in-process Better Auth handler (no self-HTTP round-trip). */
async function fetchJwksLocally() {
  const res = await auth.handler(
    new Request(new URL(JWKS_PATH, env.BETTER_AUTH_URL)),
  );
  if (!res.ok) {
    throw new Error(`JWKS endpoint returned ${res.status}`);
  }
  return res.json();
}

export async function getProtectedResourceMetadata() {
  return {
    resource: MCP_RESOURCE,
    authorization_servers: [AUTH_ISSUER],
    bearer_methods_supported: ["header"],
    scopes_supported: ["openid", "profile", "email", "offline_access"],
  };
}

export function protectedResourceMetadataResponse(metadata: Awaited<
  ReturnType<typeof getProtectedResourceMetadata>
>) {
  return new Response(JSON.stringify(metadata), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": PROTECTED_RESOURCE_CACHE_CONTROL,
    },
  });
}

export async function verifyMcpAccessToken(
  req: Request,
): Promise<{ userId: string } | null> {
  const accessToken = extractBearerToken(req);
  if (!accessToken) return null;

  try {
    const payload = await verifyJwsAccessToken(accessToken, {
      jwksFetch: fetchJwksLocally,
      verifyOptions: {
        issuer: AUTH_ISSUER,
        audience: MCP_RESOURCE,
      },
    });
    const userId = payload.sub;
    if (typeof userId !== "string" || !userId) return null;
    return { userId };
  } catch (error) {
    let claims: { iss?: unknown; aud?: unknown; sub?: unknown } | undefined;
    try {
      claims = decodeJwt(accessToken);
    } catch {
      // opaque or malformed token
    }
    logger.warn(
      {
        err: error instanceof Error ? error.message : String(error),
        tokenIss: claims?.iss,
        tokenAud: claims?.aud,
        expectedIss: AUTH_ISSUER,
        expectedAud: MCP_RESOURCE,
      },
      "MCP access token verification failed",
    );
    return null;
  }
}
