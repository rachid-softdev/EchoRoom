import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Mock the client component
vi.mock("../AuditPageClient", () => ({
  default: () => <div data-testid="audit-page-client" />,
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("AuditPage (server component)", () => {
  let AuditPage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../page");
    AuditPage = mod.default;
  });

  it("should render the AuditPageClient component", () => {
    render(<AuditPage />);

    expect(screen.getByTestId("audit-page-client")).toBeInTheDocument();
  });
});
