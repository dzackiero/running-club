import { Navigate, Outlet, useSearchParams } from "react-router-dom";
import { authClient } from "@/lib/auth-client";

/**
 * For /sign-in and /sign-up: if a session already exists, send the user onward
 * instead of showing the auth form again.
 */
export function GuestOnly() {
  const { data: session, isPending } = authClient.useSession();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
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
