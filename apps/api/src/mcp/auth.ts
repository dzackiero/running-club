import { oauthProviderResourceClient } from "@better-auth/oauth-provider/resource-client";
import { createAuthClient } from "better-auth/client";
import { auth } from "../auth";
import { env } from "../env";

/** OAuth authorization server issuer (Better Auth default basePath `/api/auth`). */
export const AUTH_ISSUER = `${env.BETTER_AUTH_URL}/api/auth`;

/** MCP resource identifier — must match `aud` claim in issued access tokens. */
export const MCP_RESOURCE = `${env.API_PUBLIC_URL}/mcp`;

const resourceClient = createAuthClient({
  plugins: [oauthProviderResourceClient(auth)],
});

const PROTECTED_RESOURCE_CACHE_CONTROL =
  "public, max-age=15, stale-while-revalidate=15, stale-if-error=86400";

function extractBearerToken(req: Request): string | undefined {
  const authorization = req.headers.get("authorization") ?? undefined;
  if (!authorization) return undefined;
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : authorization;
}

export async function getProtectedResourceMetadata() {
  return resourceClient.getProtectedResourceMetadata({
    resource: MCP_RESOURCE,
    authorization_servers: [AUTH_ISSUER],
  });
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
    const payload = await resourceClient.verifyAccessToken(accessToken, {
      verifyOptions: { audience: MCP_RESOURCE },
    });
    const userId = payload.sub;
    if (typeof userId !== "string" || !userId) return null;
    return { userId };
  } catch {
    return null;
  }
}
