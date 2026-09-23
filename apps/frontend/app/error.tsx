"use client";

import { ErrorFallback } from "@/components/ErrorFallback";
import { AppShell } from "@/components/layout/AppShell";

export default function RouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <AppShell>
      <ErrorFallback
        title="Something went wrong"
        message="This page failed to load. You can try again or return to today’s puzzle."
        onRetry={reset}
      />
    </AppShell>
  );
}
