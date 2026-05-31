# 🏗️ Rapport d'Audit Complet — EchoRoom

> **Date :** 31 Mai 2026
> **Portée :** Codebase complète (27 agents de review spécialisés)
> **Score global :** 4/10
> **Sprint 1 :** ✅ Complété (10 correctifs appliqués le 31 Mai 2026)

---

## 📋 Changelog

| Date | Version | Changement |
|------|---------|------------|
| 31 Mai 2026 | Sprint 1 | ✅ **10 correctifs critiques appliqués** — Sécurité (credentials Redis, HSTS, middleware, rate-limit login), Timeouts API, Intégrité données (cascade, modération), UI (scrollbar, nav) |
| 31 Mai 2026 | v1.0 | Rapport initial — 27 agents, ~23 300 LOC analysées |

## 🔍 Sommaire

1. [🗺️ Cartographie du Codebase](#1-️-cartographie-du-codebase)
2. [🖥️ Review Front-End](#2-️-review-front-end)
3. [🏢 Couche Métier](#3--couche-métier)
4. [💾 Couche Data Access](#4--couche-data-access)
5. [🗄️ Couche Database](#5--couche-database)
6. [⚙️ Review Back-End](#6-️-review-back-end)
7. [🏗️ Infrastructure](#7-️-infrastructure)
8. [🏛️ Synthèse Architecte](#8-️-synthèse-architecte)
9. [📅 Plan d'Action](#9--plan-daction)

---

## 1. 🗺️ Cartographie du Codebase

### Arborescence des modules clés

```
EchoRoom/                              ← Monorepo pnpm
├── echoroom-web/                      ★ Application principale (Next.js 14)
│   ├── src/
│   │   ├── app/                       ← Routes App Router (pages + API)
│   │   │   ├── (auth)/               ← login/, register/
│   │   │   ├── (dashboard)/          ← 9 sections dashboard
│   │   │   ├── (marketing)/          ← explore/, pricing/
│   │   │   ├── (legal)/              ← legal/, privacy/, terms/
│   │   │   ├── admin/                ← 6 sections admin
│   │   │   ├── api/                  ← tRPC, webhooks (Twilio, Stripe), auth, export
│   │   │   ├── call/[callId]/
│   │   │   └── scenario/[id]/
│   │   ├── components/               ← 37 composants React
│   │   │   ├── ui/                   ← 13 primitives design system
│   │   │   ├── admin/
│   │   │   ├── player/
│   │   │   ├── shared/              ← 10 composants partagés
│   │   │   └── social/              ← 8 composants sociaux
│   │   ├── hooks/                    ← 3 hooks personnalisés
│   │   ├── lib/                      ← Auth, env, tRPC, Stripe, Redis, R2, PostHog
│   │   ├── server/                   ★ Back-end complet
│   │   │   ├── db.ts                 ← Prisma singleton
│   │   │   ├── trpc.ts               ← tRPC init + middleware
│   │   │   ├── rootRouter.ts         ← 9 routers
│   │   │   ├── routers/              ← 9 routers (~75 procédures)
│   │   │   ├── services/             ← 7 domaines (ai, audio, billing, social, telephony, analytics, user)
│   │   │   ├── lib/                  ← logger, errors, encryption, date
│   │   │   ├── middleware/           ← CSRF, rate-limit, IP rate-limit
│   │   │   └── jobs/                 ← cleanup (audit logs, recordings)
│   │   ├── config/pricing.ts
│   │   ├── types/
│   │   └── middleware.ts             ← Edge middleware (auth guard)
│   └── prisma/
│       ├── schema.prisma             ← 14 modèles + 7 enums
│       └── migrations/               ← 5 migrations
├── packages/ui/                      ← Shared UI stub
├── echoroom-mobile/                  ← Stub (inactif)
├── echoroom-desktop-electron/        ← Stub (inactif)
├── turbo.json
└── pnpm-workspace.yaml
```

### Stack Technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| Runtime | Node.js | ≥20 |
| Framework | Next.js (App Router) | 14.2.25 |
| Langage | TypeScript | 5.6 |
| ORM | Prisma | 5.22 |
| BDD | PostgreSQL | — |
| Cache | Upstash Redis | 1.34 |
| API | tRPC + React Query | 11.0 |
| Auth | NextAuth v5 (beta.25) | — |
| UI | Tailwind CSS | 3.4 |
| Forms | react-hook-form + zod | 7.53 / 3.23 |
| IA | OpenAI (GPT-4o-mini), ElevenLabs, Deepgram | — |
| Téléphonie | Twilio | 5.4 |
| Paiement | Stripe | 17.0 |
| Storage | Cloudflare R2 | — |
| Analytics | PostHog | 1.200 |
| Tests | Vitest + Playwright | 2.1 / 1.48 |
| Monorepo | Turborepo | 2.0 |

### Volume

- **207 fichiers sources** (TS/TSX)
- **~23 300 LOC** dans `src/`
- **54 fichiers de test** (~23% du code)
- **14 modèles Prisma**, **7 enums**
- **5 migrations** DB

### Points d'entrée

| Type | Endpoints |
|------|-----------|
| **Pages** | `/`, `/login`, `/register`, `/dashboard`, `/call/[id]`, `/scenario/[id]`, `/explore`, `/pricing`, `/admin/*` (6) |
| **API REST** | `/api/trpc`, `/api/auth/[...nextauth]`, `/api/user/export`, `/api/webhooks/stripe`, `/api/webhooks/twilio/*` (4) |
| **tRPC** | 9 routers, ~75 procédures |
| **Edge** | `middleware.ts` (auth guard) |

### Découpage en couches

```
PRÉSENTATION → API/TRANSPORT → APPLICATION (tRPC) → SERVICES → DATA ACCESS → DATA
  (app/)        (api/ + middleware)   (routers/)    (services/)  (db.ts + lib/)  (PostgreSQL + Redis + R2)
```

---

## 2. 🖥️ Review Front-End

### 🚨 Problèmes critiques

| # | Agent | Composant | Description | Impact | Solution |
|---|-------|-----------|-------------|--------|----------|
| C1 | A4 (Access.) | `hooks/useFocusTrap.ts` | Focus trap ne rend pas le reste de la page inerte — WCAG 2.4.3 | Utilisateurs lecteurs d'écran peuvent interagir derrière la modale | Ajouter `aria-hidden` ou `inert` sur les frères du dialog |
| C2 | A4 (Access.) | `social/ShareButtons.tsx` | Boutons sans `aria-label` sur mobile (<640px : icônes muettes) — WCAG 4.1.2 | Échec critère WCAG sur mobile | Ajouter `aria-label="Partager sur..."` |
| C3 | A1/A6 | `ui/button.tsx` | Border-radius incohérents (button=rounded-xl, checkbox=rounded-md, dialog=rounded-2xl) | Design system sans hiérarchie de radius | Définir tokens sm/md/lg/xl et appliquer uniformément |
| C4 | A2 (UX) | `community/CommunityPageClient.tsx` | Mutation commentaire sans onSuccess/onError — aucun feedback, double-clic possible | Perte de données silencieuse | Ajouter callbacks comme dans ScenarioDetailClient |
| C5 | A5 (Archi.) | `dashboard/page.tsx` | 4 requêtes tRPC séparées au lieu d'une batchée | 4x round-trips réseau | Créer `dashboard.getData()` retournant tout l'état |
| C6 | A3 (Resp.) | `shared/DashboardShell.tsx` | `hide-scrollbar` classe CSS inexistante — nav overflow sans indication | Navigation mobile cassée | Ajouter la classe utilitaire dans globals.css |
| C7 | A4 (Access.) | `page.tsx` + `CallDisclaimerDialog.tsx` | `bg-muted/30` sur `bg-background` = ratio 1.5:1 | WCAG 1.4.1 — info transmise uniquement par couleur | Ajouter bordure ou utiliser `bg-muted/50` |
| C8 | A1 (Design) | `shared/DashboardShell.tsx` | Nav sticky sans fond opaque, pas de backdrop-blur | Texte se mélange avec contenu scrollé | Ajouter `backdrop-blur-sm` + `shadow-sm` |

### ⚠️ Améliorations importantes

| # | Agent | Composant | Description | Solution |
|---|-------|-----------|-------------|----------|
| W1 | A2 | `ShareButtons.tsx` | `disabled={trackMutation.isPending}` désactive TOUS les boutons | Désactiver uniquement le bouton cliqué |
| W2 | A2 | `ClipCreator.tsx` | Selection start/end via inputs sans timeline | Ajouter range slider double |
| W3 | A4 | `dialog.tsx` | `flex-col-reverse` — tab order ≠ DOM order | Utiliser `flex-col` avec `order` |
| W4 | A5 | `layout.tsx` | Aucun Suspense boundary autour des providers | Envelopper dans `<Suspense>` |
| W5 | A6 | `avatar.tsx` | `h-10 w-10` hardcodé — 6 tailles dupliquées dans le projet | Créer token `avatar-size` |
| W6 | A3 | `pricing/page.tsx` | Badge "Populaire" en `absolute -top-3` peut chevaucher titre sur mobile | Ajuster z-index |
| W7 | A4 | `EmojiPicker.tsx` | Grille sans `role="grid"` — lecteurs d'écran ne comprennent pas | Ajouter rôle et aria-label |
| W8 | A5 | `ScenarioDetailClient.tsx` | 148 lignes — trop de responsabilités | Split : ScenarioHeader, CommentsSection, RelatedScenarios |
| W9 | A1 | `pricing/page.tsx` | Formatage prix avec `toFixed().replace()`, bug sur entiers | Utiliser `Intl.NumberFormat("fr-FR")` |
| W10 | A2 | `SettingsPageClient.tsx` | Email désactivé sans explication textuelle | Ajouter tooltip |

### Score Front-End

| Catégorie | Score |
|-----------|-------|
| Design | 7/10 |
| UX | 6/10 |
| Responsive | 5/10 |
| Accessibilité | 5/10 |
| Maintenabilité | 6/10 |

---

## 3. 🏢 Couche Métier

### P0 — Problèmes bloquants

| # | Fichier | Problème | Impact | Solution |
|---|---------|----------|--------|----------|
| P0.1 | `community.ts` | `getComments` renvoie les commentaires REJECTED (pas de filtre moderationStatus) | Modération totalement ineffective | Ajouter `where: { moderationStatus: "APPROVED" }` |
| P0.2 | `community.ts` | Création commentaire sans `moderationStatus` explicite | Violation NOT NULL ou invisibilité | Définir `moderationStatus: "APPROVED"` à la création |
| P0.3 | `admin.ts` | Aucune route pour approuver un commentaire (uniquement rejeter) | Admin ne peut pas corriger une erreur | Ajouter `approveComment` symétrique |
| P0.4 | `auth.ts` | Connexion possible après soft delete (JWT valide 15 min) | Utilisateur banni continue d'utiliser l'API | Ajouter `deletedAt: null` dans la requête authorize |

### P1 — Problèmes importants

| # | Fichier | Problème | Solution |
|---|---------|----------|----------|
| P1.1 | `admin.ts` + `community.ts` | Modération ineffective : admin rejette mais commentaire reste public | Filtrer moderationStatus en lecture |
| P1.2 | `scenarios.ts` | Scénario REJECTED rendu PUBLIC via update sans re-modération | Forcer `moderationStatus = "PENDING"` si REJECTED |
| P1.3 | `calls.ts` | Codes morts `NUMBER_BLOCKED` et `DAILY_LIMIT_EXCEEDED` jamais levés | Supprimer ou centraliser |
| P1.4 | `calls.ts` | Replay accessible pour appels FAILED/PENDING | Vérifier `status === "COMPLETED"` |
| P1.5 | `social.ts` | `getFeatured` ignore la date — scénario à la une périmé | Filtrer par `featuredDate` du jour |
| P1.6 | `social.ts` | `createClip` ne vérifie pas la propriété de l'appel | Ajouter `call.userId === ctx.session.user.id` |
| P1.7 | `creditOps.ts` | `atomicRefund` sans borne supérieure — inflation de crédits possible | Ajouter plafond |

### Règles implicites documentées

1. **Crédits débités avant appel Twilio, remboursés si échec** (`callLifecycle.ts`)
2. **Emails jetables bloqués par sous-domaine récursif** (`auth.ts`)
3. **Numéros de téléphone français interdits dans le contenu** (regex blocklist)
4. **Modération output AI fail-open** (contenu autorisé si timeout)
5. **JWT avec tokenVersion + lastVerified** (revalidation périodique)

### Analyse DDD

| Problème | Entité | Impact | Suggestion |
|----------|--------|--------|------------|
| **God Aggregate** | User (11 relations, 0 méthodes) | Chaque nouvelle feature ajoute une relation | Découper en sous-agrégats (Profile, Credits, Privacy) |
| **Machine à états implicite** | Call.status | Aucune transition valide modélisée | State machine dédiée |
| **Value Objects absents** | PhoneNumber, Email, Transcript, Duration, Credits | Validation dupliquée, types faibles | Créer des VOs avec invariants |
| **Fuites métier** | Trending score dans le router, blacklist dans le router | Logique métier dans couche technique | Déplacer dans services domaine |
| **Race condition** | DailyCallLimit, Credits | findUnique + update non atomiques | Transaction unique ou update conditionnel |

---

## 4. 💾 Couche Data Access

### Repository Review

| Repository | Problème | Suggestion |
|-----------|----------|------------|
| Call | Blacklist + daily limit check dans le router | Déplacer dans `callLifecycle.ts` |
| Call | Ownership check dupliqué (calls.ts, social.ts, clips.ts) | Créer `findOwnedCallById(userId, callId)` |
| Scenario | `findUnique` + creator check dupliqué (update, delete) | `ScenarioRepository.findOwnedByUser()` |
| Scenario | Mêmes includes dupliqués (feed, myScenarios, moderationQueue) | Méthode paramétrée `findManyWithDetails()` |
| User | 9 appels `findUnique` avec selects différents dans 6 fichiers | `UserRepository.findById(id, select)` |
| AuditLog | `auditLog.create({...})` dupliqué 7× dans admin.ts | Helper `createAuditLog()` |
| Comment | Type Prisma brut retourné en DTO | Mapper vers DTO dédié |

### Query Performance

| Niveau | Fichier | Requête | Problème |
|--------|---------|---------|----------|
| 🔴 | `community.ts` | `comment.findMany({ where: { scenarioId } })` | Aucun index sur Comment.scenarioId — full table scan |
| 🔴 | `user.ts` | `comment.findMany({ where: { userId } })` | Aucun index sur Comment.userId |
| 🔴 | `cleanupRecordings.ts` | `call.findMany({ where: { endedAt <= cutoff } })` | Pas d'orderBy ni curseur — enregistrements sautés |
| 🔴 | `calls.ts` | Daily limit check + upsert | Race condition TOCTOU |
| 🟠 | `scenarios.ts` | Feed `[visibility=PUBLIC, moderationStatus=APPROVED]` | Pas d'index composite |
| 🟠 | `admin.ts` | Moderation queue `[moderationStatus=PENDING]` | Pas d'index sur moderationStatus |
| 🟠 | `admin.ts` | `user.findMany({ OR: [username: {contains} , email: {contains}] })` | ILIKE sans pg_trgm |
| 🟠 | `scenarios.ts` | `getById` avec include reactions (toutes) | 50k lignes chargées pour 1 utilisateur |

### ORM Review

| Fichier | Problème | Risque |
|---------|----------|--------|
| **Schema vs Migrations** | `tokenVersion`, `consentWithdrawnAt`, `featuredDate` absents des migrations SQL | 🔴 CRITIQUE — crash en prod sur `prisma migrate deploy` |
| `scenarios.ts:feed` | Eager loading excessif : `include: { reactions: true }` + `_count` redondant | 🟡 MOYEN — charge toutes les reactions inutilement |
| `badges.ts` | N+1 silencieux : boucle sur badges → query par badge (jusqu'à 50 queries) | 🟡 MOYEN — 5+ queries par action utilisateur |
| Tous routers | Entités Prisma exposées comme DTO — renommer colonne DB casse l'API | 🟡 MOYEN — couplage fort |
| `schema.prisma` | `onDelete: Cascade` sur `Call→Scenario` — supprimer scénario = perdre tous les appels | 🟡 MOYEN — perte de données |

---

## 5. 🗄️ Couche Database

### DBA — Schéma

| Table | Colonne/Index | Problème | Recommandation |
|-------|--------------|----------|----------------|
| DailyCallLimit | `@@index([userId])` | Index redondant (déjà couvert par `@@unique([userId, date])`) | `DROP` |
| UserBadge | `@@index([userId])` | Idem | `DROP` |
| **FeaturedScenario** | `featuredDate String` | Type String pour une date → risque format hétérogène | `ALTER ... TYPE DATE` |
| **DailyCallLimit** | `date DateTime` | DateTime pour date journalière → cassé par fuseau horaire | `ALTER ... TYPE date` |
| Call | `phoneNumber String` | Pas de limite de longueur | `VARCHAR(20)` |
| **Comment** | *(table entière)* | **Aucun index** — full table scan sur requêtes les plus fréquentes | 3 index : scenarioId, userId, moderationStatus |
| **Reaction** | *(table entière)* | Pas d'index sur scenarioId seul | `CREATE INDEX idx_reaction_scenario_id` |
| Clip | `status String` | String libre → devrait être enum | Créer `ClipStatus` enum |
| Call | `scenarioId → Scenario` | `onDelete: Cascade` → perte de données | `SetNull` ou `Restrict` |
| User | `credits Int` | Pas de CHECK → peut descendre en négatif | `CHECK (credits >= 0)` |
| Call | `durationSeconds Int` | Pas de CHECK → durée négative possible | `CHECK (duration_seconds >= 0)` |
| Purchase | `creditsPurchased Int` | Pas de CHECK | `CHECK (credits_purchased > 0)` |

### Scalabilité (×10 → ×100)

| Risque | Impact ×10 | Impact ×100 | Mitigation |
|--------|------------|-------------|------------|
| Feed sans index composite | 5-15ms → 50-150ms | 500ms+ | `@@index([visibility, moderationStatus, createdAt(sort: Desc)])` |
| Transcription JSON inline dans Call | +5-10GB | +100-500GB | Table CallTranscript séparée |
| User.credits UPDATE contention | Contentions notables | Goulot d'étranglement | Table CreditTransaction dédiée |
| Counters (likeCount, playCount) | Lock contention | Deadlocks fréquents | Queue asynchrone + batch write |
| PrismaClient pool non configuré | Limité à 25 connexions | Engorgement total | `connection_limit=50` + PgBouncer |
| Aucune séparation read/write | 100K reads/jour OK | 10M → master saturé | Read replicas |
| `contains` sur username/email | Acceptable | >5s | Index pg_trgm |

### Data Integrity

| Relation | Risque | Scénario de corruption | Solution |
|----------|--------|----------------------|----------|
| Call ↔ Twilio | Call orphelin + perte crédits | Webhook Twilio arrive AVANT que twilioCallSid soit écrit | Déplacer twilioCallSid dans transaction initiale |
| Call ↔ DailyCallLimit | Daily limit non atomique | initiateCall réussit, upsert daily limit échoue | Grouper dans une même transaction |
| Call ↔ Scenario.playCount | playCount non incrémenté | Crash entre initiateCall et increment | Déplacer dans la transaction |
| Stripe ↔ Purchase | Race condition refund | 2 webhooks charge.refunded simultanés passent tous les deux | `updateMany` avec `WHERE refundedAt IS NULL` |
| User.credits → atomicRefund | Double refund possible | Twilio exception + handler catch exécuté 2× | Ajouter guard d'idempotence |
| Registration | Race condition email/username unique | 2 inscriptions simultanées → 500 au lieu de CONFLICT | Catch P2002 + retour CONFLICT |
| Scenario → Call | Cascade suppression agressive | Suppression scénario → perte tous appels associés | Remplacer par `SetNull` ou `Restrict` |

---

## 6. ⚙️ Review Back-End

### 🚨 Critiques (8 agents)

| Agent | Fichier | Problème | Impact | Solution |
|-------|---------|----------|--------|----------|
| Sécu | `trpc.ts` | `withContentModeration` exécuté AVANT auth → DoS via OpenAI coûteux | Budget OpenAI explosé | Déplacer après isAuthenticated |
| Sécu | `stripe.ts` | userId + credits en metadata Stripe sans signature serveur | Exposition userId | HMAC-signer les metadata |
| Perf | `scenarios.ts` | Tri TRENDING en mémoire (findMany take:50 + sort JS) | Trending inexact + GC pressure | Vue matérialisée ou index DB |
| Archi | `trpc.ts` | `isAuthenticated` casse le typage (`as AuthenticatedSession`) | Bug silencieux à MAJ NextAuth | Type guard function |
| DB | `calls.ts` + `callLifecycle.ts` | Double transaction non atomique (debit dans initiateCall, dailyLimit après) | Inconsistance | Fusionner en une transaction |
| Obs | `twilio.ts` | Client Twilio initialisé une fois au module load | Pas de rotation de clés | Lazy initialization |
| Sécu | `trpc.ts` | `withRateLimit` path-based — contournable en variant le path | Rate-limit bypass | Namespace global + rate-limit agrégé |

### ⚠️ Problèmes importants

| Agent | Description | Solution |
|-------|-------------|----------|
| Archi | Monolithe synchrone total — aucune file d'attente | BullMQ + Redis |
| Archi | Scaling vertical uniquement | Design pour horizontal (sessions externalisées) |
| Sécu | Failed login non limité par IP — botnet peut flood inscriptions | `withIPRateLimit` sur register + login |
| Sécu | Pas de vérification email — usurpation possible | Email verification flow |
| Perf | `atomicRefund` pas atomique — échoue silencieusement si user supprimé | `user.updateMany` avec vérification count |
| Reli | `getConversationState` retourne null si Redis down → hangup forcé | Fallback mémoire locale avec TTL |
| Main | Badge evaluation N+1 — 50+ queries par action | Cache compteurs et évalue en batch |

### 🔒 Sécurité (OWASP)

| Vulnérabilité | OWASP Ref | Criticité | Solution |
|--------------|-----------|-----------|----------|
| REDIS_URL loggé (credentials Redis) | A02:2021 | **🔴 Critical** | Variable séparée REDIS_TOKEN, filtrer logs |
| Edge middleware ignore /api/* | A01:2021 | **🔴 High** | Fixer la regex du matcher |
| HSTS absent | A05:2021 | **🔴 High** | Ajouter `Strict-Transport-Security` |
| Stripe refund race condition | A01:2021 | **🔴 High** | `updateMany` atomique avec refundedAt: null |
| Aucun rate-limiting login | A04:2021 | **🔴 High** | Rate-limit par IP+email |
| In-memory rate-limit contournable multi-instance | A04:2021 | **🔴 High** | Redis obligatoire en production |
| CSP `unsafe-inline` permanent | A05:2021 | 🟡 Medium | `strict-dynamic` + nonce |
| JWT 30 jours sans refresh | A02:2021 | 🟡 Medium | 24h + refresh token |
| Modération fail-open par défaut | A04:2021 | 🟡 Medium | false en production |
| AES key derivation SHA-256 sans KDF | A02:2021 | 🟡 Medium | Remplacer par HKDF |
| Erreurs tRPC silencieuses en prod | A07:2021 | 🟡 Medium | Logger les erreurs (sans stack) |

### ⚡ Performance

| Problème | Impact | Solution |
|----------|--------|----------|
| Pipeline voix synchrone (transcription + TTS + upload) dans webhook Twilio | Latence ×10, timeout 15s | File d'attente asynchrone |
| `initiateCall` : 2 transactions + appel Twilio + DB → 1-2s | 20 calls/s max | Pipeline async + queue |
| Badge evaluation : for-loop avec requêtes DB (N+1) | 50 queries pour 50 badges | Batch loading |
| `cleanupRecordings` : delete individuel R2 + update DB | 1 tour API + 1 write par enregistrement | `deleteObjects` S3 batch + `updateMany` |

### 🧪 Tests manquants

| Zone | Type de test | Priorité |
|------|-------------|----------|
| Webhook Twilio handle-input (timeout, goodbye, tampering) | Integration + E2E | Haute |
| Race condition DailyCallLimit (2 calls simultanés) | Concurrency | Haute |
| Pipeline complet call (initiateCall → debit → Twilio → transcription → reconcile) | E2E | Haute |
| Stripe webhook (refund, dispute, double-firing) | Integration | Haute |
| Concurrent credit debit/refund | Concurrency | Haute |
| Anonymization (vérifier toutes les tables PII) | Integration | Haute |

### 📋 Dette technique

| Description | Coût si ignoré | Effort |
|-------------|---------------|--------|
| Type casting dans isAuthenticated (`as AuthenticatedSession`) | Bug silencieux à MAJ NextAuth | 1h |
| Duplication `synthesizeAndUpload` (voice + handle-input) | Bug fix ×2 | 2h |
| `atomicRefund` pas assez atomique | Perte crédits race condition | 1h |
| Pas de helper pagination partagé | ~50 lignes × 9 endpoints | 4h |
| TRENDING sort mémoire plutôt que DB | Requêtes de plus en plus lentes | 8h |
| Module-level initialization clients (Twilio, Deepgram, etc.) | Cold start 5-10s | 4h |

---

## 7. 🏗️ Infrastructure

### Fiabilité

| Point de risque | Type de panne | Probabilité | Impact | Solution |
|----------------|---------------|-------------|--------|----------|
| **Aucun timeout** OpenAI/ElevenLabs/Deepgram | Appel bloqué | M | 🔴 CRITIQUE | `AbortSignal.timeout(ms)` partout |
| **Circuit breaker absent** | Cascade failure | M | 🔴 CRITIQUE | opossum ou pattern maison |
| `withRetry` défini mais **jamais utilisé** | Échec transitoire non géré | M | 🟡 HAUT | Appliquer sur tous les appels externes |
| **Absence file d'attente/DLQ** | Webhooks ratés définitivement perdus | M | 🟡 HAUT | BullMQ + Redis |
| Redis SPOF pour état conversation | Si Redis down → hangup forcé | L | 🟡 MOYEN | Fallback PostgreSQL + TTL |
| Cleanup jobs : pas de persistance | Crash en milieu de batch = artefacts | L | 🟢 FAIBLE | Ajouter persistance + retry |

### Sécurité Infra

| Vulnérabilité | Criticité | Solution |
|--------------|-----------|----------|
| REDIS_URL exposé dans les logs | 🔴 Critical | Variable REDIS_TOKEN séparée |
| HSTS absent | 🔴 High | `Strict-Transport-Security: max-age=63072000` |
| Stripe refund race condition | 🔴 High | `updateMany` atomique |
| Edge middleware bypass `/api/*` | 🔴 High | Corriger la regex middleware.ts |
| AES key derivation SHA-256 (sans KDF) | 🟡 Medium | HKDF avec salt |
| Audit hash tronqué 64 bits | 🟢 Low | 256 bits complets |

### Observabilité

| Zone aveugle | Impact | Recommandation |
|-------------|--------|----------------|
| Latence API OpenAI/Deepgram/ElevenLabs | Impossible d'identifier la source du ralentissement | Timer OTel span autour de chaque appel |
| Webhooks Twilio (voice, handle-input, status) | Pic 5xx invisible | Métrique counter + historique latence |
| Cleanup jobs | Échec silencieux | Counter jobs.deleted + timer |
| Rate limiting | Impossible de savoir combien de requêtes sont limafées | Counter rate_limit.blocked |
| Moderation AI (fail-open) | Dégradation silencieuse | Counter + alert si > seuil |
| Stripe webhooks | Erreurs facturation non détectées | Counter par type d'event |
| **Rien du tout** | Aucune métrique RED, aucun tracing, aucun health check, aucun alerting | ⚠️ Aveugle en production |

### Cloud & Ops (SRE)

| Risque | Impact | Probabilité | Solution |
|--------|--------|-------------|----------|
| Aucun CI/CD | Déploiement manuel = erreur humaine | Très élevée | GitHub Actions (lint → typecheck → test → build → deploy) |
| Aucun Dockerfile | Build non reproductible | Élevée | Dockerfile multi-stage |
| Aucune backup DB | Perte de données totale | Très élevée | pg_dump quotidien + WAL archiving |
| Aucun staging environment | Modifications en prod sans validation | Très élevée | Review apps Vercel |
| Aucun auto-scaling | Panne = downtime total | Élevée | Min 2 réplicas, HPA (CPU 70%) |
| Aucun health check | Load balancer aveugle | Élevée | `/api/health` (DB, Redis, R2) |
| Prisma pool non configuré | Connexions saturées | Moyenne | `connection_limit=20` + PgBouncer |

**Score maturité SRE : 2/10**

---

## 8. 🏛️ Synthèse Architecte

### Top 20 Problèmes (tous domaines)

| # | Domaine | Problème | Impact | Effort | Sprint |
|---|---------|----------|--------|--------|--------|
| 1 | Sécurité/Infra | REDIS_URL loggé (credentials en clair) | 🔴 CRITICAL | 🟢 1h | S1 |
| 2 | Sécurité/Backend | Edge middleware ignore /api/* | 🔴 CRITICAL | 🟢 30min | S1 |
| 3 | Sécurité/Infra | Stripe refund race condition (double refund) | 🔴 HIGH | 🟡 4h | S2 |
| 4 | DevOps/Backend | Aucun timeout OpenAI/ElevenLabs/Deepgram | 🔴 HIGH | 🟢 2h | S1 |
| 5 | Business | getComments filtre pas REJECTED → modération bypass | 🔴 HIGH | 🟢 15min | S1 |
| 6 | Database | onDelete: Cascade Scenario→Call → perte de données | 🔴 HIGH | 🟢 30min | S1 |
| 7 | Business/Data | Race condition daily limit (TOCTOU) | 🔴 HIGH | 🟡 4h | S2 |
| 8 | Sécurité/Backend | HSTS absent | 🔴 HIGH | 🟢 1h | S1 |
| 9 | Sécurité/Backend | Aucun rate-limit login | 🔴 HIGH | 🟢 2h | S1 |
| 10 | Sécurité/Backend | withContentModeration AVANT auth → DoS via OpenAI | 🟡 MEDIUM | 🟢 30min | S2 |
| 11 | Sécurité/Backend | JWT 30 jours sans refresh | 🟡 MEDIUM | 🟢 4h | S2 |
| 12 | Business/Backend | Double transaction non atomique (start + initiateCall) | 🔴 HIGH | 🟡 8h | S2 |
| 13 | Backend/Infra | Pipeline voix synchrone dans webhook Twilio (timeout 15s) | 🔴 HIGH | 🔴 60h | S3 |
| 14 | Database | Migration manquante: tokenVersion, consentWithdrawnAt, featuredDate | 🔴 HIGH | 🟢 2h | S2 |
| 15 | Database | Feed sans index composite [visibility, moderationStatus, createdAt] | 🟡 MEDIUM | 🟢 2h | S2 |
| 16 | Frontend | hide-scrollbar class inexistante → nav cassée mobile | 🟡 MEDIUM | 🟢 30min | S1 |
| 17 | Frontend | Mutation commentaire sans onSuccess/onError → aucun feedback | 🟡 MEDIUM | 🟢 1h | S2 |
| 18 | Architecture | User = God Aggregate (11 relations, 0 méthodes métier) | 🔴 HIGH | 🔴 40h | S3 |
| 19 | DevOps | Aucun CI/CD, Dockerfile, backup DB, staging | 🔴 HIGH | 🔴 30h | H6 |
| 20 | Observabilité | Aucune métrique RED, tracing, health check, alerting | 🟡 MEDIUM | 🔴 50h | H6 |

### 🧨 Dette technique critique (×10 dans 6 mois)

| Problème | Raison |
|----------|--------|
| User = God Aggregate | Chaque feature ajoute une relation → refactor exponentiellement plus dur |
| Monolithe synchrone sans queue | Convertir en async = réécriture complète du pipeline audio |
| Prisma comme DTO (pas de Repository) | Migrer de DB = réécriture. Tout le code back-end couplé à Prisma |
| Aucun index DB (Comment, Reaction, Feed) | ×100 utilisateurs = ×100 temps. Indexer après = downtime/locking |
| Eager loading réactions dans feed | Pattern viral → plus le feed grossit, plus il ralentit |
| Aucun test E2E call/Stripe/Twilio | Chaque déploiement est un pari. Tester après = dette ×10 |
| AppError→TRPCError mapping manuel (9× switch) | Chaque nouvel error type = modifier 9 fichiers |
| `withRateLimit` path-based contournable | Rewrite complet du rate limiting nécessaire |

### ⚠️ Risques à 6 mois

- **Volume transcription JSON inline** → +100-500GB, requêtes lentes, backups énormes
- **User.credits UPDATE contention** → deadlocks sous charge ×50
- **Twilio webhook avant `twilioCallSid`** → calls orphelins permanents
- **Cleanup recordings sans curseur** → records sautés, accumulation storage
- **`contains` (ILIKE) sans pg_trgm** → admin.searchUsers inutilisable
- **Redis SPOF conversation state** → Redis down = tous les appels cassés
- **Aucun circuit breaker API tierces** → OpenAI down = tout le système dead

### 🔮 Risques à 2 ans

- Pas de file d'attente → scaling vertical plafonné
- Aucune abstraction AI provider → vendor lock-in (OpenAI/ElevenLabs/Deepgram)
- User God Aggregate → impossible d'introduire multi-tenant, organizations, RBAC
- Aucun event sourcing / audit trail → impossible de répondre à des audits RGPD futurs
- Aucun test E2E → la dette de test rend tout refactor dangereux → paralysie

### Score d'architecture global

| Dimension | Score | Justification |
|-----------|-------|---------------|
| Architecture | 5/10 | Monolithe synchrone mais bien structuré tRPC. User God Aggregate. |
| Sécurité | 4/10 | Credentials loggés, bypass middleware, HSTS absent, JWT 30j |
| Performance | 6/10 | OK à petite échelle, mais 🔴 à ×100 (index, N+1, synchrone) |
| Maintenabilité | 5/10 | Code organisé mais duplication, pas de Repository, mapping erreur manuel |
| Scalabilité | 3/10 | ×10 OK, ×100 = échec. Pas de queue, pas de read replica, pas de cache |
| Observabilité | 2/10 | JSON logger OK mais zéro métrique, zéro tracing, zéro health check |
| DevOps | 2/10 | Aucun CI/CD, Dockerfile, backup, staging, auto-scaling |
| **Score Global** | **4/10** | **Preuve de concept fonctionnelle, pas prête production à l'échelle** |

---

## 9. 📅 Plan d'Action

### Sprint 1 — Correctifs Critiques ✅ COMPLÉTÉ (31 Mai 2026)

| # | Action | Effort | Domaine | Statut |
|---|--------|--------|---------|--------|
| 1 | 🔥 Supprimer `REDIS_URL` des logs — Utilisation de `REDIS_TOKEN` dédié | 1h | Sec | ✅ |
| 2 | 🔥 Fixer edge middleware regex — `/api/*` désormais protégé | 30min | Sec | ✅ |
| 3 | 🔥 Ajouter timeout OpenAI (30s) + ElevenLabs (15s) + Deepgram (30s) | 2h | Backend | ✅ |
| 4 | 🔥 Ajouter HSTS header — `Strict-Transport-Security: 2 ans` | 1h | Sec | ✅ |
| 5 | 🔥 Filtrer `moderationStatus !== 'REJECTED'` dans getComments | 15min | Business | ✅ |
| 6 | 🔥 Fixer cascade delete Scenario→Call → `SetNull` | 30min | Database | ✅ |
| 7 | Fixer `hide-scrollbar` (classe utilitaire) + `backdrop-blur` nav | 30min | Frontend | ✅ |
| 8 | Rate-limit login — 5 tentatives / 15 min par email | 2h | Sec | ✅ |
| 9 | Ajouter `moderationStatus: "APPROVED"` explicite à création commentaire | 30min | Business | ✅ |
| 10 | Route admin `approveComment` — symétrique à moderateComment | 2h | Business/Backend | ✅ |

**Fichiers modifiés (14) :**
- `next.config.mjs` — HSTS header
- `prisma/schema.prisma` — Cascade→SetNull, scenarioId nullable
- `src/app/globals.css` — hide-scrollbar utility
- `src/components/shared/DashboardShell.tsx` — backdrop-blur + shadow
- `src/lib/auth.ts` — rate-limit login (checkRateLimit)
- `src/lib/env.ts` — REDIS_TOKEN dans le schéma Zod
- `src/lib/openai.ts` — timeout: 30000, maxRetries: 2
- `src/lib/redis.ts` — sanitization REDIS_URL
- `src/middleware.ts` — matcher regex fix
- `src/server/routers/admin.ts` — approveComment procedure
- `src/server/routers/community.ts` — getComments filter + moderationStatus
- `src/server/services/ai/moderation.ts` — AbortSignal.timeout(5000)
- `src/server/services/audio/transcription.ts` — AbortController 30s
- `src/server/services/audio/tts.ts` — AbortController 15s

### Sprint 2 — Stabilisation (Semaine 3-6) — ~36h total

| # | Action | Effort | Domaine |
|---|--------|--------|---------|
| 11 | Atomic daily limit — upsert conditionnel | 4h | Business/Data |
| 12 | Fusionner les 2 transactions (start + initiateCall) | 8h | Backend |
| 13 | Guard idempotence Stripe refund (`updateMany WHERE refundedAt IS NULL`) | 4h | Business |
| 14 | Migration DB : ajouter tokenVersion, consentWithdrawnAt, featuredDate → DATE | 2h | Database |
| 15 | Index : Comment(scenarioId, userId), Feed composite, Reaction(scenarioId) | 2h | Database |
| 16 | Déplacer withContentModeration APRÈS isAuthenticated | 30min | Backend |
| 17 | JWT 24h + refresh token | 8h | Sec |
| 18 | Cleanup recordings : orderBy createdAt + curseur | 2h | Data |
| 19 | 4 requêtes tRPC Dashboard → 1 batch query | 4h | Frontend/Backend |
| 20 | onSuccess/onError sur mutation commentaire | 1h | Frontend |

### Sprint 3 — Amélioration (Mois 2-3) — ~190h total

| # | Action | Effort | Domaine |
|---|--------|--------|---------|
| 21 | Repository pattern : Prisma derrière interfaces (Comment, Call, Scenario) | 40h | Architecture |
| 22 | Pipeline voix async : BullMQ + Redis pour transcription+TTS+upload | 60h | Backend/Infra |
| 23 | Badge evaluation : remplacer N+1 par GROUP BY | 4h | Data |
| 24 | Audit log : déplacer DANS la transaction | 2h | Business |
| 25 | Factoriser pagination (helper partagé) | 4h | Backend |
| 26 | Health check endpoints (/health, /ready) | 4h | Infra |
| 27 | Configuration pool sizing Prisma (PgBouncer compatible) | 2h | Data/Infra |
| 28 | Design system : unifier border-radius, spacing, couleurs | 16h | Frontend |
| 29 | Tests webhook Twilio + Stripe (refund, dispute, double-firing) | 40h | Backend |
| 30 | Test E2E pipeline call complet | 20h | Backend/E2E |

### Horizon 6 Mois — Évolution

| # | Action | Effort | Priorité |
|---|--------|--------|----------|
| A | Async call pipeline : BullMQ worker pool | 80h | 🔴 P0 |
| B | Séparation read/write DB (read replica pour feed) | 40h | 🔴 P0 |
| C | CI/CD : GitHub Actions + Docker + staging | 30h | 🟡 P1 |
| D | Backup DB automatisée (pg_dump daily + WAL) | 8h | 🟡 P1 |
| E | Observabilité : Prometheus + OTEL tracing + Grafana | 50h | 🟡 P1 |
| F | Refresh token rotation + session management | 20h | 🟡 P1 |
| G | Design system complet (Storybook + theme tokens) | 40h | 🟢 P2 |
| H | Circuit breaker API tierces (opossum) | 16h | 🟢 P2 |
| I | Caching layer (Redis pour feed, trending, featured) | 20h | 🟢 P2 |
| J | Multi-tenant architecture (workspace/organization) | 100h+ | 🔵 P3 |

---

## Verdict

> EchoRoom est une **preuve de concept fonctionnelle mais pas prête pour la production à l'échelle**. Le noyau métier (appels vocaux IA, Stripe, modération) est bien conçu et fonctionnel, mais la couche infrastructure/sécurité/ops est dangereusement immature.
>
> **Sprint 1 ✅ (31 Mai 2026) :** Les 10 correctifs critiques ont été appliqués — credentials Redis sécurisés, middleware edge protégé, timeouts API configurés, HSTS activé, modération des commentaires effective, cascade delete corrigée, navigation mobile réparée, rate-limit login implémenté, et route d'approbation admin ajoutée.
>
> **Prochaines étapes :** Sprint 2 — Stabilisation (transactions atomiques, index DB manquants, JWT 24h, migrations Prisma, fusion transactions). Ces correctifs adressent les causes racines de corruption de données et de dégradation de performance.
>

---

*Rapport généré par 27 agents de review spécialisés — Mai 2026*
