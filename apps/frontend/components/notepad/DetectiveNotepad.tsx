"use client";

import type { ReactNode } from "react";
import { Pen } from "./Pen";

interface DetectiveNotepadProps {
  /** Bumped once per submitted guess so the pen can react. */
  penTick: number;
  /** Brief pad reaction for the current guess only. */
  reaction?: "idle" | "reject" | "confirm";
  children: ReactNode;
}

/**
 * The physical notebook the player writes guesses into: ruled paper, a wire
 * binding, and the pen lying across it. Everything inside stays real,
 * interactive HTML — the notepad only supplies the surface.
 */
export function DetectiveNotepad({ penTick, reaction = "idle", children }: DetectiveNotepadProps) {
  return (
    <div className="notepad" data-note-reaction={reaction}>
      <span className="notepad-binding" aria-hidden="true" />
      <div className="notepad-sheet">
        {reaction !== "idle" ? (
          <span key={penTick} className={`notepad-flash notepad-flash-${reaction}`} aria-hidden="true" />
        ) : null}
        <p className="notepad-title">Detective notes</p>
        {children}
      </div>
      <Pen tick={penTick} />
    </div>
  );
}
