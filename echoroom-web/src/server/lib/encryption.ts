import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { env } from "@/lib/env";

// PHONE_ENCRYPTION_KEY must be a high-entropy secret (min 32 chars).
// It is hashed with SHA-256 to produce exactly 32 bytes for AES-256.
// This is NOT a password-based KDF — do NOT use a low-entropy value.
// Key rotation is supported via the version prefix in the ciphertext format.

const ALGORITHM = "aes-256-gcm";
// NIST-recommended IV length for GCM is 12 bytes (96 bits).
// Non-12-byte IVs are hashed via GHASH internally, which is slightly slower.
const IV_LENGTH = 12;
const KEY_VERSION = "v1";

let encryptionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (encryptionKey) return encryptionKey;
  encryptionKey = createHash("sha256").update(env.PHONE_ENCRYPTION_KEY).digest();
  return encryptionKey;
}

/**
 * Encrypt a phone number with AES-256-GCM authenticated encryption.
 *
 * @param phone - Plaintext phone number (e.g. "+33612345678")
 * @returns Ciphertext in the format "v1:{ivHex}:{authTagHex}:{ciphertextHex}"
 *          The "v1" prefix enables future key rotation without breaking existing records.
 *          Output length reveals plaintext length (no padding) — this is acceptable
 *          for phone numbers which have a narrow length range.
 *
 * Requires PHONE_ENCRYPTION_KEY env var (min 32 chars, high entropy).
 */
export function encryptPhoneNumber(phone: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(phone, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${KEY_VERSION}:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a phone number that was encrypted with {@link encryptPhoneNumber}.
 *
 * Supports two input formats:
 * - Current: "v1:{ivHex}:{authTagHex}:{ciphertextHex}"
 * - Legacy (unversioned): "{ivHex}:{authTagHex}:{ciphertextHex}"
 *
 * @param encrypted - The ciphertext string to decrypt.
 * @returns The original plaintext phone number.
 * @throws {Error} If the format is invalid, the key version is unknown,
 *                 the auth tag is mismatched (tampered data), or crypto fails.
 */
export function decryptPhoneNumber(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(":");
  let offset = 0;

  if (parts[0] === "v1") {
    offset = 1;
  } else if (parts[0].startsWith("v") && /^v\d+$/.test(parts[0])) {
    throw new Error(`Unknown encryption key version: ${parts[0]}`);
  }

  if (parts.length < offset + 3) {
    throw new Error("Invalid encrypted phone number format");
  }

  const iv = Buffer.from(parts[offset], "hex");
  const authTag = Buffer.from(parts[offset + 1], "hex");
  const ciphertext = parts.slice(offset + 2).join(":");

  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    throw new Error(`Decryption failed: ${(err as Error).message}`);
  }
}

/**
 * Mask a phone number for safe display in logs, audit trails, and GDPR exports.
 * Only the last 4 digits are visible: "+33612345678" → "+33****5678"
 *
 * This is NOT cryptographic masking — it is for display purposes only.
 *
 * @param phone - Plaintext phone number to mask.
 * @returns Masked string with middle digits replaced by "****".
 */
export function maskPhoneNumber(phone: string): string {
  if (phone.length < 6) return "******";
  const prefix = phone.startsWith("+") ? phone.substring(0, 3) : phone.substring(0, 2);
  return `${prefix}****${phone.slice(-4)}`;
}

/**
 * Heuristic check to determine if a string looks like an encrypted phone number.
 * Recognises the "v1:" prefix format as well as the legacy unversioned format.
 *
 * @param value - The string to check.
 * @returns True if the value matches the ciphertext format, false otherwise.
 */
export function isEncrypted(value: string): boolean {
  if (!value || !value.includes(":")) return false;
  if (value.startsWith("v1:")) return true;
  // Legacy format: starts with 32 hex chars followed by ":"
  return /^[0-9a-f]{32}:/i.test(value);
}
