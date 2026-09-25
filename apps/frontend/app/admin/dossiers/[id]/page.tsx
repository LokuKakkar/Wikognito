import { AdminDossierEditPage } from "@/components/admin/AdminDossierEditPage";

export default async function AdminDossierEditRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminDossierEditPage id={id} />;
}
