import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
const mcpUrl = `${apiUrl}/mcp`;

export function Connect() {
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(mcpUrl);
    } catch {
      // ignore — user can still select the text
    }
  }

  return (
    <section className="mx-auto w-full max-w-lg space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Connect ChatGPT
        </h1>
        <p className="text-sm text-muted-foreground">
          Add Running Club as a remote MCP server. Authentication uses OAuth —
          you sign in and approve access when prompted.
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">MCP server URL</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="block min-w-0 flex-1 break-all rounded-lg bg-secondary px-3 py-2 text-sm text-foreground">
            {mcpUrl}
          </code>
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={copyUrl}
          >
            Copy
          </Button>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <h2 className="text-sm font-medium">Steps</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Open ChatGPT → Settings → Connectors / MCP (or Developer mode).</li>
          <li>Add a remote MCP server and paste the URL above.</li>
          <li>
            When ChatGPT connects, you will be redirected here to sign in (
            <code className="text-foreground">/sign-in</code>) and approve
            access (<code className="text-foreground">/consent</code>).
          </li>
          <li>After approval, return to ChatGPT and use the running tools.</li>
        </ol>
      </div>

      <p className="text-sm text-muted-foreground">
        No personal access token is required for v1. Keep your account
        credentials private.
      </p>
    </section>
  );
}
