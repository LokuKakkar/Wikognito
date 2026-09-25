"use client";

import { useEffect, useState } from "react";
import type { ClientPuzzle, OfficialResultSummary } from "@redactle/shared";
import { fetchDossierCase } from "@/lib/api";

export function useDossierPuzzle(play?: { slug: string; caseId: string }) {
  const [puzzle, setPuzzle] = useState<ClientPuzzle | null>(null);
  const [officialResult, setOfficialResult] = useState<OfficialResultSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(play));

  useEffect(() => {
    if (!play) {
      setPuzzle(null);
      setOfficialResult(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchDossierCase(play.slug, play.caseId)
      .then((data) => {
        if (!cancelled) {
          setPuzzle(data.puzzle);
          setOfficialResult(data.officialResult);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load case file");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [play?.slug, play?.caseId]);

  return { puzzle, officialResult, error, loading };
}
