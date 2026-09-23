import { Suspense } from "react";
import { HomeGame } from "@/components/HomeGame";

export default function HomePage() {
  return (
    <Suspense fallback={<main className="page"><p>Loading today’s puzzle…</p></main>}>
      <HomeGame />
    </Suspense>
  );
}
