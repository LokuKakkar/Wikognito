"use client";

import { useState } from "react";
import { resendVerification } from "@/lib/api";
import { useMe } from "@/features/auth/useMe";

export function VerifyEmailBanner() {
  const { user, refresh } = useMe();
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!user || user.emailVerified || !user.hasPassword) {
    return null;
  }

  return (
    <div className="verify-banner" role="status">
      <span>Verify {user.email ?? "your email"} to finish setting up your account.</span>
      <button
        type="button"
        className="auth-switch"
        disabled={sending}
        onClick={() => {
          setSending(true);
          void resendVerification()
            .then(() => {
              setMessage("Verification email sent.");
              return refresh();
            })
            .catch(() => setMessage("Could not send verification email."))
            .finally(() => setSending(false));
        }}
      >
        Resend
      </button>
      {message ? <span className="muted">{message}</span> : null}
    </div>
  );
}
