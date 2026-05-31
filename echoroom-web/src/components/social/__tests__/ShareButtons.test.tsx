import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { ShareButtons } from "../ShareButtons";

// ---------------------------------------------------------------------------
// Mock tRPC (useMutation hook)
// ---------------------------------------------------------------------------

const mockMutate = vi.fn();

vi.mock("@/lib/trpc", () => ({
  api: {
    social: {
      trackShare: {
        useMutation: () => ({
          mutate: mockMutate,
          isPending: false,
        }),
      },
    },
  },
}));

// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
  mockMutate.mockClear();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(window, "open").mockImplementation(() => null);

  // Ensure clipboard is writable
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });

  // Ensure share is undefined by default
  Object.defineProperty(navigator, "share", {
    value: undefined,
    writable: true,
    configurable: true,
  });
});

// ---------------------------------------------------------------------------

describe("ShareButtons", () => {
  const defaultProps = {
    scenarioId: "scenario-123",
    title: "Test Scenario",
    description: "A test scenario description",
  };

  // ── Renders ──────────────────────────────────────────────────────

  it("renders all four share buttons", () => {
    render(<ShareButtons {...defaultProps} />);
    expect(screen.getByRole("button", { name: /twitter/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /discord/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tiktok/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /partager/i })).toBeInTheDocument();
  });

  // ── Twitter (verified working) ───────────────────────────────────

  it("opens Twitter intent URL with description", () => {
    render(<ShareButtons {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /twitter/i }));

    const expected = `https://twitter.com/intent/tweet?text=${encodeURIComponent("Test Scenario\n\nA test scenario description")}&url=${encodeURIComponent("http://localhost:3000/scenario/scenario-123")}`;
    expect(window.open).toHaveBeenCalledWith(expected, "_blank", "noopener,noreferrer");
  });

  it("opens Twitter intent URL without description", () => {
    render(<ShareButtons {...defaultProps} description={undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /twitter/i }));

    const expected = `https://twitter.com/intent/tweet?text=${encodeURIComponent("Test Scenario")}&url=${encodeURIComponent("http://localhost:3000/scenario/scenario-123")}`;
    expect(window.open).toHaveBeenCalledWith(expected, "_blank", "noopener,noreferrer");
  });

  it("tracks Twitter share via mutate", () => {
    render(<ShareButtons {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /twitter/i }));
    expect(mockMutate).toHaveBeenCalledWith({ scenarioId: "scenario-123", platform: "TWITTER" });
  });

  // ── Clipboard-based share (Discord, TikTok) ──────────────────────
  //
  // NOTE: These test that the clipboard API receives the right URL.
  // The navigator.clipboard.writeText mock is set up in beforeEach.

  it("copies scenario URL to clipboard for Discord", async () => {
    render(<ShareButtons {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /discord/i }));

    await waitFor(() => {
      const writeText = (navigator as any).clipboard?.writeText;
      expect(writeText).toHaveBeenCalledWith("http://localhost:3000/scenario/scenario-123");
    });
  });

  it("copies scenario URL to clipboard for TikTok", async () => {
    render(<ShareButtons {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /tiktok/i }));

    await waitFor(() => {
      const writeText = (navigator as any).clipboard?.writeText;
      expect(writeText).toHaveBeenCalledWith("http://localhost:3000/scenario/scenario-123");
    });
  });

  it("tracks Discord share via mutate", async () => {
    render(<ShareButtons {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /discord/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({ scenarioId: "scenario-123", platform: "DISCORD" });
    });
  });

  it("tracks TikTok share via mutate", async () => {
    render(<ShareButtons {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /tiktok/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({ scenarioId: "scenario-123", platform: "TIKTOK" });
    });
  });

  // ── Native share ─────────────────────────────────────────────────

  it("uses native share API when available", async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    (navigator as any).share = mockShare;

    render(<ShareButtons {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /partager/i }));

    await waitFor(() => {
      expect(mockShare).toHaveBeenCalledWith({
        title: "Test Scenario",
        text: "A test scenario description",
        url: "http://localhost:3000/scenario/scenario-123",
      });
    });
  });

  it("tracks native share via mutate", async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    (navigator as any).share = mockShare;

    render(<ShareButtons {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /partager/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({ scenarioId: "scenario-123", platform: "WEB_SHARE" });
    });
  });

  it("falls back to clipboard when native share unavailable", async () => {
    render(<ShareButtons {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /partager/i }));

    await waitFor(() => {
      const writeText = (navigator as any).clipboard?.writeText;
      expect(writeText).toHaveBeenCalledWith("http://localhost:3000/scenario/scenario-123");
    });
  });

  it("tracks fallback share via mutate", async () => {
    render(<ShareButtons {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /partager/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({ scenarioId: "scenario-123", platform: "WEB_SHARE" });
    });
  });

  it("passes title as text when description is missing for native share", async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined);
    (navigator as any).share = mockShare;

    render(<ShareButtons {...defaultProps} description={undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /partager/i }));

    await waitFor(() => {
      expect(mockShare).toHaveBeenCalledWith({
        title: "Test Scenario",
        text: "Test Scenario",
        url: "http://localhost:3000/scenario/scenario-123",
      });
    });
  });

  // ── Error handling ───────────────────────────────────────────────

  it("handles clipboard write failure gracefully", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    render(<ShareButtons {...defaultProps} />);
    expect(() => {
      fireEvent.click(screen.getByRole("button", { name: /discord/i }));
    }).not.toThrow();
  });

  // ── URL construction ─────────────────────────────────────────────

  it("constructs correct share URL for a given scenario ID", () => {
    render(<ShareButtons scenarioId="abc-456" title="My Scenario" />);
    fireEvent.click(screen.getByRole("button", { name: /twitter/i }));

    const expected = `https://twitter.com/intent/tweet?text=${encodeURIComponent("My Scenario")}&url=${encodeURIComponent("http://localhost:3000/scenario/abc-456")}`;
    expect(window.open).toHaveBeenCalledWith(expected, "_blank", "noopener,noreferrer");
  });
});
