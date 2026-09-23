"use client";

import { getActiveIllustrationsPack } from "@/illustrations";
import type { IllustrationId } from "@/illustrations/types";

export interface IllustrationProps {
  id: IllustrationId;
  className?: string;
  alt?: string;
  decorative?: boolean;
}

export function Illustration({ id, className, alt, decorative = true }: IllustrationProps) {
  const pack = getActiveIllustrationsPack();
  const asset = pack.assets[id];
  if (!asset) return null;

  const computedAlt = decorative ? "" : (alt ?? "");

  return (
    <img
      className={className}
      src={asset.src}
      alt={computedAlt}
      aria-hidden={decorative ? true : undefined}
      draggable={false}
      loading="lazy"
    />
  );
}

