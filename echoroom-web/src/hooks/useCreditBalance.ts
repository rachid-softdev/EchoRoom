"use client";

import { useSession } from "next-auth/react";
import { api } from "@/lib/trpc";

/**
 * Returns the user's current credit balance.
 * Refetches every 30s (via staleTime) and on window focus.
 */
export function useCreditBalance() {
  const { data: session } = useSession();
  const { data, isLoading, refetch } = api.billing.getCredits.useQuery(undefined, {
    enabled: !!session?.user,
    staleTime: 30_000,
  });

  return {
    credits: data?.credits ?? 0,
    isLoading,
    refetch,
  };
}
