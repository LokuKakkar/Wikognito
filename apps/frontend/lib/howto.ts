import { HOWTO_STORAGE_KEY } from "@redactle/shared";

const GUESS_TIP_KEY = "redactle:tip:guess:v1";
const LOCATE_TIP_KEY = "redactle:tip:locate:v1";

function readFlag(key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return true;
  }
}

function writeFlag(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Persistence is optional if storage is unavailable.
  }
}

function clearFlag(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Persistence is optional if storage is unavailable.
  }
}

export function hasSeenHowTo(): boolean {
  return readFlag(HOWTO_STORAGE_KEY);
}

export function markHowToSeen(): void {
  writeFlag(HOWTO_STORAGE_KEY);
}

export function hasSeenGuessTip(): boolean {
  return readFlag(GUESS_TIP_KEY);
}

export function markGuessTipSeen(): void {
  writeFlag(GUESS_TIP_KEY);
}

export function hasSeenLocateTip(): boolean {
  return readFlag(LOCATE_TIP_KEY);
}

export function markLocateTipSeen(): void {
  writeFlag(LOCATE_TIP_KEY);
}

export function resetHowTo(): void {
  clearFlag(HOWTO_STORAGE_KEY);
  clearFlag(GUESS_TIP_KEY);
  clearFlag(LOCATE_TIP_KEY);
}
