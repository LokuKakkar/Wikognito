import type { LucideIcon } from "lucide-react";

type IconSize = "chip" | "chrome";

interface IconProps {
  icon: LucideIcon;
  size?: IconSize;
  className?: string;
}

/** Thin-stroke Lucide mark. Decorative by default — parent supplies the name. */
export function Icon({ icon: Lucide, size = "chrome", className }: IconProps) {
  const px = size === "chip" ? 14 : 16;
  return <Lucide className={className} size={px} strokeWidth={1.5} aria-hidden />;
}
