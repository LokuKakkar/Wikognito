"use client";

import { useSearchParams } from "next/navigation";
import { GamePage } from "./GamePage";

export function HomeGame() {
  const searchParams = useSearchParams();
  const puzzleId = searchParams.get("puzzle") ?? undefined;
  return <GamePage archivePuzzleId={puzzleId} />;
}
