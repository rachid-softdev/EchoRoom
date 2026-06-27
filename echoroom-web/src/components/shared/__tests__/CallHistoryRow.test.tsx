import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CallHistoryRow } from "../CallHistoryRow";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const baseCall = {
  id: "call-1",
  status: "COMPLETED" as const,
  durationSeconds: 120,
  createdAt: new Date("2024-01-15T10:30:00Z"),
  scenario: { title: "Test Scenario", character: { name: "Char" } },
};

describe("CallHistoryRow", () => {
  it("renders completed call with replay button", () => {
    render(<CallHistoryRow call={baseCall} />);

    expect(screen.getByText("Test Scenario")).toBeInTheDocument();
    expect(screen.getByText("Terminé")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /replay/i })).toHaveAttribute("href", "/call/call-1");
  });

  it("shows fallback title when no scenario title", () => {
    const call = {
      ...baseCall,
      scenario: { ...baseCall.scenario, title: undefined as unknown as string },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<CallHistoryRow call={call as any} />);

    expect(screen.getByText("Appel")).toBeInTheDocument();
  });

  it("hides replay button for non-completed statuses", () => {
    const statuses = ["PENDING", "CALLING", "RINGING", "ACTIVE", "FAILED", "BLOCKED"];
    for (const status of statuses) {
      const { unmount } = render(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <CallHistoryRow call={{ ...baseCall, status: status as any }} />,
      );
      expect(screen.queryAllByRole("link", { name: /replay/i })).toHaveLength(0);
      unmount();
    }
  });

  it("renders zero duration", () => {
    render(<CallHistoryRow call={{ ...baseCall, durationSeconds: 0 }} />);

    expect(screen.getByText("0s")).toBeInTheDocument();
  });
});
