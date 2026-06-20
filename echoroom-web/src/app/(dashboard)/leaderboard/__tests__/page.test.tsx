import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// LeaderboardPageClient is tested separately
// This test verifies the server component wrapper renders correctly

vi.mock("../LeaderboardPageClient", () => ({
  default: () => <div data-testid="leaderboard-page-client" />,
}));

import LeaderboardPage from "../page";

describe("LeaderboardPage (server component)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders LeaderboardPageClient", () => {
    render(<LeaderboardPage />);
    expect(screen.getByTestId("leaderboard-page-client")).toBeInTheDocument();
  });
});
