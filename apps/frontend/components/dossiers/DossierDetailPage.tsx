"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DossierDetail } from "@redactle/shared";
import { fetchDossier } from "@/lib/api";
import { mergeDossierPlayState } from "@/lib/dossier-progress";
import { AppShell } from "../layout/AppShell";
import { Dossier } from "../layout/Dossier";
import { VerifyEmailBanner } from "../VerifyEmailBanner";
import { RedactedTitle } from "./RedactedTitle";

export function DossierDetailPage({ slug }: { slug: string }) {
  const [data, setData] = useState<DossierDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchDossier(slug)
      .then((response) => {
        if (!cancelled) {
          setData(response);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load dossier.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const cases = useMemo(
    () =>
      (data?.cases ?? []).map((item) => ({
        ...item,
        playState: mergeDossierPlayState(item.puzzleId, item.playState),
      })),
    [data],
  );
  const solvedCount = cases.filter((item) => item.playState === "SOLVED").length;
  const closed = cases.length > 0 && solvedCount === cases.length;
  const playCase = cases.find((item) => item.playState === "UNSOLVED") ?? cases[0];
  const playLabel = closed ? "Replay dossier" : solvedCount > 0 ? "Continue dossier" : "Play dossier";

  return (
    <AppShell>
      <main className="page">
        <VerifyEmailBanner />
        <Dossier wide kicker="Investigation folder" title={data?.title ?? "Dossier"}>
          {data ? <p className="muted">{data.description}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          {data ? (
            <p className="muted">
              Progress {solvedCount} / {cases.length}
            </p>
          ) : null}
          {playCase ? (
            <p className="dossier-play-row">
              <Link className="dossier-play-button" href={`/dossiers/${slug}/cases/${playCase.id}`}>
                {playLabel}
              </Link>
              <span className="muted">
                Plays case files in order, starting at Case {String(playCase.position).padStart(2, "0")}.
              </span>
            </p>
          ) : null}
          {closed ? (
            <p className="dossier-closed-banner">
              DOSSIER CLOSED — All case files solved. {solvedCount} / {cases.length} CASE FILES COMPLETE
            </p>
          ) : null}
          <ol className="archive-list dossier-cases">
            {cases.map((item) => {
              const solved = item.playState === "SOLVED";
              const caseLabel = `Case ${String(item.position).padStart(2, "0")}`;
              return (
                <li key={item.id}>
                  <Link
                    href={`/dossiers/${slug}/cases/${item.id}`}
                    aria-label={`${caseLabel}, ${solved ? "solved" : "unsolved"}`}
                  >
                    <span className="dossier-case-number">{String(item.position).padStart(2, "0")}</span>
                    <span className="archive-case-meta">
                      <RedactedTitle
                        title={item.title}
                        wordLengths={item.titleWordLengths}
                        revealed={solved}
                      />
                      <span className={solved ? "play-state solved" : "play-state"}>
                        {solved ? "Solved" : "Unsolved"}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          <p>
            <Link href="/dossiers">All dossiers</Link>
          </p>
        </Dossier>
      </main>
    </AppShell>
  );
}
