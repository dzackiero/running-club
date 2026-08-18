import { type FormEvent, useCallback, useEffect, useState } from "react";
import type { CreatePlanTemplateInput, PlanCategory, PlanTemplateRecord } from "@running-club/shared";
import { Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPlanTemplate, listPlanTemplates } from "@/lib/api";

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function templateDetail(template: PlanTemplateRecord) {
  if (template.category === "run") {
    return [
      template.details.targetDistanceMeters ? `${(template.details.targetDistanceMeters / 1000).toFixed(template.details.targetDistanceMeters % 1000 === 0 ? 0 : 1)} km` : null,
      template.details.targetDurationSeconds ? `${Math.round(template.details.targetDurationSeconds / 60)} min` : null,
      template.details.notes ?? null,
    ].filter(Boolean).join(" · ");
  }
  if (template.category === "gym") {
    return [template.details.templateName, template.details.focus, template.details.notes].filter(Boolean).join(" · ");
  }
  return [
    template.details.targetCalories ? `${template.details.targetCalories} kcal` : null,
    template.details.targetProteinGrams ? `${template.details.targetProteinGrams} g protein` : null,
    template.details.notes ?? null,
  ].filter(Boolean).join(" · ");
}

function numericValue(value: string) {
  const parsed = Number(value);
  return value === "" || !Number.isFinite(parsed) ? undefined : parsed;
}

export function Plan() {
  const [templates, setTemplates] = useState<PlanTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setTemplates(await listPlanTemplates());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load your plan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) return <AppLoading />;

  return (
    <section className="mx-auto w-full max-w-2xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">Recurring plan</p>
          <h1 className="text-2xl font-semibold tracking-tight">Build your training week</h1>
          <p className="max-w-lg text-sm text-muted-foreground">Templates repeat each week. Updates you make in Today apply only to that date.</p>
        </div>
        <Button type="button" onClick={() => setDialogOpen(true)}><Plus /> Add plan</Button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-5 py-10 text-center">
          <p className="font-medium">Your week is open.</p>
          <p className="mt-1 text-sm text-muted-foreground">Add a recurring plan to see today’s agenda.</p>
          <Button type="button" className="mt-4" variant="outline" onClick={() => setDialogOpen(true)}><Plus /> Add your first plan</Button>
        </div>
      ) : (
        <div className="space-y-5">
          {weekdays.map((weekday, weekdayNumber) => {
            const items = templates.filter((template) => template.weekday === weekdayNumber);
            if (items.length === 0) return null;
            return (
              <section key={weekday} aria-labelledby={`plan-${weekday.toLowerCase()}`}>
                <h2 id={`plan-${weekday.toLowerCase()}`} className="mb-2 text-xs font-semibold tracking-wide text-primary uppercase">{weekday}</h2>
                <ul className="overflow-hidden rounded-lg border border-border">
                  {items.map((template) => {
                    const detail = templateDetail(template);
                    return (
                      <li key={template.id} className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
                        <div className="min-w-0">
                          <p className="font-medium">{template.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{template.category}{detail ? ` · ${detail}` : ""}</p>
                        </div>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">{template.category}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <PlanTemplateDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={() => void refresh()} />
    </section>
  );
}

function PlanTemplateDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const [weekday, setWeekday] = useState("1");
  const [category, setCategory] = useState<PlanCategory>("run");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState({ distanceKm: "", durationMinutes: "", templateName: "", focus: "", calories: "", protein: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWeekday("1");
    setCategory("run");
    setTitle("");
    setDetails({ distanceKm: "", durationMinutes: "", templateName: "", focus: "", calories: "", protein: "", notes: "" });
  }, [open]);

  const setDetail = (key: keyof typeof details, value: string) => setDetails((current) => ({ ...current, [key]: value }));

  function input(): CreatePlanTemplateInput {
    const common = { weekday: Number(weekday), title: title.trim() };
    if (category === "run") {
      return {
        ...common,
        category,
        details: {
          ...(numericValue(details.distanceKm) ? { targetDistanceMeters: numericValue(details.distanceKm)! * 1000 } : {}),
          ...(numericValue(details.durationMinutes) ? { targetDurationSeconds: numericValue(details.durationMinutes)! * 60 } : {}),
          ...(details.notes.trim() ? { notes: details.notes.trim() } : {}),
        },
      };
    }
    if (category === "gym") {
      return {
        ...common,
        category,
        details: {
          ...(details.templateName.trim() ? { templateName: details.templateName.trim() } : {}),
          ...(details.focus.trim() ? { focus: details.focus.trim() } : {}),
          ...(details.notes.trim() ? { notes: details.notes.trim() } : {}),
        },
      };
    }
    return {
      ...common,
      category,
      details: {
        ...(numericValue(details.calories) ? { targetCalories: numericValue(details.calories) } : {}),
        ...(numericValue(details.protein) ? { targetProteinGrams: numericValue(details.protein) } : {}),
        ...(details.notes.trim() ? { notes: details.notes.trim() } : {}),
      },
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await createPlanTemplate(input());
      toast.success("Recurring plan added");
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a recurring plan</DialogTitle>
          <DialogDescription>Choose the weekday and give the session just enough guidance for Today.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="plan-weekday">Weekday</Label><select id="plan-weekday" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={weekday} onChange={(event) => setWeekday(event.target.value)}>{weekdays.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="plan-category">Category</Label><select id="plan-category" className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value as PlanCategory)}><option value="run">Run</option><option value="gym">Gym</option><option value="nutrition">Nutrition</option></select></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="plan-title">Title</Label><Input id="plan-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={category === "run" ? "Easy 6 km" : category === "gym" ? "Upper body" : "Protein target"} required maxLength={200} /></div>
          {category === "run" ? <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="plan-distance">Distance (km)</Label><Input id="plan-distance" type="number" min="0.1" step="0.1" value={details.distanceKm} onChange={(event) => setDetail("distanceKm", event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="plan-duration">Duration (min)</Label><Input id="plan-duration" type="number" min="1" step="1" value={details.durationMinutes} onChange={(event) => setDetail("durationMinutes", event.target.value)} /></div></div> : null}
          {category === "gym" ? <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="plan-template">Template name</Label><Input id="plan-template" value={details.templateName} onChange={(event) => setDetail("templateName", event.target.value)} placeholder="Strength A" /></div><div className="space-y-1.5"><Label htmlFor="plan-focus">Focus</Label><Input id="plan-focus" value={details.focus} onChange={(event) => setDetail("focus", event.target.value)} placeholder="Upper body" /></div></div> : null}
          {category === "nutrition" ? <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="plan-calories">Calories</Label><Input id="plan-calories" type="number" min="1" step="1" value={details.calories} onChange={(event) => setDetail("calories", event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="plan-protein">Protein (g)</Label><Input id="plan-protein" type="number" min="1" step="1" value={details.protein} onChange={(event) => setDetail("protein", event.target.value)} /></div></div> : null}
          <div className="space-y-1.5"><Label htmlFor="plan-notes">Notes (optional)</Label><Textarea id="plan-notes" value={details.notes} onChange={(event) => setDetail("notes", event.target.value)} maxLength={2000} rows={3} placeholder="Keep this lightweight and useful." /></div>
          <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Adding…" : "Add recurring plan"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
