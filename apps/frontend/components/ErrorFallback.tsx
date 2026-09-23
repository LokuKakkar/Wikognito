"use client";

import Link from "next/link";
import { DeskProp } from "./desk/DeskProp";

interface ErrorFallbackProps {
  title: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorFallback({ title, message, onRetry }: ErrorFallbackProps) {
  return (
    <main className="page">
      <div className="case-notice case-notice-error">
        <p className="case-notice-kicker">Case file</p>
        <h1 className="page-title">{title}</h1>
        <p className="error">{message}</p>
        <DeskProp
          className="error-illo"
          src="/assets/detective/objects/magnifier.png"
          width={112}
          height={200}
        />
        <div className="terminal-actions">
          {onRetry ? (
            <button type="button" className="replay" onClick={onRetry}>
              Try again
            </button>
          ) : null}
          <Link className="secondary-action-button" href="/">
            Back to today’s puzzle
          </Link>
        </div>
      </div>
    </main>
  );
}
