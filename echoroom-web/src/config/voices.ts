import type { PlanTier } from "./pricing";
import { isFeatureEnabled } from "./featureFlags";

/**
 * Premium ElevenLabs voice IDs (high-fidelity models) gated behind the
 * `betaPremiumVoices` feature flag (Ultra tier only). These are NOT exposed to
 * lower tiers via `getAvailableVoiceIds`.
 */
export const PREMIUM_VOICE_IDS = [
  "21m00Tcm4TlvDq8ikWAM",
  "AZnzlk1XvdvUeBnXmlld",
  "MF3mGyEYCl7XYWbV9V6O",
  "TX3LPaxmHKxFdv7VOaTB",
] as const;

/**
 * Standard (non-premium) ElevenLabs voices available to every tier.
 */
export const STANDARD_VOICE_IDS = [
  "EXAVITQu4vr4xnSDxMaL",
  "ErXwobaYiN019PkySvjV",
  "VR6AewLTigWG4xSYzeoG",
  "pNInz6obpgDQGcFmaJgB",
  "yoZ06aMxZJJ28mfd3POQ",
  "XB0fDUnXU5powFXDhCwa",
] as const;

/** Full catalogue of selectable ElevenLabs voice IDs. */
export const VOICE_IDS = [...STANDARD_VOICE_IDS, ...PREMIUM_VOICE_IDS] as const;

/**
 * Returns the list of ElevenLabs voice IDs a given tier is allowed to select.
 *
 * Premium voices (`PREMIUM_VOICE_IDS`) are filtered out unless the
 * `betaPremiumVoices` flag is enabled for the tier (Ultra only).
 */
export function getAvailableVoiceIds(tier: PlanTier): string[] {
  const premiumEnabled = isFeatureEnabled("betaPremiumVoices", { tier });
  if (premiumEnabled) {
    return [...VOICE_IDS];
  }
  const premium = new Set<string>(PREMIUM_VOICE_IDS);
  return VOICE_IDS.filter((id) => !premium.has(id));
}
