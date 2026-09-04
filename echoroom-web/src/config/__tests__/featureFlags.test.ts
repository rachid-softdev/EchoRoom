import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeatureFlagId } from "@/config/featureFlags";
import type { PlanTier } from "@/config/pricing";

/**
 * Feature-flag tier matrix tests.
 *
 * Mirrors the matrix in PLAN_PRICING_FLAGS.md:
 *   betaMultiplayerRooms / betaPremiumVoices / betaApiAccess / experimentalLongCalls → ultra only
 *   clipGenerationV2      → pro + ultra (50% rollout within tier)
 *   newCharacterCategory  → all tiers (25% rollout within tier)
 *
 * Ultra rule: the highest tier bypasses tier restrictions AND rollout, so it
 * always gets every feature unless a hard control (FF_* env kill-switch, admin
 * DB override, global JSON boolean) or defaultEnabled=false disables it.
 */

/** All tiers, lowest to highest entitlement. */
const ALL_TIERS: readonly PlanTier[] = ["free", "starter", "pro", "ultra"] as const;

const ULTRA_ONLY_FLAGS: readonly FeatureFlagId[] = [
  "betaMultiplayerRooms",
  "betaPremiumVoices",
  "betaApiAccess",
  "experimentalLongCalls",
];

const KNOWN_FLAGS: readonly FeatureFlagId[] = [
  ...ULTRA_ONLY_FLAGS,
  "newCharacterCategory",
  "clipGenerationV2",
];

type FeatureFlagsModule = typeof import("@/config/featureFlags");

/**
 * Finds a userId whose rollout bucket yields `want` for the given flag/tier.
 * Used to assert that a partial rollout splits users within a tier without
 * re-implementing the hash (the split is deterministic for the same ids).
 */
function findUser(
  mod: FeatureFlagsModule,
  flag: FeatureFlagId,
  tier: PlanTier,
  want: boolean,
): string {
  for (let i = 0; i < 2_000; i++) {
    const userId = `u${i}`;
    if (mod.isFeatureEnabled(flag, { tier, userId }) === want) return userId;
  }
  throw new Error(`no userId with isFeatureEnabled=${want} for ${flag}/${tier}`);
}

describe("feature-flag tier matrix (PLAN_PRICING_FLAGS.md)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    for (const flag of KNOWN_FLAGS) {
      delete process.env[`FF_${flag.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()}`];
    }
    delete process.env["FEATURE_FLAGS"];
  });

  it("exposes every documented flag in the catalog", async () => {
    const { FEATURE_FLAGS } = await import("@/config/featureFlags");
    expect(Object.keys(FEATURE_FLAGS).sort()).toEqual([...KNOWN_FLAGS].sort());
  });

  it("ultra-only beta flags are disabled for free/starter/pro and enabled for ultra", async () => {
    const { isFeatureEnabled } = await import("@/config/featureFlags");
    for (const flag of ULTRA_ONLY_FLAGS) {
      for (const tier of ["free", "starter", "pro"] as const) {
        expect(isFeatureEnabled(flag, { tier }), `${flag} on ${tier}`).toBe(false);
      }
      expect(isFeatureEnabled(flag, { tier: "ultra" }), `${flag} on ultra`).toBe(true);
    }
  });

  it("clipGenerationV2 is pro+ with a 50% rollout and always on for ultra", async () => {
    const mod = await import("@/config/featureFlags");
    const { isFeatureEnabled } = mod;

    // free/starter never get v2, regardless of rollout bucket.
    const proIn = findUser(mod, "clipGenerationV2", "pro", true);
    expect(isFeatureEnabled("clipGenerationV2", { tier: "free", userId: proIn })).toBe(false);
    expect(isFeatureEnabled("clipGenerationV2", { tier: "starter", userId: proIn })).toBe(false);

    // Within pro, the rollout splits users.
    const proOut = findUser(mod, "clipGenerationV2", "pro", false);
    expect(proIn).not.toBe(proOut);
    expect(isFeatureEnabled("clipGenerationV2", { tier: "pro", userId: proIn })).toBe(true);
    expect(isFeatureEnabled("clipGenerationV2", { tier: "pro", userId: proOut })).toBe(false);

    // Ultra bypasses the rollout entirely.
    expect(isFeatureEnabled("clipGenerationV2", { tier: "ultra", userId: proOut })).toBe(true);
  });

  it("newCharacterCategory applies to every tier with a 25% rollout, ultra always on", async () => {
    const mod = await import("@/config/featureFlags");
    const { isFeatureEnabled } = mod;

    const inBucket = findUser(mod, "newCharacterCategory", "free", true);
    const outBucket = findUser(mod, "newCharacterCategory", "free", false);
    expect(inBucket).not.toBe(outBucket);

    for (const tier of ["free", "starter", "pro"] as const) {
      expect(isFeatureEnabled("newCharacterCategory", { tier, userId: inBucket })).toBe(true);
      expect(isFeatureEnabled("newCharacterCategory", { tier, userId: outBucket })).toBe(false);
    }

    // Ultra bypasses the 25% rollout.
    expect(isFeatureEnabled("newCharacterCategory", { tier: "ultra", userId: outBucket })).toBe(
      true,
    );
  });

  it("unknown flags are disabled", async () => {
    const { isFeatureEnabled } = await import("@/config/featureFlags");
    expect(isFeatureEnabled("doesNotExist" as FeatureFlagId, { tier: "ultra" })).toBe(false);
  });

  it("is disabled without a tier context (except env/override hard switches)", async () => {
    const { isFeatureEnabled } = await import("@/config/featureFlags");
    for (const flag of KNOWN_FLAGS) {
      expect(isFeatureEnabled(flag)).toBe(false);
      expect(isFeatureEnabled(flag, {})).toBe(false);
    }
  });
});

describe("env kill-switch precedence (FF_*)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    for (const flag of KNOWN_FLAGS) {
      delete process.env[`FF_${flag.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()}`];
    }
    delete process.env["FEATURE_FLAGS"];
  });

  it("FF_<FLAG>=false kills a feature even for ultra", async () => {
    process.env["FF_BETA_API_ACCESS"] = "false";
    const { isFeatureEnabled } = await import("@/config/featureFlags");
    expect(isFeatureEnabled("betaApiAccess", { tier: "ultra" })).toBe(false);
    expect(isFeatureEnabled("betaApiAccess", { tier: "free" })).toBe(false);
  });

  it("FF_<FLAG>=true force-enables a feature for any tier (and without tier)", async () => {
    process.env["FF_EXPERIMENTAL_LONG_CALLS"] = "true";
    const { isFeatureEnabled } = await import("@/config/featureFlags");
    expect(isFeatureEnabled("experimentalLongCalls", { tier: "free" })).toBe(true);
    expect(isFeatureEnabled("experimentalLongCalls")).toBe(true);
  });

  it("accepts 1/0/yes/no variants", async () => {
    process.env["FF_BETA_API_ACCESS"] = "0";
    const mod = await import("@/config/featureFlags");
    expect(mod.isFeatureEnabled("betaApiAccess", { tier: "ultra" })).toBe(false);
    process.env["FF_BETA_API_ACCESS"] = "1";
    expect(mod.isFeatureEnabled("betaApiAccess", { tier: "free" })).toBe(true);
  });

  it("ignores unparseable values and falls back to config defaults", async () => {
    process.env["FF_BETA_API_ACCESS"] = "garbage";
    const { isFeatureEnabled } = await import("@/config/featureFlags");
    expect(isFeatureEnabled("betaApiAccess", { tier: "ultra" })).toBe(true);
    expect(isFeatureEnabled("betaApiAccess", { tier: "free" })).toBe(false);
  });
});

describe("FEATURE_FLAGS JSON env overrides", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env["FEATURE_FLAGS"];
    for (const flag of KNOWN_FLAGS) {
      delete process.env[`FF_${flag.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()}`];
    }
  });

  it("global boolean false disables a flag even for ultra (hard control)", async () => {
    process.env["FEATURE_FLAGS"] = JSON.stringify({ betaApiAccess: false });
    const { isFeatureEnabled } = await import("@/config/featureFlags");
    expect(isFeatureEnabled("betaApiAccess", { tier: "ultra" })).toBe(false);
  });

  it("global boolean true enables a flag for every tier", async () => {
    process.env["FEATURE_FLAGS"] = JSON.stringify({ betaApiAccess: true });
    const { isFeatureEnabled } = await import("@/config/featureFlags");
    for (const tier of ALL_TIERS) {
      expect(isFeatureEnabled("betaApiAccess", { tier })).toBe(true);
    }
  });

  it("targeted override restricts tiers, ultra still bypasses", async () => {
    process.env["FEATURE_FLAGS"] = JSON.stringify({
      betaApiAccess: { tiers: ["pro"], rollout: 100 },
    });
    const { isFeatureEnabled } = await import("@/config/featureFlags");
    expect(isFeatureEnabled("betaApiAccess", { tier: "free" })).toBe(false);
    expect(isFeatureEnabled("betaApiAccess", { tier: "starter" })).toBe(false);
    expect(isFeatureEnabled("betaApiAccess", { tier: "pro" })).toBe(true);
    expect(isFeatureEnabled("betaApiAccess", { tier: "ultra" })).toBe(true);
  });

  it("targeted override rollout splits within the targeted tier", async () => {
    process.env["FEATURE_FLAGS"] = JSON.stringify({
      clipGenerationV2: { tiers: ["pro", "ultra"], rollout: 30 },
    });
    const mod = await import("@/config/featureFlags");
    const inBucket = findUser(mod, "clipGenerationV2", "pro", true);
    const outBucket = findUser(mod, "clipGenerationV2", "pro", false);
    expect(inBucket).not.toBe(outBucket);
    // Ultra bypasses the targeted rollout.
    expect(mod.isFeatureEnabled("clipGenerationV2", { tier: "ultra", userId: outBucket })).toBe(
      true,
    );
  });

  it("invalid JSON is ignored and config defaults apply", async () => {
    process.env["FEATURE_FLAGS"] = "{not valid json";
    const { isFeatureEnabled } = await import("@/config/featureFlags");
    expect(isFeatureEnabled("betaApiAccess", { tier: "ultra" })).toBe(true);
    expect(isFeatureEnabled("betaApiAccess", { tier: "free" })).toBe(false);
  });
});

describe("runtime admin override cache", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env["FEATURE_FLAGS"];
    for (const flag of KNOWN_FLAGS) {
      delete process.env[`FF_${flag.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()}`];
    }
  });

  it("admin override false disables a flag even for ultra", async () => {
    const { isFeatureEnabled, setFlagOverrideCache } = await import("@/config/featureFlags");
    setFlagOverrideCache("betaApiAccess", false);
    expect(isFeatureEnabled("betaApiAccess", { tier: "ultra" })).toBe(false);
  });

  it("admin override true force-enables a flag for any tier", async () => {
    const { isFeatureEnabled, setFlagOverrideCache } = await import("@/config/featureFlags");
    setFlagOverrideCache("betaMultiplayerRooms", true);
    expect(isFeatureEnabled("betaMultiplayerRooms", { tier: "free" })).toBe(true);
  });

  it("FF_* kill-switch beats the admin override cache", async () => {
    process.env["FF_BETA_API_ACCESS"] = "true";
    const { isFeatureEnabled, setFlagOverrideCache } = await import("@/config/featureFlags");
    setFlagOverrideCache("betaApiAccess", false);
    expect(isFeatureEnabled("betaApiAccess", { tier: "ultra" })).toBe(true);
  });

  it("admin override cache beats the FEATURE_FLAGS JSON override", async () => {
    process.env["FEATURE_FLAGS"] = JSON.stringify({ betaApiAccess: true });
    const { isFeatureEnabled, setFlagOverrideCache } = await import("@/config/featureFlags");
    setFlagOverrideCache("betaApiAccess", false);
    expect(isFeatureEnabled("betaApiAccess", { tier: "ultra" })).toBe(false);
  });
});
