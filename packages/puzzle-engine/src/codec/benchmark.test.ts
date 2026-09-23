import { describe, expect, it } from "vitest";
import { generatePuzzle } from "../generator/puzzle-generator.js";
import { measurePayloadSizes } from "./payload.js";

function articleOfWords(wordCount: number): string {
  const words = ["quantum", "physics", "theory", "particle", "energy", "field", "wave", "matter"];
  const out: string[] = [];
  for (let i = 0; i < wordCount; i += 1) {
    out.push(words[i % words.length]!);
  }
  return out.join(" ");
}

describe("payload size benchmark", () => {
  it("reports sizes for small, medium, and large articles", () => {
    const cases = [
      { name: "small", title: "Ada Lovelace", body: "Ada Lovelace was an English mathematician and writer." },
      { name: "medium", title: "Quantum Field Theory", body: articleOfWords(800) },
      { name: "large", title: "History of Physics", body: articleOfWords(5000) },
    ];

    const report: Record<string, ReturnType<typeof measurePayloadSizes>> = {};

    for (const c of cases) {
      const generated = generatePuzzle({
        puzzleId: `bench-${c.name}`,
        puzzleNumber: 1,
        scheduledDate: "2026-08-13",
        generatorVersion: "1.0.0",
        title: c.title,
        body: c.body,
      });
      const legacy = JSON.stringify(generated.clientPuzzle);
      report[c.name] = measurePayloadSizes({
        rawArticle: `${c.title}\n${c.body}`,
        legacyClientJson: legacy,
        puzzle: generated.clientPuzzle,
      });
    }

    console.info("\nPayload benchmark (bytes):\n", JSON.stringify(report, null, 2));

    expect(report.small!.encodedPayloadBytes).toBeLessThan(report.small!.legacyClientJsonBytes);
    expect(report.medium!.encodedPayloadBytes).toBeLessThan(report.medium!.legacyClientJsonBytes);
    expect(report.large!.encodedPayloadBytes).toBeLessThan(report.large!.legacyClientJsonBytes);
    // Large article encoded payload should stay well under a naive per-token JSON blowup.
    expect(report.large!.encodedPayloadBytes / report.large!.rawArticleBytes).toBeLessThan(3);
  });
});
