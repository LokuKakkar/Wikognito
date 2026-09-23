"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { HistoryResponse } from "@redactle/shared";
import { ApiRequestError, fetchHistory, googleAuthUrl } from "@/lib/api";
import { formatAccuracy, formatDurationMs } from "@/lib/share";
import { AppShell } from "./layout/AppShell";
import { Dossier } from "./layout/Dossier";
import { VerifyEmailBanner } from "./VerifyEmailBanner";

export function HistoryPage() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [unauthenticated, setUnauthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchHistory(page)
      .then((response) => {
        if (!cancelled) {
          setData(response);
          setUnauthenticated(false);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        if (caught instanceof ApiRequestError && caught.status === 401) {
          setUnauthenticated(true);
          return;
        }
        setError(caught instanceof Error ? caught.message : "Could not load history.");
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AppShell>
      <main className="page">
        <VerifyEmailBanner />
        <Dossier wide kicker="Filed cases" title="My Games">
        {unauthenticated ? (
          <p>
            Sign in to see your official history.{" "}
            <Link href="/login">Sign in</Link>
            {" · "}
            <a href={googleAuthUrl()}>Sign in with Google</a>
          </p>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        {data ? (
          <ul className="history-list">
            {data.items.map((item) => (
              <li key={`${item.puzzleId}-${item.completedAt}`}>
                <Link href={`/?puzzle=${encodeURIComponent(item.puzzleId)}`}>
                  <span>#{item.puzzleNumber}</span>
                  <span>{item.date ?? "Unknown date"}</span>
                  <span>{item.won ? "Won" : "Gave Up"}</span>
                  <span className="muted">
                    {item.won ? `${item.guessCount} guesses · ${formatDurationMs(item.durationMs)}` : ""}
                    {formatAccuracy(item.guessAccuracy) ? ` · ${formatAccuracy(item.guessAccuracy)}` : ""}
                    {` · ${item.source === "DAILY" ? "Daily" : "Archive"}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {data && data.total === 0 ? <p className="muted">No official games yet.</p> : null}
        {data && data.total > data.pageSize ? (
          <div className="pager">
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </button>
            <span className="muted">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        ) : null}
        </Dossier>
      </main>
    </AppShell>
  );
}
