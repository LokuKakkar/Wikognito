import type { ReactNode } from "react";

interface CaseNoticeProps {
  kicker?: string;
  title: string;
  children: ReactNode;
  tone?: "pending" | "error";
}

/**
 * Loading and error copy, presented as a brief filed on the desk rather than
 * a blank page. The wording is passed in so it stays plain and specific.
 */
export function CaseNotice({ kicker = "Case file", title, children, tone = "pending" }: CaseNoticeProps) {
  return (
    <main className="page">
      <div className={`case-notice case-notice-${tone}`}>
        <p className="case-notice-kicker">{kicker}</p>
        <h1 className="page-title">{title}</h1>
        {children}
      </div>
    </main>
  );
}
