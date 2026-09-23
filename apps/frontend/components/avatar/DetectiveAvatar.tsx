"use client";

import { useEffect, useState } from "react";
import {
  DETECTIVE_AVATAR_CHANGE_EVENT,
  getDetectiveAvatar,
  resolveDetectiveAvatarId,
} from "@/lib/detective-avatar";

interface DetectiveAvatarProps {
  /** Stable id or display name used to pick a default portrait. */
  seed: string;
  /** When true, this browser's stored choice wins over the hashed default. */
  self?: boolean;
  size?: "sm" | "md" | "lg";
  alt?: string;
}

export function DetectiveAvatar({ seed, self = false, size = "md", alt }: DetectiveAvatarProps) {
  const [id, setId] = useState(() => resolveDetectiveAvatarId(seed, self));

  useEffect(() => {
    setId(resolveDetectiveAvatarId(seed, self));
    if (!self) return;
    function sync() {
      setId(resolveDetectiveAvatarId(seed, true));
    }
    window.addEventListener(DETECTIVE_AVATAR_CHANGE_EVENT, sync);
    return () => window.removeEventListener(DETECTIVE_AVATAR_CHANGE_EVENT, sync);
  }, [seed, self]);

  const avatar = getDetectiveAvatar(id);
  const label = alt ?? "";

  return (
    <img
      className={`detective-avatar detective-avatar-${size}`}
      src={avatar.src}
      alt={label}
      width={avatar.width}
      height={avatar.height}
      draggable={false}
    />
  );
}
