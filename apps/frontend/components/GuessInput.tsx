"use client";

import { useState, type FormEvent } from "react";
import { CornerDownLeft } from "lucide-react";
import { PlayHint } from "./PlayHint";
import { Icon } from "./ui/Icon";

interface GuessInputProps {
  disabled: boolean;
  onGuess: (guess: string) => void;
  /** First-investigation note pointing at the writing line. */
  coach?: boolean;
  onDismissCoach?: () => void;
}

export function GuessInput({ disabled, onGuess, coach = false, onDismissCoach }: GuessInputProps) {
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onGuess(trimmed);
    setValue("");
  }

  return (
    <form className={`guess-form${coach ? " guess-form-coach" : ""}`} onSubmit={handleSubmit}>
      {coach ? (
        <PlayHint id="guess-coach" onDismiss={onDismissCoach}>
          Start here. Write any word you think the article uses.
        </PlayHint>
      ) : null}
      <div className="guess-write">
        <label htmlFor="guess-input" className="guess-prompt">
          Write a word
        </label>
        <div className="guess-line">
          <input
            id="guess-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={disabled}
            placeholder="from the file"
            autoComplete="off"
            autoFocus
            aria-describedby={coach ? "guess-coach" : undefined}
          />
          <button type="submit" disabled={disabled || !value.trim()}>
            Guess
            <Icon icon={CornerDownLeft} size="chip" />
          </button>
        </div>
      </div>
    </form>
  );
}
