import type { IllustrationAsset, IllustrationId, IllustrationPack } from "../types";

function asset(id: IllustrationId, kind: "mascot" | "decor"): IllustrationAsset {
  return { id, kind, src: `/illustrations/v1/${kind}/${id}.svg` };
}

export const ILLUSTRATIONS_V1: IllustrationPack = {
  id: "v1",
  assets: {
    thinking: asset("thinking", "mascot"),
    cheer: asset("cheer", "mascot"),
    headscratch: asset("headscratch", "mascot"),
    revealed: asset("revealed", "mascot"),
    victory: asset("victory", "mascot"),
    confused: asset("confused", "mascot"),
    books_big: asset("books_big", "mascot"),
    reading_side: asset("reading_side", "mascot"),
    papers: asset("papers", "mascot"),
    reading_stack: asset("reading_stack", "mascot"),
    writing: asset("writing", "mascot"),
    books_small: asset("books_small", "mascot"),
    clue: asset("clue", "mascot"),
    wave: asset("wave", "mascot"),
    win_podium: asset("win_podium", "mascot"),
    hmm: asset("hmm", "mascot"),
    article_title: asset("article_title", "mascot"),
    sleeping: asset("sleeping", "mascot"),

    magnifier_e: asset("magnifier_e", "decor"),
    glasses: asset("glasses", "decor"),
    doc: asset("doc", "decor"),
    magnifier: asset("magnifier", "decor"),
    signpost: asset("signpost", "decor"),
    books: asset("books", "decor"),
    text: asset("text", "decor"),
    question: asset("question", "decor"),
    thought: asset("thought", "decor"),
    ink: asset("ink", "decor"),
    bookmark: asset("bookmark", "decor"),
    puzzle: asset("puzzle", "decor"),
    eye: asset("eye", "decor"),
    scroll: asset("scroll", "decor"),
    badge: asset("badge", "decor"),
  },
  slots: {
    caseIntroHero: { enabled: true, assetId: "thinking", className: "illo illo-float" },
    howToHero: { enabled: true, assetId: "papers", className: "illo illo-sway" },
    resultWonBadge: { enabled: true, assetId: "win_podium", className: "illo illo-pop" },
    resultGaveUpBadge: { enabled: true, assetId: "confused", className: "illo illo-pop" },
    pageHeaderDecoration: { enabled: true, assetId: "badge", className: "illo illo-sparkle" },
    errorMascot: { enabled: true, assetId: "headscratch", className: "illo illo-float" },
  },
};

