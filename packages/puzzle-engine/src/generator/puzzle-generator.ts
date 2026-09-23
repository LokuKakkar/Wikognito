import { COMMON_VISIBLE_WORDS, type ClientPuzzle, type ClientPuzzleToken, type PublicPuzzleDto } from "@redactle/shared";
import type { PuzzleToken } from "../models/token.js";
import { normalizeTitle } from "../normalizer/word-normalizer.js";
import { tokenizeText } from "../tokenizer/tokenizer.js";
import { redactTokens } from "../redactor/redactor.js";
import { buildPublicPuzzleDto } from "../codec/payload.js";

export interface GeneratePuzzleInput {
  puzzleId: string;
  puzzleNumber: number;
  scheduledDate: string;
  generatorVersion: string;
  title: string;
  body: string;
}

export interface GeneratedPuzzle {
  clientPuzzle: ClientPuzzle;
  /** Opaque public DTO stored in DB / Redis / returned by API. */
  publicDto: PublicPuzzleDto;
  /** Server-only tokens including plaintext for redacted words. */
  serverTokens: PuzzleToken[];
  title: string;
  titleMatchKey: string;
  wordCount: number;
  guessableWordCount: number;
  uniqueGuessableWordCount: number;
  titleTokenCount: number;
}

function toClientToken(token: PuzzleToken): ClientPuzzleToken {
  if (token.redacted) {
    return {
      tokenId: token.tokenId,
      type: token.type,
      wordLength: token.wordLength,
      inTitle: token.inTitle,
      redacted: true,
      // Keep matchKey/display only in the decoded model after opaque transport.
      // During generation we still need them to build the compact dictionary.
      matchKey: token.matchKey,
      displayValue: token.displayValue,
    };
  }

  return {
    tokenId: token.tokenId,
    type: token.type,
    wordLength: token.wordLength,
    inTitle: token.inTitle,
    redacted: false,
    displayValue: token.displayValue,
    matchKey: token.type === "word" ? token.matchKey : undefined,
  };
}

/**
 * Build a published puzzle representation from raw article title + body.
 * Pipeline: tokenize → redact → client model → opaque public DTO.
 */
export function generatePuzzle(input: GeneratePuzzleInput): GeneratedPuzzle {
  const titleMatchKey = normalizeTitle(input.title);

  const rawTitleTokens = tokenizeText(input.title, { idPrefix: "title" });
  const titleWordMatchKeys = rawTitleTokens
    .filter((token) => token.type === "word" && token.matchKey)
    .map((token) => token.matchKey!);
  const titleMatchKeys = new Set(titleWordMatchKeys);
  const requiredTitleMatchKeys = new Set(
    titleWordMatchKeys.filter((key) => !COMMON_VISIBLE_WORDS.has(key)),
  );

  const titleTokens = rawTitleTokens.map((token) => ({
    ...token,
    inTitle: token.type === "word" ? true : token.inTitle,
  }));

  const bodyTokens = tokenizeText(input.body, {
    idPrefix: "body",
    titleMatchKeys,
  });

  const separator: PuzzleToken = {
    tokenId: "sep-0",
    type: "whitespace",
    displayValue: "\n\n",
    redacted: false,
  };

  const allTokens = [...titleTokens, separator, ...bodyTokens];
  const redacted = redactTokens(allTokens);
  const clientContent = redacted.map(toClientToken);
  const titleTokenIds = clientContent
    .filter(
      (token) =>
        token.type === "word" && token.matchKey && requiredTitleMatchKeys.has(token.matchKey),
    )
    .map((token) => token.tokenId);
  const wordTokens = redacted.filter((token) => token.type === "word");
  const guessableTokens = wordTokens.filter((token) => token.redacted);
  const wordCount = wordTokens.length;
  const guessableWordCount = guessableTokens.length;
  const uniqueGuessableWordCount = new Set(
    guessableTokens.map((token) => token.matchKey).filter(Boolean),
  ).size;

  const clientPuzzle: ClientPuzzle = {
    puzzleId: input.puzzleId,
    puzzleNumber: input.puzzleNumber,
    scheduledDate: input.scheduledDate,
    generatorVersion: input.generatorVersion,
    titleTokenIds,
    title: input.title,
    content: clientContent,
  };

  // Strip displayValue from redacted tokens in the in-memory client model used after decode.
  // The compact encoder uses displayValue/matchKey to fill the dictionary before encoding.
  const publicDto = buildPublicPuzzleDto(clientPuzzle);

  return {
    clientPuzzle: {
      ...clientPuzzle,
      content: clientPuzzle.content.map((token) =>
        token.redacted
          ? {
              ...token,
              displayValue: undefined,
            }
          : token,
      ),
    },
    publicDto,
    serverTokens: redacted,
    title: input.title,
    titleMatchKey,
    wordCount,
    guessableWordCount,
    uniqueGuessableWordCount,
    titleTokenCount: titleTokenIds.length,
  };
}
