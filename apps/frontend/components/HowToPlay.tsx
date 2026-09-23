"use client";

import { useEffect } from "react";
import { CircleHelp } from "lucide-react";
import { Icon } from "./ui/Icon";
import { DeskProp } from "./desk/DeskProp";

interface HowToPlayProps {
  onDismiss: () => void;
  /** Full page before a case, or a desk overlay opened mid-investigation. */
  presentation?: "page" | "overlay";
  dismissLabel?: string;
}

export function HowToPlay({
  onDismiss,
  presentation = "page",
  dismissLabel = "Continue",
}: HowToPlayProps) {
  useEffect(() => {
    if (presentation !== "overlay") return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss, presentation]);

  const card = (
    <section className="case-card briefing-card" role="dialog" aria-labelledby="howto-title" aria-modal={presentation === "overlay"}>
      <div className="briefing-head">
        <div>
          <p className="case-kicker">
            <Icon icon={CircleHelp} />
            Field briefing
          </p>
          <h1 id="howto-title" className="page-title">
            How a case is solved
          </h1>
        </div>
        <DeskProp
          className="briefing-magnifier"
          src="/assets/detective/objects/magnifier.png"
          width={112}
          height={200}
          loading="eager"
        />
      </div>
      <p className="briefing-lead">
        The page on your desk is a Wikipedia article. Common words stay visible. Everything else is blacked
        out. The title is the name of the case. Find those words to solve it.
      </p>
      <ol className="briefing-moves">
        <li className="briefing-move">
          <span className="briefing-move-kicker">First</span>
          <strong>Write a word</strong>
          <p>
            Type it on the line at the bottom of your notes, then guess. If that word is in the article, it
            shows up everywhere it appears.
          </p>
        </li>
        <li className="briefing-move">
          <span className="briefing-move-kicker">Then</span>
          <strong>Tap a correct guess</strong>
          <p>
            Right guesses stay in your notes. Tap one to jump to it in the file. Tap again to see the next
            place it shows up.
          </p>
        </li>
      </ol>
      <ul className="briefing-notes">
        <li>
          <strong>Black bars.</strong> Tap one to see how many letters it hides.
        </li>
        <li>
          <strong>Word forms count.</strong> “city” also finds “cities”.
        </li>
        <li>
          <strong>Title words</strong> are marked in gold. Find all of them to close the case.
        </li>
        {presentation === "page" ? (
          <li>
            <strong>Difficulty.</strong> Easy leaves more everyday words visible. Hard blacks out more of them.
            Change it in Settings. That choice is kept for the puzzles that follow.
          </li>
        ) : null}
      </ul>
      <button type="button" className="replay" onClick={onDismiss}>
        {dismissLabel}
      </button>
    </section>
  );

  if (presentation === "overlay") {
    return (
      <div className="modal-backdrop" role="presentation" onClick={onDismiss}>
        <div className="briefing-overlay" onClick={(event) => event.stopPropagation()}>
          {card}
        </div>
      </div>
    );
  }

  return card;
}
