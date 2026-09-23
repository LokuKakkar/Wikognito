import { Suspense } from "react";
import { ResetPasswordPage } from "@/components/ResetPasswordPage";

export default function ResetPasswordRoute() {
  return (
    <Suspense fallback={<main className="page"><p>Loading…</p></main>}>
      <ResetPasswordPage />
    </Suspense>
  );
}
