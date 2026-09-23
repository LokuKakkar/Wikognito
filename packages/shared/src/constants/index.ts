import type { ClientPuzzle } from "../types/tokens.js";

/**
 * Words that stay visible on every difficulty, including inside titles.
 * Hard uses only this set. Published puzzles are redacted against it;
 * easier difficulties reveal more of these words on the client.
 */
export const COMMON_VISIBLE_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "by",
  "with",
  "as",
  "at",
  "from",
  "is",
  "was",
  "are",
  "were",
  "be",
  "been",
  "being",
  "that",
  "this",
  "it",
  "its",
  "her",
  "his",
  "she",
  "he",
  "they",
  "their",
  "who",
  "which",
  "what",
  "when",
  "where",
  "how",
  "not",
  "but",
  "if",
  "than",
  "then",
  "so",
  "can",
  "could",
  "would",
  "should",
  "may",
  "might",
  "will",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
]);

/** Added on medium and easy. Pronouns, quantities, and a few verbs. */
export const MEDIUM_EXTRA_VISIBLE_WORDS = new Set([
  "i",
  "me",
  "my",
  "mine",
  "myself",
  "you",
  "your",
  "yours",
  "yourself",
  "we",
  "us",
  "our",
  "ours",
  "ourselves",
  "them",
  "theirs",
  "themselves",
  "these",
  "those",
  "such",
  "same",
  "some",
  "any",
  "all",
  "both",
  "each",
  "every",
  "either",
  "neither",
  "another",
  "other",
  "others",
  "more",
  "most",
  "few",
  "many",
  "much",
  "less",
  "least",
  "am",
  "become",
  "became",
  "becomes",
  "becoming",
  "been",
  "being",
  "having",
]);

/** Added on easy only, on top of the medium set. */
export const EASY_EXTRA_VISIBLE_WORDS = new Set([
  "make",
  "makes",
  "made",
  "making",
  "get",
  "gets",
  "got",
  "getting",
  "go",
  "goes",
  "went",
  "going",
  "come",
  "comes",
  "came",
  "coming",
  "also",
  "too",
  "very",
  "just",
  "only",
  "even",
  "still",
  "already",
  "again",
  "always",
  "often",
  "sometimes",
  "never",
  "ever",
  "usually",
  "generally",
  "about",
  "above",
  "across",
  "after",
  "against",
  "along",
  "among",
  "around",
  "before",
  "behind",
  "below",
  "beneath",
  "beside",
  "between",
  "during",
  "into",
  "near",
  "off",
  "over",
  "through",
  "throughout",
  "under",
  "until",
  "up",
  "upon",
  "within",
  "without",
  "because",
  "although",
  "though",
  "while",
  "whether",
  "unless",
  "since",
  "as",
  "yet",
  "nor",
  "once",
  "whereas",
  "however",
  "therefore",
  "there",
  "here",
  "now",
  "then",
  "why",
  "also",
  "thus",
  "well",
  "one",
  "two",
  "first",
  "second",
  "third",
  "own",
  "another",
  "whose",
  "whom",
  "whatever",
  "whoever",
  "whatever",
  "wherever",
  "whenever",
]);

export const PLAY_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type PlayDifficulty = (typeof PLAY_DIFFICULTIES)[number];
export const DEFAULT_PLAY_DIFFICULTY: PlayDifficulty = "easy";

function unionWords(base: ReadonlySet<string>, extra: ReadonlySet<string>): Set<string> {
  const words = new Set(base);
  for (const word of extra) words.add(word);
  return words;
}

const MEDIUM_VISIBLE_WORDS = unionWords(COMMON_VISIBLE_WORDS, MEDIUM_EXTRA_VISIBLE_WORDS);
const EASY_VISIBLE_WORDS = unionWords(MEDIUM_VISIBLE_WORDS, EASY_EXTRA_VISIBLE_WORDS);

export function isPlayDifficulty(value: string | null | undefined): value is PlayDifficulty {
  return value === "easy" || value === "medium" || value === "hard";
}

/** Stopwords left visible for a play difficulty. Easy is the widest set. */
export function visibleWordsForDifficulty(difficulty: PlayDifficulty): ReadonlySet<string> {
  if (difficulty === "hard") return COMMON_VISIBLE_WORDS;
  if (difficulty === "medium") return MEDIUM_VISIBLE_WORDS;
  return EASY_VISIBLE_WORDS;
}

/**
 * Reveal stopwords for the selected difficulty.
 * Published puzzles are redacted with the hard list. Easier settings open
 * additional common words client-side, including in the title, so they are
 * not guessed and are not required to win.
 */
export function applyPlayDifficulty(puzzle: ClientPuzzle, difficulty: PlayDifficulty): ClientPuzzle {
  const visible = visibleWordsForDifficulty(difficulty);
  const opened = new Set<string>();
  let changed = false;

  const content = puzzle.content.map((token) => {
    if (token.type !== "word" || !token.redacted || !token.matchKey || !visible.has(token.matchKey)) {
      return token;
    }
    changed = true;
    opened.add(token.tokenId);
    return {
      ...token,
      redacted: false,
      displayValue: token.displayValue ?? token.matchKey,
    };
  });

  if (!changed) return puzzle;

  return {
    ...puzzle,
    content,
    titleTokenIds: puzzle.titleTokenIds.filter((id) => !opened.has(id)),
  };
}

export const SESSION_COOKIE_NAME_DEFAULT = "redactle_session";
export const SESSION_TTL_SECONDS_DEFAULT = 2592000;
export const REDIS_SESSION_KEY_PREFIX = "redactle:session:";
export const REDIS_OAUTH_STATE_KEY_PREFIX = "redactle:oauth:state:";
export const OAUTH_STATE_TTL_SECONDS = 600;
export const FRONTEND_ORIGIN_DEFAULT = "http://localhost:3002";
export const GOOGLE_REDIRECT_URI_DEFAULT = "http://localhost:4000/api/auth/google/callback";
/** Versioned so stale V1 compact payloads are never served from cache. */
export const REDIS_PUZZLE_TODAY_KEY = "redactle:puzzle:v2:today";
export const LOCAL_STORAGE_GAME_KEY = "redactle:game";
/** Isolated from today's official game so admin previews cannot overwrite it. */
export const LOCAL_STORAGE_ADMIN_PLAY_KEY = "redactle:admin-play";

export function gameStorageKey(puzzleId: string): string {
  return `${LOCAL_STORAGE_GAME_KEY}:${puzzleId}`;
}

export const THEME_STORAGE_KEY = "redactle-theme";
export const HOWTO_STORAGE_KEY = "redactle:howto:v1";
export const SOUND_STORAGE_KEY = "redactle-sound";
export const PLAY_DIFFICULTY_STORAGE_KEY = "redactle-difficulty";

export const DIFFICULTY_VERSION = 1;
export const ACTIVITY_CALENDAR_START = "2026-07-01";
export const SCORE_VERSION = 1;
export const SCORE_MIN = 0;
export const SCORE_MAX = 10000;
export const SCORE_WEIGHT_GUESS = 0.65;
export const SCORE_WEIGHT_TIME = 0.25;
export const SCORE_WEIGHT_ACCURACY = 0.1;
export const DIFFICULTY_FACTOR_MIN = 0.88;
export const DIFFICULTY_FACTOR_SPAN = 0.24;
