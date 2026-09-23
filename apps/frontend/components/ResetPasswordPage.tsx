"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/api";
import { AppShell } from "./layout/AppShell";
import { Dossier } from "./layout/Dossier";

export function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setMessage("Password reset. Sign in with your new password.");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not reset password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <main className="page">
        <Dossier kicker="Credentials" title="Reset password" clip={false}>
        <p className="muted">
          <Link href="/login">← Back to sign in</Link>
        </p>
        <form className="auth-form" onSubmit={(event) => void onSubmit(event)}>
          <label>
            New password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          {message ? <p className="muted">{message}</p> : null}
          <button type="submit" disabled={submitting || !token}>
            Reset password
          </button>
        </form>
        </Dossier>
      </main>
    </AppShell>
  );
}
