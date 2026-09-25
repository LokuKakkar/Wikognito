"use client";

import { GamePage } from "../GamePage";

export function DossierCaseGamePage({ slug, caseId }: { slug: string; caseId: string }) {
  return <GamePage dossierPlay={{ slug, caseId }} />;
}
