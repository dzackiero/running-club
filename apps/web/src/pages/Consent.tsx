import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";

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
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (!session?.user) {
    const returnTo = `/consent?${searchParams.toString()}`;
    return (
      <section className="mx-auto w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Authorize application
        </h1>
        <p className="text-sm text-muted-foreground">Sign in to continue.</p>
        <Button asChild className="w-full" size="lg">
          <Link to={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>
            Sign in
          </Link>
        </Button>
      </section>
    );
  }

  if (!clientId) {
    return (
      <section className="mx-auto w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Authorize application
        </h1>
        <Alert variant="destructive">
          <AlertDescription>
            Missing client_id in the authorization request.
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  const scopes = scope.split(/\s+/).filter(Boolean);
  const appName = client?.client_name ?? clientId;

  return (
    <section className="mx-auto w-full max-w-sm space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Authorize {appName}
        </h1>
        {client?.logo_uri ? (
          <img
            src={client.logo_uri}
            alt=""
            className="mb-2 max-h-12 rounded-md"
          />
        ) : null}
        <p className="text-sm text-muted-foreground">
          This application is requesting access to your Running Club account.
        </p>
      </div>

      <Separator />

      {scopes.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {scopes.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Default account access</p>
      )}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          className="flex-1"
          size="lg"
          disabled={loading}
          onClick={() => respond(true)}
        >
          {loading ? "Authorizing…" : "Allow"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          size="lg"
          disabled={loading}
          onClick={() => respond(false)}
        >
          Deny
        </Button>
      </div>
    </section>
  );
}
