/** True when Better Auth / oauthProviderClient will resume authorize via window.location. */
export function shouldDeferToOAuthContinue(
  data: unknown,
  search: string,
): boolean {
  if (
    data &&
    typeof data === "object" &&
    "redirect" in data &&
    Boolean((data as { redirect?: boolean }).redirect)
  ) {
    return true;
  }

  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  return params.has("sig");
}
