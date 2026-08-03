import { type FormEvent, useEffect, useState } from "react";
import { getCurrentGoal, putCurrentGoal } from "../lib/api";
import { WEEKDAY_OPTIONS } from "../lib/format";

export function Goal() {
  const [weekStartsOn, setWeekStartsOn] = useState(1);
  const [distanceKm, setDistanceKm] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [runCount, setRunCount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCurrentGoal()
      .then((goal) => {
        if (!goal) return;
        setWeekStartsOn(goal.weekStartsOn);
        if (goal.targetDistanceMeters != null) {
          setDistanceKm((goal.targetDistanceMeters / 1000).toString());
        }
        if (goal.targetDurationSeconds != null) {
          setDurationMinutes(Math.round(goal.targetDurationSeconds / 60).toString());
        }
        if (goal.targetRunCount != null) {
          setRunCount(goal.targetRunCount.toString());
        }
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load goal"),
      )
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);

    const body: {
      weekStartsOn: number;
      targetDistanceMeters?: number;
      targetDurationSeconds?: number;
      targetRunCount?: number;
    } = { weekStartsOn };

    if (distanceKm.trim()) {
      body.targetDistanceMeters = Math.round(parseFloat(distanceKm) * 1000);
    }
    if (durationMinutes.trim()) {
      body.targetDurationSeconds = Math.round(parseFloat(durationMinutes) * 60);
    }
    if (runCount.trim()) {
      body.targetRunCount = parseInt(runCount, 10);
    }

    try {
      await putCurrentGoal(body);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save goal");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <section className="panel">
      <h1>Weekly goal</h1>
      <p className="muted">Set at least one target. Empty fields are omitted.</p>
      <form onSubmit={onSubmit} className="form">
        <label>
          Week starts on
          <select
            value={weekStartsOn}
            onChange={(e) => setWeekStartsOn(Number(e.target.value))}
          >
            {WEEKDAY_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Distance (km)
          <input
            type="number"
            step="0.1"
            min="0"
            value={distanceKm}
            onChange={(e) => setDistanceKm(e.target.value)}
            placeholder="e.g. 30"
          />
        </label>
        <label>
          Duration (minutes)
          <input
            type="number"
            step="1"
            min="0"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            placeholder="e.g. 180"
          />
        </label>
        <label>
          Run count
          <input
            type="number"
            step="1"
            min="1"
            value={runCount}
            onChange={(e) => setRunCount(e.target.value)}
            placeholder="e.g. 4"
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        {saved ? <p className="success">Goal saved.</p> : null}
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save goal"}
        </button>
      </form>
    </section>
  );
}
