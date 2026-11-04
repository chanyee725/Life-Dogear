"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui";

/**
 * Starts Google sign-in through Auth.js's own endpoint (`POST /api/auth/signin/google`
 * with its CSRF token). Not a server action: signed-out requests may not POST to pages.
 */
export function GoogleSignInButton({ redirectTo }: { redirectTo: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      type="button"
      variant="primary"
      className="w-full"
      disabled={pending}
      onClick={() => {
        setPending(true);
        signIn("google", { redirectTo }).catch(() => setPending(false));
      }}
    >
      Google로 로그인
    </Button>
  );
}
