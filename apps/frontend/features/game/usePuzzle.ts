"use client";

import { useEffect, useState } from "react";
import type { ClientPuzzle, OfficialResultSummary } from "@redactle/shared";
import { fetchArchivePuzzle, fetchTodayPuzzle } from "@/lib/api";

export function usePuzzle(enabled = true, archivePuzzleId?: string) {
  const [puzzle, setPuzzle] = useState<ClientPuzzle | null>(null);
  const [officialResult, setOfficialResult] = useState<OfficialResultSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setPuzzle(null);
      setOfficialResult(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        if (archivePuzzleId) {
          const data = await fetchArchivePuzzle(archivePuzzleId);
          if (!cancelled) {
            setPuzzle(data.puzzle);
            setOfficialResult(data.officialResult);
            setError(null);
          }
        } else {
          const data = await fetchTodayPuzzle();
          if (!cancelled) {
            setPuzzle(data);
            setOfficialResult(null);
            setError(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load puzzle");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, archivePuzzleId]);

  return { puzzle, officialResult, error, loading };
}
