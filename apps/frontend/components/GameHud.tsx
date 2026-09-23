"use client";

import { CircleHelp, Flag } from "lucide-react";
import { Icon } from "./ui/Icon";

interface GameHudProps {
  guessCount: number;
  canGiveUp: boolean;
  onGiveUp: () => void;
  onBriefing?: () => void;
}

export function GameHud({ guessCount, canGiveUp, onGiveUp, onBriefing }: GameHudProps) {
  return (
    <div className="game-hud">
      <div className="control-chips">
        <span className="chip">{guessCount} guesses</span>
        {onBriefing ? (
          <button type="button" className="briefing-link" onClick={onBriefing}>
            <Icon icon={CircleHelp} size="chip" />
            Briefing
          </button>
        ) : null}
        {canGiveUp ? (
          <button
            type="button"
            className="give-up-link"
            onClick={() => {
              if (window.confirm("Give up and reveal the article?")) {
                onGiveUp();
              }
            }}
          >
            <Icon icon={Flag} size="chip" />
            Give up
          </button>
        ) : null}
      </div>
    </div>
  );
}
