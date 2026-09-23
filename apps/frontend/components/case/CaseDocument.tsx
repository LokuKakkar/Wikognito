import type { ReactNode } from "react";
import { DocumentHeader } from "./DocumentHeader";
import { CaseStamp } from "./CaseStamp";

export type PaperReaction = "idle" | "hit" | "title";
export type CaseFileStatus = "redacted" | "solved" | "closed";

interface CaseDocumentProps {
  caseNumber?: number;
  label: string;
  filedOn?: string;
  fileStatus?: CaseFileStatus;
  meta?: ReactNode;
  banner?: ReactNode;
  stamp?: { mode: "striking" | "settled" } | null;
  paperReaction?: PaperReaction;
  children: ReactNode;
}

/**
 * The sheet of paper the article is printed on.
 *
 * The paper itself is CSS so it can grow to any article length inside the
 * scrolling pane; the clip and the folder tab are separate fixed-size pieces
 * layered on top. Article content stays plain HTML and is untouched.
 */
export function CaseDocument({
  caseNumber,
  label,
  filedOn,
  fileStatus = "redacted",
  meta,
  banner,
  stamp = null,
  paperReaction = "idle",
  children,
}: CaseDocumentProps) {
  return (
    <div className="case-document">
      <span className="case-document-tab" aria-hidden="true" />
      <span className="case-document-clip" aria-hidden="true" />
      <div className="case-document-sheet" data-paper-reaction={paperReaction}>
        {stamp ? <CaseStamp caseNumber={caseNumber} mode={stamp.mode} /> : null}
        <DocumentHeader
          caseNumber={caseNumber}
          label={label}
          filedOn={filedOn}
          fileStatus={fileStatus}
          meta={meta}
        />
        {banner}
        <div className="case-document-body">{children}</div>
      </div>
    </div>
  );
}
