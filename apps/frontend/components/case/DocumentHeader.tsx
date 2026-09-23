import type { ReactNode } from "react";

interface DocumentHeaderProps {
  /** Case number printed on the file. Absent for admin previews. */
  caseNumber?: number;
  /** Small label above the case number, e.g. the source of the file. */
  label: string;
  /** Filing date or equivalent, printed in the metadata row. */
  filedOn?: string;
  /** Extra metadata links supplied by the page. */
  meta?: ReactNode;
  fileStatus?: "redacted" | "solved" | "closed";
}

/**
 * The printed masthead of the case file: classification banner, case number,
 * and the filing metadata. Presentation only — every value is passed in.
 */
export function DocumentHeader({
  caseNumber,
  label,
  filedOn,
  meta,
  fileStatus = "redacted",
}: DocumentHeaderProps) {
  const statusLabel = fileStatus === "solved" ? "Solved" : fileStatus === "closed" ? "Closed" : "Redacted";
  return (
    <header className="case-document-header">
      <div className="case-classification" aria-hidden="true">
        <span>Confidential</span>
        <span>Confidential</span>
      </div>

      <p className="case-label">{label}</p>

      <p className="case-number">
        {caseNumber != null ? `Case #${String(caseNumber).padStart(3, "0")}` : "Unfiled case"}
      </p>

      <dl className="case-meta">
        {filedOn ? (
          <div>
            <dt>Filed</dt>
            <dd>{filedOn}</dd>
          </div>
        ) : null}
        <div>
          <dt>Status</dt>
          <dd>{statusLabel}</dd>
        </div>
        <div>
          <dt>Clearance</dt>
          <dd>Investigator</dd>
        </div>
      </dl>

      {meta ? <p className="case-meta-extra">{meta}</p> : null}
    </header>
  );
}
