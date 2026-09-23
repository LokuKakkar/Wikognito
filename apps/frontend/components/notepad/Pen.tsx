"use client";

import { useLayoutEffect, useRef, useState } from "react";

interface PenProps {
  /**
   * Increments once per submitted guess. The value is only used to restart
   * the scribble animation via a changing React key — the pen never reads
   * game state and never gates a submission.
   */
  tick: number;
}

interface PenPos {
  top: number;
  left: number;
}

function visibleAnchor(root: HTMLElement): HTMLElement | null {
  const anchors = root.querySelectorAll<HTMLElement>("[data-pen-anchor]");
  for (const el of anchors) {
    if (el.getClientRects().length > 0) return el;
  }
  return null;
}

/**
 * The pen resting on the notepad. Decorative and non-interactive: it sits
 * under `pointer-events: none` so it can never intercept a tap meant for the
 * input beneath it. It parks on the newest note — the line the next guess
 * will be written onto — and scribbles there when a guess lands.
 */
export function Pen({ tick }: PenProps) {
  const slotRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<PenPos | null>(null);
  const [placed, setPlaced] = useState(false);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    const notepad = slot?.closest(".notepad");
    if (!slot || !(notepad instanceof HTMLElement)) return;
    const pad = notepad;
    const penSlot = slot;

    function locate(): void {
      const anchor = visibleAnchor(pad);
      if (!anchor) {
        setPos(null);
        return;
      }
      const sheet = pad.querySelector(".notepad-sheet");
      const word = anchor.querySelector<HTMLElement>(".guess-word") ?? anchor;
      const padRect = pad.getBoundingClientRect();
      const wordRect = word.getBoundingClientRect();
      if (sheet instanceof HTMLElement) {
        const sheetRect = sheet.getBoundingClientRect();
        if (wordRect.bottom < sheetRect.top + 6 || wordRect.top > sheetRect.bottom - 6) {
          setPos(null);
          return;
        }
      }
      const penWidth = penSlot.offsetWidth || 34;
      const penHeight = penSlot.offsetHeight || 76;
      const nibX = penWidth * 0.14;
      const nibY = penHeight * 0.86;
      const alongWord = Math.min(Math.max(wordRect.width * 0.72, 1.4 * 16), 7.5 * 16);
      setPos({
        left: wordRect.left + alongWord - padRect.left - nibX,
        top: wordRect.top + wordRect.height * 0.62 - padRect.top - nibY,
      });
      setPlaced(true);
    }

    locate();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(locate);
    observer?.observe(pad);
    pad.addEventListener("scroll", locate, true);
    window.addEventListener("resize", locate);
    return () => {
      observer?.disconnect();
      pad.removeEventListener("scroll", locate, true);
      window.removeEventListener("resize", locate);
    };
  }, [tick]);

  return (
    <span
      ref={slotRef}
      className={`notepad-pen${placed ? " is-placed" : ""}`}
      data-scribbling={tick > 0 ? "true" : "false"}
      style={
        pos
          ? { top: pos.top - 10, left: pos.left + 20, right: "auto", bottom: "auto" }
          : undefined
      }
      aria-hidden="true"
    >
      <img
        key={tick}
        className="notepad-pen-img"
        src="/assets/detective/objects/detective-pen.png"
        alt=""
        draggable={false}
        width={214}
        height={488}
      />
    </span>
  );
}
