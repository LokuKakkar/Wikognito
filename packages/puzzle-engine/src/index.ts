export { normalizeWord, normalizeGuess, normalizeTitle } from "./normalizer/word-normalizer.js";
export {
  expandInflectionalForms,
  isInflectionalDuplicate,
  sharesInflectionalFamily,
} from "./inflection/expand-forms.js";
export { tokenizeText } from "./tokenizer/tokenizer.js";
export { redactTokens } from "./redactor/redactor.js";
export { matchGuess } from "./matcher/matcher.js";
export { generatePuzzle } from "./generator/puzzle-generator.js";
export type { GeneratePuzzleInput, GeneratedPuzzle } from "./generator/puzzle-generator.js";
export { createGame, deserializeGameState, restoreGame } from "./game/game-engine.js";
export type { GameEngine } from "./game/game-engine.js";
export { countHitGuesses, guessAccuracy } from "./game/hit-guesses.js";
export { computeDifficultyV1, normalizeRange } from "./scoring/difficulty.js";
export type { DifficultyInput, DifficultyResult } from "./scoring/difficulty.js";
export { calculateScoreV1, guessEfficiency, timeEfficiency, difficultyFactor } from "./scoring/score.js";
export type { ScoreInput } from "./scoring/score.js";
export { simulateTitleWin } from "./game/simulate-win.js";
export type { SimulateTitleWinResult } from "./game/simulate-win.js";
export type { PuzzleToken } from "./models/token.js";
export {
  encodeClientPayload,
  decodeClientPayload,
  buildPublicPuzzleDto,
  restampPublicPuzzleDto,
  measurePayloadSizes,
} from "./codec/payload.js";
export type { PayloadBenchmark } from "./codec/payload.js";
export { toCompactPuzzle, fromCompactPuzzle, CompactPuzzleV2Schema } from "./codec/compact.js";
export type { CompactPuzzleV2 } from "./codec/compact.js";
