import { describe, expect, it } from "vitest";
import { tokenizeText } from "./tokenizer.js";
import { redactTokens } from "../redactor/redactor.js";

function wordValues(text: string): string[] {
  return tokenizeText(text)
    .filter((token) => token.type === "word")
    .map((token) => token.displayValue ?? "");
}

function sequence(text: string): Array<{ type: string; value: string }> {
  return tokenizeText(text).map((token) => ({
    type: token.type,
    value: token.displayValue ?? "",
  }));
}

describe("tokenizer", () => {
  it("splits apostrophes into word + visible separator + word", () => {
    const tokens = sequence("Einstein's");
    expect(tokens).toEqual([
      { type: "word", value: "Einstein" },
      { type: "punctuation", value: "'" },
      { type: "word", value: "s" },
    ]);
    expect(wordValues("Einstein's")).toEqual(["Einstein", "s"]);
  });

  it("treats Unicode apostrophes as separators", () => {
    expect(wordValues("Einstein\u2019s")).toEqual(["Einstein", "s"]);
  });

  it("splits hyphens into independently guessable words", () => {
    const tokens = sequence("mother-in-law");
    expect(tokens).toEqual([
      { type: "word", value: "mother" },
      { type: "punctuation", value: "-" },
      { type: "word", value: "in" },
      { type: "punctuation", value: "-" },
      { type: "word", value: "law" },
    ]);
  });

  it("keeps numbers as guessable word tokens", () => {
    expect(wordValues("Apollo 11")).toEqual(["Apollo", "11"]);
    expect(wordValues("1984")).toEqual(["1984"]);
    expect(wordValues("20th")).toEqual(["20th"]);
  });

  it("treats symbols as visible boundaries", () => {
    expect(sequence("50%")).toEqual([
      { type: "word", value: "50" },
      { type: "punctuation", value: "%" },
    ]);
    expect(sequence("C++")).toEqual([
      { type: "word", value: "C" },
      { type: "punctuation", value: "++" },
    ]);
    expect(sequence("AT&T")).toEqual([
      { type: "word", value: "AT" },
      { type: "punctuation", value: "&" },
      { type: "word", value: "T" },
    ]);
  });

  it("allows single-character non-common words to be guessable", () => {
    const redacted = redactTokens(tokenizeText("X A I"));
    expect(redacted.find((token) => token.matchKey === "x")?.redacted).toBe(true);
    expect(redacted.find((token) => token.matchKey === "a")?.redacted).toBe(false);
    // "i" is not in COMMON_VISIBLE_WORDS — only words on that list stay visible.
    expect(redacted.find((token) => token.matchKey === "i")?.redacted).toBe(true);
  });
});
