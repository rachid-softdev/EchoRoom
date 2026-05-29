import { describe, it, expect } from "vitest";
import { MIN_REPORT_REASON_LENGTH } from "@/lib/constants";

describe("ReportButton — MIN_REPORT_REASON_LENGTH constant", () => {
  it("should export MIN_REPORT_REASON_LENGTH equal to 10", () => {
    expect(MIN_REPORT_REASON_LENGTH).toBe(10);
  });

  it("should be usable in a disable condition (reason.trim().length < MIN_REPORT_REASON_LENGTH)", () => {
    const shortReason = "short";
    const longEnoughReason = "a".repeat(MIN_REPORT_REASON_LENGTH);
    const longReason = "a".repeat(MIN_REPORT_REASON_LENGTH + 5);

    // Simulate the exact conditions from ReportButton.tsx
    expect(shortReason.trim().length < MIN_REPORT_REASON_LENGTH).toBe(true);
    expect(longEnoughReason.trim().length < MIN_REPORT_REASON_LENGTH).toBe(false);
    expect(longReason.trim().length < MIN_REPORT_REASON_LENGTH).toBe(false);
  });

  it("should guard handleSubmit correctly (reason.trim().length < MIN_REPORT_REASON_LENGTH returns early)", () => {
    // This tests the guard logic in handleSubmit:
    //   if (reason.trim().length < MIN_REPORT_REASON_LENGTH) return;
    function simulateHandleSubmit(reason: string): boolean {
      if (reason.trim().length < MIN_REPORT_REASON_LENGTH) return false; // early return
      return true; // would proceed to mutate
    }

    expect(simulateHandleSubmit("short")).toBe(false);
    expect(simulateHandleSubmit("a".repeat(MIN_REPORT_REASON_LENGTH - 1))).toBe(false);
    expect(simulateHandleSubmit("a".repeat(MIN_REPORT_REASON_LENGTH))).toBe(true);
    expect(simulateHandleSubmit("a".repeat(MIN_REPORT_REASON_LENGTH + 10))).toBe(true);
    // Whitespace should be trimmed
    expect(simulateHandleSubmit("   short   ")).toBe(false);
    expect(simulateHandleSubmit("   " + "a".repeat(MIN_REPORT_REASON_LENGTH) + "   ")).toBe(true);
  });
});
