import { SOUND_STORAGE_KEY } from "@redactle/shared";

export type SoundPref = "off" | "quiet";

export type GameSoundKind = "hit" | "title" | "win" | "miss" | "scribble" | "paper" | "stamp";

export function readSoundPref(): SoundPref {
  if (typeof window === "undefined") return "off";
  try {
    return window.localStorage.getItem(SOUND_STORAGE_KEY) === "quiet" ? "quiet" : "off";
  } catch {
    return "off";
  }
}

export function writeSoundPref(pref: SoundPref): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, pref);
  } catch {
    // Persistence is optional if storage is unavailable.
  }
}

let audioContext: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor =
      window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!audioContext) audioContext = new Ctor();
    return audioContext;
  } catch {
    return null;
  }
}

function tone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  gain: number,
  type: OscillatorType = "sine",
): void {
  const oscillator = ctx.createOscillator();
  const amp = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(amp);
  amp.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function noiseBurst(
  ctx: AudioContext,
  start: number,
  duration: number,
  gain: number,
  frequency: number,
  q: number,
): void {
  const samples = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, samples, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < samples; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(gain, start + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter);
  filter.connect(amp);
  amp.connect(ctx.destination);
  source.start(start);
  source.stop(start + duration);
}

export function playGameSound(kind: GameSoundKind, pref: SoundPref = readSoundPref()): void {
  if (pref === "off" || typeof window === "undefined") return;
  try {
    const ctx = context();
    if (!ctx) return;
    void ctx.resume().catch(() => undefined);
    const now = ctx.currentTime;
    const gain = 0.04;
    if (kind === "hit") {
      tone(ctx, 520, now, 0.08, gain);
      return;
    }
    if (kind === "title") {
      tone(ctx, 440, now, 0.1, gain);
      tone(ctx, 660, now + 0.07, 0.12, gain);
      return;
    }
    if (kind === "win") {
      tone(ctx, 392, now, 0.12, gain);
      tone(ctx, 523, now + 0.1, 0.12, gain);
      tone(ctx, 659, now + 0.2, 0.18, gain);
      return;
    }
    if (kind === "miss") {
      tone(ctx, 196, now, 0.09, gain * 0.7, "triangle");
      return;
    }
    if (kind === "scribble") {
      noiseBurst(ctx, now, 0.09, gain * 0.55, 1800, 0.7);
      return;
    }
    if (kind === "paper") {
      noiseBurst(ctx, now, 0.12, gain * 0.45, 420, 0.5);
      return;
    }
    noiseBurst(ctx, now, 0.06, gain * 0.8, 180, 0.8);
    tone(ctx, 90, now, 0.08, gain * 0.5, "sine");
  } catch {
    // Autoplay policy, missing AudioContext, or a suspended tab — never block play.
  }
}
