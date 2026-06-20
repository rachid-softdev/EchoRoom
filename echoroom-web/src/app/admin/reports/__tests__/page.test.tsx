import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Mock the client component
vi.mock("../ReportsPageClient", () => ({
  default: () => <div data-testid="reports-page-client" />,
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("ReportsPage (server component)", () => {
  let ReportsPage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../page");
    ReportsPage = mod.default;
  });

  it("should render the ReportsPageClient component", () => {
    render(<ReportsPage />);

    expect(screen.getByTestId("reports-page-client")).toBeInTheDocument();
  });
});
