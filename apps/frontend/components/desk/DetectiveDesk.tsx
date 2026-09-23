import type { ReactNode } from "react";

export type DeskVariant = "page" | "game";

interface DetectiveDeskProps {
  children: ReactNode;
  variant?: DeskVariant;
}

/**
 * The environment every screen sits inside: a dark desk surface, a vignette,
 * and a content layer above both. Purely presentational — it holds no state
 * and reads nothing from the game.
 *
 * The surface and vignette are fixed layers rather than a scrolling
 * background so the desk stays put while the document scrolls over it.
 */
export function DetectiveDesk({ children, variant = "page" }: DetectiveDeskProps) {
  return (
    <div className={`desk desk-${variant}`}>
      <div className="desk-surface" aria-hidden="true" />
      <div className="desk-vignette" aria-hidden="true" />
      <div className="desk-content">{children}</div>
    </div>
  );
}
