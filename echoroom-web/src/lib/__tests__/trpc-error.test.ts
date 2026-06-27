import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// useApiToast — tRPC error handler hook
// ---------------------------------------------------------------------------
// Tests for src/lib/trpc-error.ts which wraps tRPC mutations with automatic
// toast notifications on success and error.

// Mock the toast function
const mockToast = vi.fn();

vi.mock("@/components/ui", () => ({
  toast: mockToast,
}));

describe("useApiToast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show success toast on successful mutation", async () => {
    const { useApiToast } = await import("../trpc-error");

    const mutation = {
      mutateAsync: vi.fn().mockResolvedValue({ id: "123" }),
      mutate: vi.fn(),
      error: null,
      isPending: false,
    };

    const { result } = renderHook(() => useApiToast(mutation, { success: "Créé avec succès !" }));

    await result.current.mutateAsync({ name: "test" });

    expect(mockToast).toHaveBeenCalledWith({
      title: "Créé avec succès !",
      variant: "default",
    });
  });

  it("should call onSuccess callback on successful mutation", async () => {
    const { useApiToast } = await import("../trpc-error");

    const onSuccess = vi.fn();
    const mutation = {
      mutateAsync: vi.fn().mockResolvedValue({ id: "123", name: "test" }),
      mutate: vi.fn(),
      error: null,
      isPending: false,
    };

    const { result } = renderHook(() =>
      useApiToast(mutation, {
        success: "Success",
        onSuccess,
      }),
    );

    const data = await result.current.mutateAsync({ name: "test" });

    expect(onSuccess).toHaveBeenCalledWith(data);
  });

  it("should show destructive toast with tRPC error message on failure", async () => {
    const { useApiToast } = await import("../trpc-error");

    const trpcError = new Error("Email déjà utilisé");
    const mutation = {
      mutateAsync: vi.fn().mockRejectedValue(trpcError),
      mutate: vi.fn(),
      error: null,
      isPending: false,
    };

    const { result } = renderHook(() => useApiToast(mutation, { success: "Créé" }));

    await expect(result.current.mutateAsync({ email: "test@test.com" })).rejects.toThrow();

    expect(mockToast).toHaveBeenCalledWith({
      title: "Email déjà utilisé",
      variant: "destructive",
    });
  });

  it("should use options.error fallback when error has no message", async () => {
    const { useApiToast } = await import("../trpc-error");

    const trpcError = {}; // No message property
    const mutation = {
      mutateAsync: vi.fn().mockRejectedValue(trpcError),
      mutate: vi.fn(),
      error: null,
      isPending: false,
    };

    const { result } = renderHook(() =>
      useApiToast(mutation, {
        success: "Créé",
        error: "Erreur personnalisée",
      }),
    );

    await expect(result.current.mutateAsync({})).rejects.toThrow();

    expect(mockToast).toHaveBeenCalledWith({
      title: "Erreur personnalisée",
      variant: "destructive",
    });
  });

  it("should use default error message when no message and no options.error", async () => {
    const { useApiToast } = await import("../trpc-error");

    const trpcError = {}; // No message property
    const mutation = {
      mutateAsync: vi.fn().mockRejectedValue(trpcError),
      mutate: vi.fn(),
      error: null,
      isPending: false,
    };

    const { result } = renderHook(() => useApiToast(mutation, { success: "Créé" }));

    await expect(result.current.mutateAsync({})).rejects.toThrow();

    expect(mockToast).toHaveBeenCalledWith({
      title: "Une erreur est survenue",
      variant: "destructive",
    });
  });

  it("should re-throw the error after showing toast", async () => {
    const { useApiToast } = await import("../trpc-error");

    const trpcError = new Error("Quelque chose a mal tourné");
    const mutation = {
      mutateAsync: vi.fn().mockRejectedValue(trpcError),
      mutate: vi.fn(),
      error: null,
      isPending: false,
    };

    const { result } = renderHook(() => useApiToast(mutation, { success: "Créé" }));

    await expect(result.current.mutateAsync({})).rejects.toThrow("Quelque chose a mal tourné");
  });

  it("should work with empty options without crashing", async () => {
    const { useApiToast } = await import("../trpc-error");

    const mutation = {
      mutateAsync: vi.fn().mockResolvedValue({ id: "123" }),
      mutate: vi.fn(),
      error: null,
      isPending: false,
    };

    const { result } = renderHook(() => useApiToast(mutation));

    const data = await result.current.mutateAsync({ name: "test" });

    expect(data).toEqual({ id: "123" });
    // No success toast since no options.success
    expect(mockToast).not.toHaveBeenCalled();
  });

  it("should spread mutation properties on the returned object", async () => {
    const { useApiToast } = await import("../trpc-error");

    const mutation = {
      mutateAsync: vi.fn(),
      mutate: vi.fn(),
      error: null,
      isPending: false,
    };

    const { result } = renderHook(() => useApiToast(mutation));

    expect(result.current.error).toBeNull();
    expect(result.current.isPending).toBe(false);
    expect(typeof result.current.mutate).toBe("function");
    expect(typeof result.current.mutateAsync).toBe("function");
  });

  it("should also wrap mutate (not just mutateAsync)", async () => {
    const { useApiToast } = await import("../trpc-error");

    const mutation = {
      mutateAsync: vi.fn().mockResolvedValue("data"),
      mutate: vi.fn(),
      error: null,
      isPending: false,
    };

    const { result } = renderHook(() => useApiToast(mutation, { success: "Success" }));

    // mutate should call mutateAsync internally
    await result.current.mutate("input");

    expect(mutation.mutateAsync).toHaveBeenCalledWith("input");
  });
});
