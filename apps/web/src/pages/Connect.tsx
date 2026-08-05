import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
const mcpUrl = `${apiUrl}/mcp`;

const guides = {
  chatgpt: {
    label: "ChatGPT",
    steps: [
      "Open ChatGPT → Settings → Apps & connectors (or Developer mode).",
      "Add a connector and paste the link above.",
      "Sign in here when asked, then tap Allow.",
      "Back in chat, say something like “log an easy 5k from this morning.”",
    ],
  },
  claude: {
    label: "Claude",
    steps: [
      "Open Claude → Settings → Connectors.",
      "Add a custom connector and paste the link above.",
      "Sign in here when asked, then tap Allow.",
      "Back in chat, ask Claude to log or list your runs.",
    ],
  },
} as const;

type GuideId = keyof typeof guides;

export function Connect() {
  const [guide, setGuide] = useState<GuideId>("chatgpt");

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn’t copy — select the link instead");
    }
  }

  return (
    <section className="mx-auto w-full max-w-lg space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Connect</h1>
        <p className="text-sm text-muted-foreground">
          Log and check runs from ChatGPT or Claude. Same link for both.
        </p>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Link</h2>
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
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {(Object.keys(guides) as GuideId[]).map((id) => (
            <button
              key={id}
              type="button"
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                guide === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setGuide(id)}
            >
              {guides[id].label}
            </button>
          ))}
        </div>

        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          {guides[guide].steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
