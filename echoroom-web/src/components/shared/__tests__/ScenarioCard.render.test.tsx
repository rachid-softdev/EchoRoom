import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock @/components/ui
vi.mock("@echoroom/ui", () => ({
  Card: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children, className }: any) => <p className={className}>{children}</p>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children, className, title, ...props }: any) => (
    <h3 className={className} title={title} {...props}>
      {children}
    </h3>
  ),
  Badge: ({ children, variant, ...props }: any) => (
    <span data-variant={variant} {...props}>
      {children}
    </span>
  ),
  Button: ({ children, onClick, variant, size, className, ...props }: any) => (
    <button onClick={onClick} className={className} {...props}>
      {children}
    </button>
  ),
  toast: vi.fn(),
}));

vi.mock("lucide-react", () => ({
  Heart: () => <svg data-testid="icon-heart" />,
  MessageCircle: () => <svg data-testid="icon-message-circle" />,
  Play: () => <svg data-testid="icon-play" />,
  Share2: () => <svg data-testid="icon-share" />,
}));

vi.mock("@/lib/constants", () => ({
  CATEGORY_LABELS: {
    ROMANTIC: "Romantique",
    CHAOTIC: "Chaotique",
    NPC: "NPC",
  },
}));

import { ScenarioCard } from "../ScenarioCard";

const baseScenario = {
  id: "s-1",
  title: "Test Scenario",
  description: "A test scenario description",
  character: { name: "Roméo", category: "ROMANTIC" },
  creator: { username: "Alice" },
  _count: { reactions: 10, comments: 5 },
  playCount: 100,
  likeCount: 50,
};

describe("ScenarioCard — rendering", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders scenario title as a link", () => {
    render(<ScenarioCard scenario={baseScenario} />);
    const link = screen.getByRole("link", { name: /test scenario/i });
    expect(link).toHaveAttribute("href", "/scenario/s-1");
  });

  it("renders category badge", () => {
    render(<ScenarioCard scenario={baseScenario} />);
    expect(screen.getByText("Romantique")).toBeInTheDocument();
  });

  it("renders fallback category label when category is unknown", () => {
    const scenario = {
      ...baseScenario,
      character: { name: "Ghost", category: "UNKNOWN" },
    };
    render(<ScenarioCard scenario={scenario as any} />);
    expect(screen.getByText("Scénario")).toBeInTheDocument();
  });

  it("renders fallback category when character is undefined", () => {
    const scenario = { ...baseScenario, character: undefined };
    render(<ScenarioCard scenario={scenario as any} />);
    expect(screen.getByText("Scénario")).toBeInTheDocument();
  });

  it("renders play count", () => {
    render(<ScenarioCard scenario={baseScenario} />);
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("formats play count in thousands (1.5k)", () => {
    const scenario = { ...baseScenario, playCount: 1500 };
    render(<ScenarioCard scenario={scenario as any} />);
    expect(screen.getByText("1.5k")).toBeInTheDocument();
  });

  it("does not render play count when undefined", () => {
    const scenario = { ...baseScenario, playCount: undefined };
    render(<ScenarioCard scenario={scenario as any} />);
    expect(screen.queryByTestId("icon-play")).not.toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<ScenarioCard scenario={baseScenario} />);
    expect(screen.getByText("A test scenario description")).toBeInTheDocument();
  });

  it("does not render description when null", () => {
    const scenario = { ...baseScenario, description: null };
    render(<ScenarioCard scenario={scenario as any} />);
    expect(screen.queryByText("A test scenario description")).not.toBeInTheDocument();
  });

  it("shows creator username when showCreator is true (default)", () => {
    render(<ScenarioCard scenario={baseScenario} />);
    expect(screen.getByText("par Alice")).toBeInTheDocument();
  });

  it("hides creator username when showCreator is false", () => {
    render(<ScenarioCard scenario={baseScenario} showCreator={false} />);
    expect(screen.queryByText("par Alice")).not.toBeInTheDocument();
  });

  it("hides creator section when creator is undefined", () => {
    const scenario = { ...baseScenario, creator: undefined };
    render(<ScenarioCard scenario={scenario as any} />);
    expect(screen.queryByText(/par/)).not.toBeInTheDocument();
  });

  it("renders like count", () => {
    render(<ScenarioCard scenario={baseScenario} />);
    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it("renders comment count from _count", () => {
    render(<ScenarioCard scenario={baseScenario} />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows share button when showShare is true", () => {
    render(<ScenarioCard scenario={baseScenario} showShare={true} />);
    expect(screen.getByTestId("icon-share")).toBeInTheDocument();
  });

  it("hides share button when showShare is false (default)", () => {
    render(<ScenarioCard scenario={baseScenario} />);
    expect(screen.queryByTestId("icon-share")).not.toBeInTheDocument();
  });

  it("uses custom href when provided", () => {
    render(<ScenarioCard scenario={baseScenario} href="/custom/s-1" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/custom/s-1");
  });

  it("renders with minimal data (only id and title)", () => {
    const minimal = { id: "s-min", title: "Minimal" };
    render(<ScenarioCard scenario={minimal as any} />);
    expect(screen.getByText("Minimal")).toBeInTheDocument();
    expect(screen.getByText("Scénario")).toBeInTheDocument(); // fallback category
  });

  it("has accessible link with focus-visibile styles", () => {
    const { container } = render(<ScenarioCard scenario={baseScenario} />);
    const link = container.querySelector("a");
    expect(link).toHaveClass("focus-visible:outline-none");
    expect(link).toHaveAttribute("href", "/scenario/s-1");
  });

  it("stops propagation on share button click", () => {
    const parentClick = vi.fn();
    render(
      <div
        role="button"
        tabIndex={0}
        onClick={parentClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            parentClick();
          }
        }}
      >
        <ScenarioCard scenario={baseScenario} showShare={true} />
      </div>,
    );
    const shareButton = screen.getByTestId("icon-share").closest("button")!;
    // Click should not propagate to parent
    fireEvent.click(shareButton);
    // The share button calls e.preventDefault() and e.stopPropagation()
    // so the parent should NOT be called
    expect(parentClick).not.toHaveBeenCalled();
  });
});
