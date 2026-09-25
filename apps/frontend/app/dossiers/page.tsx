import type { Metadata } from "next";
import { DossierListPage } from "@/components/dossiers/DossierListPage";

export const metadata: Metadata = {
  title: "Dossiers — Wikognito",
  description: "Themed collections of Wikipedia case files.",
};

export default function DossiersRoute() {
  return <DossierListPage />;
}
