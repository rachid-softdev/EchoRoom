import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TranscriptView } from "../TranscriptView";

// Mock Skeleton from UI
vi.mock("@/components/ui", () => ({
  Skeleton: ({ className, ...props }: { className?: string; [key: string]: unknown }) => (
    <div className={className} data-testid="skeleton" {...props} />
  ),
}));

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TranscriptView", () => {
  // ── Loading state ─────────────────────────────────────────────────

  it("renders 5 skeleton elements when isLoading is true", () => {
    const { container } = render(<TranscriptView transcript={null} isLoading={true} />);

    const skeletons = container.querySelectorAll('[data-testid="skeleton"]');
    expect(skeletons.length).toBe(15); // 5 groups * 3 skeletons each
  });

  it("renders loading skeletons even when transcript data exists", () => {
    const { container } = render(
      <TranscriptView transcript={[{ speaker: "user", text: "Hello" }]} isLoading={true} />,
    );

    const skeletons = container.querySelectorAll('[data-testid="skeleton"]');
    expect(skeletons.length).toBe(15);
    expect(screen.queryByText("Hello")).not.toBeInTheDocument();
  });

  // ── Empty transcript (null) ──────────────────────────────────────

  it('shows "Transcript en cours de traitement…" when transcript is null', () => {
    render(<TranscriptView transcript={null} isLoading={false} />);

    expect(screen.getByText("Transcript en cours de traitement…")).toBeInTheDocument();
  });

  it('shows "Aucune transcription disponible" when transcript is empty array', () => {
    render(<TranscriptView transcript={[]} isLoading={false} />);

    expect(screen.getByText("Aucune transcription disponible")).toBeInTheDocument();
  });

  it('shows "Aucune transcription disponible" when transcript is undefined', () => {
    render(<TranscriptView transcript={undefined} isLoading={false} />);

    expect(screen.getByText("Aucune transcription disponible")).toBeInTheDocument();
  });

  it("renders MessageSquare icon in empty state", () => {
    const { container } = render(<TranscriptView transcript={null} isLoading={false} />);

    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  // ── Transcript rendering ─────────────────────────────────────────

  it("renders transcript segments with speaker labels", () => {
    const transcript = [
      { speaker: "assistant", text: "Bonjour, comment allez-vous ?" },
      { speaker: "user", text: "Très bien, merci !" },
    ];

    render(<TranscriptView transcript={transcript} isLoading={false} scenarioName="Mentor" />);

    expect(screen.getByText("Bonjour, comment allez-vous ?")).toBeInTheDocument();
    expect(screen.getByText("Très bien, merci !")).toBeInTheDocument();
    // Assistant speaker should show IA label
    expect(screen.getAllByText("IA")[0]).toBeInTheDocument();
    // User should show "Moi" label
    expect(screen.getByText("Moi")).toBeInTheDocument();
  });

  it("renders IA speaker label with scenario name", () => {
    const transcript = [{ speaker: "assistant", text: "Hello" }];

    render(<TranscriptView transcript={transcript} isLoading={false} scenarioName="Dr. Smith" />);

    expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
    expect(screen.getByText("IA")).toBeInTheDocument();
  });

  it("renders fallback 'Personnage IA' when scenarioName is not provided", () => {
    const transcript = [{ speaker: "assistant", text: "Hello" }];

    render(<TranscriptView transcript={transcript} isLoading={false} />);

    expect(screen.getByText("Personnage IA")).toBeInTheDocument();
  });

  it("renders 'Vous' for user speaker label", () => {
    const transcript = [{ speaker: "user", text: "Hello" }];

    render(<TranscriptView transcript={transcript} isLoading={false} />);

    expect(screen.getByText("Vous")).toBeInTheDocument();
    expect(screen.getByText("Moi")).toBeInTheDocument();
  });

  it("renders timestamp when provided", () => {
    const transcript = [{ speaker: "assistant", text: "Hello", timestamp: 65 }];

    render(<TranscriptView transcript={transcript} isLoading={false} />);

    // 65 seconds = 1:05
    expect(screen.getByText("1:05")).toBeInTheDocument();
  });

  it("handles zero timestamp (0 is falsy so conditional short-circuits)", () => {
    const transcript = [{ speaker: "assistant", text: "Hello", timestamp: 0 }];

    render(<TranscriptView transcript={transcript} isLoading={false} />);

    // Known: `formatTimestamp(0)` returns '' because `!0` is true,
    // and `chunk.timestamp && (...) ` evaluates to `0` which renders as "0".
    expect(screen.getByText((content) => content.startsWith("Personnage IA"))).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
    // The number 0 leaks as a React text node from the falsy short-circuit
    expect(
      screen.getByText((content) => content.startsWith("Personnage IA")).textContent,
    ).toContain("0");
  });

  it("renders no timestamp when timestamp is undefined", () => {
    const transcript = [{ speaker: "assistant", text: "Hello" }];

    render(<TranscriptView transcript={transcript} isLoading={false} />);

    expect(screen.queryByText(/^\d+:\d+$/)).not.toBeInTheDocument();
  });

  it("renders multiple messages in correct order", () => {
    const transcript = [
      { speaker: "assistant", text: "First" },
      { speaker: "user", text: "Second" },
      { speaker: "assistant", text: "Third" },
    ];

    render(<TranscriptView transcript={transcript} isLoading={false} />);

    const messages = screen.getAllByText(/First|Second|Third/);
    expect(messages).toHaveLength(3);
    expect(messages[0]).toHaveTextContent("First");
    expect(messages[1]).toHaveTextContent("Second");
    expect(messages[2]).toHaveTextContent("Third");
  });
});
