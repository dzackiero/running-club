import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Crown } from "lucide-react";
import { toast } from "sonner";
import type {
  ClubBoardHighlight,
  ClubBoardView,
  ClubPeriod,
} from "@running-club/shared";
import {
  clubMissMessageTemplates,
  type ClubPeriodMessageTemplateId,
} from "@running-club/shared";
import { AppLoading } from "@/components/AppLoading";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteClub,
  getClub,
  getClubBoard,
  getClubPeriodResults,
  leaveClub,
  removeClubMember,
  sendClubPeriodMessage,
  updateClub,
  updateClubNudges,
  type ClubDetail as ClubDetailRecord,
  type ClubPeriodResultsView,
  type ClubSummary,
} from "@/lib/api";
import {
  formatKm,
  formatProgress,
  formatWeekRange,
  formatWeekYear,
  WEEKDAY_OPTIONS,
} from "@/lib/format";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type ClubView = "board" | "settings";

function ProgressBar({ ratio }: { ratio: number | null }) {
  const pct = Math.max(0, Math.min(100, Math.round((ratio ?? 0) * 100)));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-secondary"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-200"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function periodTitle(period: ClubPeriod, offset: number): string | null {
  if (offset === 0) return period === "week" ? "This week" : "This month";
  if (offset === -1) return period === "week" ? "Last week" : "Last month";
  return null;
}

function ClubBoard({
  board,
  loading,
  myId,
  isOwner,
  onOpenSettings,
}: {
  board: ClubBoardView;
  loading: boolean;
  myId?: string;
  isOwner: boolean;
  onOpenSettings: () => void;
}) {
  const mine = board.board.find((row) => row.userId === myId);
  const myMeters = mine?.distanceMeters ?? 0;
  const target = board.targetDistanceMeters;
  const ratio =
    target != null && target > 0 ? Math.min(1, myMeters / target) : null;

  return (
    <div className={cn("space-y-6", loading && "opacity-50")}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="stat-hero mt-1 text-foreground">
            {formatKm(myMeters)}
            <span className="ml-1 text-2xl font-semibold text-muted-foreground">
              km
            </span>
          </p>
          {target != null ? (
            <div className="text-right text-sm text-muted-foreground tabular-nums">
              <p>
                of {formatKm(target)} km · {formatProgress(ratio)}
              </p>
              <p>
                {mine?.runCount ?? 0}{" "}
                {(mine?.runCount ?? 0) === 1 ? "run" : "runs"}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground tabular-nums">
              {mine?.runCount ?? 0}{" "}
              {(mine?.runCount ?? 0) === 1 ? "run" : "runs"}
            </p>
          )}
        </div>
        {target != null ? (
          <ProgressBar ratio={ratio} />
        ) : board.offset === 0 ? (
          <p className="text-sm text-muted-foreground">
            No club target set.
            {isOwner ? (
              <>
                {" "}
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  onClick={onOpenSettings}
                >
                  Set one
                </button>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      <BoardHighlights board={board} />

      <ol className="divide-y divide-border">
        {board.board.map((row) => {
          const isMine = row.userId === myId;
          const rowRatio =
            target != null && target > 0
              ? Math.min(1, row.distanceMeters / target)
              : null;
          const leading = row.rank === 1 && row.distanceMeters > 0;
          return (
            <li key={row.userId} className="py-3">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span
                  className={
                    isMine ? "font-medium text-foreground" : "text-foreground"
                  }
                >
                  <span className="inline-flex items-baseline gap-1.5">
                    {leading ? (
                      <Crown
                        className="size-3.5 shrink-0 translate-y-0.5 text-primary"
                        aria-label="In the lead"
                      />
                    ) : null}
                    <span>
                      {row.rank}. {row.name}
                      {isMine ? " (you)" : ""}
                    </span>
                  </span>
                </span>
                <span className="font-(family-name:--font-stat) tabular-nums text-foreground">
                  {formatKm(row.distanceMeters)} km
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {row.runCount} {row.runCount === 1 ? "run" : "runs"}
                  </span>
                </span>
              </div>
              {rowRatio != null ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round(rowRatio * 100)}%` }}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function highlightCopy(row: ClubBoardHighlight): string {
  if (row.kind === "runs") {
    return `${row.value} ${row.value === 1 ? "run" : "runs"}`;
  }
  if (row.kind === "days") {
    return `${row.value} ${row.value === 1 ? "day" : "days"} out`;
  }
  return `${formatKm(row.value)} km`;
}

function highlightLabel(kind: ClubBoardHighlight["kind"]): string {
  if (kind === "runs") return "Most runs";
  if (kind === "days") return "Most days out";
  return "Longest run";
}

function BoardHighlights({ board }: { board: ClubBoardView }) {
  const clubMeters = board.board.reduce((sum, row) => sum + row.distanceMeters, 0);
  const facts: Array<{ label: string; detail: string }> = [];
  if (clubMeters > 0) {
    facts.push({
      label: "Club total",
      detail: `${formatKm(clubMeters)} km`,
    });
  }
  for (const row of board.highlights ?? []) {
    facts.push({
      label: highlightLabel(row.kind),
      detail: `${row.name} · ${highlightCopy(row)}`,
    });
  }
  if (facts.length === 0) return null;

  return (
    <ul className="space-y-1 text-sm">
      {facts.slice(0, 4).map((fact) => (
        <li key={fact.label} className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">{fact.label}</span>
          <span className="min-w-0 text-right text-foreground">{fact.detail}</span>
        </li>
      ))}
    </ul>
  );
}

function OwnerMissesBlock({
  clubId,
  period,
}: {
  clubId: string;
  period: ClubPeriod;
}) {
  const [results, setResults] = useState<ClubPeriodResultsView | null>(null);
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] =
    useState<ClubPeriodMessageTemplateId>("encourage");
  const [body, setBody] = useState(clubMissMessageTemplates[0]!.body);
  const [sending, setSending] = useState(false);

  const loadResults = useCallback(() => {
    return getClubPeriodResults(clubId, period, -1).then(setResults);
  }, [clubId, period]);

  useEffect(() => {
    let cancelled = false;
    loadResults().catch((err) => {
      if (!cancelled) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load last period",
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadResults]);

  const missed = results?.members.filter(
    (row) => row.targetDistanceMeters != null && !row.hit,
  ) ?? [];
  const periodLabel = period === "week" ? "last week" : "last month";

  return (
    <div className="space-y-3 border-t border-border pt-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-medium">Last period</h2>
          {!results ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !results.captured ? (
            <p className="text-sm text-muted-foreground">
              Miss counts appear after {periodLabel} closes.
            </p>
          ) : results.counts.noTarget === results.counts.memberCount ? (
            <p className="text-sm text-muted-foreground">
              No club target was set for {periodLabel}.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {results.counts.missed} of {results.counts.memberCount} missed{" "}
              {periodLabel}.
            </p>
          )}
        </div>
        {results?.captured && missed.length > 0 ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            Send message
          </Button>
        ) : null}
      </div>

      {missed.length > 0 ? (
        <ul className="divide-y divide-border">
          {missed.map((row) => (
            <li
              key={row.userId}
              className="flex items-baseline justify-between gap-3 py-2 text-sm"
            >
              <span>{row.name}</span>
              <span className="font-(family-name:--font-stat) tabular-nums text-muted-foreground">
                {formatKm(row.distanceMeters)} / {formatKm(row.targetDistanceMeters ?? 0)} km
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!results) return;
              setSending(true);
              try {
                const sent = await sendClubPeriodMessage(clubId, {
                  period,
                  periodStart: results.start,
                  templateId,
                  body,
                });
                toast.success(
                  sent.sent === 0
                    ? "No new messages sent"
                    : `Sent to ${sent.sent} ${sent.sent === 1 ? "member" : "members"}`,
                );
                setOpen(false);
                await loadResults();
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "Couldn’t send message",
                );
              } finally {
                setSending(false);
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Message misses</DialogTitle>
              <DialogDescription>
                Sends to members who missed {periodLabel} and still have email
                notifications on. Once per person per period.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Template</Label>
              <Select
                value={templateId}
                onValueChange={(value) => {
                  const next = value as ClubPeriodMessageTemplateId;
                  setTemplateId(next);
                  const template = clubMissMessageTemplates.find(
                    (item) => item.id === next,
                  );
                  if (template) setBody(template.body);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {clubMissMessageTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="miss-message">Message</Label>
              <Textarea
                id="miss-message"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Placeholders: {"{name}"}, {"{clubName}"}, {"{distanceKm}"}, {"{targetKm}"}, {"{period}"}, {"{dates}"}, {"{clubUrl}"}
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={sending || !body.trim()}>
                {sending ? "Sending…" : `Send to ${missed.length}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ClubDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const myId = session?.user?.id;
  const [club, setClub] = useState<ClubDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ClubView>("board");
  const [period, setPeriod] = useState<ClubPeriod>("week");
  const [offset, setOffset] = useState(0);
  const [board, setBoard] = useState<ClubBoardView | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [name, setName] = useState("");
  const [weekStartsOn, setWeekStartsOn] = useState("1");
  const [weeklyKm, setWeeklyKm] = useState("");
  const [monthlyKm, setMonthlyKm] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!id) return Promise.resolve();
    return getClub(id).then((row) => {
      setClub(row);
      setName(row.name);
      setWeekStartsOn(String(row.weekStartsOn));
      setWeeklyKm(
        row.weeklyTargetDistanceMeters != null
          ? String(row.weeklyTargetDistanceMeters / 1000)
          : "",
      );
      setMonthlyKm(
        row.monthlyTargetDistanceMeters != null
          ? String(row.monthlyTargetDistanceMeters / 1000)
          : "",
      );
    });
  }, [id]);

  useEffect(() => {
    load()
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load club");
        navigate("/clubs");
      })
      .finally(() => setLoading(false));
  }, [load, navigate]);

  useEffect(() => {
    if (!id || !club) return;

    if (offset === 0) {
      const current = period === "week" ? club.week : club.month;
      setBoard({
        period,
        offset: 0,
        start: current.start,
        end: current.end,
        targetDistanceMeters: current.targetDistanceMeters,
        board: current.board,
        highlights: current.highlights,
      });
      return;
    }

    let cancelled = false;
    setBoardLoading(true);
    getClubBoard(id, period, offset)
      .then((row) => {
        if (!cancelled) setBoard(row);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load board");
        }
      })
      .finally(() => {
        if (!cancelled) setBoardLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, club, period, offset]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      await updateClub(id, {
        name,
        weekStartsOn: Number(weekStartsOn),
        weeklyTargetDistanceMeters: weeklyKm.trim()
          ? Math.round(Number(weeklyKm) * 1000)
          : null,
        monthlyTargetDistanceMeters: monthlyKm.trim()
          ? Math.round(Number(monthlyKm) * 1000)
          : null,
      });
      toast.success("Club updated");
      setOffset(0);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn’t save club");
    } finally {
      setSaving(false);
    }
  }

  async function applySummary(next: ClubSummary) {
    setClub((current) =>
      current
        ? {
            ...current,
            ...next,
          }
        : current,
    );
  }

  if (loading || !club) return <AppLoading />;

  const isOwner = club.role === "owner";
  const showSettings = view === "settings";
  const start = board ? new Date(board.start) : null;
  const end = board ? new Date(board.end) : null;
  const title = board ? periodTitle(board.period, board.offset) : null;
  const range =
    board && start && end
      ? board.period === "week"
        ? formatWeekRange(start, end)
        : start.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })
      : "";
  const year =
    board?.period === "week" && start && end ? formatWeekYear(start, end) : null;

  return (
    <section className="mx-auto w-full max-w-lg space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            <Link to="/clubs" className="text-muted-foreground">
              Clubs
            </Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{club.name}</h1>
          <p className="text-sm text-muted-foreground">
            {club.memberCount} {club.memberCount === 1 ? "member" : "members"}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setView(showSettings ? "board" : "settings")}
        >
          {showSettings ? (
            <>
              <ChevronLeft />
              Back
            </>
          ) : (
            "Settings"
          )}
        </Button>
      </div>

      {!showSettings ? (
        <div className="space-y-4">
          <SegmentedControl
            value={period}
            options={[
              { id: "week", label: "Week" },
              { id: "month", label: "Month" },
            ]}
            onChange={(next) => {
              setPeriod(next);
              setOffset(0);
            }}
          />

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setOffset((value) => value - 1)}
              aria-label={period === "week" ? "Previous week" : "Previous month"}
            >
              <ChevronLeft />
            </Button>
            <div className="min-w-0 text-center">
              {year ? (
                <p className="text-xs font-semibold tracking-wide text-primary tabular-nums">
                  {year}
                </p>
              ) : null}
              {title ? (
                <p className="text-sm font-medium text-foreground">{title}</p>
              ) : null}
              <p
                className={cn(
                  "tabular-nums text-muted-foreground",
                  title ? "text-xs" : "text-sm font-medium text-foreground",
                )}
              >
                {range}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setOffset((value) => Math.min(0, value + 1))}
              disabled={offset >= 0}
              aria-label={period === "week" ? "Next week" : "Next month"}
            >
              <ChevronRight />
            </Button>
          </div>

          {board ? (
            <ClubBoard
              board={board}
              loading={boardLoading}
              myId={myId}
              isOwner={isOwner}
              onOpenSettings={() => setView("settings")}
            />
          ) : null}

          {isOwner ? <OwnerMissesBlock clubId={club.id} period={period} /> : null}
        </div>
      ) : (
        <div className="space-y-8">
          {isOwner && club.inviteCode ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-base font-medium">Invite code</h2>
                <p className="text-sm text-muted-foreground">
                  Share this so friends can join from Clubs.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="block min-w-0 flex-1 rounded-md bg-secondary px-3 py-2 text-sm">
                  {club.inviteCode}
                </code>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      await navigator.clipboard.writeText(club.inviteCode!);
                      toast.success("Code copied");
                    }}
                  >
                    Copy
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={async () => {
                      const next = await updateClub(club.id, {
                        rotateInviteCode: true,
                      });
                      await applySummary(next);
                      toast.success("New invite code");
                      await load();
                    }}
                  >
                    Rotate
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Miss emails</p>
              <p className="text-xs text-muted-foreground">
                {club.emailNotifications
                  ? "After the week or month ends, if you missed the club target."
                  : "Paused — email notifications are off in Settings."}
              </p>
            </div>
            <Switch
              checked={club.emailNudges}
              disabled={!club.emailNotifications}
              onCheckedChange={async (checked) => {
                try {
                  const next = await updateClubNudges(club.id, checked);
                  await applySummary(next);
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Couldn’t update",
                  );
                }
              }}
            />
          </div>

          {isOwner ? (
            <>
              <form className="space-y-4" onSubmit={onSave}>
                <div className="space-y-1">
                  <h2 className="text-base font-medium">Club</h2>
                  <p className="text-sm text-muted-foreground">
                    Name, week start, and km targets for everyone.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="club-name">Name</Label>
                  <Input
                    id="club-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Week starts</Label>
                  <Select value={weekStartsOn} onValueChange={setWeekStartsOn}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAY_OPTIONS.map((day) => (
                        <SelectItem key={day.value} value={String(day.value)}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weekly-km">Weekly target (km)</Label>
                  <Input
                    id="weekly-km"
                    inputMode="decimal"
                    value={weeklyKm}
                    onChange={(e) => setWeeklyKm(e.target.value)}
                    placeholder="None"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthly-km">Monthly target (km)</Label>
                  <Input
                    id="monthly-km"
                    inputMode="decimal"
                    value={monthlyKm}
                    onChange={(e) => setMonthlyKm(e.target.value)}
                    placeholder="None"
                  />
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save settings"}
                </Button>
              </form>

              {club.week.board.filter((row) => row.userId !== myId).length > 0 ? (
                <div className="space-y-2">
                  <h2 className="text-base font-medium">Members</h2>
                  <ul className="divide-y divide-border">
                    {club.week.board
                      .filter((row) => row.userId !== myId)
                      .map((row) => (
                        <li
                          key={row.userId}
                          className="flex items-center justify-between gap-3 py-2 text-sm"
                        >
                          <span>{row.name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              await removeClubMember(club.id, row.userId);
                              toast.success("Member removed");
                              await load();
                            }}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}

              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  if (!confirm("Delete this club for everyone?")) return;
                  await deleteClub(club.id);
                  toast.success("Club deleted");
                  navigate("/clubs");
                }}
              >
                Delete club
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await leaveClub(club.id);
                toast.success("Left club");
                navigate("/clubs");
              }}
            >
              Leave club
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
