"use client";

import { GamePage } from "../GamePage";

export function AdminPlayGamePage({ articleId }: { articleId: string }) {
  return <GamePage articleId={articleId} />;
}
