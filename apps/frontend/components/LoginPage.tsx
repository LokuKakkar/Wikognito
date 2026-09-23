"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiRequestError, googleAuthUrl, loginWithEmail, registerWithEmail } from "@/lib/api";
import { AppShell } from "./layout/AppShell";
import { Dossier } from "./layout/Dossier";

export function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "register") {
        await registerWithEmail(email, password, displayName || undefined);
      } else {
        await loginWithEmail(email, password);
      }
      router.push("/");
    } catch (caught: unknown) {
      if (caught instanceof ApiRequestError) {
        setError(caught.message);
      } else {
        setError("Could not sign in.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <main className="page">
        <Dossier kicker="Credentials" title="Sign in" clip={false}>
        <p className="muted">
          Authentication is optional. Sign in to keep official stats and appear on today’s
          leaderboard, or keep playing anonymously.
        </p>
        <p>
          <a className="auth-sign-in" href={googleAuthUrl()}>
            Sign in with Google
          </a>
        </p>
        <form className="auth-form" onSubmit={(event) => void onSubmit(event)}>
          <h2>{mode === "login" ? "Email and password" : "Create an account"}</h2>
          {mode === "register" ? (
            <label>
              Display name
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="nickname"
              />
            </label>
          ) : null}
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
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={8}
              required
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={submitting}>
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        {mode === "login" ? (
          <p className="muted">
            <Link href="/forgot-password">Forgot password?</Link>
          </p>
        ) : null}
        <p className="muted">
          {mode === "login" ? (
            <button type="button" className="auth-switch" onClick={() => setMode("register")}>
              Need an account? Register
            </button>
          ) : (
            <button type="button" className="auth-switch" onClick={() => setMode("login")}>
              Already have an account? Sign in
            </button>
          )}
        </p>
        </Dossier>
      </main>
    </AppShell>
  );
}
