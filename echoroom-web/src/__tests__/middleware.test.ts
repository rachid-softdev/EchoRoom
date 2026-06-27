import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be defined before any imports
// ---------------------------------------------------------------------------
vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn(() => {
      const headers = new Map<string, string>();
      return {
        headers: {
          set: vi.fn((key: string, value: string) => headers.set(key, value)),
          get: vi.fn((key: string) => headers.get(key)),
        },
      };
    }),
    redirect: vi.fn((url: URL) => {
      const headers = new Map<string, string>();
      return {
        headers: {
          set: vi.fn((key: string, value: string) => headers.set(key, value)),
          get: vi.fn((key: string) => headers.get(key)),
        },
        url,
      };
    }),
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn((handler: (req: any) => any) => handler),
}));

import { NextResponse } from "next/server";
// ---------------------------------------------------------------------------
// Imports after mocks are hoisted
// ---------------------------------------------------------------------------
import middleware from "@/middleware";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
interface MockRequestOptions {
  auth?: unknown;
  url?: string;
}

function createRequest(
  pathname: string,
  options?: MockRequestOptions,
): NextRequest & { auth?: unknown } {
  return {
    nextUrl: {
      pathname,
      searchParams: new URLSearchParams(),
    },
    url: options?.url ?? `https://echoroom.app${pathname}`,
    auth: options?.auth,
  } as unknown as NextRequest & { auth?: unknown };
}

/** Shorthand for an authenticated session (non-admin). */
const USER_AUTH = { user: { role: "USER" } };

/** Shorthand for an admin session. */
const ADMIN_AUTH = { user: { role: "ADMIN" } };

/** Shorthand for a moderator session. */
const MODERATOR_AUTH = { user: { role: "MODERATOR" } };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("src/middleware.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  Public path detection  (1)
  // ─────────────────────────────────────────────────────────────────────────
  describe("public path detection", () => {
    it.each([
      { path: "/", label: "root" },
      { path: "/explore", label: "explore" },
      { path: "/pricing", label: "pricing" },
      { path: "/terms", label: "terms" },
      { path: "/privacy", label: "privacy" },
    ])("should allow $label ($path) without auth", async ({ path }) => {
      const req = createRequest(path);
      await middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it.each([
      { path: "/legal", label: "/legal exact" },
      { path: "/legal/terms", label: "/legal/terms" },
      { path: "/legal/privacy", label: "/legal/privacy" },
      { path: "/legal/cookies", label: "/legal/cookies" },
    ])("should allow $label ($path) without auth", async ({ path }) => {
      const req = createRequest(path);
      await middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it.each([
      { path: "/_next", label: "/_next exact" },
      { path: "/_next/static/chunks/main.js", label: "/_next/static/..." },
      { path: "/_next/data/build-id/page.json", label: "/_next/data/..." },
    ])("should allow $label ($path) without auth", async ({ path }) => {
      const req = createRequest(path);
      await middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it.each([
      { path: "/api/auth/session", label: "/api/auth/..." },
      { path: "/api/auth/csrf", label: "/api/auth/csrf" },
      { path: "/api/webhooks/stripe", label: "/api/webhooks/..." },
      { path: "/api/webhooks/twilio", label: "/api/webhooks/twilio" },
    ])("should allow $label ($path) without auth", async ({ path }) => {
      const req = createRequest(path);
      await middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it("should allow /favicon.ico without auth", async () => {
      const req = createRequest("/favicon.ico");
      await middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it("should allow /login without auth (unaltered)", async () => {
      const req = createRequest("/login");
      await middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it("should allow /register without auth (unaltered)", async () => {
      const req = createRequest("/register");
      await middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  Auth redirect — unauthenticated on protected routes  (2)
  // ─────────────────────────────────────────────────────────────────────────
  describe("auth redirect — unauthenticated users", () => {
    it("should redirect unauthenticated /dashboard to /login with callbackUrl", async () => {
      const req = createRequest("/dashboard");
      await middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      expect(NextResponse.next).not.toHaveBeenCalled();

      const redirectUrl = NextResponse.redirect.mock.calls[0][0] as URL;
      expect(redirectUrl.pathname).toBe("/login");
      expect(redirectUrl.searchParams.get("callbackUrl")).toBe("/dashboard");
    });

    it("should redirect unauthenticated /dashboard/settings to /login with correct callbackUrl", async () => {
      const req = createRequest("/dashboard/settings");
      await middleware(req);

      const redirectUrl = NextResponse.redirect.mock.calls[0][0] as URL;
      expect(redirectUrl.pathname).toBe("/login");
      expect(redirectUrl.searchParams.get("callbackUrl")).toBe("/dashboard/settings");
    });

    it("should redirect unauthenticated /call/abc-123 to /login with callbackUrl", async () => {
      const req = createRequest("/call/abc-123");
      await middleware(req);

      const redirectUrl = NextResponse.redirect.mock.calls[0][0] as URL;
      expect(redirectUrl.pathname).toBe("/login");
      expect(redirectUrl.searchParams.get("callbackUrl")).toBe("/call/abc-123");
    });

    it("should allow authenticated /dashboard through", async () => {
      const req = createRequest("/dashboard", { auth: USER_AUTH });
      await middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it("should allow authenticated /call/xyz through", async () => {
      const req = createRequest("/call/xyz", { auth: USER_AUTH });
      await middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  Admin role guard  (3)
  // ─────────────────────────────────────────────────────────────────────────
  describe("admin role guard", () => {
    it("should redirect unauthenticated /admin to /login with callbackUrl", async () => {
      const req = createRequest("/admin");
      await middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = NextResponse.redirect.mock.calls[0][0] as URL;
      expect(redirectUrl.pathname).toBe("/login");
      expect(redirectUrl.searchParams.get("callbackUrl")).toBe("/admin");
    });

    it("should redirect USER role on /admin to /dashboard", async () => {
      const req = createRequest("/admin", { auth: USER_AUTH });
      await middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = NextResponse.redirect.mock.calls[0][0] as URL;
      expect(redirectUrl.pathname).toBe("/dashboard");
      // No callbackUrl on admin → dashboard redirect
      expect(redirectUrl.searchParams.get("callbackUrl")).toBeNull();
    });

    it("should redirect MODERATOR role on /admin to /dashboard", async () => {
      const req = createRequest("/admin", { auth: MODERATOR_AUTH });
      await middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = NextResponse.redirect.mock.calls[0][0] as URL;
      expect(redirectUrl.pathname).toBe("/dashboard");
    });

    it("should redirect USER role on /admin/users to /dashboard", async () => {
      const req = createRequest("/admin/users", { auth: USER_AUTH });
      await middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = NextResponse.redirect.mock.calls[0][0] as URL;
      expect(redirectUrl.pathname).toBe("/dashboard");
    });

    it("should allow ADMIN role on /admin to pass through", async () => {
      const req = createRequest("/admin", { auth: ADMIN_AUTH });
      await middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it("should allow ADMIN role on /admin/users to pass through", async () => {
      const req = createRequest("/admin/users", { auth: ADMIN_AUTH });
      await middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it("should allow ADMIN role on /admin/settings to pass through", async () => {
      const req = createRequest("/admin/settings", { auth: ADMIN_AUTH });
      await middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  Callback URL handling  (5)
  // ─────────────────────────────────────────────────────────────────────────
  describe("callback URL handling", () => {
    it("should include the original path as callbackUrl when redirecting to login", async () => {
      const paths = [
        "/dashboard",
        "/dashboard/settings",
        "/dashboard/billing",
        "/call/abc-123",
        "/admin",
        "/admin/users",
      ];

      for (const path of paths) {
        vi.clearAllMocks();
        const req = createRequest(path);
        await middleware(req);

        expect(NextResponse.redirect).toHaveBeenCalled();
        const redirectUrl = NextResponse.redirect.mock.calls[0][0] as URL;
        expect(redirectUrl.searchParams.get("callbackUrl")).toBe(path);
      }
    });

    it("should preserve callbackUrl across different base URLs", async () => {
      const req = createRequest("/dashboard", {
        url: "https://app.echoroom.test/dashboard",
      });
      await middleware(req);

      const redirectUrl = NextResponse.redirect.mock.calls[0][0] as URL;
      expect(redirectUrl.searchParams.get("callbackUrl")).toBe("/dashboard");
      expect(redirectUrl.hostname).toBe("app.echoroom.test");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  Authenticated user redirect from login / register  (6)
  // ─────────────────────────────────────────────────────────────────────────
  describe("authenticated redirect from login / register", () => {
    it("should redirect authenticated /login to /dashboard", async () => {
      const req = createRequest("/login", { auth: USER_AUTH });
      await middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = NextResponse.redirect.mock.calls[0][0] as URL;
      expect(redirectUrl.pathname).toBe("/dashboard");
    });

    it("should redirect authenticated /register to /dashboard", async () => {
      const req = createRequest("/register", { auth: USER_AUTH });
      await middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = NextResponse.redirect.mock.calls[0][0] as URL;
      expect(redirectUrl.pathname).toBe("/dashboard");
    });

    it("should redirect authenticated ADMIN /login to /dashboard", async () => {
      const req = createRequest("/login", { auth: ADMIN_AUTH });
      await middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = NextResponse.redirect.mock.calls[0][0] as URL;
      expect(redirectUrl.pathname).toBe("/dashboard");
    });

    it("should allow unauthenticated /login through", async () => {
      const req = createRequest("/login");
      await middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it("should allow unauthenticated /register through", async () => {
      const req = createRequest("/register");
      await middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  Security headers  (4)
  // ─────────────────────────────────────────────────────────────────────────
  describe("security headers", () => {
    const EXPECTED_HEADERS: Record<string, string> = {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    };

    /** Extract the response object that was passed to withSecurityHeaders. */
    function getResponse() {
      // The last call to either next() or redirect() will have had .headers.set
      // called by withSecurityHeaders. We grab the response from next() if it
      // was called, otherwise from redirect().
      if (NextResponse.next.mock.calls.length > 0) {
        return NextResponse.next.mock.results[0]?.value;
      }
      if (NextResponse.redirect.mock.calls.length > 0) {
        return NextResponse.redirect.mock.results[0]?.value;
      }
      return null;
    }

    it("should set all four security headers on a public path response", async () => {
      const req = createRequest("/explore");
      await middleware(req);

      const response = getResponse();
      expect(response).not.toBeNull();

      for (const [header, value] of Object.entries(EXPECTED_HEADERS)) {
        expect(response.headers.set).toHaveBeenCalledWith(header, value);
      }
    });

    it("should set all four security headers on a redirect response", async () => {
      const req = createRequest("/dashboard");
      await middleware(req);

      const response = getResponse();
      expect(response).not.toBeNull();

      for (const [header, value] of Object.entries(EXPECTED_HEADERS)) {
        expect(response.headers.set).toHaveBeenCalledWith(header, value);
      }
    });

    it("should set all four security headers on an admin-allowed response", async () => {
      const req = createRequest("/admin", { auth: ADMIN_AUTH });
      await middleware(req);

      const response = getResponse();
      expect(response).not.toBeNull();

      for (const [header, value] of Object.entries(EXPECTED_HEADERS)) {
        expect(response.headers.set).toHaveBeenCalledWith(header, value);
      }
    });

    it("should set all four security headers on a login → dashboard redirect", async () => {
      const req = createRequest("/login", { auth: USER_AUTH });
      await middleware(req);

      const response = getResponse();
      expect(response).not.toBeNull();

      for (const [header, value] of Object.entries(EXPECTED_HEADERS)) {
        expect(response.headers.set).toHaveBeenCalledWith(header, value);
      }
    });

    it("should set headers in the correct order (X-Content-Type-Options first)", async () => {
      const req = createRequest("/explore");
      await middleware(req);

      const response = getResponse();
      const setCalls = response.headers.set.mock.calls as Array<[string, string]>;
      const headerKeys = setCalls.map(([key]) => key);

      expect(headerKeys[0]).toBe("X-Content-Type-Options");
      expect(headerKeys[1]).toBe("X-Frame-Options");
      expect(headerKeys[2]).toBe("Referrer-Policy");
      expect(headerKeys[3]).toBe("Permissions-Policy");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  Fallback / default case
  // ─────────────────────────────────────────────────────────────────────────
  describe("fallthrough / default", () => {
    it("should allow unknown paths through with next()", async () => {
      const req = createRequest("/some-unknown-path");
      await middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });

    it("should allow unknown paths for authenticated users", async () => {
      const req = createRequest("/some-unknown-path", { auth: USER_AUTH });
      await middleware(req);

      expect(NextResponse.next).toHaveBeenCalledTimes(1);
      expect(NextResponse.redirect).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  //  Edge cases
  // ─────────────────────────────────────────────────────────────────────────
  describe("edge cases", () => {
    it("should treat auth as falsy when req.auth is undefined", async () => {
      // A request with auth explicitly set to undefined — same as missing
      const req = createRequest("/dashboard", { auth: undefined });
      await middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
    });

    it("should treat auth as falsy when req.auth is null", async () => {
      const req = createRequest("/dashboard", { auth: null });
      await middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
    });

    it("should not confuse /api-endpoint (non-public) with /api/auth", async () => {
      // /api/custom is NOT in publicPaths — should be treated as unknown
      const req = createRequest("/api/custom");
      await middleware(req);

      // Falls through to the default: next()
      expect(NextResponse.next).toHaveBeenCalledTimes(1);
    });

    it("should handle pathname with trailing slash", async () => {
      // /dashboard/ should still be caught by startsWith("/dashboard")
      const req = createRequest("/dashboard/");
      await middleware(req);

      expect(NextResponse.redirect).toHaveBeenCalledTimes(1);
      const redirectUrl = NextResponse.redirect.mock.calls[0][0] as URL;
      expect(redirectUrl.pathname).toBe("/login");
      expect(redirectUrl.searchParams.get("callbackUrl")).toBe("/dashboard/");
    });
  });
});
