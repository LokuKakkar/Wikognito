interface CaseStampProps {
  caseNumber?: number;
  /** "striking" plays the impact; "settled" is the ink already on the page. */
  mode: "striking" | "settled";
}

/**
 * Physical CASE SOLVED ink on the file. Decorative — the live result copy
 * stays in ResultCeremony. pointer-events none so it never traps input.
 */
export function CaseStamp({ caseNumber, mode }: CaseStampProps) {
  const caption =
    caseNumber != null ? `Case #${String(caseNumber).padStart(3, "0")} — solved` : "Case solved";

  return (
    <div className={`case-stamp case-stamp-${mode}`} aria-hidden="true">
      <img
        className="case-stamp-mark"
        src="/assets/detective/objects/case-solved-stamp.png"
        alt=""
        draggable={false}
        width={541}
        height={284}
      />
      <p className="case-stamp-caption">{caption}</p>
    </div>
  );
}
