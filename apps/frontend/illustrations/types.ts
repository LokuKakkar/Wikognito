export type IllustrationPackId = "none" | "v1";

export type IllustrationKind = "mascot" | "decor";

export type IllustrationId =
  | "thinking"
  | "cheer"
  | "headscratch"
  | "revealed"
  | "victory"
  | "confused"
  | "books_big"
  | "reading_side"
  | "papers"
  | "reading_stack"
  | "writing"
  | "books_small"
  | "clue"
  | "wave"
  | "win_podium"
  | "hmm"
  | "article_title"
  | "sleeping"
  | "magnifier_e"
  | "glasses"
  | "doc"
  | "magnifier"
  | "signpost"
  | "books"
  | "text"
  | "question"
  | "thought"
  | "ink"
  | "bookmark"
  | "puzzle"
  | "eye"
  | "scroll"
  | "badge";

export type IllustrationSlot =
  | "caseIntroHero"
  | "howToHero"
  | "resultWonBadge"
  | "resultGaveUpBadge"
  | "pageHeaderDecoration"
  | "errorMascot";

export interface IllustrationAsset {
  id: IllustrationId;
  kind: IllustrationKind;
  src: string;
}

export interface SlotPlacement {
  enabled: boolean;
  assetId: IllustrationId;
  /**
   * Decorative by default. If you want it announced, set an alt string.
   * (Prefer keeping these decorative to avoid noise for screen readers.)
   */
  alt?: string;
  className?: string;
}

export interface IllustrationPack {
  id: IllustrationPackId;
  assets: Record<IllustrationId, IllustrationAsset>;
  slots: Partial<Record<IllustrationSlot, SlotPlacement>>;
}

