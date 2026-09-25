import type { Metadata } from "next";
import { DossierCaseGamePage } from "@/components/dossiers/DossierCaseGamePage";

interface Props {
  params: Promise<{ slug: string; caseId: string }>;
}

export const metadata: Metadata = {
  title: "Case File — Wikognito",
  description: "Play a dossier case file.",
};

export default async function DossierCaseRoute({ params }: Props) {
  const { slug, caseId } = await params;
  return <DossierCaseGamePage slug={slug} caseId={caseId} />;
}
