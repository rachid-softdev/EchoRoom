# 🎯 Scénarios de Test E2E Manquants — Au-delà de TEST_SCENARIOS.md

> **Analyse statique du code source** — 24 juin 2026  
> **Méthode** : Reverse-engineering de 120+ fichiers (composants React, procédures tRPC, middlewares, webhooks, jobs, services)  
> **Objectif** : Trouver des scénarios non documentés dans TEST_SCENARIOS.md (qui compte déjà 190 ✅ + 534 ⬜)

---

## Résumé des Découvertes

| Agent | Périmètre | Scénarios trouvés |
|-------|-----------|:-----------------:|
| Agent 1 | Auth, Security, Session, CSRF, Rate Limiting | ~70 |
| Agent 2 | Dashboard, Create, Library, History, Settings, Billing | ~76 |
| Agent 3 | Landing, Explore, Scenario Detail, Call Replay, Pricing, Help, Profile, Community, Leaderboard | ~60 |
| Agent 4 | Composants UI, Shared, Player, Social, Admin | ~98 |
| Agent 5 | Admin, Webhooks, API, Cron, Stripe, GDPR | ~85 |
| **Total** | | **~389 nouveaux scénarios** |

---

## TOP 15 — Scénarios Prioritaires (Risque Élevé)

Ces scénarios représentent des bugs potentiels identifiés par analyse statique.

### 🔴 P1 — Bug: Auth — Email case sensitivity (`USER@EXAMPLE.COM` vs `user@example.com`)
- **Risque**: La recherche Prisma `findUnique({ where: { email } })` est **case-sensitive** dans PostgreSQL. Si l'utilisateur s'inscrit avec `User@Example.com` mais tente de se connecter avec `user@example.com`, la connexion échoue.
- **Code**: `packages/auth/src/lib/auth.ts` ligne 86: `prisma.user.findUnique({ where: { email } })`
- **Test**: Login avec email en majuscules d'un compte créé en minuscules → doit réussir (normalisation)
- **Priorité**: 🔴 CRITIQUE — Impact direct sur la connexion utilisateur

### 🔴 P2 — Bug: Billing — Historique d'achats toujours vide
- **Risque**: Le composant `/billing` affiche **toujours** "Aucun achat pour le moment" même si l'utilisateur a des achats. La page utilise un texte statique et ne fetch PAS `billing.getPurchases`.
- **Code**: `src/app/(dashboard)/billing/page.tsx` — pas de query API pour l'historique
- **Test**: Créer un achat → naviguer vers `/billing` → vérifier que l'historique s'affiche (ou un message approprié)
- **Priorité**: 🔴 CRITIQUE — Feature complètement non fonctionnelle

### 🔴 P3 — Bug: Settings — "Enregistrer" ne se désactive pas quand l'username revient à l'original
- **Risque**: `setHasChanges(true)` est appelé à chaque `onChange` sans comparer avec la valeur initiale. Si l'utilisateur change l'username puis le remet comme avant, le bouton reste actif.
- **Code**: `src/app/(dashboard)/settings/SettingsPageClient.tsx`
- **Test**: Modifier username → le remettre à l'original → vérifier que le bouton "Enregistrer" est désactivé
- **Priorité**: 🔴 CRITIQUE — UX cassée, mutation inutile

### 🔴 P4 — Bug: Dashboard — Échec d'UN widget fait planter TOUT le dashboard
- **Risque**: Les 4 KPIs sont dans le même `Promise.all` dans `dashboard.getData`. Si UNE requête échoue, TOUTES échouent. Le composant utilise `?.` partout mais le `undefined` cascade sur tous les widgets.
- **Code**: `src/server/routers/dashboard.ts`
- **Test**: Faire échouer 1 requête sur 4 → vérifier que les 3 autres s'affichent
- **Priorité**: 🔴 CRITIQUE — Perte de la page entière pour une erreur partielle

### 🟠 P5 — Bug: AudioPlayer — useEffect ne reset pas l'erreur au changement de recordingUrl
- **Risque**: Le `useEffect` qui reset `setHasError(false)` et `setIsLoaded(false)` a un tableau de dépendances vide `[]` au lieu de `[recordingUrl]`. Si l'URL change (navigation vers un autre call), l'audio ne se recharge pas.
- **Code**: `src/components/player/AudioPlayer.tsx` ligne 35-37
- **Test**: Naviguer de call A vers call B → vérifier que le nouvel audio se charge
- **Priorité**: 🟠 HAUTE — Navigation entre replays cassée

### 🟠 P6 — Bug: Create — Draft localStorage n'est pas effacé au clic "Annuler"
- **Risque**: Le bouton "Annuler" navigue vers `/dashboard` via un `Link`. Rien n'efface le draft dans localStorage. Revenir sur `/create` restaure l'ancien draft.
- **Code**: `src/app/(dashboard)/create/page.tsx` — pas de cleanup du draft
- **Test**: Remplir → Annuler → Revenir → vérifier que le formulaire est vide
- **Priorité**: 🟠 HAUTE — Données fantômes réapparaissent

### 🟠 P7 — Bug: Settings — `deleteMyAccount` ne vérifie PAS les appels actifs
- **Risque**: `withdrawConsent` vérifie les appels actifs avant de retirer le consentement, mais `deleteMyAccount` ne le fait PAS. L'utilisateur peut supprimer son compte pendant un appel actif.
- **Code**: `src/server/routers/profile.ts` — pas de guard pour les appels actifs
- **Test**: Supprimer le compte pendant un appel ACTIF → vérifier incohérence
- **Priorité**: 🟠 HAUTE — Incohérence métier, données orphelines

### 🟠 P8 — Bug: Settings — Changement de mot de passe absent de l'UI (documenté mais pas codé)
- **Risque**: La section "Changer le mot de passe" est listée dans TEST_SCENARIOS.md mais le composant `SettingsPageClient.tsx` n'a ni champs password, ni mutation associée.
- **Code**: `src/app/(dashboard)/settings/SettingsPageClient.tsx` — absence totale
- **Test**: Naviguer vers `/settings` → vérifier qu'aucun formulaire password n'existe
- **Priorité**: 🟠 HAUTE — Feature non implémentée mais documentée comme planifiée

### 🟡 P9 — Gap: Rate limit register (3/heure) non testé
- **Code**: `withRateLimit({ limit: 3, window: 3600 })` sur `auth.register`
- **Test**: 4 inscriptions → la 4ème doit retourner 429
- **Priorité**: 🟡 MOYENNE — Protection anti-spam non validée

### 🟡 P10 — Gap: Rate limit login par email non testé (5/15min)
- **Code**: `checkRateLimit({ identifier: 'login:${email}', limit: 5, window: 900 })`
- **Test**: 6 tentatives → la 6ème retourne 429
- **Priorité**: 🟡 MOYENNE — Protection brute-force non validée

### 🟡 P11 — Gap: CSRF en production — POST sans origin → 403
- **Code**: `src/lib/trpc.ts` — `allowMissingOrigin: process.env['NODE_ENV'] !== "production"`  
- **Test**: Mutation TRPC sans Origin → 403 en production
- **Priorité**: 🟡 MOYENNE — Sécurité CSRF non testée E2E

### 🟡 P12 — Gap: Stripe webhook — checkout.completed avec payment_intent null
- **Code**: `src/server/services/billing/stripe.ts`
- **Test**: Simuler événement sans payment_intent → 400
- **Priorité**: 🟡 MOYENNE — Résilience webhook

### 🟡 P13 — Gap: Redirection callbackUrl après login fonctionnelle
- **Code**: `middleware.ts` ajoute `?callbackUrl=%2Flibrary`
- **Test**: Naviguer vers /library sans auth → login → callback vers /library
- **Priorité**: 🟡 MOYENNE — UX de redirection

### 🟡 P14 — Gap: Session multi-onglet — déconnexion onglet A → onglet B déconnecté
- **Code**: Session JWT avec `tokenVersion`
- **Test**: 2 onglets → déconnexion onglet A → action onglet B → redirection login
- **Priorité**: 🟡 MOYENNE — Cohérence session

### 🟡 P15 — Gap: Modération — admin ne peut pas voir les scénarios REJECTED
- **Code**: ModerationQueue ne filtre que PENDING
- **Test**: Vérifier absence de filtre REJECTED onglet "Scénarios"
- **Priorité**: 🟡 MOYENNE — Fonctionnalité admin incomplète

---

## Résumé par Section

### Auth & Security (~70 scénarios)
- Login: email case sensitivity, leading/trailing whitespace, double-clic, timing attack, rate limiting
- Register: Unicode/emoji username, email jetable (24 domaines), double-clic, rate limiting, PasswordStrengthMeter thresholds
- Forgot/Reset Password: token invalide/expiré/réutilisé
- Session: multi-onglet, tokenVersion, session expirée en SPA, callbackUrl
- CSRF: origin manquante/malformée/non-autorisée, Referer fallback, PUT/DELETE non protégé (!)
- Rate Limiting: login, register, changePassword, export, delete — tous avec compteurs indépendants

### Dashboard Pages (~76 scénarios)
- Dashboard: échec partiel batch query, refetch après création, session refresh
- Create: XSS dans instructions, draft localStorage corrompu/quota dépassé, génération IA timeout
- Library: search avec caractères regex, pagination + recherche combinée, suppression rollback
- History: statut BLOCKED, durée nulle/extrême, filtrage par statut en français
- Settings: username déjà pris (P2002 error), export données vides/massives, double suppression
- Billing: retour Stripe muet (?success= ignoré), cache non invalidé, historique toujours vide

### Pages Publiques (~60 scénarios)
- Landing: LiveCounter aléatoire, animations fade-in, HeroFeatures alternance
- Explore: URL sync, debounce recherche 300ms, "Surprise-moi" mode chaos
- Scenario Detail: PRIVATE visibility, ReactionBar optimistic, ShareButtons popup/track
- Call Replay: AudioPlayer play/pause/seek/speed/cleanup, TranscriptView états null/empty
- Profile: Stats zéro, activité mixée/triée, formatRelativeDate edge cases
- Community: Input préservé sur erreur, Enter key submit, ReactionBar feed
- Leaderboard: tabs désactive l'autre query, top 3 trophées, ranking fallback

### Composants Partagés (~98 scénarios)
- UI (14 composants): Alert role, Avatar fallback, Button asChild, Dialog focus-trap/scroll-lock, Input file, SegmentedControl arrow keys, Skeleton reduced-motion, ThemeToggle hydration, Tooltip positions/Unicode
- Shared (15 composants): Breadcrumbs routes inconnues, CallDisclaimerDialog localStorage, ConfirmDialog destructive/loading, ConsentBanner reconsent, CreditDisplay skeleton/tooltip, DataLoader retry cycle, PaginatedGrid edge cases, PasswordStrengthMeter tous les seuils
- Player (4 composants): AudioPlayer **bug useEffect**, TranscriptView alternance/timestamps
- Social (10 composants): BadgeDisplay empty/error, BadgeNotification auto-dismiss, EmojiPicker fermeture, ReactionBar disabled state, ReportButton conflit

### Admin ~85 scénarios
- Moderation: Moderator role, pagination absente, tab REJECTED manquante
- Users: Recherche <2 caractères, suppression utilisateur supprimé, pas de deep link
- Reports: Pagination absente, dismiss concurrent, pas d'action "Traiter"
- Blocked Numbers: Validation téléphone, déblocage concurrent, déjà bloqué
- Audit: dateFrom > dateTo, filtres non persistés, incompatibilité curseur/filtres
- Analytics: Page entièrement statique (placeholder)
- Webhooks Stripe: payment_intent null, idempotency Redis down, metadata invalides, body size limite
- Webhooks Twilio: race condition statuts, SSRF RecordingUrl, crédits insuffisants
- API: Healthcheck DB down, OG font fallback, User export CSRF incomplet
- Cron: CRON_SECRET absent, lock Redis concurrent, batch cursor, timeout 5 min
- GDPR: Purge partielle, export après anonymization, donnes partiellement nettoyées
- Cross-cutting: Cache non invalidé entre modules, session expirée en SPA, offline

---

## Bugs Identifiés par Analyse Statique

| ID | Bug | Impact | Fichier |
|:--:|-----|--------|---------|
| B1 | Email case-sensitive dans Prisma (connexion bloque) | 🔴 CRITIQUE | `auth.ts` |
| B2 | Historique achats toujours vide (placeholder) | 🔴 CRITIQUE | `billing/page.tsx` |
| B3 | Bouton "Enregistrer" ne se désactive pas au retour à l'original | 🔴 CRITIQUE | `SettingsPageClient.tsx` |
| B4 | Dashboard — échec d'un widget cascade sur tous | 🔴 CRITIQUE | `dashboard.ts` router |
| B5 | AudioPlayer — useEffect dépendance manquante recordingUrl | 🟠 HAUTE | `AudioPlayer.tsx` |
| B6 | Draft localStorage non effacé au clic "Annuler" | 🟠 HAUTE | `create/page.tsx` |
| B7 | deleteMyAccount sans vérification appels actifs | 🟠 HAUTE | `profile.ts` |
| B8 | Changement mot de passe documenté mais non codé | 🟠 HAUTE | `SettingsPageClient.tsx` |
| B9 | ModerationQueue pagination absente (>50 items inaccessibles) | 🟠 HAUTE | `moderation/page.tsx` |
| B10 | Reports pagination absente (>50 items inaccessibles) | 🟠 HAUTE | `reports/page.tsx` |
| B11 | CSRF non protégé pour PUT/DELETE/PATCH | 🟠 HAUTE | `trpc.ts` |
| B12 | History — recherche "Terminé" ne trouve rien (match sur "COMPLETED") | 🟡 MOYENNE | `history/page.tsx` |
| B13 | Library — bouton "Annuler" restaure le draft | 🟡 MOYENNE | `create/page.tsx` |
| B14 | Billing — pas de feedback après retour Stripe | 🟡 MOYENNE | `billing/page.tsx` |

---

## Recommandations

1. **Corriger les bugs P1-P8** avant d'écrire des tests (les tests échoueront sinon)
2. **Écrire les tests E2E par priorité** :
   - Sprint 1 : Critical bugs (B1-B4) — 4 tests
   - Sprint 2 : Auth & Security — ~20 tests priorisés
   - Sprint 3 : Dashboard pages — ~30 tests
   - Sprint 4 : Pages publiques — ~30 tests
   - Sprint 5 : Composants partagés — ~40 tests
   - Sprint 6 : Admin, Webhooks, API — ~40 tests
3. **Ajouter les scénarios manquants à TEST_SCENARIOS.md** pour maintenir un plan de couverture complet

---

## Métriques de Couverture

| Métrique | Valeur |
|----------|:------:|
| Tests E2E existants (dans .spec.ts) | 190 |
| Scénarios planifiés (dans TEST_SCENARIOS.md) | 534 |
| Nouveaux scénarios identifiés (ce document) | ~389 |
| Bugs confirmés par analyse statique | 14 |
| **Potentiel total** | **~1113 scénarios** |
