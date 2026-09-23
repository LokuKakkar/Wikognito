export const GUESS_BUCKET_SIZE = 10;
export const GUESS_BUCKET_SIZE_FINE = 5;
export const MIN_COARSE_BUCKETS = 5;
/** Last labeled start; everything at or above this is one overflow bar. */
export const GUESS_OVERFLOW_START = 201;

export interface GuessHistogramBucket {
  start: number;
  end: number;
  count: number;
  label: string;
}

export interface GuessHistogram {
  bucketSize: number;
  buckets: GuessHistogramBucket[];
}

export function bucketStartForGuesses(guessCount: number, bucketSize = GUESS_BUCKET_SIZE): number {
  const n = Math.max(1, Math.round(guessCount));
  if (n >= GUESS_OVERFLOW_START) return GUESS_OVERFLOW_START;
  return Math.floor((n - 1) / bucketSize) * bucketSize + 1;
}

export function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  const fraction = value / exp;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * exp;
}

export function yAxisTicks(maxValue: number): number[] {
  const top = niceCeiling(maxValue);
  if (top <= 1) return [0, 1];
  const mid = top / 2;
  if (!Number.isInteger(mid)) return [0, top];
  return [0, mid, top];
}

function lastOccupiedStart(histogram: Record<string, number>, bucketSize: number): number {
  let lastStart = 1;
  let found = false;
  for (const [key, count] of Object.entries(histogram)) {
    const guesses = Number(key);
    if (!Number.isFinite(guesses) || count <= 0) continue;
    found = true;
    lastStart = Math.max(lastStart, bucketStartForGuesses(guesses, bucketSize));
  }
  return found ? lastStart : 0;
}

function bucketCountForLastStart(lastStart: number, bucketSize: number): number {
  if (lastStart <= 0) return 0;
  if (lastStart >= GUESS_OVERFLOW_START) {
    return Math.floor((GUESS_OVERFLOW_START - 1) / bucketSize) + 1;
  }
  return Math.floor((lastStart - 1) / bucketSize) + 1;
}

export function chooseGuessBucketSize(histogram: Record<string, number>): number {
  const lastTen = lastOccupiedStart(histogram, GUESS_BUCKET_SIZE);
  if (lastTen === 0) return GUESS_BUCKET_SIZE;
  const coarseCount = bucketCountForLastStart(lastTen, GUESS_BUCKET_SIZE);
  return coarseCount < MIN_COARSE_BUCKETS ? GUESS_BUCKET_SIZE_FINE : GUESS_BUCKET_SIZE;
}

function bucketsForSize(histogram: Record<string, number>, bucketSize: number): GuessHistogramBucket[] {
  const counts = new Map<number, number>();
  let lastStart = 1;
  for (const [key, count] of Object.entries(histogram)) {
    const guesses = Number(key);
    if (!Number.isFinite(guesses) || count <= 0) continue;
    const start = bucketStartForGuesses(guesses, bucketSize);
    counts.set(start, (counts.get(start) ?? 0) + count);
    lastStart = Math.max(lastStart, start);
  }
  if (counts.size === 0) return [];

  const buckets: GuessHistogramBucket[] = [];
  for (let start = 1; start <= lastStart; start += bucketSize) {
    const overflow = start >= GUESS_OVERFLOW_START;
    const end = overflow ? Number.POSITIVE_INFINITY : start + bucketSize - 1;
    buckets.push({
      start,
      end,
      count: counts.get(start) ?? 0,
      label: overflow ? `${GUESS_OVERFLOW_START}+` : String(start),
    });
    if (overflow) break;
  }
  return buckets;
}

export function buildGuessHistogram(histogram: Record<string, number>): GuessHistogram {
  const bucketSize = chooseGuessBucketSize(histogram);
  return { bucketSize, buckets: bucketsForSize(histogram, bucketSize) };
}
