import { vi } from "vitest";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of the user object inside an authenticated session. */
export interface MockUser {
  id: string;
  email?: string;
  name?: string;
  username?: string;
  credits?: number;
  image?: string;
}

/** Shape of the object returned by `useSession()` from next-auth/react. */
export interface MockSession {
  data: {
    user: MockUser;
    expires: string;
  } | null;
  status: "authenticated" | "unauthenticated" | "loading";
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/**
 * Creates an authenticated session fixture.
 *
 * Pass `overrides` to customise specific user fields (e.g. `credits`).
 *
 * @example
 *   useSession.mockReturnValue(createAuthenticatedSession({ credits: 50 }));
 */
export function createAuthenticatedSession(
  overrides?: Partial<MockUser>,
): MockSession {
  return {
    data: {
      user: {
        id: "test-user-id",
        email: "test@example.com",
        name: "Test User",
        username: "testuser",
        credits: 100,
        ...overrides,
      },
      expires: "2099-01-01T00:00:00.000Z",
    },
    status: "authenticated",
  };
}

/**
 * Creates an unauthenticated session fixture (`{ data: null, status: "unauthenticated" }`).
 *
 * @example
 *   useSession.mockReturnValue(createUnauthenticatedSession());
 */
export function createUnauthenticatedSession(): MockSession {
  return { data: null, status: "unauthenticated" };
}

/**
 * Creates a loading session fixture (`{ data: null, status: "loading" }`).
 *
 * @example
 *   useSession.mockReturnValue(createLoadingSession());
 */
export function createLoadingSession(): MockSession {
  return { data: null, status: "loading" };
}

// ---------------------------------------------------------------------------
// Pre-built vi.mock() factory
// ---------------------------------------------------------------------------

/**
 * Standard `vi.mock()` factory for `"next-auth/react"`.
 *
 * Stubs `useSession` with `createAuthenticatedSession()`, and provides
 * `signIn` / `signOut` / `getSession` spies.
 *
 * Usage — place at the top of your test file:
 *
 * ```ts
 * vi.mock("next-auth/react", () => nextAuthMock);
 * ```
 *
 * To switch session state inside a test, import `useSession` and mock its
 * return value:
 *
 * ```ts
 * import { useSession } from "next-auth/react";
 * (useSession as jest.Mock).mockReturnValue(createUnauthenticatedSession());
 * ```
 */
export const nextAuthMock = {
  useSession: vi.fn(() => createAuthenticatedSession()),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
};
