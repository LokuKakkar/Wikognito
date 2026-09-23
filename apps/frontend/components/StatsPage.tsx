"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StatsResponse, UserStatsResponse } from "@redactle/shared";
import { ApiRequestError, fetchStats, fetchUserStats, googleAuthUrl } from "@/lib/api";
import { AppShell } from "./layout/AppShell";
import { Dossier } from "./layout/Dossier";
import { StatsGrid } from "./ProfilePage";
import { ActivityCalendar } from "./stats/ActivityCalendar";
import { TrendCharts } from "./stats/TrendCharts";

export function StatsPage() {
  const [stats, setStats] = useState<UserStatsResponse | null>(null);
  const [sessionStats, setSessionStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unauthenticated, setUnauthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchUserStats()
      .then((data) => {
        if (!cancelled) {
          setStats(data);
          setUnauthenticated(false);
        }
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        if (caught instanceof ApiRequestError && caught.status === 401) {
          setUnauthenticated(true);
          void fetchStats()
            .then((session) => {
              if (!cancelled) setSessionStats(session);
            })
            .catch(() => {
              if (!cancelled) setSessionStats(null);
            });
          return;
        }
        setError(caught instanceof Error ? caught.message : "Could not load stats.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell>
      <main className="page">
        <Dossier kicker="Investigation record" title="Stats">
        {unauthenticated ? (
          <p>
            Sign in to keep official results, streaks, and your activity calendar.{" "}
            <Link href="/login">Sign in</Link>
            {" · "}
            <a href={googleAuthUrl()}>Sign in with Google</a>
          </p>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        {stats ? (
          <>
            <StatsGrid stats={stats} />
            <p className="muted">
              <Link href="/history">View official history</Link>
              {" · "}
              <Link href="/leaderboard">Today’s leaderboard</Link>
            </p>
            <h2>Activity</h2>
            <ActivityCalendar activity={stats.activity ?? []} calendarStart={stats.calendarStart} />
            <TrendCharts trends={stats.trends ?? []} />
          </>
        ) : null}
        {unauthenticated && sessionStats ? (
          <dl className="stats-grid">
            <div>
              <dt>Session games</dt>
              <dd>{sessionStats.gamesPlayed}</dd>
            </div>
            <div>
              <dt>Session wins</dt>
              <dd>{sessionStats.gamesWon}</dd>
            </div>
          </dl>
        ) : null}
        </Dossier>
      </main>
    </AppShell>
  );
}
