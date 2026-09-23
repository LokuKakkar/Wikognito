"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { UserStatsResponse } from "@redactle/shared";
import { ApiRequestError, fetchUserStats, googleAuthUrl } from "@/lib/api";
import { formatAccuracy, formatDurationMs } from "@/lib/share";
import { AppShell } from "./layout/AppShell";
import { Dossier } from "./layout/Dossier";
import { VerifyEmailBanner } from "./VerifyEmailBanner";
import { ActivityCalendar } from "./stats/ActivityCalendar";
import { useMe } from "@/features/auth/useMe";
import { DetectiveAvatar } from "./avatar/DetectiveAvatar";
import { AvatarPicker } from "./avatar/AvatarPicker";
import { DeskProp } from "./desk/DeskProp";

function formatWinRate(winRate: number): string {
  return `${(winRate * 100).toFixed(1)}%`;
}

function formatAverageGuesses(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(1);
}

export function StatsGrid({ stats }: { stats: UserStatsResponse }) {
  return (
    <dl className="stats-grid">
      <div>
        <dt>Games Played</dt>
        <dd>{stats.gamesPlayed}</dd>
      </div>
      <div>
        <dt>Games Won</dt>
        <dd>{stats.gamesWon}</dd>
      </div>
      <div>
        <dt>Games Given Up</dt>
        <dd>{stats.gamesGaveUp}</dd>
      </div>
      <div>
        <dt>Win Rate</dt>
        <dd>{formatWinRate(stats.winRate)}</dd>
      </div>
      <div>
        <dt>Current Streak</dt>
        <dd>{stats.currentStreak}</dd>
      </div>
      <div>
        <dt>Longest Streak</dt>
        <dd>{stats.longestStreak}</dd>
      </div>
      <div>
        <dt>Average Guesses</dt>
        <dd>{formatAverageGuesses(stats.averageGuesses)}</dd>
      </div>
      <div>
        <dt>Average Time</dt>
        <dd>{stats.averageCompletionTimeMs == null ? "—" : formatDurationMs(stats.averageCompletionTimeMs)}</dd>
      </div>
      <div>
        <dt>Guess Accuracy</dt>
        <dd>{formatAccuracy(stats.guessAccuracy) ?? "—"}</dd>
      </div>
    </dl>
  );
}

export function ProfilePage() {
  const { user, loading } = useMe();
  const [stats, setStats] = useState<UserStatsResponse | null>(null);
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
          return;
        }
        setError(caught instanceof Error ? caught.message : "Could not load stats.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signedOut = unauthenticated || (!loading && !user);
  const seed = user?.id ?? user?.displayName ?? user?.email ?? "detective";

  return (
    <AppShell>
      <main className="page">
        <VerifyEmailBanner />
        <Dossier
          kicker="Investigator"
          title="Detective Dossier"
          decor={
            <DeskProp
              className="dossier-hat"
              src="/assets/detective/objects/hat.png"
              width={200}
              height={147}
              loading="eager"
            />
          }
        >
          {signedOut ? (
            <p>
              Sign in to see your profile and statistics.{" "}
              <Link href="/login">Sign in</Link>
              {" · "}
              <a href={googleAuthUrl()}>Sign in with Google</a>
            </p>
          ) : null}
          {error ? <p className="error">{error}</p> : null}
          {user ? (
            <section className="profile-card">
              <DetectiveAvatar seed={seed} self size="lg" alt="" />
              <div>
                <h2>{user.displayName ?? user.email ?? "Player"}</h2>
                <p className="muted">{user.email}</p>
                <p className="muted">
                  <Link href="/settings">Settings</Link>
                  {" · "}
                  <Link href="/history">History</Link>
                </p>
              </div>
            </section>
          ) : null}
          {user ? (
            <section className="settings-section">
              <h2>Portrait</h2>
              <p className="muted">Choose a detective portrait. It stays on this device.</p>
              <AvatarPicker seed={seed} />
            </section>
          ) : null}
          {stats ? (
            <>
              <StatsGrid stats={stats} />
              <h2>Activity</h2>
              <ActivityCalendar activity={stats.activity ?? []} calendarStart={stats.calendarStart} />
            </>
          ) : null}
        </Dossier>
      </main>
    </AppShell>
  );
}
