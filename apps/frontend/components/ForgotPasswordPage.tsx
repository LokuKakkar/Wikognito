"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/api";
import { AppShell } from "./layout/AppShell";
import { Dossier } from "./layout/Dossier";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await forgotPassword(email);
      setMessage(result.message);
    } catch {
      setMessage("If an account exists for this email, a password reset link has been sent.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <main className="page">
        <Dossier kicker="Credentials" title="Forgot password" clip={false}>
        <p className="muted">
          <Link href="/login">← Back to sign in</Link>
        </p>
        <form className="auth-form" onSubmit={(event) => void onSubmit(event)}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          {message ? <p className="muted">{message}</p> : null}
          <button type="submit" disabled={submitting}>
            Send reset link
          </button>
        </form>
        </Dossier>
      </main>
    </AppShell>
  );
}
