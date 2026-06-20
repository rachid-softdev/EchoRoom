import { vi } from "vitest";

/**
 * Creates a mock router object matching Next.js `useRouter()` return type.
 *
 * Each router method defaults to a `vi.fn()` stub. Pass `overrides` to
 * supply specific implementations or to share a spy across tests.
 *
 * @example
 *   const router = createMockRouter({ push: vi.fn() });
 *   router.push("/dashboard");
 *   expect(router.push).toHaveBeenCalledWith("/dashboard");
 */
export function createMockRouter(
  overrides?: Partial<{
    push: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
    back: ReturnType<typeof vi.fn>;
    forward: ReturnType<typeof vi.fn>;
  }>,
) {
  return {
    push: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    ...overrides,
  };
}

/**
 * Standard `vi.mock()` factory for `"next/navigation"`.
 *
 * Provides stubs for all commonly-used exports: `useRouter`, `usePathname`,
 * `useSearchParams`, `redirect`, and `notFound`.
 *
 * Usage — place at the top of your test file (before imports):
 *
 * ```ts
 * vi.mock("next/navigation", () => nextNavigationMock);
 * ```
 *
 * To customize a return value inside a test:
 *
 * ```ts
 * import { usePathname } from "next/navigation";
 * (usePathname as jest.Mock).mockReturnValue("/custom-path");
 * ```
 */
export const nextNavigationMock = {
  useRouter: () => createMockRouter(),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  redirect: vi.fn(),
  notFound: vi.fn(),
};
