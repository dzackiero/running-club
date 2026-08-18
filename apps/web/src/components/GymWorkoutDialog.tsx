import { type FormEvent, useEffect, useState } from "react";
import type { PlanOccurrenceRecord } from "@running-club/shared";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { createGymWorkout } from "@/lib/api";

type DraftSet = { reps: string; loadKg: string; rpe: string };
type DraftExercise = { name: string; sets: DraftSet[] };

const blankSet = (): DraftSet => ({ reps: "8", loadKg: "", rpe: "" });
const blankExercise = (): DraftExercise => ({ name: "", sets: [blankSet()] });

export function GymWorkoutDialog({
  occurrence,
  open,
  onOpenChange,
  onSaved,
}: {
  occurrence: PlanOccurrenceRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [exercises, setExercises] = useState<DraftExercise[]>([blankExercise()]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setExercises([blankExercise()]);
    setNotes("");
  }, [open, occurrence?.id]);

  if (!occurrence || occurrence.category !== "gym") return null;
  const gymOccurrence = occurrence;

  const changeExercise = (exerciseIndex: number, update: Partial<DraftExercise>) => {
    setExercises((current) => current.map((exercise, index) => index === exerciseIndex ? { ...exercise, ...update } : exercise));
  };

  const changeSet = (exerciseIndex: number, setIndex: number, update: Partial<DraftSet>) => {
    setExercises((current) => current.map((exercise, index) => index === exerciseIndex ? {
      ...exercise,
      sets: exercise.sets.map((set, currentSet) => currentSet === setIndex ? { ...set, ...update } : set),
    } : exercise));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await createGymWorkout({
        occurredAt: `${gymOccurrence.date}T12:00:00.000Z`,
        planOccurrenceId: gymOccurrence.id,
        notes: notes.trim() || undefined,
        exercises: exercises.map((exercise, position) => ({
          name: exercise.name.trim(),
          position,
          sets: exercise.sets.map((set, setPosition) => ({
            position: setPosition,
            reps: Number(set.reps),
            loadKg: Number(set.loadKg),
            ...(set.rpe ? { rpe: Number(set.rpe) } : {}),
          })),
        })),
      });
      toast.success("Workout logged");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to log workout");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Log {gymOccurrence.title}</DialogTitle>
          <DialogDescription>Record the sets you completed today. This will mark the planned session done.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-4">
            {exercises.map((exercise, exerciseIndex) => (
              <fieldset key={exerciseIndex} className="rounded-lg border border-border p-3">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Label htmlFor={`exercise-${exerciseIndex}`}>Exercise {exerciseIndex + 1}</Label>
                    <Input id={`exercise-${exerciseIndex}`} value={exercise.name} onChange={(event) => changeExercise(exerciseIndex, { name: event.target.value })} placeholder="Back squat" required maxLength={200} />
                  </div>
                  {exercises.length > 1 ? (
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove exercise ${exerciseIndex + 1}`} onClick={() => setExercises((current) => current.filter((_, index) => index !== exerciseIndex))}><Trash2 /></Button>
                  ) : null}
                </div>
                <div className="mt-3 space-y-2">
                  {exercise.sets.map((set, setIndex) => (
                    <div key={setIndex} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                      <Input aria-label={`Exercise ${exerciseIndex + 1} set ${setIndex + 1} reps`} type="number" min="1" step="1" required value={set.reps} onChange={(event) => changeSet(exerciseIndex, setIndex, { reps: event.target.value })} placeholder="Reps" />
                      <Input aria-label={`Exercise ${exerciseIndex + 1} set ${setIndex + 1} load in kilograms`} type="number" min="0" step="0.5" required value={set.loadKg} onChange={(event) => changeSet(exerciseIndex, setIndex, { loadKg: event.target.value })} placeholder="kg" />
                      <Input aria-label={`Exercise ${exerciseIndex + 1} set ${setIndex + 1} RPE`} type="number" min="1" max="10" step="0.5" value={set.rpe} onChange={(event) => changeSet(exerciseIndex, setIndex, { rpe: event.target.value })} placeholder="RPE" />
                      {exercise.sets.length > 1 ? <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove set ${setIndex + 1}`} onClick={() => changeExercise(exerciseIndex, { sets: exercise.sets.filter((_, index) => index !== setIndex) })}><Trash2 /></Button> : <span />}
                    </div>
                  ))}
                </div>
                <Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => changeExercise(exerciseIndex, { sets: [...exercise.sets, blankSet()] })}><Plus /> Add set</Button>
              </fieldset>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setExercises((current) => [...current, blankExercise()])}><Plus /> Add exercise</Button>
          <div className="space-y-1.5">
            <Label htmlFor="workout-notes">Notes (optional)</Label>
            <Textarea id="workout-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} rows={3} placeholder="How did it feel?" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Logging…" : "Log workout"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
