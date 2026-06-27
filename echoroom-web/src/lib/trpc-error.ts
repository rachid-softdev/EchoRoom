"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import type { TRPCClientErrorLike } from "@trpc/react-query";
import { toast } from "@/components/ui";
import type { AppRouter } from "@/server/rootRouter";

type MutationLike<TData, TInput> = Pick<
  UseMutationResult<TData, TRPCClientErrorLike<AppRouter>, TInput>,
  "mutateAsync" | "mutate" | "error" | "isPending"
>;

interface UseApiToastOptions<TData> {
  success?: string;
  error?: string;
  onSuccess?: (data: TData) => void;
}

/**
 * Wraps a tRPC mutation with automatic toast notifications.
 *
 * @example
 * const create = useApiToast(
 *   api.scenarios.create.useMutation(),
 *   {
 *     success: "Scénario créé !",
 *     onSuccess: (data) => router.push(`/scenario/${data.scenarioId}`),
 *   }
 * )
 */
export function useApiToast<TData, TInput>(
  mutation: MutationLike<TData, TInput>,
  options: UseApiToastOptions<TData> = {},
) {
  const wrappedMutate = async (input: TInput) => {
    try {
      const data = await mutation.mutateAsync(input);
      if (options.success) {
        toast({
          title: options.success,
          variant: "default",
        });
      }
      options.onSuccess?.(data);
      return data;
    } catch (err) {
      const message =
        (err as TRPCClientErrorLike<AppRouter>)?.message ??
        options.error ??
        "Une erreur est survenue";
      toast({
        title: message,
        variant: "destructive",
      });
      throw err;
    }
  };

  return {
    ...mutation,
    mutate: wrappedMutate as (input: TInput) => Promise<TData>,
    mutateAsync: wrappedMutate,
  };
}
