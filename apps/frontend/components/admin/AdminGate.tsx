"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchMe } from "@/lib/api";
import { AuthBar } from "../AuthBar";

export function AdminGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchMe()
      .then((me) => {
        if (cancelled) return;
        if (me?.role === "ADMIN") {
          setAllowed(true);
          return;
        }
        router.replace("/");
      })
      .catch(() => {
        if (!cancelled) {
          router.replace("/");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!allowed) {
    return (
      <main className="page">
        <p className="muted">Checking admin access…</p>
      </main>
    );
  }

  return (
    <>
      <div className="admin-auth-bar">
        <AuthBar />
      </div>
      {children}
    </>
  );
}
