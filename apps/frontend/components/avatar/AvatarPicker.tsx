"use client";

import { useEffect, useState } from "react";
import {
  DETECTIVE_AVATARS,
  DETECTIVE_AVATAR_CHANGE_EVENT,
  resolveDetectiveAvatarId,
  writeDetectiveAvatarId,
  type DetectiveAvatarId,
} from "@/lib/detective-avatar";

interface AvatarPickerProps {
  seed: string;
}

export function AvatarPicker({ seed }: AvatarPickerProps) {
  const [selected, setSelected] = useState<DetectiveAvatarId>(() =>
    resolveDetectiveAvatarId(seed, true),
  );

  useEffect(() => {
    function sync() {
      setSelected(resolveDetectiveAvatarId(seed, true));
    }
    sync();
    window.addEventListener(DETECTIVE_AVATAR_CHANGE_EVENT, sync);
    return () => window.removeEventListener(DETECTIVE_AVATAR_CHANGE_EVENT, sync);
  }, [seed]);

  return (
    <div className="avatar-picker" role="radiogroup" aria-label="Detective portrait">
      {DETECTIVE_AVATARS.map((avatar) => {
        const isSelected = avatar.id === selected;
        return (
          <label
            key={avatar.id}
            className={isSelected ? "avatar-choice is-selected" : "avatar-choice"}
          >
            <input
              type="radio"
              name="detective-avatar"
              value={avatar.id}
              checked={isSelected}
              onChange={() => {
                setSelected(avatar.id);
                writeDetectiveAvatarId(avatar.id);
              }}
            />
            <img src={avatar.src} alt="" width={avatar.width} height={avatar.height} draggable={false} />
            <span>{avatar.label}</span>
          </label>
        );
      })}
    </div>
  );
}
