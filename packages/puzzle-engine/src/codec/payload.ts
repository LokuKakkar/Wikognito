import { deflateSync, inflateSync } from "fflate";
import type { ClientPuzzle, PublicPuzzleDto } from "@redactle/shared";
import {
  CompactPuzzleV2Schema,
  fromCompactPuzzle,
  publicDtoFromMeta,
  toCompactPuzzle,
  type CompactPuzzleV2,
} from "./compact.js";

/**
 * Client-known obfuscation key. Not a secret — only makes the Network tab
 * payload opaque rather than readable JSON. A determined user can reverse this.
 */
const OBFUSCATION_KEY = new TextEncoder().encode("redactle-phase1.1-client-payload-v1");

function xorObfuscate(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) {
    out[i] = bytes[i]! ^ OBFUSCATION_KEY[i % OBFUSCATION_KEY.length]!;
  }
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const b64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(encoded: string): Uint8Array {
  const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  if (typeof atob === "function") {
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  return new Uint8Array(Buffer.from(padded, "base64"));
}

export interface PayloadBenchmark {
  rawArticleBytes: number;
  legacyClientJsonBytes: number;
  compactJsonBytes: number;
  compressedBytes: number;
  encodedPayloadBytes: number;
}

/**
 * Serialize → deflate → XOR obfuscate → base64url.
 * Runs at ingestion time, not request time.
 */
export function encodeClientPayload(puzzle: ClientPuzzle): string {
  const compact = toCompactPuzzle(puzzle);
  const json = new TextEncoder().encode(JSON.stringify(compact));
  const compressed = deflateSync(json, { level: 9 });
  const obfuscated = xorObfuscate(compressed);
  return toBase64Url(obfuscated);
}

export function decodeClientPayload(payload: string): ClientPuzzle {
  const obfuscated = fromBase64Url(payload);
  const compressed = xorObfuscate(obfuscated);
  const jsonBytes = inflateSync(compressed);
  const parsed: unknown = JSON.parse(new TextDecoder().decode(jsonBytes));
  const version =
    parsed && typeof parsed === "object" && "v" in parsed ? (parsed as { v: unknown }).v : undefined;
  if (version !== 2) {
    throw new Error(`Unsupported compact puzzle version: ${String(version)}`);
  }
  const result = CompactPuzzleV2Schema.safeParse(parsed);
  if (!result.success) {
    throw new Error("Invalid compact puzzle payload");
  }
  return fromCompactPuzzle(result.data);
}

export function buildPublicPuzzleDto(puzzle: ClientPuzzle): PublicPuzzleDto {
  return publicDtoFromMeta(
    {
      id: puzzle.puzzleId,
      puzzleNumber: puzzle.puzzleNumber,
      scheduledDate: puzzle.scheduledDate,
      generatorVersion: puzzle.generatorVersion,
    },
    encodeClientPayload(puzzle),
  );
}

export function restampPublicPuzzleDto(
  dto: PublicPuzzleDto,
  meta: Pick<PublicPuzzleDto, "id" | "puzzleNumber" | "scheduledDate">,
): PublicPuzzleDto {
  const puzzle = decodeClientPayload(dto.payload);
  return buildPublicPuzzleDto({
    ...puzzle,
    puzzleId: meta.id,
    puzzleNumber: meta.puzzleNumber,
    scheduledDate: meta.scheduledDate,
    generatorVersion: dto.generatorVersion,
  });
}

export function measurePayloadSizes(options: {
  rawArticle: string;
  legacyClientJson: string;
  puzzle: ClientPuzzle;
}): PayloadBenchmark {
  const compact: CompactPuzzleV2 = toCompactPuzzle(options.puzzle);
  const compactJson = JSON.stringify(compact);
  const compressed = deflateSync(new TextEncoder().encode(compactJson), { level: 9 });
  const encoded = encodeClientPayload(options.puzzle);

  return {
    rawArticleBytes: new TextEncoder().encode(options.rawArticle).length,
    legacyClientJsonBytes: new TextEncoder().encode(options.legacyClientJson).length,
    compactJsonBytes: new TextEncoder().encode(compactJson).length,
    compressedBytes: compressed.length,
    encodedPayloadBytes: encoded.length,
  };
}
