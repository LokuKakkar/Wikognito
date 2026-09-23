"use client";

import { useCallback, useEffect, useState } from "react";
import type { MeResponse } from "@redactle/shared";
import { fetchMe, logout } from "@/lib/api";

export function useMe() {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await logout();
    setUser(null);
  }, []);

  return { user, loading, refresh, signOut };
}
