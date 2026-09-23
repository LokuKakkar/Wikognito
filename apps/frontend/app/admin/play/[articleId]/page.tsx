import { AdminPlayGamePage } from "@/components/admin/AdminPlayGamePage";

export default async function AdminPlayArticleRoute({
  params,
}: {
  params: Promise<{ articleId: string }>;
}) {
  const { articleId } = await params;
  return <AdminPlayGamePage articleId={decodeURIComponent(articleId)} />;
}
