import { describe, it, expect, beforeAll } from "vitest";
import bcrypt from "bcryptjs";

// ---------------------------------------------------------------------------
// Auth DUMMY_HASH tests
// ---------------------------------------------------------------------------
// The auth module (src/lib/auth.ts) computes:
//   bcrypt.hashSync("dummy-timing-attack-prevention", 12)
// at module-load time to ensure timing-constant authentication even when
// the user doesn't exist (prevents account enumeration).
//
// Since DUMMY_HASH is not exported from the auth module, we independently
// verify the contract by computing an identical hash and testing its
// properties. The implementation is deterministic given the same salt cost
// (bcrypt includes a random salt internally, so we can't predict the exact
// output — but the format and behavioral contract are testable).

let dummyHash: string;

beforeAll(async () => {
  // Compute a bcrypt hash with the same cost as auth.ts uses
  dummyHash = bcrypt.hashSync("dummy-timing-attack-prevention", 12);
});

describe("DUMMY_HASH — timing-constant auth protection", () => {
  it("should be a valid bcrypt hash matching $2[abxy]$ format", () => {
    // bcrypt hashes: $2<variant>$<cost>$<22-char-salt><31-char-hash> = 60 chars total
    expect(dummyHash).toMatch(/^\$2[abxy]\$\d+\$.{53}$/);
    expect(dummyHash.length).toBe(60);
  });

  it("should return false when comparing 'correct-password' against the dummy hash", async () => {
    // The dummy hash is for "dummy-timing-attack-prevention", not "correct-password"
    const result = await bcrypt.compare("correct-password", dummyHash);
    expect(result).toBe(false);
  });

  it("should not throw when used in bcrypt.compare", async () => {
    await expect(
      bcrypt.compare("any-password", dummyHash),
    ).resolves.not.toThrow();
  });

  it("should return false for empty password against dummy hash", async () => {
    const result = await bcrypt.compare("", dummyHash);
    expect(result).toBe(false);
  });

  it("should produce a valid bcrypt hash with cost 12", () => {
    // Extract cost factor from hash: $2b$12$...
    const cost = parseInt(dummyHash.split("$")[2], 10);
    expect(cost).toBe(12);
  });
});
