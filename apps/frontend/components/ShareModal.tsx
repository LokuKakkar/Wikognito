"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PuzzleStats } from "@redactle/shared";
import { Copy, Image, Link2, Share2, X } from "lucide-react";
import { copyShareImage, formatDurationMs, formatShareUrl, type ShareVisualInput } from "@/lib/share";
import { SolveStatsDetails } from "./stats/SolveStatsDetails";
import { Icon } from "./ui/Icon";

interface ShareModalProps {
  open: boolean;
  text: string;
  visual?: ShareVisualInput | null;
  puzzleStats?: PuzzleStats | null;
  onClose: () => void;
}

export function ShareModal({ open, text, visual, puzzleStats, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState<"none" | "text" | "image" | "link">("none");
  const dialogRef = useRef<HTMLDivElement>(null);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const shareUrl = useMemo(
    () => (visual ? formatShareUrl(visual.puzzleId) : ""),
    [visual],
  );

  useEffect(() => {
    if (!open) {
      setCopied("none");
      return;
    }
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function copyText(): Promise<void> {
    await navigator.clipboard.writeText(text);
    setCopied("text");
  }

  async function copyLink(): Promise<void> {
    if (!shareUrl) {
      await copyText();
      return;
    }
    await navigator.clipboard.writeText(shareUrl);
    setCopied("link");
  }

  async function copyImage(): Promise<void> {
    if (!visual) {
      await copyText();
      return;
    }
    const ok = await copyShareImage(visual);
    if (ok) {
      setCopied("image");
      return;
    }
    await copyText();
  }

  async function share(): Promise<void> {
    if (canNativeShare) {
      try {
        await navigator.share({ text, title: "Wikognito", url: shareUrl || undefined });
        return;
      } catch {
        // Fall through to copy when the user cancels or share is unavailable.
      }
    }
    await copyText();
  }

  const won = visual?.won ?? false;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal solve-stats-modal share-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="solve-stats-head">
          <div>
            <p className="case-notice-kicker">
              {visual ? `Wikognito #${visual.puzzleNumber}` : won ? "Case filed" : "Attempt closed"}
            </p>
            <strong id="share-title">Share your result</strong>
          </div>
          <button type="button" className="icon-button" aria-label="Close share" onClick={onClose}>
            <Icon icon={X} />
          </button>
        </div>
        {visual && puzzleStats ? (
          <SolveStatsDetails
            guessCount={visual.guessCount}
            durationMs={visual.durationMs}
            accuracy={visual.accuracy ?? null}
            puzzleStats={puzzleStats}
          />
        ) : visual ? (
          <dl className="solve-stats-grid">
            <div>
              <dt>Guesses</dt>
              <dd>{visual.guessCount}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{formatDurationMs(visual.durationMs)}</dd>
            </div>
          </dl>
        ) : null}
        {shareUrl ? (
          <div className="share-link-card">
            <p className="share-link-label">
              <Icon icon={Link2} size="chip" />
              Puzzle link
            </p>
            <a className="share-link" href={shareUrl}>
              {shareUrl}
            </a>
          </div>
        ) : null}
        <pre className="share-preview">{text}</pre>
        <div className="terminal-actions">
          <button type="button" className="replay" onClick={() => void copyText()}>
            <Icon icon={Copy} />
            {copied === "text" ? "Copied" : "Copy result"}
          </button>
          {shareUrl ? (
            <button type="button" className="replay" onClick={() => void copyLink()}>
              <Icon icon={Link2} />
              {copied === "link" ? "Link copied" : "Copy link"}
            </button>
          ) : null}
          {visual ? (
            <button type="button" className="replay" onClick={() => void copyImage()}>
              <Icon icon={Image} />
              {copied === "image" ? "Image copied" : "Copy image"}
            </button>
          ) : null}
          <button type="button" className="replay" onClick={() => void share()}>
            <Icon icon={Share2} />
            Share
          </button>
        </div>
      </div>
    </div>
  );
}
