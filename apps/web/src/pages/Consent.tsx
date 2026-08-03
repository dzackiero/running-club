import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authClient } from "../lib/auth-client";

type PublicClient = {
  client_id: string;
  client_name?: string | null;
  logo_uri?: string | null;
};

export function Consent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get("client_id") ?? "";
  const scope = searchParams.get("scope") ?? "";

  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [client, setClient] = useState<PublicClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!session?.user || !clientId) return;

    authClient.oauth2
      .publicClient({ query: { client_id: clientId } })
      .then(({ data, error: clientError }) => {
        if (clientError) {
          setError(clientError.message ?? "Could not load application details");
          return;
        }
        setClient(data as PublicClient);
      });
  }, [session?.user, clientId]);

  async function respond(accept: boolean) {
    setError(null);
    setLoading(true);

    const { data, error: consentError } = await authClient.oauth2.consent({
      accept,
      scope: scope || undefined,
    });

    setLoading(false);

    if (consentError) {
      setError(consentError.message ?? "Consent failed");
      return;
    }

    const redirectUrl =
      data && typeof data === "object" && "redirect_uri" in data
        ? (data as { redirect_uri?: string }).redirect_uri
        : data && typeof data === "object" && "url" in data
          ? (data as { url?: string }).url
          : undefined;

    if (redirectUrl) {
      window.location.href = redirectUrl;
      return;
    }

    navigate("/");
  }

  if (sessionPending) {
    return <p className="muted">Loading…</p>;
  }

  if (!session?.user) {
    const returnTo = `/consent?${searchParams.toString()}`;
    return (
      <section className="panel">
        <h1>Authorize application</h1>
        <p className="muted">Sign in to continue.</p>
        <Link to={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>
          Sign in
        </Link>
      </section>
    );
  }

  if (!clientId) {
    return (
      <section className="panel">
        <h1>Authorize application</h1>
        <p className="error">Missing client_id in the authorization request.</p>
      </section>
    );
  }

  const scopes = scope.split(/\s+/).filter(Boolean);
  const appName = client?.client_name ?? clientId;

  return (
    <section className="panel">
      <h1>Authorize {appName}</h1>
      {client?.logo_uri ? (
        <img src={client.logo_uri} alt="" className="client-logo" />
      ) : null}
      <p>This application is requesting access to your Running Club account.</p>
      {scopes.length > 0 ? (
        <ul className="scope-list">
          {scopes.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      ) : (
        <p className="muted">Default account access</p>
      )}
      {error ? <p className="error">{error}</p> : null}
      <div className="actions">
        <button type="button" disabled={loading} onClick={() => respond(true)}>
          {loading ? "Authorizing…" : "Allow"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={loading}
          onClick={() => respond(false)}
        >
          Deny
        </button>
      </div>
    </section>
  );
}
