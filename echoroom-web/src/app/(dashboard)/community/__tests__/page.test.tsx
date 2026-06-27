import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
