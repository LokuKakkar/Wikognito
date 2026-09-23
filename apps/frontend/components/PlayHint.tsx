"use client";

import type { ReactNode } from "react";

interface PlayHintProps {
  children: ReactNode;
  id?: string;
  onDismiss?: () => void;
}

/**
 * Instructional copy (hints, coaching, how-to notes). Kept out of the
 * handwritten notepad so it reads as interface text.
 */
export function PlayHint({ children, id, onDismiss }: PlayHintProps) {
  return (
    <div className="play-hint" id={id} role="note">
      <div className="play-hint-body">{children}</div>
      {onDismiss ? (
        <button type="button" className="play-hint-dismiss" onClick={onDismiss}>
          Got it
        </button>
      ) : null}
    </div>
  );
}
