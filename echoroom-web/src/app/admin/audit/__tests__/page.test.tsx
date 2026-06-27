import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
