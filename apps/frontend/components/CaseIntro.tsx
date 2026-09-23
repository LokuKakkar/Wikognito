"use client";

import { BookOpen } from "lucide-react";
import { Icon } from "./ui/Icon";
import { DeskProp } from "./desk/DeskProp";

interface CaseIntroProps {
  puzzleNumber: number;
  scheduledDate: string;
  onBegin: () => void;
  onBriefing: () => void;
}

export function CaseIntro({ puzzleNumber, scheduledDate, onBegin, onBriefing }: CaseIntroProps) {
  return (
    <div className="illustrated-split">
      <section className="case-card case-intro-card" aria-labelledby="case-title">
        <p className="case-kicker">Today’s case</p>
        <h1 id="case-title" className="page-title">
          Puzzle #{puzzleNumber}
        </h1>
        <p className="case-filed">{scheduledDate}</p>
        <p className="case-lead">
          A Wikipedia article, blacked out. The words that name it are still hidden.
        </p>
        <ol className="case-moves">
          <li>
            <strong>Write a word</strong>
            <span>in your notes. That is how the file opens.</span>
          </li>
          <li>
            <strong>Tap a hit</strong>
            <span>to jump to every place that word sits in the article.</span>
          </li>
        </ol>
        <p className="case-aside">Everyday words are already visible. Recover every title word to close the case.</p>
        <div className="case-actions">
          <button type="button" className="replay" onClick={onBegin}>
            <Icon icon={BookOpen} />
            Begin the case
          </button>
          <button type="button" className="case-briefing-link" onClick={onBriefing}>
            Read the full briefing
          </button>
        </div>
      </section>
      <div className="illustrated-split-art" aria-hidden>
        <DeskProp
          className="intro-folders"
          src="/assets/detective/objects/folder-stack.png"
          width={280}
          height={217}
          loading="eager"
        />
      </div>
    </div>
  );
}
