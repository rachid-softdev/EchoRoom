# Catalogue de Scénarios — Auth, Account, Settings, Legal & GDPR, Security (Supplément TE-1)

> Source : analyse du code réel (`auth.ts`, `profile.ts`, `user.ts`, `v1/*`, `lib/auth.ts`, `middleware.ts`,
> `calls.ts`, `scenarios.ts`, `anonymization.ts`, `/api/user/export`, pages `(auth)/*`, `(legal)/*`,
> `(dashboard)/settings`, `config/pricing.ts`, `schema.prisma`, `callLifecycle.ts`, `dailyLimitOps.ts`).
> Aucun scénario ci-dessous ne figure dans `TEST_SCENARIOS.md`, `SCENARIOS_MANQUANTS.md`,
> `SCENARIOS_OBSCURS.md`, `ROUND2_AGENT1_TRPC.md`, `ROUND2_AGENT3_TRANSVERSAL.md`.

## 1. Registration (`auth.register` / `v1.auth.register`)

- **auth.register.v1-email-no-lowercase** — Échec. Le routeur v1 stocke l'email SANS `.toLowerCase()` (le web le fait). Connexion ultérieure avec email normalisé échoue. **P0**
- **auth.register.v1-duplicate-case-bypass** — Edge/Sécu. v1 ne normalise pas l'email → contourne l'unicité fonctionnelle (2 comptes pour même adresse). **P1**
- **auth.register.username-case-sensitive** — Edge/Sécu. `username` jamais normalisé → `John`≠`john` = 2 comptes. **P1**
- **auth.register.email-whitespace** — Edge. Email avec espaces stocké tel quel, inconsociable. **P1**
- **auth.register.username-max-divergence** — Edge. `register` max(20) mais `updateProfile` max(30) → incohérence. **P2**
- **auth.register.password-boundary-128** — Edge. 128 ok, 129 refusé. **P3**
- **auth.register.post-register-signin-failure** — Edge. Compte créé mais `signIn` échoue → compte orphelin non connecté. **P2**

## 2. Login & Session (`lib/auth.ts`)

- **auth.login.username-unsupported** — Edge. `authorize` ne cherche que `email` ; username valide échoue avec message générique. **P2**
- **auth.login.rate-limit-per-email-not-ip** — Sécu. Rate-limit clé sur `login:${email}`, pas l'IP → attaque distribuée non bloquée. **P1**
- **auth.login.password-change-invalidates-all-sessions** — Edge. `changePassword` incrémente `tokenVersion` mais Settings ne fait pas `signOut` → 401 gracieux à vérifier. **P2**

## 3. Password Reset — FONCTIONNALITÉ ABSENTE

- **auth.password-reset.route-missing** — Échec/Gap. `/login` linke `/auth/forgot-password` qui N'EXISTE PAS (404). **P1**
- **auth.password-reset.no-procedure** — Échec/Gap. Aucune procédure `auth.forgotPassword`/`resetPassword`. **P2**

## 4. Account Settings

- **auth.changePassword.no-reuse-check** — Edge/Sécu. Réutilisation du mot de passe actuel autorisée. **P2**
- **auth.changePassword.api-ignores-confirm** — Edge. Pas de `confirmPassword` côté serveur. **P2**
- **settings.delete-no-reauth** — Sécu. `deleteMyAccount` ne demande AUCUNE ré-auth (input `confirmation` only) alors que `changePassword` oui. **P1**
- **settings.withdraw-no-reauth** — Sécu. `withdrawConsent` sans step-up. **P2**
- **settings.export-partial-failure-lock** — Edge. Verrou `gdprDataExportedAt` acquis AVANT génération ; si `getPresignedUrl` lève, verrou resté → utilisateur bloqué 1 h. **P1**
- **settings.export-shape-divergence** — Edge. `profile.exportData` (tRPC) omet `clips`/`abuseReports` que `/api/user/export` inclut. **P2**

## 5. GDPR & Data Privacy

- **gdpr.withdraw-irreversible-via-ui** — Échec/Gap P0. `withdrawConsent` change l'email en `withdrawn-<anon>@...` + `tokenVersion++` → session invalidée + email d'origine perdu → reconnect impossible → `reconsent` impossible. Promesse « réversible » fausse. **P0**
- **gdpr.v1-delete-no-active-call-guard** — Échec/Gap. `v1.profile.deleteMyAccount` n'a PAS le guard « appel actif » (contrairement au unversioned). **P1**
- **gdpr.delete-scenarios-to-private** — Edge. Anonymisation met scénarios en PRIVATE (pas supprimés) → visibles « masqués ». **P2**
- **gdpr.withdrawn-not-purged** — Edge. `withdrawn` pose `consentWithdrawnAt` mais pas `anonymizedAt` → `gdpr-purge` ne purge jamais. **P2**
- **gdpr.export-429-retryafter** — Succès/Edge. 429 + `retryAfterSeconds` cohérent avec header `Retry-After`. **P2**
- **gdpr.export-rate-limit-divergence** — Edge. tRPC `exportData` limité 2/h, `/api/user/export` 1/h → divergence. **P1**
- **gdpr.both-guards-during-active-call** — Succès. Ni `deleteMyAccount` ni `withdrawConsent` possibles pendant un appel actif. **P2**

## 6. Legal Pages

- **legal.forgot-password-link-dead** — Échec/Gap. Lien mot de passe oublié → 404 (voir §3). **P2**
- **legal.pages-public-no-pii** — Succès/Sécu. Pages légales ne fuent pas de PII, pas de tRPC authentifié. **P3**
- **legal.cookie-consent-gap** — Edge/Conformité. PostHog chargé sans consentement cookies (pas de banner). **P2**
- **legal.stale-update-date** — Edge. `/privacy`/`/terms` affichent « janvier 2025 » (obsolète). **P3**
- **legal.terms-missing-gdpr-sections** — Edge. `/terms` ne mentionne pas suppression/retrait/export. **P3**

## 7. Security (middleware, rôles, cookies)

- **security.server-side-redirect-raw-http** — Succès/Sécu. `/settings`,`/library`,`/billing`,`/create`,`/community`,`/leaderboard`,`/history` protégés seulement par le layout `(dashboard)`, pas `middleware.ts` → vérifier redirection 307 brute. **P1**
- **security.role-escalation-prevented** — Succès/Sécu. JWT forgé `role:ADMIN` ré-écrit depuis la DB → pas d'escalade USER→ADMIN. **P1**
- **security.delete-requires-no-stepup** — Sécu. Suppression compte sans step-up (voir §4). **P1**

## 8. Tier-Gated Access (`config/pricing.ts`, `callLifecycle.ts`)

> Le gating est **crédit-based** + limite quotidienne codée en dur à 10 pour TOUS (`maxLimit:10`).
> `PRICING_CONFIG` ne définit que free/starter/pro (pas `ultra`).

- **tier.ultra-not-defined** — Edge/Gap. `ultra` absent de `PRICING_CONFIG`. **P1**
- **tier.daily-limit-uniform-10** — Échec/Gap P0. Daily limit codée en dur à 10 pour tous, y compris pro/ultra (contredit « illimité »).
- **tier.free-credits-exhausted** — Succès. Free à 0 crédit → `calls.start` refusé (`PRECONDITION_FAILED`). **P1**
- **tier.free-can-create-scenario** — Edge/Gap. `scenarios.create` n'a AUCUN garde de tier → free peut créer. **P1**
- **tier.free-can-replay-and-share** — Edge/Gap. `calls.replay`/`social.trackShare` sans garde tier. **P2**
- **tier.characters-visibility** — Edge/Gap. `characters.list` ne filtre pas les 8 persos pour free. **P2**
- **tier.benefits-are-credit-derived** — Edge. Achat Starter/Pro = crédits seulement, pas de flag « illimité/replay/early-access ». **P2**

## Recommandations transverses
1. Reporter le fix B7 (guard appel actif) dans `v1.profile.deleteMyAccount`.
2. Normaliser email en `toLowerCase().trim()` dans `v1.auth.register`.
3. Rendre le retrait de consentement réellement réversible (ou reformuler l'UI).
4. Unifier les limites d'export GDPR (1/h vs 2/h) ; acquérir le verrou APRÈS la génération.
5. Paramétrer la daily-call-limit par tier (ou corriger le mapping produit).
6. Implémenter (ou retirer) le flux de réinitialisation de mot de passe — le lien est mort (404).
7. Ajouter un step-up `currentPassword` sur `deleteMyAccount`/`withdrawConsent`.
