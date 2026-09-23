"use client";

import { useEffect, type ReactNode } from "react";
import { ScrollText, X } from "lucide-react";
import { Icon } from "./ui/Icon";

interface GuessSheetProps {
  open: boolean;
  guessCount: number;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
}

export function GuessSheet({ open, guessCount, onOpen, onClose, children }: GuessSheetProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <button type="button" className="guess-sheet-toggle" onClick={onOpen}>
        <Icon icon={ScrollText} size="chip" />
        Guesses · {guessCount}
      </button>
      {open ? (
        <div className="guess-sheet-backdrop" role="presentation" onClick={onClose}>
          <div
            className="guess-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Guess history"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="guess-sheet-head">
              <strong>Guesses</strong>
              <button type="button" className="icon-button" aria-label="Close guesses" onClick={onClose}>
                <Icon icon={X} />
              </button>
            </div>
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
