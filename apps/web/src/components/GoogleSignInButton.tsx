import { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { socialCallbackUrls } from "@/lib/social-auth";

export function GoogleSignInButton({
  onError,
}: {
  onError: (message: string) => void;
}) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    onError("");
    setLoading(true);

    const { callbackURL, errorCallbackURL } = socialCallbackUrls({
      origin: window.location.origin,
      pathname: location.pathname,
      search: location.search,
      returnTo: searchParams.get("returnTo"),
    });

    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL,
      errorCallbackURL,
    });

    setLoading(false);

    if (error) {
      onError(error.message ?? "Google sign-in failed");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      size="lg"
      disabled={loading}
      onClick={signInWithGoogle}
    >
      <GoogleMark />
      {loading ? "Redirecting…" : "Continue with Google"}
    </Button>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.82-.07-1.64-.23-2.43H12v4.6h6.46a5.52 5.52 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.55-5.17 3.55-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.97-1.07 7.96-2.93l-3.88-3c-1.08.72-2.47 1.14-4.08 1.14-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.25A7.2 7.2 0 0 1 4.89 12c0-.78.14-1.53.38-2.25V6.66H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.34l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.96 1.14 15.23 0 12 0 7.31 0 3.26 2.69 1.27 6.66l4 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}
