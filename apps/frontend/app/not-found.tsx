import { ErrorFallback } from "@/components/ErrorFallback";
import { AppShell } from "@/components/layout/AppShell";

export default function NotFound() {
  return (
    <AppShell>
      <ErrorFallback
        title="Page not found"
        message="That Wikognito page does not exist."
      />
    </AppShell>
  );
}
