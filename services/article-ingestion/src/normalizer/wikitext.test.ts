import { describe, expect, it } from "vitest";
import { convertWikitextToPlaintext, countWords, hashContent } from "./wikitext.js";

const SAMPLE = `{{Infobox animal
| name = Pet door
}}
A '''pet door''' or '''cat flap''' is a small opening that allows pets to enter.<ref>Smith 2020</ref>

== History ==
Pet doors have been used for centuries.

== References ==
{{Reflist}}

== See also ==
* Door

== External links ==
* [https://example.com Example]

[[Category:Doors]]
`;

describe("convertWikitextToPlaintext", () => {
  it("keeps readable prose and drops citation/reference machinery", () => {
    const text = convertWikitextToPlaintext(SAMPLE);
    expect(text.toLowerCase()).toContain("pet door");
    expect(text.toLowerCase()).toContain("small opening");
    expect(text).toContain("History");
    expect(text).not.toMatch(/\[\d+\]/);
    expect(text.toLowerCase()).not.toContain("category:doors");
    expect(text.toLowerCase()).not.toContain("see also");
    expect(text.toLowerCase()).not.toContain("external links");
    expect(text.toLowerCase()).not.toContain("{{infobox");
  });

  it("returns empty string for empty wikitext", () => {
    expect(convertWikitextToPlaintext("")).toBe("");
  });
});

describe("countWords / hashContent", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("one two three")).toBe(3);
    expect(countWords("  ")).toBe(0);
  });

  it("hashes normalized content stably", () => {
    expect(hashContent("hello")).toBe(hashContent("hello"));
    expect(hashContent("hello")).not.toBe(hashContent("Hello"));
    expect(hashContent("hello")).toMatch(/^[a-f0-9]{64}$/);
  });
});
