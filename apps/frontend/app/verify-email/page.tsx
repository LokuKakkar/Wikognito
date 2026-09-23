import { Suspense } from "react";
import { VerifyEmailPage } from "@/components/VerifyEmailPage";

export default function VerifyEmailRoute() {
  return (
    <Suspense fallback={<main className="page"><p>Verifying…</p></main>}>
      <VerifyEmailPage />
    </Suspense>
  );
}
