import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Telephony Constants — constants.ts tests
// ---------------------------------------------------------------------------
// Tests for constants.ts:
//   - All constants exported with correct values

describe("telephony constants", () => {
  it("should export MAX_TURNS = 20", async () => {
    const { MAX_TURNS } = await import("../constants");
    expect(MAX_TURNS).toBe(20);
  });

  it("should export CALL_TIMEOUT_MS = 600000", async () => {
    const { CALL_TIMEOUT_MS } = await import("../constants");
    expect(CALL_TIMEOUT_MS).toBe(600_000);
    // Verify: 10 minutes * 60 seconds * 1000ms = 600000
    expect(CALL_TIMEOUT_MS).toBe(10 * 60 * 1000);
  });

  it("should export CONVERSATION_TTL_S = 1800", async () => {
    const { CONVERSATION_TTL_S } = await import("../constants");
    expect(CONVERSATION_TTL_S).toBe(1800);
    // Verify: 30 minutes * 60 seconds = 1800
    expect(CONVERSATION_TTL_S).toBe(30 * 60);
  });

  it("should export ELEVENLABS_MODEL = 'eleven_turbo_v2_5'", async () => {
    const { ELEVENLABS_MODEL } = await import("../constants");
    expect(ELEVENLABS_MODEL).toBe("eleven_turbo_v2_5");
  });

  it("should export RECORDING_TURN_NUMBER = -1", async () => {
    const { RECORDING_TURN_NUMBER } = await import("../constants");
    expect(RECORDING_TURN_NUMBER).toBe(-1);
  });

  it("should export all constants with correct types", async () => {
    const mod = await import("../constants");
    // MAX_TURNS is a number
    expect(typeof mod.MAX_TURNS).toBe("number");
    // CALL_TIMEOUT_MS is a number
    expect(typeof mod.CALL_TIMEOUT_MS).toBe("number");
    // CONVERSATION_TTL_S is a number
    expect(typeof mod.CONVERSATION_TTL_S).toBe("number");
    // ELEVENLABS_MODEL is a string
    expect(typeof mod.ELEVENLABS_MODEL).toBe("string");
    // RECORDING_TURN_NUMBER is a number
    expect(typeof mod.RECORDING_TURN_NUMBER).toBe("number");
  });
});
