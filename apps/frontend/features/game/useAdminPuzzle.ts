"use client";

import { useEffect, useState } from "react";
import type { ClientPuzzle } from "@redactle/shared";
import { fetchAdminArticlePuzzle } from "@/lib/api";

export function useAdminPuzzle(articleId: string | undefined) {
  const [puzzle, setPuzzle] = useState<ClientPuzzle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(articleId));

  useEffect(() => {
    if (!articleId) {
      setPuzzle(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await fetchAdminArticlePuzzle(articleId);
        console.log("data", data);
        if (!cancelled) {
          setPuzzle(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setPuzzle(null);
          setError(err instanceof Error ? err.message : "Failed to load puzzle");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  return { puzzle, error, loading };
}
