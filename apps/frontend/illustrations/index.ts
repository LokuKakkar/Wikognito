import type { IllustrationPack, IllustrationPackId, IllustrationSlot, SlotPlacement } from "./types";
import { ILLUSTRATIONS_V1 } from "./packs/v1";

const NONE_PACK: IllustrationPack = {
  id: "none",
  // TS needs a full record, but nothing should render when pack is none.
  assets: ILLUSTRATIONS_V1.assets,
  slots: {},
};

export function getActiveIllustrationsPackId(): IllustrationPackId {
  const raw = (process.env.NEXT_PUBLIC_ILLUSTRATIONS_PACK ?? "").toLowerCase().trim();
  if (raw === "none" || raw === "off" || raw === "0" || raw === "false" || raw === "") return "none";
  if (raw === "v1") return "v1";
  // Unknown → default to v1 so the site still looks intentional.
  return "v1";
}

export function getActiveIllustrationsPack(): IllustrationPack {
  const id = getActiveIllustrationsPackId();
  if (id === "none") return NONE_PACK;
  return ILLUSTRATIONS_V1;
}

export function getSlotPlacement(slot: IllustrationSlot): SlotPlacement | null {
  const pack = getActiveIllustrationsPack();
  const placement = pack.slots[slot];
  if (!placement || !placement.enabled) return null;
  return placement;
}

