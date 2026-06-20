import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Mock the client component
vi.mock("../ModerationPageClient", () => ({
  default: () => <div data-testid="moderation-page-client" />,
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("ModerationPage (server component)", () => {
  let ModerationPage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../page");
    ModerationPage = mod.default;
  });

  it("should render the ModerationPageClient component", () => {
    render(<ModerationPage />);

    expect(
      screen.getByTestId("moderation-page-client"),
    ).toBeInTheDocument();
  });
});
