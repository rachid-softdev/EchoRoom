import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  encryptPhoneNumber,
  decryptPhoneNumber,
  maskPhoneNumber,
  isEncrypted,
} from "../encryption";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_KEY = "test_encryption_key_32_chars_minimum!!";
const V1_FORMAT_REGEX = /^v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]*$/i;

// ---------------------------------------------------------------------------
// Setup / Teardown — manage PHONE_ENCRYPTION_KEY for the test suite
// ---------------------------------------------------------------------------

let originalKey: string | undefined;

beforeAll(() => {
  originalKey = process.env['PHONE_ENCRYPTION_KEY'];
  process.env['PHONE_ENCRYPTION_KEY'] = TEST_KEY;
});

afterAll(() => {
  if (originalKey === undefined) {
    delete process.env['PHONE_ENCRYPTION_KEY'];
  } else {
    process.env['PHONE_ENCRYPTION_KEY'] = originalKey;
  }
});

// ---------------------------------------------------------------------------
// encryptPhoneNumber
// ---------------------------------------------------------------------------

describe("encryptPhoneNumber", () => {
  it("returns a string matching v1:hex:hex:hex format", () => {
    const result = encryptPhoneNumber("+33612345678");
    expect(result).toMatch(V1_FORMAT_REGEX);
  });

  it("produces different output for each call (non-deterministic IV)", () => {
    const phone = "+33612345678";
    const result1 = encryptPhoneNumber(phone);
    const result2 = encryptPhoneNumber(phone);
    expect(result1).not.toBe(result2);
  });

  it("can encrypt short phone numbers", () => {
    const result = encryptPhoneNumber("123");
    expect(result).toMatch(V1_FORMAT_REGEX);
  });

  it("can encrypt empty string", () => {
    const result = encryptPhoneNumber("");
    expect(result).toMatch(V1_FORMAT_REGEX);
  });

  it("extracts IV, authTag, and ciphertext as hex-encoded segments", () => {
    const result = encryptPhoneNumber("+33612345678");
    const [, ivHex, authTagHex, ciphertextHex] = result.split(":");

    // IV is 12 bytes => 24 hex chars
    expect(ivHex).toMatch(/^[0-9a-f]{24}$/i);
    // Auth tag is 16 bytes => 32 hex chars (GCM default)
    expect(authTagHex).toMatch(/^[0-9a-f]{32}$/i);
    // Ciphertext is variable-length hex
    expect(ciphertextHex).toMatch(/^[0-9a-f]+$/i);
    expect(ciphertextHex!.length).toBeGreaterThan(0);
  });

  it("throws when PHONE_ENCRYPTION_KEY is missing in env module", async () => {
    vi.resetModules();
    // env.ts provides a dev default, so to simulate a missing key we must mock the module.
    vi.doMock("@/lib/env", () => ({
      env: Object.freeze({} as Record<string, string>),
    }));

    const { encryptPhoneNumber: enc } = await import("../encryption");
    expect(() => enc("+33612345678")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// decryptPhoneNumber
// ---------------------------------------------------------------------------

describe("decryptPhoneNumber", () => {
  it("decrypts an encrypted phone number back to the original", () => {
    const original = "+33612345678";
    const encrypted = encryptPhoneNumber(original);
    const decrypted = decryptPhoneNumber(encrypted);
    expect(decrypted).toBe(original);
  });

  it("handles international phone numbers", () => {
    const numbers = [
      "+33612345678",
      "+14155552671",
      "+447911123456",
      "+81312345678",
    ];
    for (const phone of numbers) {
      const encrypted = encryptPhoneNumber(phone);
      const decrypted = decryptPhoneNumber(encrypted);
      expect(decrypted).toBe(phone);
    }
  });

  it("handles domestic phone numbers without + prefix", () => {
    const numbers = ["01234567890", "15551234567", "0123456789"];
    for (const phone of numbers) {
      const encrypted = encryptPhoneNumber(phone);
      const decrypted = decryptPhoneNumber(encrypted);
      expect(decrypted).toBe(phone);
    }
  });

  it("handles short numbers (e.g. extension codes)", () => {
    const phone = "123";
    const encrypted = encryptPhoneNumber(phone);
    const decrypted = decryptPhoneNumber(encrypted);
    expect(decrypted).toBe(phone);
  });

  it("handles empty strings", () => {
    const encrypted = encryptPhoneNumber("");
    const decrypted = decryptPhoneNumber(encrypted);
    expect(decrypted).toBe("");
  });

  it("handles format WITHOUT the v1: prefix (backward compatibility)", () => {
    const original = "+33612345678";
    const encrypted = encryptPhoneNumber(original);

    // Strip the "v1:" prefix
    const stripped = encrypted.slice(3);
    expect(stripped).not.toMatch(/^v1:/);

    const decrypted = decryptPhoneNumber(stripped);
    expect(decrypted).toBe(original);
  });

  it("throws Error on invalid ciphertext format (too few parts)", () => {
    expect(() => decryptPhoneNumber("too:few")).toThrow(
      "Invalid encrypted phone number format"
    );
  });

  it("throws Error on malformed hex in IV segment", () => {
    // "v1:" + "nothex" (invalid hex) + ":auth:cipher"
    expect(() => decryptPhoneNumber("v1:nothex:aaaaaaaaaaaaaaaaaaaaaaaaaaaaa:abc123")).toThrow();
  });

  it("throws on tampered auth tag (integrity check failure)", () => {
    const original = "+33612345678";
    const encrypted = encryptPhoneNumber(original);

    // Split and corrupt the auth tag segment
    const parts = encrypted.split(":");
    // parts[0] = "v1", parts[1] = iv, parts[2] = authTag, parts[3] = ciphertext
    const corruptedAuth = "0000000000000000000000000000000"; // won't match the real auth tag
    parts[2] = corruptedAuth;
    const tampered = parts.join(":");

    expect(() => decryptPhoneNumber(tampered)).toThrow();
  });

  it("throws on tampered ciphertext", () => {
    const original = "+33612345678";
    const encrypted = encryptPhoneNumber(original);

    // Corrupt the ciphertext segment
    const parts = encrypted.split(":");
    parts[3] = parts[3] + "00"; // append bogus hex
    const tampered = parts.join(":");

    expect(() => decryptPhoneNumber(tampered)).toThrow();
  });

  it("throws when PHONE_ENCRYPTION_KEY is missing in env module", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: Object.freeze({} as Record<string, string>),
    }));

    const { decryptPhoneNumber } = await import("../encryption");
    const fakeEncrypted = "v1:aaaaaaaaaaaaaaaaaaaaaaaa:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:cccccc";
    expect(() => decryptPhoneNumber(fakeEncrypted)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// maskPhoneNumber
// ---------------------------------------------------------------------------

describe("maskPhoneNumber", () => {
  it("does not leak length for short numbers (less than 6 chars)", () => {
    // M-3 fix: < 6 chars returns fixed-length "******"
    expect(maskPhoneNumber("1234")).toBe("******");
    expect(maskPhoneNumber("12345")).toBe("******");
    expect(maskPhoneNumber("123")).toBe("******");
    expect(maskPhoneNumber("12")).toBe("******");
    expect(maskPhoneNumber("1")).toBe("******");
  });

  it("returns ****** for empty string", () => {
    expect(maskPhoneNumber("")).toBe("******");
  });

  it("masks exactly 6-7 character numbers with 2-char prefix and last 4", () => {
    // length 6: prefix = "12", last 4 = "3456"
    expect(maskPhoneNumber("123456")).toBe("12****3456");
    // length 7: prefix = "12", last 4 = "4567"
    expect(maskPhoneNumber("1234567")).toBe("12****4567");
  });

  it("preserves first 3 chars for international numbers (+ prefix)", () => {
    // 12 chars: first 3 = "+33", last 4 = "5678"
    expect(maskPhoneNumber("+33612345678")).toBe("+33****5678");
    // 15 chars: first 3 = "+44", last 4 = "7890"
    expect(maskPhoneNumber("+4479111237890")).toBe("+44****7890");
  });

  it("preserves first 2 chars for domestic numbers (no + prefix)", () => {
    // 10 chars: first 2 = "06", last 4 = "5678"
    expect(maskPhoneNumber("0612345678")).toBe("06****5678");
    // 10 chars: first 2 = "55", last 4 = "4321"
    expect(maskPhoneNumber("5551234321")).toBe("55****4321");
    // 10 chars: first 2 = "01", last 4 = "6789"
    expect(maskPhoneNumber("0123456789")).toBe("01****6789");
  });

  it("does not trim whitespace", () => {
    // " +33612345678" -> does NOT start with "+" due to leading space
    // so prefix = first 2 chars = " +", last 4 = "5678"
    expect(maskPhoneNumber(" +33612345678")).toBe(" +****5678");
  });
});

// ---------------------------------------------------------------------------
// isEncrypted
// ---------------------------------------------------------------------------

describe("isEncrypted", () => {
  it("returns true for v1:hex:hex:hex format", () => {
    const encrypted = encryptPhoneNumber("+33612345678");
    expect(isEncrypted(encrypted)).toBe(true);
  });

  it("returns true for manually constructed v1 format strings", () => {
    expect(isEncrypted("v1:abc:def:ghi")).toBe(true);
    expect(isEncrypted("v1:0000111122223333:aaaabbbbccccdddd:eeff")).toBe(true);
  });

  it("returns true for backward-compatible format (32 hex chars at start)", () => {
    // Format without "v1:" prefix: 32 hex chars for IV, then colon, then auth tag, then ciphertext
    expect(isEncrypted("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb:cccccc")).toBe(true);
  });

  it("returns false for plaintext phone numbers", () => {
    expect(isEncrypted("+33612345678")).toBe(false);
    expect(isEncrypted("01234567890")).toBe(false);
    expect(isEncrypted("123")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isEncrypted("")).toBe(false);
  });

  it("returns false for strings without a colon", () => {
    expect(isEncrypted("v1justtextwithoutcolon")).toBe(false);
  });

  it("returns false for strings with colon but invalid prefix", () => {
    // Contains ":" but doesn't start with "v1:" or match the 32-hex-char pattern
    expect(isEncrypted("v2:abc:def")).toBe(false);
    expect(isEncrypted("plain:text")).toBe(false);
    expect(isEncrypted("short:colon")).toBe(false);
  });
});
