"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleHelp, Volume1, VolumeX } from "lucide-react";
import type { PlayDifficulty } from "@redactle/shared";
import { ApiRequestError, changePassword, deleteAccount, updateProfile } from "@/lib/api";
import { readSoundPref, writeSoundPref, type SoundPref } from "@/lib/sound";
import { readPlayDifficulty, writePlayDifficulty } from "@/lib/difficulty";
import { DifficultyPicker } from "./DifficultyPicker";
import { resetHowTo } from "@/lib/howto";
import { AppShell } from "./layout/AppShell";
import { Dossier } from "./layout/Dossier";
import { VerifyEmailBanner } from "./VerifyEmailBanner";
import { useMe } from "@/features/auth/useMe";
import { Icon } from "./ui/Icon";
import { AvatarPicker } from "./avatar/AvatarPicker";

export function SettingsPage() {
  const { user, loading, refresh, signOut } = useMe();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sound, setSound] = useState<SoundPref>("off");
  const [difficulty, setDifficulty] = useState<PlayDifficulty>("easy");
  const [howToMessage, setHowToMessage] = useState<string | null>(null);

  useEffect(() => {
    setSound(readSoundPref());
    setDifficulty(readPlayDifficulty());
  }, []);

  function difficultySection() {
    return (
      <section className="settings-section">
        <h2>Difficulty</h2>
        <p className="muted">
          This changes which everyday words start visible. Easy shows the most. Hard keeps only the
          smallest set. Your choice is saved on this device and used for every puzzle, including new
          ones.
        </p>
        <DifficultyPicker
          value={difficulty}
          onChange={(next) => {
            writePlayDifficulty(next);
            setDifficulty(next);
          }}
        />
      </section>
    );
  }

  function appearanceSection() {
    return (
      <section className="settings-section">
        <h2>Appearance</h2>
        <div className="theme-toggle sound-toggle" role="group" aria-label="Sound">
          <button
            type="button"
            aria-pressed={sound === "off"}
            onClick={() => {
              writeSoundPref("off");
              setSound("off");
            }}
          >
            <Icon icon={VolumeX} size="chip" />
            Off
          </button>
          <button
            type="button"
            aria-pressed={sound === "quiet"}
            onClick={() => {
              writeSoundPref("quiet");
              setSound("quiet");
            }}
          >
            <Icon icon={Volume1} size="chip" />
            Quiet
          </button>
        </div>
        <p>
          <button
            type="button"
            className="secondary-action-button"
            onClick={() => {
              resetHowTo();
              setHowToMessage("How to play will show the next time you open today’s puzzle.");
            }}
          >
            <Icon icon={CircleHelp} />
            Show how to play
          </button>
        </p>
        {howToMessage ? <p className="muted">{howToMessage}</p> : null}
      </section>
    );
  }

  if (!loading && !user) {
    return (
      <AppShell>
        <main className="page">
          <Dossier kicker="Desk drawer" title="Settings" clip={false}>
            {difficultySection()}
            {appearanceSection()}
            <p className="muted">
              <Link href="/login">Sign in</Link> to manage your account.
            </p>
          </Dossier>
        </main>
      </AppShell>
    );
  }

  async function onSaveProfile(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setProfileMessage(null);
    try {
      await updateProfile(displayName || user?.displayName || "Player");
      await refresh();
      setProfileMessage("Display name updated.");
    } catch (caught: unknown) {
      setProfileMessage(caught instanceof Error ? caught.message : "Could not update profile.");
    }
  }

  async function onChangePassword(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPasswordMessage(null);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setPasswordMessage("Password changed.");
    } catch (caught: unknown) {
      setPasswordMessage(caught instanceof Error ? caught.message : "Could not change password.");
    }
  }

  async function onDelete(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setDeleteError(null);
    if (deleteConfirm !== "DELETE") {
      setDeleteError("Type DELETE to confirm.");
      return;
    }
    try {
      await deleteAccount("DELETE", user?.hasPassword ? deletePassword : undefined);
      await signOut();
      router.push("/");
    } catch (caught: unknown) {
      setDeleteError(
        caught instanceof ApiRequestError ? caught.message : "Could not delete account.",
      );
    }
  }

  return (
    <AppShell>
      <main className="page">
        <VerifyEmailBanner />
        <Dossier kicker="Desk drawer" title="Settings" clip={false}>
        {difficultySection()}
        <section className="settings-section">
          <h2>Profile</h2>
          <form className="auth-form" onSubmit={(event) => void onSaveProfile(event)}>
            <label>
              Display name
              <input
                value={displayName || user?.displayName || ""}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="nickname"
              />
            </label>
            {profileMessage ? <p className="muted">{profileMessage}</p> : null}
            <button type="submit">Save profile</button>
          </form>
          <p className="muted">Choose a detective portrait. It stays on this device.</p>
          <AvatarPicker seed={user?.id ?? user?.displayName ?? user?.email ?? "detective"} />
        </section>

        {appearanceSection()}

        <section className="settings-section">
          <h2>Security</h2>
          <p>
            Email: {user?.email ?? "—"}{" "}
            <span className="muted">{user?.emailVerified ? "(verified)" : "(unverified)"}</span>
          </p>
          <p className="muted">Connected accounts: {user?.providers.join(", ") || "none"}</p>
          {user?.hasPassword ? (
            <form className="auth-form" onSubmit={(event) => void onChangePassword(event)}>
              <label>
                Current password
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
              <label>
                New password
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
              {passwordMessage ? <p className="muted">{passwordMessage}</p> : null}
              <button type="submit">Change password</button>
            </form>
          ) : (
            <p className="muted">This Google account does not have a local password.</p>
          )}
        </section>

        <section className="settings-section">
          <h2>Danger zone</h2>
          <p className="muted">
            This permanently removes your personal game history, identities, and sessions. Shared
            puzzles are not deleted.
          </p>
          <form className="auth-form" onSubmit={(event) => void onDelete(event)}>
            <label>
              Type DELETE to confirm
              <input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} />
            </label>
            {user?.hasPassword ? (
              <label>
                Password
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  autoComplete="current-password"
                />
              </label>
            ) : null}
            {deleteError ? <p className="error">{deleteError}</p> : null}
            <button type="submit">Delete account</button>
          </form>
        </section>
        </Dossier>
      </main>
    </AppShell>
  );
}
