import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the client component
vi.mock("../BlockedNumbersPageClient", () => ({
  default: () => <div data-testid="blocked-numbers-page-client" />,
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("BlockedNumbersPage (server component)", () => {
  let BlockedNumbersPage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../page");
    BlockedNumbersPage = mod.default;
  });

  it("should render the BlockedNumbersPageClient component", () => {
    render(<BlockedNumbersPage />);

    expect(screen.getByTestId("blocked-numbers-page-client")).toBeInTheDocument();
  });
});
