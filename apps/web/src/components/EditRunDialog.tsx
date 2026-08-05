import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  activityTypes,
  type ActivityType,
  type RunRecord,
} from "@running-club/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ACTIVITY_LABELS } from "@/lib/activity";
import { updateRun } from "@/lib/api";

type EditRunDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  run: RunRecord;
  onSaved?: () => void;
};

function resolvedActivityType(run: RunRecord): ActivityType {
  return activityTypes.includes(run.activityType as ActivityType)
    ? (run.activityType as ActivityType)
    : "run";
}

export function EditRunDialog({
  open,
  onOpenChange,
  run,
  onSaved,
}: EditRunDialogProps) {
  const [activityType, setActivityType] = useState<ActivityType>(() =>
    resolvedActivityType(run),
  );
  const [notes, setNotes] = useState(run.notes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActivityType(resolvedActivityType(run));
    setNotes(run.notes ?? "");
  }, [open, run]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    setSaving(true);
    try {
      await updateRun(run.id, {
        activityType,
        notes: notes.trim(),
      });
      toast.success("Run updated");
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update run");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit run</DialogTitle>
          <DialogDescription>
            Change activity type or notes. Distance and time stay as logged.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Activity</p>
            <div className="flex flex-wrap gap-2">
              {activityTypes.map((type) => (
                <Button
                  key={type}
                  type="button"
                  size="sm"
                  variant={activityType === type ? "default" : "outline"}
                  onClick={() => setActivityType(type)}
                >
                  {ACTIVITY_LABELS[type]}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes (optional)</Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How it felt, weather, route…"
              maxLength={2000}
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
