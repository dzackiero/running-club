import { Navigate, Outlet } from "react-router-dom";
import { authClient } from "../lib/auth-client";

export function RequireAuth() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <p className="muted">Loading…</p>;
  }

  if (!session?.user) {
    return <Navigate to="/sign-in" replace />;
  }

  return <Outlet />;
}
