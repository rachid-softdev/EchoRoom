import type { PlanTier } from "./pricing";

export type FeatureFlagId =
  | "betaMultiplayerRooms"
  | "betaPremiumVoices"
  | "betaApiAccess"
  | "experimentalLongCalls"
  | "newCharacterCategory"
  | "clipGenerationV2";

export interface FeatureFlagConfig {
  id: FeatureFlagId;
  description: string;
  /** Conceptual default for the feature (combined with `enabledTiers`). */
  defaultEnabled: boolean;
  /** Tiers that receive the feature by default (requires `defaultEnabled`). */
  enabledTiers: readonly PlanTier[];
  /** Percentage rollout (0-100) within each enabled tier. */
  rollout: number;
  /** Owning team — for audit + PostHog tagging. */
  owner: string;
}

export interface FeatureContext {
  tier?: PlanTier;
  userId?: string;
}

export const FEATURE_FLAGS: Readonly<Record<FeatureFlagId, FeatureFlagConfig>> =
  Object.freeze({
    betaMultiplayerRooms: {
      id: "betaMultiplayerRooms",
      description: "Rooms multijoueurs / écoute entre amis (live listen).",
      defaultEnabled: true,
      enabledTiers: ["ultra"],
      rollout: 100,
      owner: "product",
    },
    betaPremiumVoices: {
      id: "betaPremiumVoices",
      description: "Voix premium ElevenLabs (modèles haute fidélité).",
      defaultEnabled: true,
      enabledTiers: ["ultra"],
      rollout: 100,
      owner: "ai",
    },
    betaApiAccess: {
      id: "betaApiAccess",
      description: "Accès programmatique à l'API EchoRoom (clés API).",
      defaultEnabled: true,
      enabledTiers: ["ultra"],
      rollout: 100,
      owner: "platform",
    },
    experimentalLongCalls: {
      id: "experimentalLongCalls",
      description: "Durée maximale d'appel portée à 600s (au lieu de 300s).",
      defaultEnabled: true,
      enabledTiers: ["ultra"],
      rollout: 100,
      owner: "product",
    },
    newCharacterCategory: {
      id: "newCharacterCategory",
      description: "Nouvelle catégorie de personnages 'ICON' en déploiement progressif.",
      defaultEnabled: true,
      enabledTiers: ["free", "starter", "pro", "ultra"],
      rollout: 25,
      owner: "content",
    },
    clipGenerationV2: {
      id: "clipGenerationV2",
      description: "Pipeline de génération de clips v2 (découpage auto + sous-titres).",
      defaultEnabled: true,
      enabledTiers: ["pro", "ultra"],
      rollout: 50,
      owner: "content",
    },
  });

type FlagOverride =
  | { kind: "global"; enabled: boolean }
  | { kind: "targeted"; tiers: PlanTier[]; rollout: number };

function toScreamingSnake(id: string): string {
  return id.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();
}

function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash) % 2 ** 32;
}

let cachedJsonOverrides: Partial<Record<FeatureFlagId, FlagOverride>> | null = null;

/**
 * Runtime override cache for feature flags. Populated by admin actions
 * (admin.setFeatureFlagOverride) and loadFlagOverridesFromDb(). Consulted by
 * isFeatureEnabled AFTER the FF_* env kill-switch but BEFORE the FEATURE_FLAGS
 * JSON / config defaults — so an admin override takes effect immediately at
 * runtime without a redeploy.
 */
let flagOverrideCache: Map<FeatureFlagId, boolean> | null = null;

export function setFlagOverrideCache(flag: FeatureFlagId, enabled: boolean): void {
  if (!flagOverrideCache) flagOverrideCache = new Map();
  flagOverrideCache.set(flag, enabled);
}

export async function loadFlagOverridesFromDb(): Promise<void> {
  // Prisma cannot run in the Edge runtime used by Next.js middleware.
  // Skip DB-backed overrides there; isFeatureEnabled falls back to config
  // defaults (and the FF_*/FEATURE_FLAGS env overrides), which is correct
  // for middleware evaluation.
  if (process.env.NEXT_RUNTIME === "edge") return;
  // Dynamic import avoids a static dependency cycle with the DB module.
  const { db } = await import("@/server/db");
  const rows = await db.featureFlagOverride.findMany();
  const map = new Map<FeatureFlagId, boolean>();
  for (const r of rows) map.set(r.flag as FeatureFlagId, r.enabled);
  flagOverrideCache = map;
}

function getJsonOverrides(): Partial<Record<FeatureFlagId, FlagOverride>> {
  if (cachedJsonOverrides) return cachedJsonOverrides;
  const raw = process.env["FEATURE_FLAGS"];
  const empty: Partial<Record<FeatureFlagId, FlagOverride>> = {};
  if (!raw) {
    cachedJsonOverrides = empty;
    return empty;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      cachedJsonOverrides = empty;
      return empty;
    }
    const obj = parsed as Record<string, unknown>;
    const result: Partial<Record<FeatureFlagId, FlagOverride>> = {};
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === "boolean") {
        result[key as FeatureFlagId] = { kind: "global", enabled: value };
      } else if (value && typeof value === "object") {
        const v = value as Record<string, unknown>;
        const tiers = Array.isArray(v["tiers"])
          ? (v["tiers"] as unknown[]).filter(
              (t): t is PlanTier => typeof t === "string",
            )
          : [];
        const rollout =
          typeof v["rollout"] === "number" ? (v["rollout"] as number) : 100;
        result[key as FeatureFlagId] = { kind: "targeted", tiers, rollout };
      }
    }
    cachedJsonOverrides = result;
    return result;
  } catch {
    cachedJsonOverrides = empty;
    return empty;
  }
}

function passesRollout(seed: string, ctx: FeatureContext, rollout: number): boolean {
  if (rollout >= 100) return true;
  if (rollout <= 0) return false;
  if (!ctx.userId && !ctx.tier) return false;
  const bucket = hashString(`${seed}:${ctx.userId ?? ctx.tier}`) % 100;
  return bucket < rollout;
}

/**
 * Evaluate whether `flag` is enabled for the given context.
 *
 * Precedence (highest first):
 *   1. Individual `FF_<NAME>` env var (quick kill-switch: true/false/1/0/yes/no).
 *   2. `FEATURE_FLAGS` JSON env (global boolean or targeted {tiers, rollout}).
 *   3. Config defaults (defaultEnabled + enabledTiers + rollout%).
 *
 * On the client, `process.env.FF_*` / `FEATURE_FLAGS` are undefined, so only
 * config defaults apply — the authoritative gate always remains server-side.
 */
export function isFeatureEnabled(flag: FeatureFlagId, ctx?: FeatureContext): boolean {
  const config = FEATURE_FLAGS[flag];
  if (!config) return false;

  const envVar = process.env[`FF_${toScreamingSnake(flag)}`];
  if (envVar !== undefined) {
    const normalized = envVar.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }

  const cached = flagOverrideCache?.get(flag);
  if (cached !== undefined) return cached;

  const jsonOverride = getJsonOverrides()[flag];
  if (jsonOverride) {
    if (jsonOverride.kind === "global") return jsonOverride.enabled;
    if (!ctx?.tier) return false;
    if (!jsonOverride.tiers.includes(ctx.tier)) return false;
    return passesRollout(flag, ctx, jsonOverride.rollout);
  }

  if (!config.defaultEnabled) return false;
  if (!ctx?.tier) return false;
  if (!config.enabledTiers.includes(ctx.tier)) return false;
  return passesRollout(flag, ctx, config.rollout);
}
