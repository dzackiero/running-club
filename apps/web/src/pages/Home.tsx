import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getWeekProgress, listRuns, type RunRecord, type WeekProgress } from "../lib/api";
import {
  formatDate,
  formatDuration,
  formatKm,
  formatPace,
  formatProgress,
} from "../lib/format";

function WeekSnapshot({ progress }: { progress: WeekProgress }) {
  const { totals, goal, progress: ratios } = progress;
  const parts: string[] = [];

  if (goal?.targetDistanceMeters) {
    parts.push(
      `${formatKm(totals.distanceMeters)} / ${formatKm(goal.targetDistanceMeters)} km (${formatProgress(ratios.distanceRatio)})`,
    );
  }
  if (goal?.targetRunCount) {
    parts.push(
      `${totals.runCount} / ${goal.targetRunCount} runs (${formatProgress(ratios.runCountRatio)})`,
    );
  }
  if (goal?.targetDurationSeconds) {
    parts.push(
      `${formatDuration(totals.durationSeconds)} / ${formatDuration(goal.targetDurationSeconds)} (${formatProgress(ratios.durationRatio)})`,
    );
  }

  if (!goal) {
    return (
      <p className="week-line muted">
        No weekly goal set.{" "}
        <Link to="/goal">Set a goal</Link> to track progress.
      </p>
    );
  }

  return (
    <p className="week-line">
      This week: {parts.length > 0 ? parts.join(" · ") : "No targets configured"}
    </p>
  );
}

function RunRow({ run }: { run: RunRecord }) {
  return (
    <li className="run-row">
      <span className="run-date">{formatDate(run.startedAt)}</span>
      <span>{formatKm(run.distanceMeters)} km</span>
      <span>{formatDuration(run.durationSeconds)}</span>
      <span className="muted">{formatPace(run.avgPaceSecPerKm)}</span>
      <span className="muted">{run.activityType}</span>
    </li>
  );
}

export function Home() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [week, setWeek] = useState<WeekProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listRuns(10), getWeekProgress()])
      .then(([runList, weekProgress]) => {
        setRuns(runList);
        setWeek(weekProgress);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <section>
      <h1>Recent runs</h1>
      {week ? <WeekSnapshot progress={week} /> : null}
      {runs.length === 0 ? (
        <p className="muted">No runs yet. Log one via ChatGPT or the API.</p>
      ) : (
        <ul className="run-list">
          {runs.map((run) => (
            <RunRow key={run.id} run={run} />
          ))}
        </ul>
      )}
    </section>
  );
}
