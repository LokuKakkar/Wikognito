"use client";

export function RedactedTitle({
  title,
  wordLengths,
  revealed,
}: {
  title: string | null;
  wordLengths: number[];
  revealed: boolean;
}) {
  if (revealed && title) {
    return <strong>{title}</strong>;
  }

  const lengths = wordLengths.length > 0 ? wordLengths : [4];
  return (
    <span className="redacted-title" aria-label="Redacted case title">
      {lengths.map((length, index) => (
        <span
          key={`${length}-${index}`}
          className="word redacted"
          data-word-length={length}
          aria-hidden
        >
          <span className="redacted-blocks">{"█".repeat(length)}</span>
        </span>
      ))}
    </span>
  );
}
