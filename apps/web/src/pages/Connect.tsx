const apiUrl = import.meta.env.VITE_API_URL;
const mcpUrl = `${apiUrl}/mcp`;

export function Connect() {
  return (
    <section className="panel">
      <h1>Connect ChatGPT</h1>
      <p>
        Add Running Club as a remote MCP server in ChatGPT. Authentication uses
        OAuth — you will sign in and approve access when prompted.
      </p>

      <h2>MCP server URL</h2>
      <code className="code-block">{mcpUrl}</code>

      <h2>Steps</h2>
      <ol className="steps">
        <li>Open ChatGPT → Settings → Connectors / MCP (or Developer mode).</li>
        <li>Add a remote MCP server and paste the URL above.</li>
        <li>
          When ChatGPT connects, you will be redirected here to sign in (
          <code>/sign-in</code>) and approve access (<code>/consent</code>).
        </li>
        <li>After approval, return to ChatGPT and use running tools.</li>
      </ol>

      <p className="muted">
        No personal access token is required for v1. Keep your account
        credentials private.
      </p>
    </section>
  );
}
