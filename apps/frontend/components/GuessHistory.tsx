"use client";

import { Check, CircleDot, Minus } from "lucide-react";
import { PlayHint } from "./PlayHint";
import { Icon } from "./ui/Icon";

export interface GuessHistoryRowProps {
  guess: string;
  hits: number;
  isTitleHit?: boolean;
  justWritten?: boolean;
  /** Newest visible note — where the pen parks and scribbles. */
  penAnchor?: boolean;
  /** First recovered word while the locate tip is still showing. */
  locateAnchor?: boolean;
  onSelect?: (guess: string) => void;
}

export function GuessHistoryRow({
  guess,
  hits,
  isTitleHit = false,
  justWritten = false,
  penAnchor = false,
  locateAnchor = false,
  onSelect,
}: GuessHistoryRowProps) {
  const content = (
    <>
      <span className="guess-word">
        <span className="guess-word-text">{guess}</span>
        {isTitleHit ? (
          <span className="title-hit" aria-label="Title word">
            <Icon icon={CircleDot} size="chip" />
          </span>
        ) : null}
      </span>
      <span className="guess-hits">
        {hits > 0 ? (
          <>
            <Icon icon={Check} size="chip" /> {hits}
          </>
        ) : (
          <Icon icon={Minus} size="chip" />
        )}
      </span>
    </>
  );

  const rowClass = [
    hits > 0 ? "hit" : "miss",
    justWritten ? "just-written" : "",
    locateAnchor ? "locate-anchor" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!onSelect) {
    return (
      <li className={rowClass} data-pen-anchor={penAnchor ? "true" : undefined}>
        {content}
      </li>
    );
  }

  return (
    <li className={rowClass} data-pen-anchor={penAnchor ? "true" : undefined}>
      <button
        type="button"
        className="guess-row"
        disabled={hits === 0}
        title={hits > 0 ? "Show this word in the file. Click again for the next place it appears." : undefined}
        onClick={() => {
          if (hits > 0) onSelect(guess);
        }}
      >
        {content}
        {hits > 0 ? <span className="sr-only">Show in the file.</span> : null}
      </button>
    </li>
  );
}

interface GuessHistoryProps {
  guesses: string[];
  hitCounts: Map<string, number>;
  titleMatchKeys?: Set<string>;
  onGuessFocus?: (guess: string) => void;
  limit?: number;
  /** Animate only the newest note — never the rest of the history. */
  justWrittenGuess?: string | null;
  /** Point at a recovered word until the player has used the locate gesture. */
  showLocateHint?: boolean;
  onDismissLocateHint?: () => void;
}

export function GuessHistory({
  guesses,
  hitCounts,
  titleMatchKeys,
  onGuessFocus,
  limit,
  justWrittenGuess = null,
  showLocateHint = false,
  onDismissLocateHint,
}: GuessHistoryProps) {
  if (guesses.length === 0) {
    return (
      <>
        <PlayHint>Write the first word on the line. Notes land here.</PlayHint>
        <p className="guess-history guess-history-empty" data-pen-anchor="true" aria-hidden="true" />
      </>
    );
  }

  const ordered = [...guesses].reverse();
  const shown = limit != null ? ordered.slice(0, limit) : ordered;
  const firstHitIndex = shown.findIndex((guess) => (hitCounts.get(guess) ?? 0) > 0);
  const hint = showLocateHint && firstHitIndex >= 0;

  return (
    <>
      {hint ? (
        <PlayHint onDismiss={onDismissLocateHint}>
          Tap a recovered word to jump through the file. Each tap moves to the next place it appears.
        </PlayHint>
      ) : null}
      <ol className={`guess-history${hint ? " guess-history-coaching" : ""}`}>
        {shown.map((guess, index) => (
          <GuessHistoryRow
            key={`${guess}-${index}`}
            guess={guess}
            hits={hitCounts.get(guess) ?? 0}
            isTitleHit={titleMatchKeys?.has(guess) ?? false}
            justWritten={index === 0 && justWrittenGuess === guess}
            penAnchor={index === 0}
            locateAnchor={hint && index === firstHitIndex}
            onSelect={onGuessFocus}
          />
        ))}
      </ol>
    </>
  );
}
