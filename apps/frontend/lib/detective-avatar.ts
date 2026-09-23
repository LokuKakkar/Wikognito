export const DETECTIVE_AVATARS = [
  {
    id: "fedora",
    label: "Fedora",
    src: "/assets/detective/ui/avatar-fedora.png",
    width: 191,
    height: 192,
  },
  {
    id: "noir",
    label: "Brim",
    src: "/assets/detective/ui/avatar-noir.png",
    width: 192,
    height: 188,
  },
  {
    id: "scholar",
    label: "Spectacles",
    src: "/assets/detective/ui/avatar-scholar.png",
    width: 192,
    height: 191,
  },
  {
    id: "shades",
    label: "Shades",
    src: "/assets/detective/ui/avatar-shades.png",
    width: 192,
    height: 178,
  },
  {
    id: "deerstalker",
    label: "Deerstalker",
    src: "/assets/detective/ui/avatar-deerstalker.png",
    width: 187,
    height: 192,
  },
] as const;

export type DetectiveAvatarId = (typeof DETECTIVE_AVATARS)[number]["id"];

export const DEFAULT_DETECTIVE_AVATAR_ID: DetectiveAvatarId = "fedora";
export const DETECTIVE_AVATAR_STORAGE_KEY = "wikognito.detective-avatar";
export const DETECTIVE_AVATAR_CHANGE_EVENT = "wikognito-detective-avatar";

export function isDetectiveAvatarId(value: string): value is DetectiveAvatarId {
  return DETECTIVE_AVATARS.some((avatar) => avatar.id === value);
}

export function avatarFromSeed(seed: string): DetectiveAvatarId {
  const text = seed.trim();
  if (!text) return DEFAULT_DETECTIVE_AVATAR_ID;
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }
  const index = Math.abs(hash) % DETECTIVE_AVATARS.length;
  return DETECTIVE_AVATARS[index].id;
}

export function readStoredDetectiveAvatarId(): DetectiveAvatarId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DETECTIVE_AVATAR_STORAGE_KEY);
    if (raw && isDetectiveAvatarId(raw)) return raw;
  } catch {
    return null;
  }
  return null;
}

export function writeDetectiveAvatarId(id: DetectiveAvatarId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DETECTIVE_AVATAR_STORAGE_KEY, id);
    window.dispatchEvent(new Event(DETECTIVE_AVATAR_CHANGE_EVENT));
  } catch {
    // Presentation-only; missing storage must not block the page.
  }
}

export function resolveDetectiveAvatarId(seed: string, preferStored: boolean): DetectiveAvatarId {
  if (preferStored) {
    return readStoredDetectiveAvatarId() ?? avatarFromSeed(seed);
  }
  return avatarFromSeed(seed);
}

export function getDetectiveAvatar(id: DetectiveAvatarId) {
  return DETECTIVE_AVATARS.find((avatar) => avatar.id === id) ?? DETECTIVE_AVATARS[0];
}
