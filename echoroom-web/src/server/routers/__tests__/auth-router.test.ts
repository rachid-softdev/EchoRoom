import { describe, it, expect } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Auth Router — Password Validation Tests
// ---------------------------------------------------------------------------
// The auth router (src/server/routers/auth.ts) enforces password strength
// using Zod validation. The schema is embedded in the .input() call and
// not exported, so we replicate it here to verify the contract.
//
// Password requirements (L-5):
//   - Minimum 8 characters
//   - Maximum 128 characters
//   - At least one uppercase letter (A-Z)
//   - At least one lowercase letter (a-z)
//   - At least one digit (0-9)

const passwordSchema = z
  .string()
  .min(8, "Minimum 8 caractères")
  .max(128, "Maximum 128 caractères")
  .regex(/[A-Z]/, "Doit contenir une majuscule")
  .regex(/[a-z]/, "Doit contenir une minuscule")
  .regex(/[0-9]/, "Doit contenir un chiffre");

// Helper: safeParse returns true if validation passes
function isValidPassword(password: string): boolean {
  return passwordSchema.safeParse(password).success;
}

function getValidationError(password: string): string | null {
  const result = passwordSchema.safeParse(password);
  if (result.success) return null;
  return result.error.issues[0]?.message ?? "Validation failed";
}

describe("Auth Router — Password Validation (L-5)", () => {
  // -----------------------------------------------------------------------
  // Valid passwords
  // -----------------------------------------------------------------------

  it("should accept a valid password with uppercase, lowercase, and digit", () => {
    expect(isValidPassword("Valid1Password")).toBe(true);
  });

  it("should accept a password at the minimum length (8 chars)", () => {
    expect(isValidPassword("Abcdef1!")).toBe(true);
  });

  it("should accept a password at the maximum length (128 chars)", () => {
    // Construct: 1 uppercase + 121 lowercase + 6 digits = 128 chars
    const longPassword = "A" + "a".repeat(121) + "1".repeat(6);
    expect(longPassword.length).toBe(128);
    expect(isValidPassword(longPassword)).toBe(true);
  });

  it("should accept a password with special characters", () => {
    expect(isValidPassword("P@ssw0rd!")).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Rejected passwords — missing requirements
  // -----------------------------------------------------------------------

  it("should reject a password without uppercase letters", () => {
    expect(isValidPassword("nouppercase1")).toBe(false);
    const error = getValidationError("nouppercase1");
    expect(error).toContain("majuscule");
  });

  it("should reject a password without lowercase letters", () => {
    expect(isValidPassword("NOLOWERCASE1")).toBe(false);
    const error = getValidationError("NOLOWERCASE1");
    expect(error).toContain("minuscule");
  });

  it("should reject a password without digits", () => {
    expect(isValidPassword("NoDigitsHere")).toBe(false);
    const error = getValidationError("NoDigitsHere");
    expect(error).toContain("chiffre");
  });

  it("should reject a password that is too short (less than 8 chars)", () => {
    expect(isValidPassword("Short1A")).toBe(false);
    const error = getValidationError("Short1A");
    expect(error).toContain("8");
  });

  it("should reject a password that is too long (more than 128 chars)", () => {
    const tooLong = "A1" + "a".repeat(128);
    expect(isValidPassword(tooLong)).toBe(false);
    const error = getValidationError(tooLong);
    expect(error).toContain("128");
  });

  // -----------------------------------------------------------------------
  // Boundary cases
  // -----------------------------------------------------------------------

  it("should reject an empty string", () => {
    expect(isValidPassword("")).toBe(false);
  });

  it("should reject a password with only uppercase and digits (no lowercase)", () => {
    expect(isValidPassword("UPPERCASE1")).toBe(false);
  });

  it("should reject a password with only lowercase and digits (no uppercase)", () => {
    expect(isValidPassword("lowercase1")).toBe(false);
  });

  it("should reject a password with only letters (no digits)", () => {
    expect(isValidPassword("UppercaseLowercase")).toBe(false);
  });

  it("should reject 7-char password that meets all other requirements", () => {
    // 7 chars is too short even if it has upper, lower, digit
    expect(isValidPassword("Abcd12!")).toBe(false);
  });
});
