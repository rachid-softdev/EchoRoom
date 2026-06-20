import "@testing-library/jest-dom/vitest";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PasswordStrengthMeter } from "../PasswordStrengthMeter";

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PasswordStrengthMeter", () => {
  // ── Empty password ────────────────────────────────────────────────

  it("returns null for empty password", () => {
    const { container } = render(<PasswordStrengthMeter password="" />);
    expect(container.innerHTML).toBe("");
  });

  // ── Very weak (0 checks) ──────────────────────────────────────────

  it("shows 5 gray segments and all ✗ for very weak password", () => {
    render(<PasswordStrengthMeter password="a" />);

    // All 5 list items should show ✗
    const listItems = screen.getAllByRole("listitem");
    expect(listItems).toHaveLength(5);

    // All should have ✗ indicator
    const crosses = screen.getAllByText("✗");
    expect(crosses).toHaveLength(5);

    // Strength label
    expect(screen.getByText("Force : Très faible")).toBeInTheDocument();

    // All 5 segments should exist (we check that there are 5 segment divs)
    const container = screen.getByText("Force : Très faible")
      .previousElementSibling;
    expect(container?.children).toHaveLength(5);
  });

  // ── Maximum strength (all 5) ──────────────────────────────────────

  it("shows all colored segments and all ✓ for maximum strength", () => {
    render(<PasswordStrengthMeter password="Abcdef1!@#" />);

    // All 5 checks should pass: length >= 8 ✅, length >= 12 ❌ hmm...
    // "Abcdef1!@#" has length 10: ≥8 ✓, ≥12 ✗, has uppercase ✓, has digit ✓, has special ✓
    // So score = 4
    // Let's use a password that passes all 5: length >= 12, has uppercase, has digit, has special
    // "Abcdef1!@xyz" - length 12, has uppercase, has digit, has special → score 4
    // Actually we need >=12 AND >=8. Length 12 means both pass. So all 5 pass.
    // "Abcdef1!@xyz" length 12, has A, has 1, has ! → all 5 checks pass

    // Let's re-render with a proper password
    cleanup();
    render(<PasswordStrengthMeter password="Abcdef1!@xyz" />);

    const checks = screen.getAllByText("✓");
    expect(checks).toHaveLength(5);

    expect(screen.getByText("Force : Très fort")).toBeInTheDocument();
  });

  // ── Boundary: exactly 8 chars vs 7 ────────────────────────────────

  it("passes length check at exactly 8 characters", () => {
    render(<PasswordStrengthMeter password="abcdefgh" />);

    // Password: length = 8, no uppercase, no digit, no special
    // Checks passed: [8 chars ✓], [12 chars ✗], [uppercase ✗], [digit ✗], [special ✗]
    // Score = 1, label = Faible

    const checks = screen.getAllByText("✓");
    expect(checks).toHaveLength(1);
    expect(screen.getByText("8 caractères minimum")).toBeInTheDocument();
    expect(screen.getByText("Force : Faible")).toBeInTheDocument();
  });

  it("fails length check at exactly 7 characters", () => {
    render(<PasswordStrengthMeter password="abcdefg" />);

    // Password: length = 7, no uppercase, no digit, no special
    // Checks passed: [8 chars ✗], [12 chars ✗], [uppercase ✗], [digit ✗], [special ✗]
    // Score = 0

    expect(screen.getByText("Force : Très faible")).toBeInTheDocument();
    // All 5 checks fail, so there are multiple ✗ elements
    expect(screen.getAllByText("✗").length).toBeGreaterThan(0);
  });

  // ── Boundary: exactly 12 chars vs 11 ──────────────────────────────

  it("passes both length checks at exactly 12 characters", () => {
    render(<PasswordStrengthMeter password="abcdefghijkl" />);

    // Password: length = 12, only letters
    // Checks passed: [8 chars ✓], [12 chars ✓], [uppercase ✗], [digit ✗], [special ✗]
    // Score = 2

    const checks = screen.getAllByText("✓");
    expect(checks).toHaveLength(2);
    expect(screen.getByText("Force : Moyen")).toBeInTheDocument();
  });

  it("passes only first length check at 11 characters", () => {
    render(<PasswordStrengthMeter password="abcdefghijk" />);

    // Password: length = 11
    // Checks passed: [8 chars ✓], [12 chars ✗], [uppercase ✗], [digit ✗], [special ✗]
    // Score = 1

    expect(screen.getByText("Force : Faible")).toBeInTheDocument();
  });

  // ── Strength labels ───────────────────────────────────────────────

  it("displays correct strength labels for each score level", () => {
    // Score 0 → Très faible
    cleanup();
    render(<PasswordStrengthMeter password="a" />);
    expect(screen.getByText("Force : Très faible")).toBeInTheDocument();

    // Score 1 → Faible (8 chars minimum, nothing else)
    cleanup();
    render(<PasswordStrengthMeter password="abcdefgh" />);
    expect(screen.getByText("Force : Faible")).toBeInTheDocument();

    // Score 2 → Moyen (8 chars + uppercase or digit)
    cleanup();
    render(<PasswordStrengthMeter password="Abcdefgh" />);
    expect(screen.getByText("Force : Moyen")).toBeInTheDocument();

    // Score 3 → Fort (8 chars + uppercase + digit)
    cleanup();
    render(<PasswordStrengthMeter password="Abcdefg1" />);
    expect(screen.getByText("Force : Fort")).toBeInTheDocument();

    // Score 4 → Très fort (8 chars + uppercase + digit + special)
    cleanup();
    render(<PasswordStrengthMeter password="Abcdef1!" />);
    expect(screen.getByText("Force : Très fort")).toBeInTheDocument();
  });

  // ── Segments rendering ────────────────────────────────────────────

  it("renders 5 visual segments", () => {
    const { container } = render(<PasswordStrengthMeter password="Test1!" />);
    // The first div contains the 5 segments
    const segmentsContainer = container.querySelector(".flex.gap-1");
    expect(segmentsContainer?.children).toHaveLength(5);
  });

  // ── Check labels ──────────────────────────────────────────────────

  it("renders all check labels", () => {
    render(<PasswordStrengthMeter password="Test1!" />);

    expect(screen.getByText("8 caractères minimum")).toBeInTheDocument();
    expect(screen.getByText("12 caractères minimum")).toBeInTheDocument();
    expect(screen.getByText("Une lettre majuscule")).toBeInTheDocument();
    expect(screen.getByText("Un chiffre")).toBeInTheDocument();
    expect(screen.getByText("Un caractère spécial")).toBeInTheDocument();
  });
});
