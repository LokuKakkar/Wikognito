import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DETECTIVE_AVATAR_STORAGE_KEY,
  avatarFromSeed,
  readStoredDetectiveAvatarId,
  writeDetectiveAvatarId,
} from "../lib/detective-avatar";
import { AvatarPicker } from "../components/avatar/AvatarPicker";

describe("detective avatars", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("hashes a seed to a stable default portrait", () => {
    expect(avatarFromSeed("alex")).toBe(avatarFromSeed("alex"));
    expect(avatarFromSeed("")).toBe("fedora");
  });

  it("stores a local selection without touching account fields", async () => {
    const user = userEvent.setup();
    render(<AvatarPicker seed="user-1" />);
    await user.click(screen.getByRole("radio", { name: "Deerstalker" }));
    expect(readStoredDetectiveAvatarId()).toBe("deerstalker");
    expect(window.localStorage.getItem(DETECTIVE_AVATAR_STORAGE_KEY)).toBe("deerstalker");
    writeDetectiveAvatarId("scholar");
    expect(readStoredDetectiveAvatarId()).toBe("scholar");
  });
});
