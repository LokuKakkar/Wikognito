"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LeaderboardTodayResponse } from "@redactle/shared";
import { fetchTodayLeaderboard } from "@/lib/api";
import { AppShell } from "./layout/AppShell";
import { Dossier } from "./layout/Dossier";
import { useMe } from "@/features/auth/useMe";
import { DetectiveAvatar } from "./avatar/DetectiveAvatar";
import { DeskProp } from "./desk/DeskProp";

const MEDALS: Record<number, { src: string; width: number; height: number; label: string }> = {
  1: { src: "/assets/detective/ui/medal-1.png", width: 78, height: 96, label: "First" },
  2: { src: "/assets/detective/ui/medal-2.png", width: 78, height: 96, label: "Second" },
  3: { src: "/assets/detective/ui/medal-3.png", width: 78, height: 96, label: "Third" },
};

export function LeaderboardPage() {
  const { user } = useMe();
  const [data, setData] = useState<LeaderboardTodayResponse | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchTodayLeaderboard(page)
      .then((response) => {
        if (!cancelled) {
          setData(response);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load the leaderboard.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <AppShell>
      <main className="page">
        <Dossier
          wide
          kicker="Top Detectives"
          title="Today’s Wikognito"
          decor={
            <DeskProp
              className="leaderboard-plaque"
              src="/assets/detective/ui/plaque-leaderboard.png"
              width={280}
              height={108}
              loading="eager"
            />
          }
        >
          {data ? <p className="muted">Puzzle #{data.puzzleNumber}</p> : null}
          {!user ? (
            <p className="muted">
              Sign in to appear on today’s leaderboard. Gameplay is never blocked.{" "}
              <Link href="/login">Sign in</Link>
            </p>
          ) : null}
          {user && data && !data.played ? (
            <p className="muted">You haven’t played today’s puzzle yet.</p>
          ) : null}
          {user && data?.me ? (
            <p>
              Your rank: #{data.me.rank} · {data.me.score.toLocaleString()}
            </p>
          ) : null}
          {error ? <p className="error">{error}</p> : null}
          {data ? (
            <ol className="leaderboard-list">
              {data.entries.map((entry) => {
                const medal = MEDALS[entry.rank];
                const seed = `${entry.displayName}:${entry.rank}`;
                return (
                  <li
                    key={`${entry.rank}-${entry.displayName}`}
                    className={`leaderboard-row${entry.isCurrentUser ? " is-me" : ""}`}
                  >
                    <span className="leaderboard-rank">
                      {medal ? (
                        <img
                          className="leaderboard-medal"
                          src={medal.src}
                          alt={medal.label}
                          width={medal.width}
                          height={medal.height}
                          draggable={false}
                        />
                      ) : (
                        <span aria-hidden>#{entry.rank}</span>
                      )}
                      {medal ? <span className="sr-only">#{entry.rank}</span> : null}
                    </span>
                    <DetectiveAvatar
                      seed={seed}
                      self={entry.isCurrentUser}
                      size="sm"
                      alt=""
                    />
                    <span>{entry.displayName}</span>
                    <span>{entry.score.toLocaleString()}</span>
                  </li>
                );
              })}
            </ol>
          ) : null}
          {data && data.total === 0 ? <p className="muted">No scores yet today.</p> : null}
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
