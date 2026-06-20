import { vi } from "vitest";

// ---------------------------------------------------------------------------
// tRPC useQuery mock
// ---------------------------------------------------------------------------

/**
 * Creates a controllable tRPC `useQuery` mock with mutable internal state.
 *
 * The returned object exposes:
 * - `useQuery` — a `vi.fn()` that returns the current internal state.
 * - `__setState(partial)` — update loading / error / data in the middle of a test.
 * - `__getState()` — read current state for assertions.
 *
 * @example
 *   const queryMock = createTRPCQueryMock({ items: [] });
 *   vi.mock("@/lib/trpc", () => ({
 *     api: { myRouter: { myQuery: { useQuery: queryMock.useQuery } } },
 *   }));
 *
 *   // Later, simulate loading:
 *   queryMock.__setState({ isLoading: true, isSuccess: false, data: undefined });
 *
 * @param initialData - Optional initial response data.
 */
export function createTRPCQueryMock<TData = any>(initialData?: TData) {
  let state = {
    data: initialData ?? undefined,
    isLoading: false,
    isError: false,
    error: null as unknown,
    isSuccess: true,
    refetch: vi.fn(),
  };

  return {
    useQuery: vi.fn(() => state),
    /** Merge partial state into the mock's internal state (triggers on next render). */
    __setState: (newState: Partial<typeof state>) => {
      state = { ...state, ...newState };
    },
    /** Read the current internal state (useful for assertions). */
    __getState: () => state,
  };
}

// ---------------------------------------------------------------------------
// tRPC useMutation mock
// ---------------------------------------------------------------------------

/**
 * Creates a controllable tRPC `useMutation` mock.
 *
 * The returned object exposes:
 * - `useMutation` — a factory `vi.fn()` that returns a mutation shape.
 * - `mockMutate` / `mockMutateAsync` — spies for asserting call arguments.
 * - `setIsPending(bool)` — toggle the `isPending` flag.
 *
 * @example
 *   const mutationMock = createTRPCMutationMock();
 *   vi.mock("@/lib/trpc", () => ({
 *     api: { myRouter: { doThing: { useMutation: mutationMock.useMutation } } },
 *   }));
 *
 *   // Assert mutation was called:
 *   expect(mutationMock.mockMutate).toHaveBeenCalledWith({ id: "abc" });
 */
export function createTRPCMutationMock() {
  const mockMutate = vi.fn();
  const mockMutateAsync = vi.fn();
  let isPending = false;

  return {
    /**
     * Factory function that returns a mutation object shaped like
     * `api.some.procedure.useMutation(opts)`.
     *
     * The returned `mutate` and `mutateAsync` call the shared spies, and
     * `mutate` fires `opts.onSuccess` if provided.
     */
    useMutation: vi.fn(
      (opts?: { onSuccess?: (...args: any[]) => void; onError?: (...args: any[]) => void }) => ({
        mutate: (...args: any[]) => {
          mockMutate(...args);
          opts?.onSuccess?.();
        },
        mutateAsync: (...args: any[]) => {
          mockMutateAsync(...args);
          return Promise.resolve();
        },
        isPending,
        data: null,
        error: null,
        reset: vi.fn(),
      }),
    ),
    /** Spy on the arguments passed to `mutate`. */
    mockMutate,
    /** Spy on the arguments passed to `mutateAsync`. */
    mockMutateAsync,
    /** Toggle the `isPending` flag returned by future `useMutation` calls. */
    setIsPending: (v: boolean) => {
      isPending = v;
    },
  };
}
