"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { verifyEmail } from "@/lib/api";
import { AppShell } from "./layout/AppShell";
import { Dossier } from "./layout/Dossier";
import { useMe } from "@/features/auth/useMe";

export function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const { refresh } = useMe();
  const [status, setStatus] = useState<"working" | "ok" | "error">(token ? "working" : "error");
  const [message, setMessage] = useState(token ? "Verifying…" : "Missing verification token.");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void verifyEmail(token)
      .then(() => {
        if (cancelled) return;
        setStatus("ok");
        setMessage("Email verified.");
        return refresh();
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(caught instanceof Error ? caught.message : "This link is invalid or has expired.");
      });
    return () => {
      cancelled = true;
    };
  }, [token, refresh]);

  return (
    <AppShell>
      <main className="page">
        <Dossier kicker="Credentials" title="Verify email" clip={false}>
        <p className="muted">
          <Link href="/">← Back to today’s puzzle</Link>
        </p>
        <p className={status === "error" ? "error" : "muted"}>{message}</p>
        </Dossier>
      </main>
    </AppShell>
  );
}
