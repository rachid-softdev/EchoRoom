"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "next-auth";

interface UseServerSessionReturn {
  user: Session["user"] | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * Client-side hook that fetches session data from `/api/auth/session`.
 * Re-fetches on mount only (no polling).
 * Use this when you need session data in a client component without
 * relying on the SessionProvider context (e.g. in SSR-adjacent contexts).
 */
export function useServerSession(): UseServerSessionReturn {
  const [user, setUser] = useState<Session["user"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      if (!res.ok) {
        throw new Error(`Failed to fetch session: ${res.status}`);
      }
      const session: Session | null = await res.json();
      setUser(session?.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
