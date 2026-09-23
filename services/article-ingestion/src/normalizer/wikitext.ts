import { createHash } from "node:crypto";
import wtf from "wtf_wikipedia";

const DROP_SECTIONS = new Set([
  "references",
  "see also",
  "external links",
  "notes",
  "bibliography",
  "further reading",
  "citations",
  "sources",
  "notes and references",
  "footnotes",
]);

export function convertWikitextToPlaintext(wikitext: string): string {
  const doc = wtf(wikitext);
  const parts: string[] = [];

  for (const section of doc.sections()) {
    const heading = section.title().trim();
    if (DROP_SECTIONS.has(heading.toLowerCase())) {
      continue;
    }
    const body = section.text({}).trim();
    if (!heading && !body) {
      continue;
    }
    parts.push(heading ? `${heading}\n\n${body}`.trim() : body);
  }

  let text = parts.join("\n\n");
  if (!text) {
    text = doc.text().trim();
  }
  text = text.replace(/\[(?:\d+|[a-z])\]/gi, "");
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function hashContent(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function validateNormalizedArticle(input: { title: string; body: string }): void {
  if (!input.title.trim()) {
    throw new Error("Article title is empty.");
  }
  if (!input.body.trim()) {
    throw new Error("Article body is empty.");
  }
}
