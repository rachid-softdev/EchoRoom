# Catalogue de Scénarios — Billing, Platform & Infra (Supplément TE-5)

> Source : `billing.ts`, `stripe.ts`, `stripeWebhooks.ts`, `creditCore.ts`, `creditOps.ts`,
> `env.ts`, `config/pricing.ts`, `lib/*.ts`, `prisma/schema.prisma`, `cron/*`, `middleware.ts`.
> **IMPORTANT** : ces scénarios NE sont PAS dans `TEST_SCENARIOS.md` mais le code examine prouve
> que les features décrites (subscription lifecycle, flag override, cron idempotency) sont absentes
> ou cassées — à traiter comme P0/P1 avant d'ajouter des tiers.

## 1. Billing Page & Checkout (`billing.ts`, `billing/page.tsx`)
- **bill.page.hardcoded-packs-broken** — Échec P0 : `billing/page.tsx` hardcode `price_10/50/200/500`
  absents de `PRICING_CONFIG` → `stripe.prices.retrieve` échoue → checkout cassé. **P0**
- **bill.checkout.tier-mapping** — Limite : `createCheckoutSession` mappe tier→price via `PRICING_CONFIG`
  ; si un tier n'a pas de price → erreur. **P1**
- **bill.checkout.success-credit-grant** — Succès : achat → `addCredits` correct.
- **bill.checkout.refund** — Limite : remboursement partiel → crédits déduits ; **peut aller négatif**. **P1**
- **bill.checkout.coupon** — Gap : pas de coupon/promo testé. **P2**
- **bill.history.pagination** — Edge : historique paginé sans doublon.
- **bill.invoice.download** — Gap : pas de téléchargement de facture. **P2**
- **bill.webhook.signature-invalid** — Sécu : signature invalide → 400 (pas de traitement). **P1**

## 2. Stripe Webhooks (`stripeWebhooks.ts`)
- **wh.checkout.session.completed** — Succès : crédits ajoutés, idempotency respectée.
- **wh.idempotency-set-before-tx** — Limite P0 : clé idempotency settée AVANT la tx DB → si DB 500
  après set → crédits perdus au retry (clé déjà présente). **P0**
- **wh.subscription.created** — Gap P1 : aucune gestion `customer.subscription.created/updated/deleted`
  → pas de lifecycle d'abonnement. **P1**
- **wh.refund.webhook** — Gap : pas de gestion `charge.refunded` → crédits non ajustés. **P1**
- **wh.duplicate-event** — Limite : événement dupliqué → idempotent (ne double pas).
- **wh.tenant-isolation** — Sécu : webhook d'un user ne crédite pas un autre. **P1**

## 3. Credits (`creditCore.ts`, `creditOps.ts`, `callLifecycle.ts`)
- **cr.deduct.success / cr.deduct.negative** — Succès / Limite P1 : déduction peut rendre négatif. **P1**
- **cr.legacy-vs-ubilling** — Limite P0 : `handleCompletedCall` reconcile sur `User.credits` legacy,
  PAS `UserBilling.credits` → sous-facturation. **P0**
- **cr.refund-on-failed** — Limite P0 : call `FAILED` → `markAsFailedWithRefund` NON appelé. **P0**
- **cr.reconcile.race** — Limite : 2 appels finissent en parallèle → reconcile race. **P1**
- **cr.monthly-reset** — Gap : pas de reset mensuel des crédits (modèle inconnu). **P2**
- **cr.admin-adjust** — Gap : pas de procédure admin d'ajustement crédits. **P1**

## 4. Feature Flags (Platform) (`lib/featureFlags.ts`, `config/featureFlags.ts`)
- **ff.env-override** — Succès : `FF_<NAME>` ou JSON `FEATURE_FLAGS` override.
- **ff.json-invalid** — Limite : JSON invalide → ignoré (fallback defaults), pas de crash. **P2**
- **ff.admin-toggle-missing** — Gap P1 : aucune procédure admin pour flipper un flag. **P1**
- **ff.rollout-percentage** — Edge : rollout % cohérent par tier.
- **ff.requireFeature-middleware** — Succès : flag off → `FORBIDDEN` ; non-auth → `UNAUTHORIZED`. **P1**

## 5. Cron & Infra (`cron/*`, `lib/cache.ts`, `lib/redis.ts`)
- **cron.rotate-featured.no-lock** — Limite P1 : `rotate-featured` sans Redis lock → exécutions doubles. **P1**
- **cron.cleanup-recordings.no-lock** — Limite P1 : `cleanup-recordings` sans lock. **P1**
- **cron.cleanup-orphan-recordings** — Gap : orphelins non nettoyés. **P2**
- **cache.namespace-collision** — Limite : `community:*` vs `com:` → collision de clés. **P1**
- **cache.ttl-boundary** — Edge : TTL=0 vs max. **P3**
- **redis.fail-graceful** — Limite : Redis down → fallback (pas de 500 en chaîne). **P1**
- **middleware.server-route-protection** — Sécu : routes `(dashboard)/*` protégées seulement par layout,
  pas `middleware.ts` → vérifier redirection brute. **P1**

## Résumé lacunes critiques
- **P0** : billing page hardcode des price IDs cassés ; webhook idempotency avant tx DB ;
  `handleCompletedCall` utilise `User.credits` legacy ; pas de refund sur call FAILED ;
  pas de subscription lifecycle Stripe.
- **P1** : refund peut aller négatif ; deduire négatif ; cron sans Redis lock ; cache namespace
  collision ; pas de toggle flag admin ; webhook tenant isolation ; middleware brut.

## Recommandations (à faire AVANT d'ajouter `ultra`)
1. Brancher `billing/page.tsx` sur `PRICING_CONFIG` (plus de price IDs en dur).
2. Set l'idempotency Redis APRES la tx DB réussie (pattern outbox).
3. Migrer `handleCompletedCall` sur `UserBilling.credits` + appeler `markAsFailedWithRefund`.
4. Ajouter `customer.subscription.*` handlers → `UserBilling.plan`.
5. Clamp les crédits ≥ 0 (deduct + refund).
6. Redis lock sur tous les crons ; unifier les namespaces cache.
7. Ajouter procédure admin feature-flag + role-change.
