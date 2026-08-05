import { useEffect } from "react";
import { Navigate, Outlet, useSearchParams } from "react-router-dom";
import { authClient } from "@/lib/auth-client";
import { mcpAuthorizeContinueUrl } from "@/lib/social-auth";

/**
 * For /sign-in and /sign-up: if a session already exists, send the user onward
 * instead of showing the auth form again.
 *
 * MCP authorize (`sig`) must not be dropped — after Google the user may land
 * back here already signed in and still need to resume consent.
 */
export function GuestOnly() {
  const { data: session, isPending } = authClient.useSession();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const continueUrl = mcpAuthorizeContinueUrl(searchParams.toString());

  useEffect(() => {
    if (!session?.user || !continueUrl) return;
    window.location.replace(continueUrl);
  }, [session?.user, continueUrl]);

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (session?.user && continueUrl) {
    return (
      <p className="text-sm text-muted-foreground">Continuing authorization…</p>
    );
  }

  if (session?.user) {
    const target =
      returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
        ? returnTo
        : "/";
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}
