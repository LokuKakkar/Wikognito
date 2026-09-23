"use client";

import { getSlotPlacement } from "@/illustrations";
import type { IllustrationSlot } from "@/illustrations/types";
import { Illustration } from "./Illustration";

export interface IllustrationSlotProps {
  slot: IllustrationSlot;
  className?: string;
}

function joinClassNames(...values: Array<string | undefined | null | false>): string | undefined {
  const result = values.filter(Boolean).join(" ").trim();
  return result.length > 0 ? result : undefined;
}

export function IllustrationSlot({ slot, className }: IllustrationSlotProps) {
  const placement = getSlotPlacement(slot);
  if (!placement) return null;

  const decorative = !placement.alt;
  return (
    <Illustration
      id={placement.assetId}
      alt={placement.alt}
      decorative={decorative}
      className={joinClassNames(placement.className, className)}
    />
  );
}

