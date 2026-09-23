/** Next index when cycling through guess occurrences; wraps and is a no-op for empty lists. */
export function nextOccurrenceIndex(current: number | undefined, count: number): number {
  if (count <= 0) return 0;
  return (current ?? 0) % count;
}

export function advanceOccurrenceCursor(
  cursor: Map<string, number>,
  guess: string,
  count: number,
): number {
  const index = nextOccurrenceIndex(cursor.get(guess), count);
  if (count > 0) {
    cursor.set(guess, index + 1);
  }
  return index;
}
