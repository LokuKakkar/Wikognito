import { describe, expect, it } from "vitest";
import {
  clearInflectionCacheForTests,
  expandInflectionalForms,
  isInflectionalDuplicate,
} from "./expand-forms.js";

describe("expandInflectionalForms", () => {
  it("includes singular and plural for nouns", () => {
    const forms = expandInflectionalForms("dog");
    expect(forms.has("dog")).toBe(true);
    expect(forms.has("dogs")).toBe(true);
  });

  it("includes verb conjugations for run", () => {
    const forms = expandInflectionalForms("run");
    expect(forms.has("run")).toBe(true);
    expect(forms.has("ran")).toBe(true);
    expect(forms.has("runs")).toBe(true);
    expect(forms.has("running")).toBe(true);
  });

  it("returns the same set from cache on repeated calls", () => {
    const first = [...expandInflectionalForms("child")].sort();
    const second = [...expandInflectionalForms("child")].sort();
    expect(second).toEqual(first);
    expect(first).toContain("children");
  });

  it("does not throw on empty or odd input", () => {
    expect(expandInflectionalForms("")).toEqual(new Set());
    expect(expandInflectionalForms("   ")).toEqual(new Set());
    expect(() => expandInflectionalForms("!!!")).not.toThrow();
    expect(expandInflectionalForms("!!!").size).toBe(0);
  });

  it("re-seeds after cache clear", () => {
    clearInflectionCacheForTests();
    const forms = expandInflectionalForms("go");
    expect(forms.has("went")).toBe(true);
  });
});

describe("isInflectionalDuplicate", () => {
  it("detects exact and family duplicates", () => {
    expect(isInflectionalDuplicate(["dog"], "dog")).toBe(true);
    expect(isInflectionalDuplicate(["dog"], "dogs")).toBe(true);
    expect(isInflectionalDuplicate(["dog"], "cat")).toBe(false);
  });
});
