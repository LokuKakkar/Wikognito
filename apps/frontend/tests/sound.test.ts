import { describe, expect, it } from "vitest";
import { playGameSound } from "../lib/sound";

describe("playGameSound", () => {
  it("does nothing when sound is off", () => {
    expect(() => playGameSound("hit", "off")).not.toThrow();
    expect(() => playGameSound("title", "off")).not.toThrow();
    expect(() => playGameSound("win", "off")).not.toThrow();
    expect(() => playGameSound("miss", "off")).not.toThrow();
    expect(() => playGameSound("scribble", "off")).not.toThrow();
    expect(() => playGameSound("paper", "off")).not.toThrow();
    expect(() => playGameSound("stamp", "off")).not.toThrow();
  });
});
