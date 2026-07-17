# EchoRoom — Pricing Tiers & Feature-Flag System

Status: Design + partial implementation (config + flag engine + plan storage proposal).
Owner sign-off needed on: Ultra price, invite-only Ultra, subscription vs credit model.

> Implemented this pass: `src/config/pricing.ts` (4 tiers + `ultra`), `src/config/featureFlags.ts`
> (flag config + `isFeatureEnabled`), `src/lib/featureFlags.ts` (`requireFeature` middleware),
> `src/lib/env.ts` (`STRIPE_PRICE_ULTRA`), and updated `src/config/__tests__/pricing.test.ts`.
> NOT yet implemented: Prisma `UserBilling.plan` + `Subscription`, and wiring flags/tiers into routers.

## 1. Tier → Feature / Permission matrix

Legend: ✅ included · 🚩 flag-gated (see §2) · ❌ not available

| Feature                              | free | starter | pro | ultra | Notes |
|--------------------------------------|------|---------|-----|-------|-------|
| Crédits / mois                       | 5    | 50      | 200 | 1000  | Consommables, réinitialisés mensuellement |
| Prix                                | 0 €  | 9,99 €  | 24,99 € | 49,99 € | mensuel |
| Personnages                         | 8 IA | tous    | tous | tous  | |
| Création de scénarios               | ❌   | ✅ illimité | ✅ | ✅ | |
| Replay des appels                   | ❌   | ✅      | ✅ | ✅ | |
| Partage viral                       | ❌   | ✅      | ✅ | ✅ | |
| Scénarios avant-première            | ❌   | ❌      | ✅ | ✅ | |
| Badge créateur                      | ❌   | ❌      | ✅ | ✅ | |
| Support prioritaire                 | ❌   | ❌      | ✅ | ✅ (max) | |
| Durée max appel                     | 300s | 300s   | 300s | 600s | 🚩 experimentalLongCalls |
| Limite d'appels quotidiens          | oui  | oui    | oui | ❌ (aucune) | DailyCallLimit bypass |
| Rooms multijoueurs / listen         | ❌   | ❌      | ❌ | ✅ | 🚩 betaMultiplayerRooms |
| Voix premium ElevenLabs             | ❌   | ❌      | ❌ | ✅ | 🚩 betaPremiumVoices |
| Accès API (clés)                    | ❌   | ❌      | ❌ | ✅ | 🚩 betaApiAccess |
| Nouvelle catégorie 'ICON'           | 🚩 25% | 🚩 25% | 🚩 25% | 🚩 25% | 🚩 newCharacterCategory |
| Génération de clips v2              | ❌   | ❌      | 🚩 50% | 🚩 50% | 🚩 clipGenerationV2 |

## 2. Feature-flag catalog

| Flag                    | Description                                   | default | enabled tiers              | rollout | owner    |
|-------------------------|-----------------------------------------------|---------|----------------------------|---------|----------|
| betaMultiplayerRooms    | Rooms multijoueurs / live listen              | on      | ultra                      | 100%    | product  |
| betaPremiumVoices       | Voix premium ElevenLabs                       | on      | ultra                      | 100%    | ai       |
| betaApiAccess           | Accès API programmatique                      | on      | ultra                      | 100%    | platform |
| experimentalLongCalls   | Appels jusqu'à 600s                           | on      | ultra                      | 100%    | product  |
| newCharacterCategory    | Catégorie 'ICON' en déploiement               | on      | free,starter,pro,ultra     | 25%     | content  |
| clipGenerationV2        | Pipeline clips v2 (découpe+subtitles)         | on      | pro, ultra                 | 50%     | content  |

Env override (highest precedence):
- Kill-switch per flag: `FF_BETA_API_ACCESS=true|false`
- Granular: `FEATURE_FLAGS={"betaApiAccess":{"tiers":["pro","ultra"],"rollout":30}}`
- Safe-parsed; invalid JSON is ignored (falls back to defaults).

## 3. Integration with tRPC protectedProcedure

```ts
// Gate a beta procedure:
import { protectedProcedure } from "@/server/procedures";
import { requireFeature } from "@/lib/featureFlags";

export const apiKeysList = protectedProcedure
  .use(requireFeature("betaApiAccess"))
  .query(({ ctx }) => listApiKeys(ctx.session.user.id));

// Gate a call-duration limit inside an existing procedure:
import { isFeatureEnabled } from "@/config/featureFlags";
const maxDuration = isFeatureEnabled("experimentalLongCalls", { tier: userTier })
  ? 600 : 300;
```

Tier is resolved by `requireFeature`'s `resolveTier` (default → "free" until `UserBilling.plan`
migration; then it reads the persisted plan).

## 4. Implementation plan

### Implemented NOW
- [x] 4-tier `PRICING_CONFIG` + `ultra` (pricing.ts)
- [x] `PlanTier` type + `TIER_RANK` / `tierMeetsMinimum` helpers
- [x] Feature-flag config (config/featureFlags.ts) — typed, env-driven, safe-parse
- [x] `isFeatureEnabled` + `requireFeature` (lib/featureFlags.ts)
- [x] `STRIPE_PRICE_ULTRA` env default
- [x] Pricing unit test updated to 4 tiers
- [ ] Prisma: `UserBilling.plan` + `Subscription` (proposed below, migrate in follow-up)
- [ ] Wire `resolveTier` to `UserBilling.plan` post-migration

### Follow-up wiring (per router — gate by flag or tier)
- `billing.ts` — checkout must support `mode:"subscription"` + map price→tier; webhook sets `plan`.
- `calls.ts` — `experimentalLongCalls` (600s), `betaMultiplayerRooms` (room creation), bypass `DailyCallLimit` for ultra.
- `characters.ts` — `newCharacterCategory` filter in list.
- `clips.ts` — `clipGenerationV2` pipeline selection.
- `scenarios.ts` — add free-tier create gate; early-access is a Pro/Ultra listing boost.
- `user.ts` / `profile.ts` — expose `tier` (needs `UserBilling.plan`).
- `admin.ts` — flag override dashboard (read `FEATURE_FLAGS`, flip `FF_*`).
- `auth.ts` — assign `plan=FREE` on registration.

## 5. Recommended tier storage (Prisma snippet — NOT migrated yet)

```prisma
enum PlanTier {
  FREE
  STARTER
  PRO
  ULTRA
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  INCOMPLETE
}

model UserBilling {
  id     String   @id @default(cuid())
  userId String   @unique
  user   User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  credits Int     @default(5)
  plan   PlanTier @default(FREE)   // cached entitlement, synced by Stripe webhooks
  subscriptions Subscription[]
  @@index([userId])
  @@index([plan])
}

model Subscription {
  id                 String   @id @default(cuid())
  userId             String
  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  stripeSubscriptionId String  @unique
  stripePriceId        String
  plan                 PlanTier
  status               SubscriptionStatus @default(ACTIVE)
  currentPeriodStart DateTime @default(now())
  currentPeriodEnd   DateTime
  cancelAtPeriodEnd  Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([userId])
  @@index([status])
}
```

**Migration note:** `prisma migrate dev --name add_plan_and_subscription`. Additive, non-breaking.
Backfill `UserBilling.plan = FREE` for existing rows (default handles it).

**GDPR / Stripe-webhook implications**
- `checkout.session.completed` (mode `subscription`): create `Subscription`, set `UserBilling.plan`.
- `customer.subscription.updated`: update status/period; if canceled/past_due and no other active sub → `plan = FREE`.
- `customer.subscription.deleted`: `plan = FREE`.
- Reuse existing Redis idempotency + `P2002` guards.
- `plan` is derived entitlement data (covered by GDPR export/anonymize); ensure `stripeSubscriptionId` excluded from public export and purged on deletion.

## 6. Open questions for owner
1. Ultra price: 49,99 €/mois proposed — confirm or adjust (e.g. 39,99 €)?
2. Is Ultra invite-only / waitlist, or publicly purchasable?
3. Billing model: are Starter/Pro/Ultra recurring *subscriptions* (monthly credit allowance) or one-time *credit packs*? Drives checkout `mode` + webhook redesign.
4. Confirm `newCharacterCategory` rollout % (25% proposed) and category name (placeholder `ICON`).
