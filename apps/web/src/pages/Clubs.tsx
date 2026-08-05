import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppLoading } from "@/components/AppLoading";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClub, joinClub, listClubs, type ClubSummary } from "@/lib/api";

type DialogKind = "create" | "join" | null;

export function Clubs() {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<ClubSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    listClubs()
      .then(setClubs)
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Failed to load clubs"),
      )
      .finally(() => setLoading(false));
  }, []);

  function closeDialog() {
    setDialog(null);
    setName("");
    setInviteCode("");
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const club = await createClub({ name });
      toast.success("Club created");
      navigate(`/clubs/${club.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn’t create club");
    } finally {
      setCreating(false);
    }
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault();
    setJoining(true);
    try {
      const club = await joinClub(inviteCode);
      toast.success(`Joined ${club.name}`);
      navigate(`/clubs/${club.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn’t join club");
    } finally {
      setJoining(false);
    }
  }

  if (loading) return <AppLoading />;

  return (
    <section className="mx-auto w-full max-w-lg space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Clubs</h1>
          <p className="text-sm text-muted-foreground">
            Club with friends, family, and colleagues to challenge and progress
            together.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon-sm" aria-label="Add a club">
              <Plus />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setDialog("create")}>
              Create club
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDialog("join")}>
              Join with code
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {clubs.length === 0 ? (
        <p className="text-sm text-muted-foreground">You’re not in a club yet.</p>
      ) : (
        <ul className="space-y-2">
          {clubs.map((club) => (
            <li key={club.id}>
              <Link
                to={`/clubs/${club.id}`}
                className="flex min-h-14 items-center justify-between gap-3 rounded-md border border-border bg-card px-3.5 py-3 text-foreground no-underline transition-colors hover:bg-muted/40 active:bg-muted/60"
              >
                <span className="font-medium">{club.name}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  {club.memberCount}{" "}
                  {club.memberCount === 1 ? "member" : "members"}
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={dialog === "create"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent>
          <form onSubmit={onCreate} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Create club</DialogTitle>
              <DialogDescription>
                You’ll get an invite code to share.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="club-name">Name</Label>
              <Input
                id="club-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={80}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? "Creating…" : "Create club"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "join"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent>
          <form onSubmit={onJoin} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Join with code</DialogTitle>
              <DialogDescription>Paste a club invite code.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="invite-code">Invite code</Label>
              <Input
                id="invite-code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                required
                autoCapitalize="characters"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={joining || !inviteCode.trim()}>
                {joining ? "Joining…" : "Join club"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
