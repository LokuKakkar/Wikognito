"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ArchiveListResponse } from "@redactle/shared";
import { fetchArchiveList } from "@/lib/api";
import { AppShell } from "./layout/AppShell";
import { Dossier } from "./layout/Dossier";
import { VerifyEmailBanner } from "./VerifyEmailBanner";
import { DeskProp } from "./desk/DeskProp";

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function ArchivePage() {
  const [data, setData] = useState<ArchiveListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchArchiveList(page)
      .then((response) => {
        if (!cancelled) {
          setData(response);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load archive.");
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
        <VerifyEmailBanner />
        <Dossier
          wide
          kicker="Historical investigations"
          title="Case File Archive"
          decor={
            <DeskProp
              className="archive-stamp"
              src="/assets/detective/ui/stamp-archive.png"
              width={138}
              height={140}
              loading="eager"
            />
          }
        >
          <p className="muted">Past daily puzzles, newest first. Today’s puzzle is not listed here.</p>
          {error ? <p className="error">{error}</p> : null}
          {data ? (
            <ul className="archive-list">
              {data.items.map((item) => {
                const solved = item.playState === "COMPLETED";
                return (
                  <li key={item.puzzleId}>
                    <Link href={`/?puzzle=${encodeURIComponent(item.puzzleId)}`}>
                      <img
                        className="archive-folder"
                        src={
                          solved
                            ? "/assets/detective/ui/folder-solved.png"
                            : "/assets/detective/ui/folder-available.png"
                        }
                        alt=""
                        width={160}
                        height={solved ? 123 : 125}
                        draggable={false}
                      />
                      <span className="archive-case-meta">
                        <span>#{item.puzzleNumber}</span>
                        <span className="muted">{formatDate(item.date)}</span>
                      </span>
                      <span className="play-state">{solved ? "Replay" : "Play"}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {data && data.total === 0 ? <p className="muted">No archived puzzles yet.</p> : null}
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
