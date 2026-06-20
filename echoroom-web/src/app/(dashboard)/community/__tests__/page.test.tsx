import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// CommunityPageClient is already tested in CommunityPageClient.test.tsx
// This test verifies the server component wrapper renders correctly

vi.mock("../CommunityPageClient", () => ({
  default: () => <div data-testid="community-page-client" />,
}));

import CommunityPage from "../page";

describe("CommunityPage (server component)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders CommunityPageClient", () => {
    render(<CommunityPage />);
    expect(screen.getByTestId("community-page-client")).toBeInTheDocument();
  });
});
