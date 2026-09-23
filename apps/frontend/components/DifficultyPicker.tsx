"use client";

import { PLAY_DIFFICULTIES, type PlayDifficulty } from "@redactle/shared";

const LABELS: Record<PlayDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

interface DifficultyPickerProps {
  value: PlayDifficulty;
  onChange: (difficulty: PlayDifficulty) => void;
}

export function DifficultyPicker({ value, onChange }: DifficultyPickerProps) {
  return (
    <div className="difficulty-field">
      <div className="theme-toggle difficulty-toggle" role="group" aria-label="Difficulty">
        {PLAY_DIFFICULTIES.map((level) => (
          <button
            key={level}
            type="button"
            aria-pressed={value === level}
            onClick={() => onChange(level)}
          >
            {LABELS[level]}
          </button>
        ))}
      </div>
    </div>
  );
}
