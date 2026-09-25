"use client";

import Link from "next/link";

export function AdminNav() {
  return (
    <nav className="admin-nav" aria-label="Admin">
      <Link href="/admin/articles">Import articles</Link>
      <Link href="/admin/puzzles">Puzzle pool</Link>
      <Link href="/admin/dossiers">Dossiers</Link>
      <Link href="/admin/play">Play stored article</Link>
    </nav>
  );
}
