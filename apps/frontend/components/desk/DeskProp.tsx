interface DeskPropProps {
  src: string;
  width: number;
  height: number;
  className?: string;
  loading?: "lazy" | "eager";
}

/**
 * A decorative desk object. Always hidden from assistive tech — the page
 * copy next to it carries the meaning.
 */
export function DeskProp({ src, width, height, className, loading = "lazy" }: DeskPropProps) {
  return (
    <img
      className={className ? `desk-prop ${className}` : "desk-prop"}
      src={src}
      alt=""
      width={width}
      height={height}
      aria-hidden="true"
      draggable={false}
      loading={loading}
    />
  );
}
