import { Link, Outlet, useNavigate } from "react-router-dom";
import { authClient } from "../lib/auth-client";

export function Layout() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  async function signOut() {
    await authClient.signOut();
    navigate("/sign-in");
  }

  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="brand">
          Running Club
        </Link>
        {session?.user ? (
          <nav className="nav">
            <Link to="/">Home</Link>
            <Link to="/goal">Goal</Link>
            <Link to="/connect">Connect</Link>
            <button type="button" className="link-btn" onClick={signOut}>
              Sign out
            </button>
          </nav>
        ) : null}
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
