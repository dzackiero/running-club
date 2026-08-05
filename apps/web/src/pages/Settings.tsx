import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  getCurrentGoal,
  getPreferences,
  putCurrentGoal,
  updatePreferences,
} from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { WEEKDAY_OPTIONS } from "@/lib/format";

export function Settings() {
  const { data: session } = authClient.useSession();
  const user = session?.user;

  const [name, setName] = useState("");
  const [weekStartsOn, setWeekStartsOn] = useState(1);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loadingWeek, setLoadingWeek] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingWeek, setSavingWeek] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [hasPasswordAccount, setHasPasswordAccount] = useState<boolean | null>(
    null,
  );

  const [goalSnapshot, setGoalSnapshot] = useState<{
    targetDistanceMeters?: number;
    targetDurationSeconds?: number;
    targetRunCount?: number;
  }>({});

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  useEffect(() => {
    if (!user) return;

    authClient
      .listAccounts()
      .then(({ data, error }) => {
        if (error || !data) {
          setHasPasswordAccount(true);
          return;
        }
        setHasPasswordAccount(
          data.some((account) => account.providerId === "credential"),
        );
      })
      .catch(() => setHasPasswordAccount(true));
  }, [user]);

  useEffect(() => {
    Promise.all([getCurrentGoal(), getPreferences()])
      .then(([goal, prefs]) => {
        if (goal) {
          setWeekStartsOn(goal.weekStartsOn);
          setGoalSnapshot({
            ...(goal.targetDistanceMeters != null
              ? { targetDistanceMeters: goal.targetDistanceMeters }
              : {}),
            ...(goal.targetDurationSeconds != null
              ? { targetDurationSeconds: goal.targetDurationSeconds }
              : {}),
            ...(goal.targetRunCount != null
              ? { targetRunCount: goal.targetRunCount }
              : {}),
          });
        }
        setEmailNotifications(prefs.emailNotifications);
      })
      .catch((err) =>
        toast.error(
          err instanceof Error ? err.message : "Failed to load preferences",
        ),
      )
      .finally(() => setLoadingWeek(false));
  }, []);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const { error } = await authClient.updateUser({ name: name.trim() });
      if (error) {
        toast.error(error.message ?? "Failed to update name");
        return;
      }
      toast.success("Name saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update name");
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveWeekStartsOn(e: FormEvent) {
    e.preventDefault();
    setSavingWeek(true);
    try {
      const goal = await putCurrentGoal({
        weekStartsOn,
        ...goalSnapshot,
      });
      setGoalSnapshot({
        ...(goal.targetDistanceMeters != null
          ? { targetDistanceMeters: goal.targetDistanceMeters }
          : {}),
        ...(goal.targetDurationSeconds != null
          ? { targetDurationSeconds: goal.targetDurationSeconds }
          : {}),
        ...(goal.targetRunCount != null
          ? { targetRunCount: goal.targetRunCount }
          : {}),
      });
      toast.success("Week start saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save week start",
      );
    } finally {
      setSavingWeek(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    setSavingPassword(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });
      if (error) {
        toast.error(error.message ?? "Failed to change password");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to change password",
      );
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-md space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Name, preferences, and password.
        </p>
      </div>

      <form onSubmit={saveProfile} className="space-y-4">
        <h2 className="text-base font-medium">Profile</h2>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={user?.email ?? ""}
            disabled
            readOnly
          />
          <p className="text-xs text-muted-foreground">
            Email changes aren’t available yet.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>
        <Button type="submit" disabled={savingProfile}>
          {savingProfile ? "Saving…" : "Save name"}
        </Button>
      </form>

      <Separator />

      <form onSubmit={saveWeekStartsOn} className="space-y-4">
        <h2 className="text-base font-medium">Preferences</h2>
        <div className="space-y-2">
          <Label htmlFor="week-starts">Week starts on</Label>
          <p className="text-xs text-muted-foreground">
            Personal Home and Insights only. Club boards use each club’s own week
            start.
          </p>
          {loadingWeek ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Select
              value={String(weekStartsOn)}
              onValueChange={(value) => setWeekStartsOn(Number(value))}
            >
              <SelectTrigger id="week-starts" className="w-full">
                <SelectValue placeholder="Choose day" />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAY_OPTIONS.map((day) => (
                  <SelectItem key={day.value} value={String(day.value)}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Button type="submit" disabled={savingWeek || loadingWeek}>
          {savingWeek ? "Saving…" : "Save week start"}
        </Button>
        <div className="flex items-center justify-between gap-3 pt-2">
          <div>
            <p className="text-sm font-medium">Email notifications</p>
            <p className="text-xs text-muted-foreground">
              Club miss emails and other CUP Run mail. Turn off to stop all emails.
            </p>
          </div>
          <Switch
            checked={emailNotifications}
            disabled={loadingWeek}
            onCheckedChange={async (checked) => {
              const previous = emailNotifications;
              setEmailNotifications(checked);
              try {
                await updatePreferences({ emailNotifications: checked });
              } catch (err) {
                setEmailNotifications(previous);
                toast.error(
                  err instanceof Error ? err.message : "Couldn’t update emails",
                );
              }
            }}
          />
        </div>
      </form>

      <Separator />

      {hasPasswordAccount === false ? (
        <div className="space-y-2">
          <h2 className="text-base font-medium">Password</h2>
          <p className="text-sm text-muted-foreground">
            You use Google to sign in, so there’s no password here.
          </p>
        </div>
      ) : (
        <form onSubmit={savePassword} className="space-y-4">
          <h2 className="text-base font-medium">Password</h2>
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
            />
          </div>
          <Button type="submit" disabled={savingPassword}>
            {savingPassword ? "Updating…" : "Update password"}
          </Button>
        </form>
      )}
    </section>
  );
}
