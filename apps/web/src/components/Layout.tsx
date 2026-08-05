import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut, Menu, Settings, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CupRunWordmark } from "@/components/CupRunLogo";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md px-2.5 py-1.5 text-sm transition-colors",
    isActive
      ? "bg-secondary text-foreground"
      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
  );

function userInitials(name?: string | null, email?: string | null): string {
  const source = (name?.trim() || email?.trim() || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function Layout() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    setMenuOpen(false);
    await authClient.signOut();
    navigate("/sign-in");
  }

  const user = session?.user;

  const nav = user ? (
    <>
      <NavLink to="/" end className={navLinkClass} onClick={() => setMenuOpen(false)}>
        Home
      </NavLink>
      <NavLink to="/goal" className={navLinkClass} onClick={() => setMenuOpen(false)}>
        Goal
      </NavLink>
      <NavLink
        to="/clubs"
        className={navLinkClass}
        onClick={() => setMenuOpen(false)}
      >
        Clubs
      </NavLink>
      <NavLink
        to="/insights"
        className={navLinkClass}
        onClick={() => setMenuOpen(false)}
      >
        Insights
      </NavLink>
      <NavLink
        to="/connect"
        className={navLinkClass}
        onClick={() => setMenuOpen(false)}
      >
        Connect
      </NavLink>
    </>
  ) : null;

  const profileMenu = user ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Account menu"
        >
          <Avatar size="sm">
            <AvatarFallback className="bg-secondary text-foreground">
              {userInitials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium text-foreground">
            {user.name || "Runner"}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setMenuOpen(false);
            navigate("/settings");
          }}
        >
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={signOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-10 sm:px-6">
      <header className="flex items-center justify-between gap-3 py-4">
        <Link to="/" className="text-foreground no-underline">
          <CupRunWordmark />
        </Link>

        {user ? (
          <div className="flex items-center gap-1">
            <nav className="hidden items-center gap-1 sm:flex">{nav}</nav>
            <div className="hidden sm:block">{profileMenu}</div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="sm:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        ) : null}
      </header>

      {user && menuOpen ? (
        <nav className="mb-4 flex flex-col gap-1 rounded-lg border border-border bg-card p-2 sm:hidden">
          {nav}
          <Separator className="my-1" />
          <div className="flex items-center justify-between gap-2 px-1 py-1">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {user.name || "Runner"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            </div>
            {profileMenu}
          </div>
        </nav>
      ) : null}

      <Separator className="mb-6" />

      <main>
        <Outlet />
      </main>
    </div>
  );
}
