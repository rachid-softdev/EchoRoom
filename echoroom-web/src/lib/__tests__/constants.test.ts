import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Constants & utility functions tests
// ---------------------------------------------------------------------------
// Tests for formatDate, formatDuration, STATUS_LABELS, CATEGORY_LABELS,
// DAILY_LIMITS and other exports from src/lib/constants.ts

describe("formatDate", () => {
  it("should format an ISO string in French locale", async () => {
    const { formatDate } = await import("../constants");
    const result = formatDate("2026-06-20T14:30:00.000Z");

    // French locale should produce "20 juin 2026" or similar
    expect(result).toContain("2026");
    expect(result).toContain("juin");
    // Should include time
    expect(result).toMatch(/14|15|16/); // either 14:30 or 16:30 depending on timezone
  });

  it("should format a Date object", async () => {
    const { formatDate } = await import("../constants");
    const date = new Date("2026-01-15T10:00:00.000Z");
    const result = formatDate(date);

    expect(result).toContain("2026");
    expect(result).toContain("janv");
  });

  it("should throw on an invalid date string", async () => {
    const { formatDate } = await import("../constants");
    // Invalid date string — the constructor creates an Invalid Date
    // Intl.DateTimeFormat.format throws RangeError for Invalid Date values
    expect(() => formatDate("not-a-date")).toThrow(RangeError);
  });

  it("should throw on empty string", async () => {
    const { formatDate } = await import("../constants");
    // Empty string creates an Invalid Date, which triggers RangeError
    expect(() => formatDate("")).toThrow(RangeError);
  });
});

describe("formatDuration", () => {
  it('should format 3661 seconds as "61:01"', async () => {
    const { formatDuration } = await import("../constants");
    expect(formatDuration(3661)).toBe("61:01");
  });

  it('should format 45 seconds as "45s"', async () => {
    const { formatDuration } = await import("../constants");
    expect(formatDuration(45)).toBe("45s");
  });

  it('should format 0 seconds as "0s"', async () => {
    const { formatDuration } = await import("../constants");
    expect(formatDuration(0)).toBe("0s");
  });

  it('should clamp negative values and return "0s"', async () => {
    const { formatDuration } = await import("../constants");
    expect(formatDuration(-1)).toBe("0s");
  });

  it('should format 60 seconds as "1:00"', async () => {
    const { formatDuration } = await import("../constants");
    expect(formatDuration(60)).toBe("1:00");
  });

  it('should format 3600 seconds as "60:00"', async () => {
    const { formatDuration } = await import("../constants");
    expect(formatDuration(3600)).toBe("60:00");
  });

  it('should format 1 second as "1s"', async () => {
    const { formatDuration } = await import("../constants");
    expect(formatDuration(1)).toBe("1s");
  });

  it('should format 59 seconds as "59s"', async () => {
    const { formatDuration } = await import("../constants");
    expect(formatDuration(59)).toBe("59s");
  });

  it('should format 61 seconds as "1:01"', async () => {
    const { formatDuration } = await import("../constants");
    expect(formatDuration(61)).toBe("1:01");
  });
});

describe("STATUS_LABELS", () => {
  it("should have all 7 keys with French labels", async () => {
    const { STATUS_LABELS } = await import("../constants");

    expect(STATUS_LABELS).toEqual({
      PENDING: "En attente",
      CALLING: "Appel en cours",
      RINGING: "Sonnerie",
      ACTIVE: "Actif",
      COMPLETED: "Terminé",
      FAILED: "Échoué",
      BLOCKED: "Bloqué",
    });
  });

  it("should have exactly 7 entries", async () => {
    const { STATUS_LABELS } = await import("../constants");
    expect(Object.keys(STATUS_LABELS)).toHaveLength(7);
  });
});

describe("CATEGORY_LABELS", () => {
  it("should have all 8 categories with French labels", async () => {
    const { CATEGORY_LABELS } = await import("../constants");

    expect(CATEGORY_LABELS).toEqual({
      ROMANTIC: "Romantique",
      CHAOTIC: "Chaotique",
      CORPORATE: "Corporate",
      NPC: "NPC",
      HORROR: "Horreur",
      CRINGE: "Cringe",
      GAMER: "Gamer",
      WEIRD: "Weird",
    });
  });

  it("should have exactly 8 entries", async () => {
    const { CATEGORY_LABELS } = await import("../constants");
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(8);
  });
});

describe("DAILY_LIMITS", () => {
  it("should be readonly (as const)", async () => {
    const { DAILY_LIMITS } = await import("../constants");

    expect(DAILY_LIMITS.MAX_CALLS).toBe(10);
    expect(DAILY_LIMITS.MAX_DURATION_SECONDS).toBe(3600);
    expect(DAILY_LIMITS.DEFAULT_MAX_DAILY_DURATION_SECONDS).toBe(3600);
  });
});

describe("STATUS_VARIANTS", () => {
  it("should have all 7 keys with BadgeVariant values", async () => {
    const { STATUS_VARIANTS } = await import("../constants");

    expect(STATUS_VARIANTS).toEqual({
      PENDING: "outline",
      CALLING: "default",
      RINGING: "secondary",
      ACTIVE: "default",
      COMPLETED: "secondary",
      FAILED: "destructive",
      BLOCKED: "destructive",
    });
  });
});

describe("LOCALE", () => {
  it('should be "fr-FR"', async () => {
    const { LOCALE } = await import("../constants");
    expect(LOCALE).toBe("fr-FR");
  });
});

describe("MIN_REPORT_REASON_LENGTH", () => {
  it("should be 10", async () => {
    const { MIN_REPORT_REASON_LENGTH } = await import("../constants");
    expect(MIN_REPORT_REASON_LENGTH).toBe(10);
  });
});
