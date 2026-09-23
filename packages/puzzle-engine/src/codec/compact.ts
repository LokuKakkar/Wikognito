import { z } from "zod";
import type { ClientPuzzle, ClientPuzzleToken, PublicPuzzleDto, TokenType } from "@redactle/shared";
import { normalizeWord } from "../normalizer/word-normalizer.js";

const KIND = {
  word: 0,
  whitespace: 1,
  punctuation: 2,
  text: 3,
} as const;

const KIND_BY_NUM: TokenType[] = ["word", "whitespace", "punctuation", "text"];

/**
 * Compact puzzle wire format V2 (pre-compression).
 * `title` is the article title text. `titleTokenIndexes` are indexes into `stream`.
 */
export interface CompactPuzzleV2 {
  v: 2;
  id: string;
  n: number;
  d: string;
  g: string;
  title: string;
  dict: string[];
  /** [kind, dictIndex, flags, wordLength?] — flags: bit0 redacted, bit1 inTitle */
  stream: number[][];
  /** Stream indices of required guessable title word tokens (win condition). */
  titleTokenIndexes: number[];
}

export const CompactPuzzleV2Schema = z
  .object({
    v: z.literal(2),
    id: z.string(),
    n: z.number(),
    d: z.string(),
    g: z.string(),
    title: z.string(),
    dict: z.array(z.string()),
    stream: z.array(z.array(z.number())),
    titleTokenIndexes: z.array(z.number().int()),
  })
  .superRefine((data, ctx) => {
    for (const index of data.titleTokenIndexes) {
      if (index < 0 || index >= data.stream.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `titleTokenIndexes contains invalid stream index ${index}`,
        });
        continue;
      }
      const kind = data.stream[index]?.[0];
      if (kind !== KIND.word) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `titleTokenIndexes ${index} does not point to a word token`,
        });
      }
    }
  });

export function toCompactPuzzle(puzzle: ClientPuzzle): CompactPuzzleV2 {
  const dict: string[] = [];
  const indexByValue = new Map<string, number>();

  function intern(value: string): number {
    const existing = indexByValue.get(value);
    if (existing !== undefined) return existing;
    const idx = dict.length;
    dict.push(value);
    indexByValue.set(value, idx);
    return idx;
  }

  const stream: number[][] = [];
  const titleTokenIndexes: number[] = [];
  const titleIdSet = new Set(puzzle.titleTokenIds);
  const title = puzzle.title;

  for (const token of puzzle.content) {
    const streamIndex = stream.length;
    if (token.type === "word") {
      const value = token.displayValue ?? token.matchKey ?? "";
      const dictIndex = intern(value);
      let flags = 0;
      if (token.redacted) flags |= 1;
      if (token.inTitle) flags |= 2;
      stream.push([KIND.word, dictIndex, flags, token.wordLength ?? value.length]);
      if (titleIdSet.has(token.tokenId)) {
        titleTokenIndexes.push(streamIndex);
      }
    } else {
      const value = token.displayValue ?? "";
      const dictIndex = intern(value);
      stream.push([KIND[token.type], dictIndex, 0]);
    }
  }

  return {
    v: 2,
    id: puzzle.puzzleId,
    n: puzzle.puzzleNumber,
    d: puzzle.scheduledDate,
    g: puzzle.generatorVersion,
    title,
    dict,
    stream,
    titleTokenIndexes,
  };
}

export function fromCompactPuzzle(compact: CompactPuzzleV2): ClientPuzzle {
  const content: ClientPuzzleToken[] = [];

  for (let i = 0; i < compact.stream.length; i += 1) {
    const entry = compact.stream[i]!;
    const kind = KIND_BY_NUM[entry[0]!] ?? "text";
    const dictIndex = entry[1]!;
    const value = compact.dict[dictIndex] ?? "";
    const tokenId = `t-${i}`;

    if (kind === "word") {
      const flags = entry[2] ?? 0;
      const redacted = (flags & 1) === 1;
      const inTitle = (flags & 2) === 2;
      const wordLength = entry[3] ?? value.length;
      const matchKey = normalizeWord(value);
      content.push({
        tokenId,
        type: "word",
        wordLength,
        inTitle,
        redacted,
        matchKey,
        // Decoded model may retain displayValue for local reveal; Network never sees this JSON.
        displayValue: value,
      });
    } else {
      content.push({
        tokenId,
        type: kind,
        redacted: false,
        displayValue: value,
      });
    }
  }

  const titleTokenIds = compact.titleTokenIndexes
    .map((idx) => content[idx]?.tokenId)
    .filter((id): id is string => Boolean(id));

  return {
    puzzleId: compact.id,
    puzzleNumber: compact.n,
    scheduledDate: compact.d,
    generatorVersion: compact.g,
    titleTokenIds,
    title: compact.title,
    content,
  };
}

export function isCompactPuzzleV2(value: unknown): value is CompactPuzzleV2 {
  return CompactPuzzleV2Schema.safeParse(value).success;
}

export function publicDtoFromMeta(
  meta: Pick<PublicPuzzleDto, "id" | "puzzleNumber" | "scheduledDate" | "generatorVersion">,
  payload: string,
): PublicPuzzleDto {
  return {
    id: meta.id,
    puzzleNumber: meta.puzzleNumber,
    scheduledDate: meta.scheduledDate,
    generatorVersion: meta.generatorVersion,
    payload,
  };
}
