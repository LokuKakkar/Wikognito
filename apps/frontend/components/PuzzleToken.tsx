"use client";

import { memo, useState } from "react";
import type { ClientPuzzleToken } from "@redactle/shared";

interface PuzzleTokenProps {
  token: ClientPuzzleToken;
  revealed: boolean;
  justRevealed?: boolean;
  historyFocus?: boolean;
  revealDelayMs?: number;
  displayValue?: string;
}

export const PuzzleTokenView = memo(function PuzzleTokenView({
  token,
  revealed,
  justRevealed = false,
  historyFocus = false,
  revealDelayMs = 0,
  displayValue,
}: PuzzleTokenProps) {
  const [inspecting, setInspecting] = useState(false);

  if (token.type === "whitespace") {
    const value = token.displayValue ?? " ";
    if (value.includes("\n")) {
      return (
        <>
          {value.split("\n").map((part, index, arr) => (
            <span key={`${token.tokenId}-${index}`}>
              {part}
              {index < arr.length - 1 ? <br /> : null}
            </span>
          ))}
        </>
      );
    }
    return <span>{value}</span>;
  }

  if (token.type === "punctuation" || token.type === "text") {
    return <span>{token.displayValue ?? ""}</span>;
  }

  if (!token.redacted || revealed) {
    const text = revealed ? (displayValue ?? token.displayValue ?? "") : (token.displayValue ?? "");
    const classes = [
      "word",
      token.inTitle ? "in-title" : "",
      revealed ? "revealed" : "",
      justRevealed ? "just-revealed" : "",
      historyFocus ? "history-focus" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <span
        className={classes}
        data-token-id={token.tokenId}
        style={justRevealed && revealDelayMs ? { animationDelay: `${revealDelayMs}ms` } : undefined}
      >
        {text}
      </span>
    );
  }

  const blocks = "█".repeat(token.wordLength ?? 1);
  const letters = token.wordLength ?? "?";

  function toggleInspect() {
    setInspecting((open) => !open);
  }

  return (
    <span
      className={`word redacted${token.inTitle ? " in-title" : ""}${inspecting ? " inspecting" : ""}${historyFocus ? " history-focus" : ""}`}
      data-token-id={token.tokenId}
      data-word-length={token.wordLength}
      role="button"
      tabIndex={0}
      aria-label={`${letters} letters`}
      aria-pressed={inspecting}
      onClick={toggleInspect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          toggleInspect();
        }
      }}
    >
      <span className="redacted-blocks" aria-hidden>
        {blocks}
      </span>
      {inspecting ? <span className="letter-count">{letters}</span> : null}
    </span>
  );
});
