/**
 * Word normalization: trim, lowercase, collapse whitespace,
 * strip surrounding punctuation for matching purposes.
 *
 * After normalize, matching expands the guess into inflectional forms
 * (see expandInflectionalForms). Article tokens are not stemmed.
 */
export function normalizeWord(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");
}

export function normalizeGuess(input: string): string | null {
  const normalized = normalizeWord(input);
  if (!normalized) {
    return null;
  }
  return normalized;
}

export function normalizeTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s]/gi, "")
    .trim();
}
