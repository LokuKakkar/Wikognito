import type { Metadata } from "next";
import { DossierDetailPage } from "@/components/dossiers/DossierDetailPage";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const title = slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return {
    title: `${title} — Wikognito Dossiers`,
    description: `Case files in the ${title} dossier.`,
  };
}

export default async function DossierDetailRoute({ params }: Props) {
  const { slug } = await params;
  return <DossierDetailPage slug={slug} />;
}
