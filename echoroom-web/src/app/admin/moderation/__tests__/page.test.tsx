import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

    expect(screen.getByTestId("moderation-page-client")).toBeInTheDocument();
  });
});
