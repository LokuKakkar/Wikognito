import { loadGameStateForPuzzle } from "./local-storage";

export function isLocalPuzzleSolved(puzzleId: string): boolean {
  return loadGameStateForPuzzle(puzzleId)?.status === "WON";
}

export function mergeDossierPlayState(
  puzzleId: string,
  serverState: "SOLVED" | "UNSOLVED",
): "SOLVED" | "UNSOLVED" {
  if (serverState === "SOLVED" || isLocalPuzzleSolved(puzzleId)) {
    return "SOLVED";
  }
  return "UNSOLVED";
}
