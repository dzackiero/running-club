import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  disconnectIntervals,
  getIntervalsStatus,
  importIntervalsActivities,
  saveIntervalsApiKey,
} from "@/lib/api";

export function IntervalsConnectCard() {
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    getIntervalsStatus()
      .then((status) => {
        setConnected(status.connected);
        setHint(status.hint);
        setLastSyncedAt(status.lastSyncedAt);
      })
      .catch(() => {
        setConnected(false);
        setHint(null);
        setLastSyncedAt(null);
      });
  }, []);

  async function saveKey(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const status = await saveIntervalsApiKey(apiKey);
      setConnected(status.connected);
      setHint(status.hint);
      setLastSyncedAt(status.lastSyncedAt);
      setApiKey("");
      toast.success("Intervals API key saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save Intervals key",
      );
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setSaving(true);
    try {
      await disconnectIntervals();
      setConnected(false);
      setHint(null);
      setLastSyncedAt(null);
      toast.success("Intervals disconnected");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to disconnect Intervals",
      );
    } finally {
      setSaving(false);
    }
  }

  async function importNow() {
    setImporting(true);
    try {
      const result = await importIntervalsActivities();
      const status = await getIntervalsStatus();
      setLastSyncedAt(status.lastSyncedAt);
      toast.success(
        `Imported ${result.imported}, updated ${result.updated}, skipped ${result.skipped}`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Intervals import failed",
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <form onSubmit={saveKey} className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-medium">Intervals.icu</h2>
        <p className="text-sm text-muted-foreground">
          Paste your API key from Intervals Settings → Developer. Cup Run
          imports runs one way and checks again every 2 hours.
        </p>
      </div>
      {connected ? (
        <p className="text-sm text-muted-foreground">
          Connected{hint ? ` · ending in ${hint}` : ""}.
          {lastSyncedAt
            ? ` Last sync ${new Date(lastSyncedAt).toLocaleString()}.`
            : " No sync yet."}
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="intervals-key">API key</Label>
        <Input
          id="intervals-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          autoComplete="off"
          placeholder={connected ? "Enter a new key to replace" : ""}
          required={!connected}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving || !apiKey.trim()}>
          {saving ? "Saving…" : "Save key"}
        </Button>
        {connected ? (
          <>
            <Button
              type="button"
              onClick={importNow}
              disabled={importing || saving}
            >
              {importing ? "Importing…" : "Import now"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={disconnect}
              disabled={saving || importing}
            >
              Disconnect
            </Button>
          </>
        ) : null}
      </div>
    </form>
  );
}
