import { Inflectors } from "en-inflectors";
import { normalizeWord } from "../normalizer/word-normalizer.js";
import { SEED_LEMMAS } from "./seed-forms.js";

const CACHE_MAX = 2000;

/** LRU-ish cache: Map insertion order; re-set on hit to move to end. */
const formCache = new Map<string, string[]>();

function cacheGet(key: string): string[] | undefined {
  const hit = formCache.get(key);
  if (!hit) return undefined;
  formCache.delete(key);
  formCache.set(key, hit);
  return hit;
}

function cacheSet(key: string, forms: string[]): void {
  if (formCache.has(key)) {
    formCache.delete(key);
  }
  formCache.set(key, forms);
  while (formCache.size > CACHE_MAX) {
    const oldest = formCache.keys().next().value;
    if (oldest === undefined) break;
    formCache.delete(oldest);
  }
}

function safeForm(fn: () => string): string | null {
  try {
    const value = fn();
    if (typeof value !== "string" || !value) return null;
    const normalized = normalizeWord(value);
    return normalized || null;
  } catch {
    return null;
  }
}

function computeForms(word: string): string[] {
  const forms = new Set<string>([word]);

  try {
    const instance = new Inflectors(word);
    const candidates = [
      () => instance.toSingular(),
      () => instance.toPlural(),
      () => instance.toPresent(),
      () => instance.toPresentS(),
      () => instance.toPast(),
      () => instance.toPastParticiple(),
      () => instance.toGerund(),
      () => instance.comparative(),
      () => instance.superlative(),
    ];

    for (const candidate of candidates) {
      const form = safeForm(candidate);
      if (form) forms.add(form);
    }
  } catch {
    // Keep the original word only if the library rejects the input.
  }

  return [...forms];
}

/**
 * Expand a normalized word into related inflectional surface forms
 * (noun singular/plural, verb conjugations, adjective degrees).
 * Results are cached in memory (seeded with common lemmas).
 */
export function expandInflectionalForms(word: string): Set<string> {
  const normalized = normalizeWord(word);
  if (!normalized) {
    return new Set();
  }

  const cached = cacheGet(normalized);
  if (cached) {
    return new Set(cached);
  }

  const forms = computeForms(normalized);
  cacheSet(normalized, forms);
  return new Set(forms);
}

/** True when two normalized guesses share any inflectional form. */
export function sharesInflectionalFamily(a: string, b: string): boolean {
  const formsA = expandInflectionalForms(a);
  if (formsA.size === 0) return false;
  const formsB = expandInflectionalForms(b);
  for (const form of formsB) {
    if (formsA.has(form)) return true;
  }
  return false;
}

/** True when `guess` overlaps any previously submitted guess's form family. */
export function isInflectionalDuplicate(guesses: readonly string[], guess: string): boolean {
  const nextForms = expandInflectionalForms(guess);
  if (nextForms.size === 0) return false;

  for (const previous of guesses) {
    if (previous === guess) return true;
    const prevForms = expandInflectionalForms(previous);
    for (const form of nextForms) {
      if (prevForms.has(form)) return true;
    }
  }
  return false;
}

/** Test helper: clear runtime cache entries (re-seeds common lemmas). */
export function clearInflectionCacheForTests(): void {
  formCache.clear();
  warmSeedCache();
}

function warmSeedCache(): void {
  for (const lemma of SEED_LEMMAS) {
    const key = normalizeWord(lemma);
    if (!key || formCache.has(key)) continue;
    formCache.set(key, computeForms(key));
  }
}

warmSeedCache();
