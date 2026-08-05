const apiBaseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

export function oauthErrorFromSearch(search: string): string | null {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const description = params.get("error_description")?.trim();
  if (description) return description;
  const error = params.get("error")?.trim();
  if (!error) return null;
  return error.replaceAll("_", " ");
}

export function socialCallbackUrls(input: {
  origin: string;
  pathname: string;
  search: string;
  returnTo: string | null;
}): { callbackURL: string; errorCallbackURL: string } {
  const origin = input.origin.replace(/\/$/, "");
  const params = new URLSearchParams(
    input.search.startsWith("?") ? input.search.slice(1) : input.search,
  );
  const errorCallbackURL = `${origin}${input.pathname}${input.search}`;

  if (params.has("sig")) {
    return {
      callbackURL: `${origin}${input.pathname}${input.search}`,
      errorCallbackURL,
    };
  }

  const returnTo = input.returnTo;
  const path =
    returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : "/";

  return {
    callbackURL: `${origin}${path}`,
    errorCallbackURL,
  };
}

export function mcpAuthorizeContinueUrl(search: string): string | null {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  if (!params.has("sig") || !params.has("client_id")) return null;

  params.delete("sig");
  params.delete("exp");
  params.delete("ba_iat");
  params.delete("ba_pl");
  params.delete("ba_param");

  return `${apiBaseUrl.replace(/\/$/, "")}/api/auth/oauth2/authorize?${params}`;
}
