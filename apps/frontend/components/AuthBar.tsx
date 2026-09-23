"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  BookOpen,
  CalendarCheck,
  ChartColumn,
  Library,
  LogIn,
  LogOut,
  Menu,
  Settings,
  Trophy,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { fetchUserStats, googleAuthUrl } from "@/lib/api";
import { useMe } from "@/features/auth/useMe";
import { Icon } from "./ui/Icon";
import { DetectiveAvatar } from "./avatar/DetectiveAvatar";

const PUBLIC_LINKS: ReadonlyArray<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/", label: "Play", icon: BookOpen },
  { href: "/archive", label: "Archive", icon: Library },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/stats", label: "Stats", icon: ChartColumn },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AuthBar() {
  const { user, loading, signOut } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [streak, setStreak] = useState<number | null>(null);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!user) {
      setStreak(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const stats = await fetchUserStats();
        if (!cancelled) setStreak(stats && stats.currentStreak > 0 ? stats.currentStreak : null);
      } catch {
        if (!cancelled) setStreak(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }

    function onClick(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !toggleRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    const first = menuRef.current?.querySelector<HTMLElement>("a, button");
    first?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  function current(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const links = PUBLIC_LINKS.map((link) => (
    <Link key={link.href} href={link.href} aria-current={current(link.href) ? "page" : undefined}>
      <Icon icon={link.icon} />
      {link.label}
    </Link>
  ));

  return (
    <header className="app-nav">
      <Link className="nav-brand" href="/">
        Wikognito
      </Link>
      {streak != null ? (
        <span className="nav-streak" aria-label={`Current streak ${streak}`}>
          <Icon icon={CalendarCheck} size="chip" />
          Streak {streak}
        </span>
      ) : null}
      <nav className="nav-desktop" aria-label="Primary">
        {links}
        {loading ? <span className="muted">…</span> : null}
        {!loading && !user ? (
          <>
            <Link href="/login">
              <Icon icon={LogIn} />
              Sign in
            </Link>
            <a className="auth-sign-in" href={googleAuthUrl()}>
              Sign in with Google
            </a>
          </>
        ) : null}
        {!loading && user ? (
          <>
            <DetectiveAvatar
              seed={user.id}
              self
              size="sm"
              alt=""
            />
            <span className="auth-name">{user.displayName ?? user.email ?? "Signed in"}</span>
            <button
              type="button"
              className="auth-logout"
              onClick={() => {
                void signOut().then(() => router.push("/"));
              }}
            >
              <Icon icon={LogOut} />
              Logout
            </button>
          </>
        ) : null}
      </nav>
      <button
        ref={toggleRef}
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Menu"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon icon={Menu} />
        Menu
      </button>
      <div
        ref={menuRef}
        id={menuId}
        className="nav-menu"
        data-open={open ? "true" : "false"}
        hidden={!open}
      >
        {links}
        {user?.role === "ADMIN" ? <Link href="/admin/articles">Admin</Link> : null}
        {user ? (
          <button
            type="button"
            className="auth-logout"
            onClick={() => {
              void signOut().then(() => router.push("/"));
            }}
          >
            <Icon icon={LogOut} />
            Sign out
          </button>
        ) : (
          <>
            <Link href="/login">
              <Icon icon={LogIn} />
              Sign in
            </Link>
            <a href={googleAuthUrl()}>Sign in with Google</a>
          </>
        )}
      </div>
    </header>
  );
}
