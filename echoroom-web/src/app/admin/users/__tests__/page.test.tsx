import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
