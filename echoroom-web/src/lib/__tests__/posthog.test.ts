import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// PostHog client-side initialization tests
// ---------------------------------------------------------------------------
// Tests for the client-side posthog.ts module:
//   - In browser (typeof window !== 'undefined'): posthogjs.init called with correct keys
//   - In SSR (typeof window === 'undefined'): no crash, posthog remains null

const mockPosthogInit = vi.fn();
const mockPosthogIdentify = vi.fn();

vi.mock("posthog-js", () => ({
  default: {
    init: mockPosthogInit,
    identify: mockPosthogIdentify,
  },
}));

// Store windowSpy reference for per-test control
const windowSpy = vi.spyOn(globalThis as any, "window", "get");

describe("PostHog client-side initialization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("should call posthogjs.init with correct keys in browser environment", async () => {
    // Simulate browser: window is defined
    windowSpy.mockReturnValue({} as Window & typeof globalThis);

    // We need to re-mock env.client for this test
    vi.doMock("@/lib/env.client", () => ({
      env: {
        NEXT_PUBLIC_POSTHOG_KEY: "phc_test_key_browser",
        NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_placeholder",
      },
    }));

    const mod = await import("../posthog");
    expect(mod.posthog).not.toBeNull();
    expect(mockPosthogInit).toHaveBeenCalledWith("phc_test_key_browser", {
      api_host: "https://us.i.posthog.com",
    });
  });

  it("should not crash in SSR (typeof window === 'undefined')", async () => {
    // Simulate SSR: window is undefined
    windowSpy.mockReturnValue(undefined);

    vi.doMock("@/lib/env.client", () => ({
      env: {
        NEXT_PUBLIC_POSTHOG_KEY: "phc_test_key_ssr",
        NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_placeholder",
      },
    }));

    const mod = await import("../posthog");
    expect(mod.posthog).toBeNull();
    // posthogjs.init should NOT have been called in SSR
    expect(mockPosthogInit).not.toHaveBeenCalled();
  });

  it("should handle initialization errors gracefully without crashing", async () => {
    // Simulate browser
    windowSpy.mockReturnValue({} as Window & typeof globalThis);

    vi.doMock("@/lib/env.client", () => ({
      env: {
        NEXT_PUBLIC_POSTHOG_KEY: "phc_test_key_error",
        NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_placeholder",
      },
    }));

    // Make posthogjs.init throw
    mockPosthogInit.mockImplementation(() => {
      throw new Error("PostHog init failed");
    });

    // Should not crash; posthog should be null since the try/catch catches it
    const mod = await import("../posthog");
    // The try/catch in posthog.ts sets posthog = posthogjs only after init succeeds
    // Since init throws, posthog stays as the module-level null initial value
    expect(mod.posthog).toBeNull();
  });
});
