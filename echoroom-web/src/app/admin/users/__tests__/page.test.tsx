import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Mock the client component
vi.mock("../UsersPageClient", () => ({
  default: () => <div data-testid="users-page-client" />,
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("UsersPage (server component)", () => {
  let UsersPage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../page");
    UsersPage = mod.default;
  });

  it("should render the UsersPageClient component", () => {
    render(<UsersPage />);

    expect(screen.getByTestId("users-page-client")).toBeInTheDocument();
  });
});
