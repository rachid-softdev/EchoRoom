# 🕳️ Scénarios de Test Obscurs — Au Cœur de l'API, Middleware & Routage

> **Analyse dynamique du code source** — 24 juin 2026  
> **Méthode** : Reverse-engineering exhaustif de 50+ fichiers (middleware, routers, webhooks, services telephony, API routes)  
> **Objectif** : Trouver les scénarios que personne n'a encore imaginés — les coins les plus sombres du système  

---

## Table des Matières
1. [tRPC Error Handling & Middleware Chain](#1-trpc-error-handling--middleware-chain)
2. [Routes API Edge Cases](#2-routes-api-edge-cases)
3. [Permissions & Authorization (IDOR, Mass Assignment)](#3-permissions--authorization)
4. [API Versioning (v1 vs v2)](#4-api-versioning)
5. [Twilio Telephony Deep Dive](#5-twilio-telephony-deep-dive)
6. [Webhook Edge Cases](#6-webhook-edge-cases)
7. [Cron Jobs & Background Jobs](#7-cron-jobs--background-jobs)
8. [GDPR & Data Privacy](#8-gdpr--data-privacy)
9. [Rate Limiting & DDoS Protection](#9-rate-limiting--ddos-protection)
10. [CSRF Protection Failures](#10-csrf-protection-failures)
11. [Redis Failure Modes & Degraded Operations](#11-redis-failure-modes)
12. [Circuit Breakers](#12-circuit-breakers)
13. [Spam Detection Edge Cases](#13-spam-detection-edge-cases)
14. [Content Moderation Blind Spots](#14-content-moderation-blind-spots)
15. [Database Error Handling (Prisma)](#15-database-error-handling-prisma)
16. [Concurrent Operations & Race Conditions](#16-concurrent-operations--race-conditions)
17. [Token & Session Management](#17-token--session-management)
18. [Encryption & Data Masking](#18-encryption--data-masking)
19. [File Upload & Audio Processing](#19-file-upload--audio-processing)
20. [Feature Flag & Admin Operations](#20-feature-flag--admin-operations)

---

## 1. tRPC Error Handling & Middleware Chain

### 1.1 — Ordre de la chaîne de middleware : `withTracing` AVANT `isAuthenticated`
- **Scénario** : Vérifier que `withTracing` s'exécute même pour les procédures protégées où `isAuthenticated` throw (le tracing doit enregistrer les tentatives échouées)
- **Pre-conditions**: Session invalide ou absente
- **Étapes Playwright**:
  1. Lancer une requête tRPC `calls.history` sans session valide
  2. Vérifier que le middleware `withTracing` a bien été exécuté (log de `requestId` + `userId: undefined`)
  3. Vérifier que `withREDMetrics` enregistre l'échec (compteur d'erreurs incrémenté)
- **Pourquoi c'est important** : L'ordre publicProcedure = `withTracing` -> `withREDMetrics` -> `isAuthenticated` est délibéré. Si quelqu'un réordonne, le tracing pourrait sauter les erreurs d'auth.

### 1.2 — Erreur dans `withContentModeration` qui court-circuite `withRateLimit`
- **Scénario** : `withContentModeration` throw UN AUTHORIZED (pas de session) alors que `withRateLimit` n'a pas encore été exécuté — vérifier que le rate limit n'est PAS incrémenté pour une requête non-auth
- **Pre-conditions**: Aucune session, appel à `scenarios.create`
- **Étapes Playwright**:
  1. Envoyer 10 requêtes `scenarios.create` sans auth en parallèle
  2. Vérifier que le rate limit n'est pas atteint (20/heure sur create)
  3. Vérifier que CHAQUE requête retourne UNAUTHORIZED, pas TOO_MANY_REQUESTS
- **Pourquoi c'est important** : `withContentModeration` est exécuté APRÈS `withRateLimit`. Si l'ordre change, un attaquant peut consommer le rate limit sans auth.

### 1.3 — `withRateLimit` avec Redis down → fallback in-memory
- **Scénario** : Redis indisponible, le fallback in-memory prend le relais. Mais en multi-instance, le compteur est PER INSTANCE.
- **Pre-conditions**: Redis down, application déployée sur 3 instances
- **Étapes Playwright**:
  1. Simuler Redis down (stopper le service Redis)
  2. Envoyer 20 requêtes `calls.start` depuis 3 instances différentes
  3. Vérifier que plus de 20 requêtes passent (3 instances × 20 = 60)
  4. Vérifier que le log `"Redis rate limit failed — falling back to in-memory"` n'apparaît qu'UNE FOIS (variable `redisUnavailableLogged`)
- **Pourquoi c'est important** : Le rate limit est effectivement multiplié par le nombre d'instances. Un attaquant peut exploiter ce trou.

### 1.4 — `redisUnavailableLogged` global → logging silencieux après première erreur
- **Scénario** : Variable module-level `let redisUnavailableLogged = false` — une fois `true`, plus aucun warning n'est loggé même si Redis revient puis re-crash
- **Pre-conditions**: Redis crash → revient → re-crash
- **Étapes Playwright**:
  1. Redis down → vérifier log "Redis rate limit failed"
  2. Redis up → envoyer requête OK
  3. Redis down → vérifier que AUCUN nouveau log n'apparaît (variable toujours `true`)
- **Pourquoi c'est important** : Perte de visibilité sur les dégradations récurrentes. Le SRE ne voit pas que Redis re-crashe.

### 1.5 — Rate limit qui expire PENDANT une requête longue
- **Scénario** : Une procédure prend 5 secondes (ex: `generateScript` avec IA). Le rate limit Redis a une fenêtre de 1h. Mais si la fenêtre expire pendant l'exécution, le compteur est réinitialisé avant la fin.
- **Pre-conditions**: Fenêtre rate limit courte (ex: 1 seconde)
- **Étapes Playwright**:
  1. Créer un rate limit de test avec window=1s
  2. Envoyer une requête qui prend 2s (simuler latence IA)
  3. Pendant l'exécution, attendre 1.5s
  4. Envoyer une seconde requête — elle pourrait passer si la première n'a pas encore enregistré le `zadd`
- **Pourquoi c'est important** : TOCTOU (Time-of-check Time-of-use) dans `zcount` avant `zadd`. Si la fenêtre expire entre les deux, le compteur est réinitialisé.

### 1.6 — Procédure protégée avec session partiellement invalide (userId présent mais role absent)
- **Scénario** : Session JWT avec `user.id` présent mais `user.role` absent — `isAdmin` check `ctx.session?.user?.role !== "ADMIN"` — mais si `role` est `undefined`, l'expression est `true` et donc FORBIDDEN est throw. Vérifier ce comportement.
- **Pre-conditions**: Session JWT avec `{ user: { id: "abc", email: "test@test.com" } }` (sans rôle)
- **Étapes Playwright**:
  1. Forger un token JWT avec `user.id` mais sans `role`
  2. Appeler `admin.moderationQueue`
  3. Vérifier FORBIDDEN (et pas UNAUTHORIZED ni crash 500)
- **Pourquoi c'est important** : Protection contre les tokens mal formés. Ne doit pas crasher avec un `undefined` comparison.

### 1.7 — Error formatting : TRPCError personnalisé avec message non traduit
- **Scénario** : Vérifier que TOUS les messages d'erreur TRPCError sont en français. Certains middlewares (`withContentModeration`) utilisent des messages en anglais : `"Authentication required for content moderation"`
- **Pre-conditions**: Appel à une procédure avec `withContentModeration` sans auth
- **Étapes Playwright**:
  1. Envoyer `scenarios.create` sans auth
  2. Vérifier le message d'erreur
  3. Vérifier qu'il est en français (cohérence avec le reste de l'app)
- **Pourquoi c'est important** : Incohérence i18n — le message `"Authentication required for content moderation"` est en anglais alors que toutes les autres erreurs sont en français.

### 1.8 — Erreur Prisma P2002 (unique constraint) → transformé en CONFLICT ? Pas toujours.
- **Scénario** : Dans `auth.register`, si l'email existe déjà, c'est géré via `findUnique` préalable. Mais si le `create` Prisma throw P2002 (race condition), l'errorFormatter de tRPC ne le traduit PAS en CONFLICT — il leak le message brut Prisma.
- **Pre-conditions**: Deux inscriptions simultanées avec le même email
- **Étapes Playwright**:
  1. Envoyer 2 requêtes `auth.register` avec le même email en parallèle
  2. Vérifier que ni l'une ni l'autre ne crash avec une erreur Prisma brute
  3. Vérifier qu'au moins une retourne CONFLICT (pas INTERNAL_SERVER_ERROR)
- **Pourquoi c'est important** : Race condition sur `findUnique` → `create`. La deuxième insertion throw P2002 qui n'est pas catchée dans `auth.ts`.

### 1.9 — Timeout de procédure (30s Next.js) → 504 vs 500
- **Scénario** : Les procédures longues (`generateScript` avec IA, `start` avec Twilio) peuvent dépasser le timeout Next.js de 30s (ou 60s sur Pro). Vérifier le comportement.
- **Pre-conditions**: Procédure qui prend > 30s
- **Étapes Playwright**:
  1. Envoyer `scenarios.generateScript` avec un payload qui force un timeout IA
  2. Attendre 35s
  3. Vérifier que la réponse est 504 (Gateway Timeout) et pas 500
  4. Vérifier que le message est cohérent
- **Pourquoi c'est important** : Next.js retourne 504 par défaut, mais tRPC pourrait retourner 500 si le handler catch l'erreur.

### 1.10 — `isOriginAllowed` avec URL malformée (`not-a-url`) → `try/catch` retourne `false`
- **Scénario** : `new URL(origin)` throw sur `"not-a-url"`. Le catch retourne `false`, donc l'origine est rejetée. Mais le `validateCSRF` ne distingue pas entre "origine non autorisée" et "origine malformée".
- **Pre-conditions**: Header `Origin: not-a-url`
- **Étapes Playwright**:
  1. Envoyer une mutation tRPC avec `Origin: not-a-url`
  2. Vérifier retour FORBIDDEN (403)
  3. Vérifier le message : `"Requête rejetée — origine non autorisée"` (pas clair que le format soit invalide)
- **Pourquoi c'est important** : Le message d'erreur ne permet pas de diagnostiquer le problème. Un client légitime avec un header Origin malformé ne saura pas quoi corriger.

### 1.11 — CSRF bypass via méthodes autres que POST (PUT/DELETE/PATCH)
- **Scénario** : `createTRPCContext` ne vérifie CSRF que sur `opts.req.method === "POST"`. tRPC expose aussi des mutations via PUT/DELETE etc. En production, `allowMissingOrigin: false`, mais seulement pour POST.
- **Pre-conditions**: Production, mutation via PUT
- **Étapes Playwright**:
  1. Envoyer une mutation tRPC avec méthode PUT
  2. Ne PAS inclure le header Origin
  3. Vérifier que la requête réussit (CSRF bypassé)
- **Pourquoi c'est important** : La protection CSRF est contournable en changeant simplement la méthode HTTP. C'est le **Bug B11** de SCENARIOS_MANQUANTS.md, confirmé par le code.

### 1.12 — `allowMissingOrigin` en production → `NODE_ENV` non défini
- **Scénario** : Si `process.env['NODE_ENV']` n'est pas défini (ou est autre chose que "production"), `allowMissingOrigin` est `true`. En staging avec `NODE_ENV=staging`, la protection CSRF est désactivée.
- **Pre-conditions**: `NODE_ENV=staging`
- **Étapes Playwright**:
  1. Envoyer une mutation avec `NODE_ENV=staging` et sans Origin header
  2. Vérifier que la requête réussit (CSRF bypassé en staging)
- **Pourquoi c'est important** : Les environnements de staging/staging sont rarement configurés avec des vrais tokens CSRF. C'est une vulnérabilité connue.

---

## 2. Routes API Edge Cases

### 2.1 — Route `/api/trpc` avec procédure inexistante → erreur formatée
- **Scénario** : Appeler `api.inexistent.procedure` via tRPC. Vérifier le format d'erreur.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Envoyer une requête POST à `/api/trpc` avec `{ "0": { "procedure": "inexistent.procedure" } }`
  2. Vérifier que la réponse a le format tRPC standard (`error.message`, `error.code`)
  3. Vérifier que l'erreur est NOT_FOUND (code -32004) et pas 404 HTTP
- **Pourquoi c'est important** : Vérifier que tRPC gère correctement les routes inconnues sans leak d'infrastructure.

### 2.2 — Route `/api/trpc` avec body JSON invalide → 400
- **Scénario** : Envoyer un body malformé (pas du JSON, ou JSON invalide)
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Envoyer POST à `/api/trpc` avec `Content-Type: application/json` et body `{invalid json`
  2. Vérifier status 400
  3. Vérifier que le message d'erreur n'est pas un stack trace
- **Pourquoi c'est important** : Next.js pourrait leak des détails de parsing JSON.

### 2.3 — Route `/api/auth/session` avec cookie de session invalide (JWT malformé/tamperé)
- **Scénario** : Envoyer un cookie session_token avec un JWT signé avec une clé différente
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Forger un cookie `session_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJhYmMifQ.tampered`
  2. Envoyer GET à `/api/auth/session` avec ce cookie
  3. Vérifier que la réponse est `null` (pas de crash 500)
- **Pourquoi c'est important** : Un JWT invalide ne doit pas crasher le handler. Actuellement, la route catch `error` et retourne 500 — vérifier que c'est bien `null`.

### 2.4 — Paramètres de requête SQL injectés dans les URLs
- **Scénario** : Les paramètres de recherche (`?sort=`, `?cursor=`) pourraient contenir des tentatives d'injection. Prisma protège, mais vérifier le comportement.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Appeler `scenarios.feed` avec `sort=CHRONOLOGICAL; DROP TABLE users;--`
  2. Vérifier que l'API retourne une erreur Zod (validation échouée) et pas une erreur SQL
  3. Appeler avec `cursor=1' OR '1'='1`
  4. Vérifier que la pagination ne leak pas de données
- **Pourquoi c'est important** : Prisma est immunisé, mais tester que Zod catch avant Prisma.

### 2.5 — Headers HTTP malveillants : `x-request-id` avec path traversal
- **Scénario** : `sanitizeRequestId` nettoie les caractères non autorisés, mais le résultat est utilisé dans les logs et potentiellement dans des métriques. Tester les valeurs limites.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Envoyer requête avec `x-request-id: ../../../etc/passwd`
  2. Vérifier que `sanitizeRequestId` supprime les `/` et `.`
  3. Vérifier que le résultat est tronqué à 64 caractères
- **Pourquoi c'est important** : Log injection via header. `sanitizeRequestId` filtre bien, mais tester la robustesse.

### 2.6 — Route `/api/og` avec scénario PRIVATE → 404
- **Scénario** : Le handler OG ne cherche que les scénarios PUBLIC + APPROVED. Donc un scénario PRIVATE retourne 404. Vérifier qu'il n'y a pas de différence temporelle entre scénario inexistant et scénario privé.
- **Pre-conditions**: Un scénario PUBLIC existe, un scénario PRIVATE existe, un ID inexistant
- **Étapes Playwright**:
  1. Appeler `/api/og?id={PRIVATE_ID}` → 404
  2. Appeler `/api/og?id={INEXISTANT_ID}` → 404
  3. Mesurer le temps de réponse des deux — ils doivent être similaires (pas de timing side-channel)
- **Pourquoi c'est important** : Timing attack pour distinguer "scénario privé" de "scénario inexistant".

### 2.7 — Route `/api/og` avec font CDN down → ImageResponse sans fallback ?
- **Scénario** : `AbortSignal.timeout(5000)` sur le fetch de la police. Si le CDN ne répond pas, `interFont` reste `null` et `ImageResponse` utilise la police par défaut.
- **Pre-conditions**: Font CDN indisponible
- **Étapes Playwright**:
  1. Bloquer le domaine `fonts.gstatic.com` dans Playwright (route intercept)
  2. Appeler `/api/og?id={VALID_ID}`
  3. Vérifier que l'image est générée (status 200, type image/png)
  4. Vérifier que le fallback `sans-serif` est utilisé (pas de crash)
- **Pourquoi c'est important** : Résilience du générateur OG face à un CDN externe défaillant.

### 2.8 — Route `/api/og` avec crash → fallback avatar + redirect 302
- **Scénario** : Si `ImageResponse` throw (ex: payload trop grand), le handler catch et essaie un redirect vers l'avatar du personnage. Si l'avatar n'existe pas non plus, retour 500.
- **Pre-conditions**: Scénario avec très long titre
- **Étapes Playwright**:
  1. Créer un scénario avec un titre de 200 caractères
  2. Appeler `/api/og?id={SCENARIO_ID}`
  3. Vérifier que le handler ne crash pas (doit gérer le fallback)
- **Pourquoi c'est important** : L'ImageResponse de Vercel a des limites de taille. Tester le comportement dégradé.

### 2.9 — Webhook rate limit "twilio:voice:init" → par IP uniquement (perIp: true)
- **Scénario** : 30 req/min par IP pour l'init. Plusieurs appels simultanés depuis la même IP (NAT) peuvent être bloqués.
- **Pre-conditions**: Même IP publique pour plusieurs utilisateurs (NAT d'entreprise)
- **Étapes Playwright**:
  1. Simuler 30 requêtes POST à `/api/webhooks/twilio/voice` depuis la même IP
  2. Vérifier que la 31ème retourne 429
  3. Simuler la même requête depuis une IP différente
  4. Vérifier qu'elle réussit (rate limit par IP, pas global)
- **Pourquoi c'est important** : Sous NAT, tous les utilisateurs partagent la même IP et pourraient être bloqués collectivement.

### 2.10 — Healthcheck : DB down → status 503 "degraded"
- **Scénario** : La base de données est indisponible mais Redis fonctionne. Le healthcheck retourne `status: "degraded"` avec `checks: { database: "unhealthy", redis: "healthy" }`.
- **Pre-conditions**: DB stoppe
- **Étapes Playwright**:
  1. Stopper la base de données
  2. GET `/api/health`
  3. Vérifier `status: "degraded"` (pas "healthy", pas "unhealthy")
  4. Vérifier status HTTP 503
  5. Vérifier `checks.database === "unhealthy"`
- **Pourquoi c'est important** : Le healthcheck est utilisé par les orchestrators. Un mauvais status peut faire redémarrer l'instance inutilement.

---

## 3. Permissions & Authorization

### 3.1 — IDOR : Utilisateur A accède aux appels de l'utilisateur B via `calls.replay`
- **Scénario** : `calls.replay` vérifie `call.userId !== ctx.session.user.id`. Mais si l'utilisateur A connaît l'UUID d'un call de l'utilisateur B, la vérification est stricte.
- **Pre-conditions**: Utilisateur A connecté, UUID d'un call de l'utilisateur B
- **Étapes Playwright**:
  1. Connecter utilisateur A
  2. Appeler `calls.replay({ callId: "{UUID_CALL_B}" })`
  3. Vérifier FORBIDDEN (403)
  4. Vérifier que le message est "Cet appel ne vous appartient pas"
  5. Vérifier qu'il n'y a PAS de différence temporelle entre "call inexistant" et "call d'un autre utilisateur" (timing side-channel)
- **Pourquoi c'est important** : L'IDOR est le risque #1 des APIs REST/tRPC. Ici, la vérification est correcte — mais tester la robustesse temporelle.

### 3.2 — Mass assignment : Envoyer des champs non prévus dans `scenarios.create`
- **Scénario** : Zod accepte `characterId`, `title`, `description`, `openingMessage`, `aiInstructions`, `visibility`. Envoyer `creatorRole: "ADMIN"` ou `playCount: 999999` ne doit pas passer.
- **Pre-conditions**: Utilisateur connecté
- **Étapes Playwright**:
  1. Envoyer `scenarios.create` avec des champs supplémentaires : `{ "creatorRole": "ADMIN", "playCount": 999999, ...validFields }`
  2. Vérifier que Zod filtre les champs inconnus (`strict` object ?)
  3. Vérifier que `playCount` est bien 0 après création
- **Pourquoi c'est important** : Zod `object()` par défaut permet des champs supplémentaires. Si `z.strictObject()` n'est pas utilisé, les champs inconnus sont ignorés silencieusement — mais pourraient être utilisés si un jour le modèle Prisma les expose.

### 3.3 — Admin impersonation : Un user USER devient ADMIN via manipulation
- **Scénario** : `isAdmin` vérifie `ctx.session?.user?.role !== "ADMIN"`. Si un attaquant modifie son token JWT pour inclure `role: "ADMIN"`, la vérification passe.
- **Pre-conditions**: Token JWT falsifié avec `role: "ADMIN"`
- **Étapes Playwright**:
  1. Forger un token JWT avec `{ user: { id: "...", role: "ADMIN", ... } }`
  2. Appeler `admin.featureScenario` avec ce token
  3. Vérifier que la requête est rejetée (FORBIDDEN ou UNAUTHORIZED)
  4. Si le token est signé avec NextAuth, la falsification est détectée
- **Pourquoi c'est important** : Tester que la signature JWT est bien vérifiée (côté auth()). Un token falsifié ne doit pas passer le guard.

### 3.4 — Scénario PRIVATE accessible via l'ID si on connaît l'UUID
- **Scénario** : `scenarios.getById` vérifie les permissions via `permissionConditions`. Un utilisateur non créateur ne peut PAS voir un scénario PRIVATE. Mais un utilisateur non auth ? Il ne peut voir que PUBLIC.
- **Pre-conditions**: Scénario PRIVATE existant, utilisateur non connecté
- **Étapes Playwright**:
  1. Appeler `scenarios.getById({ id: "{PRIVATE_SCENARIO_ID}" })` sans auth
  2. Vérifier que le retour est `null` (et pas 404)
  3. Connecter le créateur
  4. Appeler la même procédure
  5. Vérifier que le scénario est retourné
- **Pourquoi c'est important** : La politique d'accès est correcte — mais vérifier que l'absence de scénario n'est pas distinguable d'un "PRIVATE" (timing side-channel).

### 3.5 — Call d'un autre utilisateur via `calls.listByScenario`
- **Scénario** : `calls.listByScenario` filtre par `userId: ctx.session.user.id`. Donc même si on connaît un `scenarioId`, on ne voit que ses propres appels.
- **Pre-conditions**: Utilisateur A a appelé scénario X, utilisateur B connecté
- **Étapes Playwright**:
  1. Connecter utilisateur B
  2. Appeler `calls.listByScenario({ scenarioId: "{X}" })`
  3. Vérifier que les appels de l'utilisateur A ne sont PAS visibles
- **Pourquoi c'est important** : Vérifier que le filtre `userId` est bien appliqué.

### 3.6 — Procédure publique qui expose des données protégées
- **Scénario** : `scenarios.feed` est publique mais ne retourne que les scénarios PUBLIC + APPROVED. Vérifier qu'aucun scénario PRIVATE ou UNLISTED n'est leaké.
- **Pre-conditions**: Scénario UNLISTED existant
- **Étapes Playwright**:
  1. Appeler `scenarios.feed` sans auth
  2. Vérifier qu'aucun résultat n'a `visibility: "PRIVATE"` ou `visibility: "UNLISTED"`
  3. Tester avec pagination (`cursor`) pour s'assurer que TOUS les résultats respectent le filtre
- **Pourquoi c'est important** : Le filtre `visibility: "PUBLIC"` est dans le `where` — vérifier qu'il n'est pas contourné par la pagination.

### 3.7 — Procédure protégée qui pourrait être appelée sans auth via `publicProcedure` mal configuré
- **Scénario** : Dans `procedures.ts`, toutes les procédures sont soit `publicProcedure` soit `protectedProcedure`. Vérifier qu'aucune procédure sensible n'utilise `publicProcedure` par erreur.
- **Pre-conditions**: Revue de toutes les procédures
- **Étapes Playwright**:
  1. Pour chaque procédure dans admin.ts, vérifier qu'elle utilise `adminProcedure`
  2. Pour `profile.deleteMyAccount`, vérifier `protectedProcedure`
  3. Pour `billing.getPurchases`, vérifier `protectedProcedure`
- **Pourquoi c'est important** : Une configuration erronée (publique au lieu de protégée) exposerait des données sensibles.

### 3.8 — MODERATOR role : vérifier les permissions vs ADMIN
- **Scénario** : `isAdmin` vérifie `role !== "ADMIN"` donc MODERATOR n'est PAS autorisé sur les procédures admin. Mais MODERATOR peut accéder à `moderationQueue`, `approveScenario`, etc ? Oui, via le guard de `scenarios.ts` qui vérifie `userRole === "ADMIN" || userRole === "MODERATOR"`.
- **Pre-conditions**: Utilisateur avec rôle MODERATOR
- **Étapes Playwright**:
  1. Connecter un utilisateur MODERATOR
  2. Appeler `admin.moderationQueue` → FORBIDDEN (utilise `adminProcedure`)
  3. Appeler `scenarios.getById` sur un scénario PENDING → OK (vérifie MODERATOR)
- **Pourquoi c'est important** : Les MODERATOR peuvent modérer via l'API publique mais pas via l'API admin. Incohérence potentielle — ils doivent modérer via l'interface publique.

---

## 4. API Versioning

### 4.1 — Procédure v1 qui existe mais pas v2 (et vice versa)
- **Scénario** : Comparer les signatures v1 et unversioned. `scenariosV1Router.create` n'a PAS `detectScenarioSpam` contrairement au unversioned. Vérifier la divergence.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Appeler `v1.scenarios.create` avec des données spammées
  2. Vérifier que le spam n'est PAS détecté (comportement v1 legacy)
  3. Appeler `scenarios.create` (unversioned) avec les mêmes données
  4. Vérifier que le spam EST détecté
- **Pourquoi c'est important** : Les clients v1 contournent la détection de spam. C'est une régression de sécurité potentielle.

### 4.2 — Différence structure de retour entre v1 et v2 : `characters.list`
- **Scénario** : Vérifier que les structures de retour entre v1 et unversioned sont identiques pour les procédures "frozen".
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Appeler `characters.list` (unversioned)
  2. Appeler `v1.characters.list`
  3. Comparer les structures JSON — elles doivent être strictement identiques
- **Pourquoi c'est important** : Les contrats v1 sont "frozen". Si une différence apparaît, les clients v1 cassent silencieusement.

### 4.3 — Header X-API-Version manquant → version "latest"
- **Scénario** : `resolveApiVersion` retourne "latest" si aucun header. Le handler sélectionne `appRouter` (unversioned). Vérifier le comportement par défaut.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Appeler `/api/trpc` sans header `x-api-version`
  2. Vérifier que le comportement est identique à `x-api-version: latest`
  3. Vérifier qu'aucun log `"Versioned request"` n'apparaît
- **Pourquoi c'est important** : Le comportement par défaut doit être stable et prévisible.

### 4.4 — Version inconnue (`x-api-version: v3`) → fallback "latest" (pas 400)
- **Scénario** : `resolveApiVersion` retourne "latest" pour les versions inconnues. Donc `v3` est traité comme "latest" silencieusement.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Envoyer requête avec `x-api-version: v3`
  2. Vérifier que le handler ne retourne PAS une erreur
  3. Vérifier que le comportement est identique à "latest"
  4. Vérifier qu'aucun log ne mentionne "v3"
- **Pourquoi c'est important** : Un client avec une version invalide ne reçoit PAS d'erreur. Il pourrait penser qu'il utilise v3 alors qu'il utilise latest.

### 4.5 — `accept-version` header legacy
- **Scénario** : `resolveApiVersion` check aussi `accept-version` comme fallback. Mais l'ordre est `x-api-version` > `accept-version` > "latest".
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Envoyer requête avec `accept-version: v1` sans `x-api-version`
  2. Vérifier que le handler utilise v1
  3. Envoyer requête avec `x-api-version: v2` ET `accept-version: v1`
  4. Vérifier que v2 prend le dessus (priorité au header spécifique)
- **Pourquoi c'est important** : La priorité des headers doit être documentée et testée.

### 4.6 — `withVersioning` middleware vs `resolveApiVersion` — deux mécanismes différents
- **Scénario** : Il y a DEUX mécanismes de versioning : `resolveApiVersion` dans le handler (header-based) et `withVersioning` middleware (header + path-based). Ils peuvent diverger.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Appeler `v1.scenarios.feed` via tRPC (path-based versioning)
  2. Vérifier que `ctx.apiVersion` est "v1"
  3. Appeler `scenarios.feed` avec `x-api-version: v1`
  4. Vérifier que `ctx.apiVersion` est "v1" aussi
  5. Comparer les résultats des deux appels
- **Pourquoi c'est important** : Deux mécanismes de versioning = deux sources de vérité potentielles.

---

## 5. Twilio Telephony Deep Dive

### 5.1 — Appel entrant : la route `voice/route.ts` ne gère PAS GET pour l'init
- **Scénario** : Twilio appelle POST sur le voice webhook. Mais le handler GET existe (health check qui retourne `{ active: false }`). Si Twilio appelle GET par erreur (mauvaise config), ça retourne `active: false` et pas du TwiML.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. GET `/api/webhooks/twilio/voice?token=xxx`
  2. Vérifier retour `{ active: false }` (JSON, pas TwiML)
  3. Vérifier qu'un POST normal retourne du TwiML
- **Pourquoi c'est important** : Si Twilio est mal configuré (GET au lieu de POST), l'appel échoue silencieusement. Le test documente ce comportement.

### 5.2 — Timeout d'appel (>30 min) avec `statusCallback` qui arrive APRÈS le hangup
- **Scénario** : Twilio timeout après `maxDurationSeconds` (défaut 300s, max 3600s). Le `statusCallback` "completed" arrive. Mais si l'état Redis a déjà expiré (CONVERSATION_TTL_S = 30 min), `handleCompletedCall` ne trouve pas l'état.
- **Pre-conditions**: Appel qui dure > 30 minutes, Redis TTL expire
- **Étapes Playwright**:
  1. Initier un appel avec `maxDurationSeconds: 3600`
  2. Attendre que Redis TTL expire (30 min — difficile en E2E, simuler avec `CONVERSATION_TTL_S=1`)
  3. Simuler l'arrivée du webhook `completed`
  4. Vérifier que `getConversationState` retourne `null`
  5. Vérifier que l'appel est marqué COMPLETED (via `findUnique` sur `twilioCallSid`)
  6. Vérifier que la transcription n'a pas de messages (state null → transcript null)
- **Pourquoi c'est important** : Les conversations longues perdent leur état Redis. La transcription des premiers tours est perdue.

### 5.3 — Transcription Deepgram qui arrive APRÈS le webhook completed
- **Scénario** : Le webhook completed fetch l'enregistrement et le transcrit SYNC. Si Deepgram prend > 30s (gros fichier), le webhook Twilio timeout (10s default ?) et Twilio retry. Double traitement potentiel.
- **Pre-conditions**: Enregistrement long (> 5 min)
- **Étapes Playwright**:
  1. Simuler un webhook `completed` avec un `RecordingUrl` pointant vers un long fichier audio
  2. Vérifier que le handler ne timeout pas
  3. Vérifier l'idempotence : si Twilio renvoie le même webhook, le handler détecte `status === "COMPLETED"` et skip
- **Pourquoi c'est important** : Le fetch et la transcription sont SYNC dans le webhook handler. Si ça prend trop longtemps, Twilio retry.

### 5.4 — Media Streams (WebSocket) — Phase 1 stub retourne hangup
- **Scénario** : La route `stream` est un stub qui retourne `<Hangup/>`. Si Twilio est configuré pour utiliser Media Streams, l'appel est immédiatement terminé.
- **Pre-conditions**: Twilio configuré pour utiliser `/api/webhooks/twilio/voice/stream`
- **Étapes Playwright**:
  1. Initier un appel
  2. Intercepter la requête POST vers `/api/webhooks/twilio/voice/stream`
  3. Vérifier que la réponse est du TwiML avec `<Hangup/>`
  4. Vérifier que l'appel est marqué FAILED ou COMPLETED
- **Pourquoi c'est important** : Si quelqu'un active Media Streams dans Twilio sans implémenter le handler, tous les appels échouent.

### 5.5 — Goodbye detector — faux positif
- **Scénario** : `detectGoodbye` utilise des regex avec `\b` word boundaries. Mais `"salutations"` contient `"salut"` suivi de lettres. Avec le pattern Unicode `(?<![\\p{L}\\p{N}_])salut(?![\\p{L}\\p{N}_])`, `"salutations"` ne match PAS. Mais `"dis salut"` match.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Tester `"salutations à tous"` → ne doit PAS détecter goodbye
  2. Tester `"je dis salut"` → doit détecter goodbye
  3. Tester `"merci beaucoup"` → doit détecter goodbye (mot "merci" dans la liste)
  4. Tester `"je vous remercie"` → doit détecter goodbye
  5. Tester `"merciere"` → ne doit PAS détecter (le mot "merci" fait partie de "merciere")
- **Pourquoi c'est important** : Les faux positifs coupent prématurément la conversation. Le détecteur utilise `\p{L}` (Unicode) pour les boundaries — vérifier son comportement avec des mots composés.

### 5.6 — Goodbye detector — langues mélangées
- **Scénario** : `detectGoodbye` détecte l'anglais ET le français. Un utilisateur anglophone qui dit "goodbye" verra son appel terminé.
- **Pre-conditions**: Appel en anglais
- **Étapes Playwright**:
  1. Simuler l'input "goodbye" dans le handle-input
  2. Vérifier que l'appel est terminé
  3. Vérifier que le message d'au revoir est en français `"Merci pour cette conversation. Au revoir!"` (pas en anglais)
- **Pourquoi c'est important** : Le message d'au revoir est toujours en français même si l'utilisateur parle anglais.

### 5.7 — Cost credits — arrondi Math.ceil quand duration = 0
- **Scénario** : `Math.max(1, Math.ceil(duration / 60))`. Si `duration = 0` (pas de durée retournée par Twilio), `Math.ceil(0/60) = 0`, donc `Math.max(1, 0) = 1`. Minimum 1 crédit.
- **Pre-conditions**: Appel avec `callDuration` absent ou "0"
- **Étapes Playwright**:
  1. Simuler un webhook completed sans `CallDuration`
  2. Vérifier `costCredits` calculé : minimum 1
  3. Vérifier que 1 crédit est débité (et pas 0)
- **Pourquoi c'est important** : Un appel sans durée ne devrait pas coûter de crédit, mais le code garantit minimum 1. Est-ce intentionnel ?

### 5.8 — État Redis expiré PENDANT un appel actif
- **Scénario** : `CONVERSATION_TTL_S = 30 * 60` (30 min). Si l'appel dure plus longtemps, l'état expire en plein milieu. `getConversationState` retourne `null` → le handle-input répond "Désolé, la conversation a expiré" et raccroche.
- **Pre-conditions**: Appel > 30 min
- **Étapes Playwright**:
  1. Initier un appel
  2. Simuler l'expiration de Redis TTL (possible en test unitaire)
  3. Envoyer un input speech
  4. Vérifier que le handler retourne "Désolé, la conversation a expiré. Veuillez rappeler pour continuer." + hangup
- **Pourquoi c'est important** : Limite invisible de 30 min. L'utilisateur est coupé sans explication claire.

### 5.9 — ScenarioId mismatch entre token et Redis (possible tampering)
- **Scénario** : `handle-input` vérifie la cohérence entre le `scenarioId` du token HMAC et celui stocké dans Redis. Si mismatch, l'appel est rejeté avec "Erreur de conversation".
- **Pre-conditions**: Token HMAC modifié ou mixé entre deux appels
- **Étapes Playwright**:
  1. Initier un appel pour le scénario A
  2. Prendre le token du scénario A
  3. L'utiliser pour un appel du scénario B (modifier le token)
  4. Vérifier que la conversation est rejetée
- **Pourquoi c'est important** : C'est une protection contre le détournement de session. Tester qu'elle fonctionne.

### 5.10 — `resolveVoiceId` retourne "" si characterId = "unknown"
- **Scénario** : Dans `handle-input`, si le token est invalide ou absent, `characterId = "unknown"`. `resolveVoiceId("unknown")` retourne `""`. Donc `ttsClient && voiceId` est `false` → pas de synthèse vocale.
- **Pre-conditions**: Token invalide ou absent
- **Étapes Playwright**:
  1. Initier un appel
  2. Modifier le token pour qu'il soit invalide
  3. Vérifier que `voiceId` est `""`
  4. Vérifier que le handler utilise `twiml.say()` au lieu de `twiml.play()`
- **Pourquoi c'est important** : Fallback transparent — la voix IA est remplacée par une voix générique. L'utilisateur ne sait pas pourquoi.

### 5.11 — `initiateCall` avec Twilio circuit breaker OPEN
- **Scénario** : `twilioCircuitBreaker` est utilisé dans `initiateCall`. Si le circuit est OPEN (trop d'échecs Twilio), les appels sont immédiatement refusés.
- **Pre-conditions**: Circuit breaker OPEN (Twilio en échec)
- **Étapes Playwright**:
  1. Simuler des échecs Twilio pour ouvrir le circuit breaker
  2. Initier un nouvel appel
  3. Vérifier que `twilioCircuitBreaker.call(() => ...)` throw immédiatement
  4. Vérifier que l'appel est marqué FAILED avec refund
  5. Vérifier que le message d'erreur est "Échec de l'appel" (pas "Circuit breaker open")
- **Pourquoi c'est important** : Le message d'erreur ne mentionne pas le circuit breaker. L'utilisateur ne comprend pas pourquoi l'appel échoue.

### 5.12 — `withRetry` dans `initiateCall` — 2 tentatives, baseDelay 1s, maxDelay 5s
- **Scénario** : `initiateCall` utilise `withRetry(() => twilioClient.calls.create(...), 2, 1000, 5000)`. Donc 1 tentative + 1 retry avec 1-2s de délai.
- **Pre-conditions**: Twilio API instable (1er appel échoue, 2ème réussit)
- **Étapes Playwright**:
  1. Simuler une erreur Twilio sur le premier appel
  2. Vérifier que le second appel réussit après le délai
  3. Vérifier que l'appel est marqué RINGING (pas FAILED)
- **Pourquoi c'est important** : Le retry masque les erreurs transitoires. Mais si les deux échouent, le refund est atomique.

### 5.13 — Token HMAC expiré dans le voice webhook
- **Scénario** : Le token HMAC créé par `createTwilioToken` n'a PAS de TTL explicite (pas d'expiration). Un token volé est valide indéfiniment.
- **Pre-conditions**: Token HMAC volé
- **Étapes Playwright**:
  1. Intercepter le token HMAC d'un appel
  2. Attendre 24h
  3. Utiliser le token pour initier une conversation
  4. Vérifier si le token est toujours valide
- **Pourquoi c'est important** : Les tokens HMAC sans expiration sont des risques de sécurité. Vérifier s'il y a une expiration implicite (ex: via le `callId` qui référence un call qui n'existe plus).

### 5.14 — `encryptPhoneNumber` vs legacy plaintext dans `getCallerNumber`
- **Scénario** : `getCallerNumber` essaie `decryptPhoneNumber` et si ça throw, retourne le numéro en clair (legacy format). Pendant la transition de déploiement, les numéros peuvent être en clair.
- **Pre-conditions**: Conversation state avec `callerNumber` en clair (pas encrypté)
- **Étapes Playwright**:
  1. Lire l'état Redis d'une conversation legacy
  2. Vérifier que `callerNumber` est stocké en clair
  3. Vérifier que `getCallerNumber` retourne le numéro en clair sans erreur
- **Pourquoi c'est important** : Pendant la transition, les numéros de téléphone sont en clair dans Redis. Vérifier la durée de cette fenêtre.

### 5.15 — `callRepository.updateStatusWithGuard` — race condition sur le statut
- **Scénario** : `updateStatusWithGuard` vérifie que le statut actuel est "CALLING" avant de passer à "RINGING". Si deux webhooks arrivent en même temps, un seul passe.
- **Pre-conditions**: Deux webhooks concurrents
- **Étapes Playwright**:
  1. Simuler deux webhooks `ringing` simultanés
  2. Vérifier qu'un seul update réussit
  3. Vérifier que le second update échoue (pas de crash)
- **Pourquoi c'est important** : La guard condition est correcte pour éviter les transitions d'état invalides.

---

## 6. Webhook Edge Cases

### 6.1 — Stripe webhook avec body > 100KB
- **Scénario** : `contentLength > 100_000` → retourne 413. Stripe n'envoie jamais de payload > 100KB normalement.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Envoyer POST à `/api/webhooks/stripe` avec `Content-Length: 100001` et un body de 100KB+
  2. Vérifier 413
  3. Vérifier le message "Requête trop volumineuse"
- **Pourquoi c'est important** : La limite est à 100KB, mais le `parseInt` de `content-length` pourrait être NaN (header absent) → `NaN > 100000` est `false`. Donc pas de limite si header absent.

### 6.2 — Stripe webhook sans `Content-Length` → body size non limité
- **Scénario** : Si le header `content-length` est absent, `NaN > 100_000` = `false`. Donc la limite n'est pas appliquée.
- **Pre-conditions**: Header `content-length` absent
- **Étapes Playwright**:
  1. Envoyer POST à `/api/webhooks/stripe` SANS `Content-Length`
  2. Avec un très gros body (>100KB)
  3. Vérifier que la limite n'est PAS appliquée
- **Pourquoi c'est important** : La vérification `parseInt("")` = NaN, et `NaN > X` est toujours `false`. Donc le body size n'est pas limité si le header manque.

### 6.3 — Stripe webhook avec `content-length` non numérique
- **Scénario** : `parseInt("abc", 10)` = NaN. Même problème : limite non appliquée.
- **Pre-conditions**: Header `content-length: abc`
- **Étapes Playwright**:
  1. Envoyer POST à `/api/webhooks/stripe` avec `Content-Length: abc`
  2. Vérifier que `parseInt("abc")` = NaN
  3. `NaN > 100000` = false → limite non appliquée
- **Pourquoi c'est important** : Injection de header malveillant pour contourner la limite de taille.

### 6.4 — Stripe webhook idempotency : Redis down → pas de double protection
- **Scénario** : `checkIdempotency` retourne `false` si Redis est down. La protection contre les doublons repose sur la contrainte unique `stripePaymentId` dans la base de données.
- **Pre-conditions**: Redis down
- **Étapes Playwright**:
  1. Simuler Redis down
  2. Envoyer deux webhooks Stripe identiques
  3. Vérifier que le second est rejeté par la contrainte P2002 (et pas par l'idempotency)
  4. Vérifier que les crédits ne sont PAS ajoutés deux fois
- **Pourquoi c'est important** : La dégradation gracieuse fonctionne grâce à Prisma — mais tester que c'est bien le cas.

### 6.5 — Stripe webhook `checkout.session.completed` avec session.metadata vide
- **Scénario** : Si `session.metadata.userId` ou `session.metadata.credits` est manquant, le handler log une erreur et retourne 400.
- **Pre-conditions**: Session Stripe sans metadata
- **Étapes Playwright**:
  1. Simuler un événement `checkout.session.completed` sans metadata
  2. Vérifier 400 avec "Métadonnées manquantes"
- **Pourquoi c'est important** : Stripe peut envoyer des sessions sans metadata si le checkout est créé manuellement. Tester la résilience.

### 6.6 — Stripe webhook `charge.refunded` avec `payment_intent` absent
- **Scénario** : Le handler check `if (!paymentIntentId)` et break (ignore l'événement). Log un warning.
- **Pre-conditions**: Événement refund sans payment intent
- **Étapes Playwright**:
  1. Simuler `charge.refunded` avec un payload sans `payment_intent`
  2. Vérifier que le handler ne crash pas
  3. Vérifier que la réponse est 200 (l'événement est ignoré)
- **Pourquoi c'est important** : Les événements sans payment_intent sont ignorés silencieusement. Vérifier que ça ne cause pas d'incohérence.

### 6.7 — Twilio webhook status `completed` arrive AVANT le dernier stream message
- **Scénario** : Twilio envoie `status=completed` avant que le dernier `MediaStream` n'ait été traité. `handleCompletedCall` peut terminer la conversation pendant que le dernier message est encore en transit.
- **Pre-conditions**: Appel avec Media Streams
- **Étapes Playwright**:
  1. Simuler un webhook `completed` avec des messages encore en transit
  2. Vérifier que `deleteConversationState` est appelé
  3. Vérifier que les messages en transit sont perdus
- **Pourquoi c'est important** : Race condition entre le webhook de statut et les messages Media Streams. Le dernier tour de conversation peut être perdu.

### 6.8 — Twilio webhook DLQ : pushToDLQ avec Redis down
- **Scénario** : `pushToDLQ` log un warning et ne throw pas si Redis est down. Les webhooks échoués sont perdus.
- **Pre-conditions**: Redis down
- **Étapes Playwright**:
  1. Simuler Redis down
  2. Envoyer un webhook Stripe invalide
  3. Vérifier que `pushToDLQ` log un warning sans throw
  4. Vérifier que le handler retourne 400 (pas 500)
- **Pourquoi c'est important** : Les webhooks échoués sont perdus si Redis est down. Mais le handler continue de fonctionner.

### 6.9 — Twilio webhook : URL malveillante dans RecordingUrl (SSRF)
- **Scénario** : `validateRecordingUrl` vérifie que l'origine de l'URL est un domaine Twilio autorisé. Si `recordingUrl` pointe vers un serveur malveillant, le handler skip le fetch.
- **Pre-conditions**: Webhook Twilio avec `RecordingUrl` falsifié
- **Étapes Playwright**:
  1. Simuler un webhook avec `RecordingUrl: https://malicious-server.com/audio`
  2. Vérifier que `validateRecordingUrl` retourne `false`
  3. Vérifier que le handler log "Invalid RecordingUrl origin"
  4. Vérifier que l'appel est marqué COMPLETED sans enregistrement
- **Pourquoi c'est important** : Protection SSRF essentielle. Vérifier qu'elle fonctionne.

### 6.10 — Stripe webhook idempotency : `set` avec `nx: true` retourne `null` si déjà traité
- **Scénario** : Le check idempotency utilise `redis.set(key, "1", { nx: true, ex: ... })`. Si ça retourne `null`, l'événement est déjà traité. Mais si Redis est resurcité entre-temps, la clé disparaît.
- **Pre-conditions**: Redis restarted
- **Étapes Playwright**:
  1. Traiter un webhook Stripe (clé créée)
  2. Redis restart
  3. Envoyer le même webhook
  4. Vérifier que la clé N'EXISTE PLUS → l'idempotency ne fonctionne plus
  5. Vérifier que la contrainte P2002 protège contre le double traitement
- **Pourquoi c'est important** : L'idempotency Redis est transitoire. La vraie protection est la contrainte unique en base.

---

## 7. Cron Jobs & Background Jobs

### 7.1 — Cron `gdpr-purge` avec `CRON_SECRET` absent → 401
- **Scénario** : `process.env['CRON_SECRET'] ?? ''` — si la variable est absente, `expected` est `""`. Tout token → mismatch (sauf si token vide aussi).
- **Pre-conditions**: `CRON_SECRET` non défini
- **Étapes Playwright**:
  1. GET `/api/cron/gdpr-purge` avec `Authorization: Bearer any-token`
  2. Vérifier 401
  3. Vérifier que `expected` est `""` → `tokenBuf.length === 0` → `isValid = false`
- **Pourquoi c'est important** : Si `CRON_SECRET` est absent, AUCUN appel cron ne fonctionne. Tester le message d'erreur.

### 7.2 — Cron with Empty Authorization → `authHeader.slice(7)` sur chaîne non-Bearer
- **Scénario** : `authHeader.startsWith("Bearer ")` est false si le header est `Basic xxx`. `const token = authHeader.slice(7)` prend les caractères 7+ de `"Basic xxx"` → `" xxx"`. Token invalide.
- **Pre-conditions**: Header `Authorization: Basic base64token`
- **Étapes Playwright**:
  1. GET `/api/cron/gdpr-purge` avec `Authorization: Basic dGVzdDpwYXNz`
  2. Vérifier 401
  3. Vérifier que `token` = `" dGVzdDpwYXNz"` (normal car il n'y a pas de "Bearer " prefix)
- **Pourquoi c'est important** : Si un admin met un header Basic par erreur, le message d'erreur ne l'aide pas à comprendre pourquoi.

### 7.3 — Cron `cleanup-recordings` avec `maxDuration` = 300 (5 min) — AbortController
- **Scénario** : `AbortController` avec 5 min de timeout. Si le job dépasse, `controller.signal.aborted` est `true` et le handler retourne 504.
- **Pre-conditions**: Enregistrements > 5 min de nettoyage
- **Étapes Playwright**:
  1. Simuler un cleanup qui prend > 5 min (beaucoup d'enregistrements)
  2. Vérifier que le handler catch l'AbortError
  3. Vérifier retour 504 avec "Délai d'exécution dépassé"
  4. Vérifier que `clearTimeout` est bien appelé (pas de leak)
- **Pourquoi c'est important** : Le timeout de 5 min est défini dans `maxDuration = 300` ET dans `AbortController(300_000)`. Si les deux divergent, le comportement est incohérent.

### 7.4 — Cron `rotate-featured` avec timeout 30s → `AbortSignal.timeout` vs `setTimeout`
- **Scénario** : Deux mécanismes de timeout coexistent : `AbortController`/`setTimeout` et l'export `maxDuration`. Si le dépassement arrive, le handler catch `aborted` et retourne 504.
- **Pre-conditions**: Rotation qui prend > 30s
- **Étapes Playwright**:
  1. Simuler une rotation lente
  2. Vérifier que le handler catch l'erreur
  3. Vérifier que `clearTimeout` est appelé
- **Pourquoi c'est important** : Vérifier la cohérence entre les deux mécanismes de timeout.

### 7.5 — Lock Redis concurrent : deux crons simultanés
- **Scénario** : Actuellement, AUCUN lock Redis n'est implémenté pour les crons. Deux exécutions simultanées du même cron (ex: si Vercel Cron dépasse la prochaine exécution) peuvent s'exécuter en parallèle.
- **Pre-conditions**: Premier cron pas encore fini, deuxième cron démarré
- **Étapes Playwright**:
  1. Initier un cron `cleanup-recordings`
  2. Simuler une seconde exécution avant la fin de la première
  3. Vérifier que les deux s'exécutent en parallèle (pas de lock)
- **Pourquoi c'est important** : Sans lock, les batchs de purge peuvent manipuler les mêmes données simultanément.

### 7.6 — Batch cursor : purge par lots de 100 utilisateurs
- **Scénario** : `purgeAnonymizedUsers` utilise un curseur batch. Si le 1er lot échoue, les lots suivants ne sont pas traités.
- **Pre-conditions**: 150 utilisateurs à purger, 100 par lot
- **Étapes Playwright**:
  1. Simuler un échec sur le premier lot
  2. Vérifier que le reste n'est pas traité (rollback)
  3. Vérifier le retour du cron : `{ success: false, deletedUsers: 0 }`
- **Pourquoi c'est important** : Atomicité des batchs — si le premier batch échoue, tout le job échoue.

---

## 8. GDPR & Data Privacy

### 8.1 — Export de données massives (>10MB) → download réussi
- **Scénario** : `profile.exportData` peut générer un JSON > 10MB pour les utilisateurs avec beaucoup de données. Tester que le download ne timeout pas.
- **Pre-conditions**: Utilisateur avec 1000+ scénarios et appels
- **Étapes Playwright**:
  1. Créer un utilisateur avec beaucoup de données
  2. Appeler `profile.exportData`
  3. Vérifier que la réponse est bien un JSON téléchargeable
  4. Vérifier que la taille du JSON > 10MB
- **Pourquoi c'est important** : Les exports massifs peuvent timeout sur Vercel (30s). Vérifier les limites.

### 8.2 — Export après anonymisation (`deleted` user → NOT_FOUND)
- **Scénario** : `profile.exportData` cherche l'utilisateur par `ctx.session.user.id`. Mais si le compte est déjà anonymisé, la session peut encore être valide (token non invalidé).
- **Pre-conditions**: Compte supprimé mais session encore active
- **Étapes Playwright**:
  1. Supprimer un compte (anonymisation)
  2. Ne pas logout (le token JWT peut être encore valide)
  3. Appeler `profile.exportData`
  4. Vérifier NOT_FOUND (le user n'existe plus avec les critères de recherche)
- **Pourquoi c'est important** : La session peut survivre à la suppression du compte si `tokenVersion` n'est pas incrémenté correctement.

### 8.3 — Export via `/api/user/export` avec Origin non autorisé → 403
- **Scénario** : Le handler check `originUrl.origin !== appUrlObj.origin`. Mais si `origin` est absent, le check est sauté. Donc CSRF bypassé si pas d'Origin header.
- **Pre-conditions**: Requête sans Origin header
- **Étapes Playwright**:
  1. Envoyer POST à `/api/user/export` sans Origin header
  2. Vérifier que le check CSRF est sauté
  3. Vérifier que la requête est traitée normalement (après session check)
- **Pourquoi c'est important** : La protection CSRF de ce endpoint est plus laxiste que celle de tRPC.

### 8.4 — Export rate limit : updateMany optimiste lock → race condition
- **Scénario** : `updateMany` avec `WHERE gdprDataExportedAt < now - 1h` agit comme un lock optimiste. Mais deux requêtes simultanées peuvent toutes deux trouver la condition vraie avant que l'une n'update.
- **Pre-conditions**: Deux exports simultanés
- **Étapes Playwright**:
  1. Envoyer deux requêtes POST `/api/user/export` en parallèle
  2. Vérifier qu'au moins une retourne 429 (ou une échoue)
  3. Vérifier que les deux ne réussissent PAS toutes les deux
- **Pourquoi c'est important** : Le lock optimiste en READ COMMITTED peut laisser passer deux requêtes si elles arrivent exactement en même temps.

### 8.5 — Suppression de compte pendant un appel actif
- **Scénario** : `profile.deleteMyAccount` vérifie maintenant les appels actifs. Mais si l'utilisateur supprime son compte dans un onglet pendant que l'appel est actif dans un autre, la vérification est correcte.
- **Pre-conditions**: Appel actif (status ACTIVE)
- **Étapes Playwright**:
  1. Initier un appel (status ACTIVE)
  2. Dans un autre onglet, essayer de supprimer le compte
  3. Vérifier PRECONDITION_FAILED
  4. Vérifier le message : "Impossible de supprimer le compte : un appel est en cours"
- **Pourquoi c'est important** : La vérification des appels actifs était **absente** dans la version précédente (Bug B7). Tester qu'elle est maintenant implémentée.

---

## 9. Rate Limiting & DDoS Protection

### 9.1 — Rate limit IP vs User : `withIPRateLimit` et `withRateLimit` utilisés ensemble
- **Scénario** : Certaines procédures (`scenarios.feed`) utilisent `withIPRateLimit` (60/min) sans `withRateLimit`. D'autres (`social.trackShare`) utilisent les DEUX : `withRateLimit` (60/heure) + `withIPRateLimit` (30/min).
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Envoyer 61 requêtes à `scenarios.feed` en < 1 min
  2. Vérifier que la 61ème retourne TOO_MANY_REQUESTS (IP rate limit)
  3. Envoyer 31 requêtes à `social.trackShare`
  4. Vérifier que la 31ème retourne TOO_MANY_REQUESTS (IP rate limit)
- **Pourquoi c'est important** : Les deux rate limits s'appliquent cumulativement. L'IP rate limit peut bloquer plus vite que l'user rate limit.

### 9.2 — Rate limit sur `profile.me` (120/min) — très permissif
- **Scénario** : `profile.me` a un rate limit de 120 req/min. C'est très permissif et pourrait être utilisé pour brute-force.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Envoyer 121 requêtes à `profile.me` en < 1 min
  2. Vérifier que la 121ème retourne TOO_MANY_REQUESTS
- **Pourquoi c'est important** : 120 req/min = 2 req/s. Faible protection contre le scraping.

### 9.3 — Rate limit `anonymous` identifiant : `ctx.session?.user?.id` ?? `x-forwarded-for` ?? `"anonymous"`
- **Scénario** : `withRateLimit` utilise `ctx.session?.user?.id` comme identifiant. Si pas de session, utilise `x-forwarded-for`. Si aucun des deux, `"anonymous"`.
- **Pre-conditions**: Requête sans session, sans IP
- **Étapes Playwright**:
  1. Envoyer 3 requêtes à `auth.register` (rate limit: 3/h) sans IP headers
  2. Vérifier que 3 passes, la 4ème rate limitée
  3. Toutes les requêtes anonymes partagent le même compteur `"anonymous"`
- **Pourquoi c'est important** : Tous les utilisateurs non connectés partagent le même rate limit. 3 inscriptions/heure max sur toute l'application.

### 9.4 — Rate limit Redis key collision : deux paths différents avec le même identifiant
- **Scénario** : La clé Redis est `${path}:${identifier}`. Si `identifier` est vide ou `"anonymous"`, deux procédures différentes peuvent interférer.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Vérifier que `auth.register` et `scenarios.create` ont des clés différentes même avec le même utilisateur
  2. `ratelimit:auth.register:userId:abc` vs `ratelimit:scenarios.create:userId:abc`
- **Pourquoi c'est important** : Le path est inclus dans la clé, donc pas de collision.

### 9.5 — Redis sorted set `zremrangebyscore` pas appelé dans `checkRateLimit`
- **Scénario** : `checkRateLimit` utilise `zcount` et `zadd` mais ne fait PAS `zremrangebyscore`. La mémoire Redis peut croître indéfiniment.
- **Pre-conditions**: Charge soutenue
- **Étapes Playwright**:
  1. Vérifier que `zcount` et `zadd` n'utilisent pas `zremrangebyscore`
  2. Vérifier la taille de la sorted set après 1000 requêtes
  3. Vérifier que les entrées expirées restent dans Redis (elles expirent via le TTL du set)
- **Pourquoi c'est important** : Le TTL sur la clé expire TOUT le set. Mais les entrées anciennes restent jusqu'à l'expiration du TTL. Pas de `zremrangebyscore` = pas de cleanup progressif.

### 9.6 — In-memory rate limit store > 100K entries → éviction 25%
- **Scénario** : `InMemoryRateLimitStore` évite 25% des entrées quand `size > 100_000`. Les 25% les plus anciennes (resetAt les plus petits) sont supprimées.
- **Pre-conditions**: 100K+ entrées dans le store
- **Étapes Playwright**:
  1. Ajouter 100 001 entrées
  2. Vérifier que `periodicCleanup` évite 25 000 entrées
  3. Vérifier que le log `"evicted 25% of entries"` apparaît
- **Pourquoi c'est important** : Protection contre l'explosion mémoire, mais les entrées évincées perdent leur compteur de rate limit.

---

## 10. CSRF Protection Failures

### 10.1 — CSRF : validation SEULEMENT sur POST (pas PUT/DELETE/PATCH)
- **Scénario** : `createTRPCContext` ne valide CSRF que sur `opts.req.method === "POST"`. tRPC n'utilise que POST, mais Next.js API routes pourraient être appelées avec d'autres méthodes.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Envoyer une mutation tRPC avec méthode PUT (si possible via le transport tRPC)
  2. Vérifier que CSRF n'est pas validé
  3. Vérifier que la mutation réussit sans Origin header (en production)
- **Pourquoi c'est important** : **Bug B11** confirmé par le code. La protection CSRF est incomplète.

### 10.2 — CSRF : `parseTrustedOrigins` avec des origines mal formatées
- **Scénario** : `parseTrustedOrigins` splitte par `,`, trim, filter(Boolean). Si `TRUSTED_ORIGINS` contient des espaces, des origines vides, ou des valeurs invalides, `isOriginAllowed` les catch dans son `try/catch` et retourne `false`.
- **Pre-conditions**: `TRUSTED_ORIGINS="https://app.com, ,invalid-url,https://trusted.com"`
- **Étapes Playwright**:
  1. Envoyer une mutation avec `Origin: https://trusted.com`
  2. Vérifier que la requête réussit (trusted origin)
  3. Envoyer avec `Origin: invalid-url`
  4. Vérifier que `new URL("invalid-url")` throw → `false`
  5. Vérifier FORBIDDEN
- **Pourquoi c'est important** : Les origines invalides sont silencieusement ignorées. Pas d'erreur de configuration détectable.

### 10.3 — CSRF : Referer utilisé comme fallback quand Origin absent
- **Scénario** : Si `origin` est absent, `validateCSRF` utilise `new URL(referer).origin`. Si `referer` aussi malformé, `sourceOrigin = null` → `allowMissingOrigin` check.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Envoyer mutation sans Origin mais avec `Referer: https://app.com/some-page`
  2. Vérifier que `sourceOrigin === "https://app.com"` → OK
  3. Envoyer sans Origin et avec `Referer: not-a-url`
  4. Vérifier que `new URL("not-a-url")` throw → `sourceOrigin = null`
  5. Vérifier le comportement selon `allowMissingOrigin`
- **Pourquoi c'est important** : Le fallback Referer est une sécurité supplémentaire mais peut être contourné si le Referer est malformé.

### 10.4 — CSRF : log warning en prod mais pas d'erreur pour `allowMissingOrigin: false`
- **Scénario** : En production, `allowMissingOrigin: false`. Si Origin est absent, `CSRFFailure` est throw avec `"Missing origin header"`. Mais le log warn dans `createTRPCContext` enregistre l'événement.
- **Pre-conditions**: Production, mutation sans Origin
- **Étapes Playwright**:
  1. Envoyer mutation sans Origin en production
  2. Vérifier FORBIDDEN
  3. Vérifier le message : "Requête rejetée — origine non autorisée"
  4. Vérifier que le log contient "CSRF rejection"
- **Pourquoi c'est important** : Le message d'erreur ne mentionne pas que le header Origin est manquant — il dit "origine non autorisée". Pas clair pour le client.

---

## 11. Redis Failure Modes

### 11.1 — Redis down : tous les middlewares qui dépendent de Redis tombent en fallback
- **Scénario** : `rateLimit.ts`, `ipRateLimit.ts`, `conversationState.ts`, `webhookIdempotency.ts`, `webhookDLQ.ts`, `scenarioCache.ts` — tous ont des fallbacks quand Redis est down.
- **Pre-conditions**: Redis down
- **Étapes Playwright**:
  1. Stopper Redis
  2. Tester `calls.start` (rate limit → in-memory)
  3. Tester `webhooks/stripe` (idempotency → skip)
  4. Tester `scenarios.feed` (cache → query DB direct)
  5. Tester `conversationState` (return null — conversation perdue)
  6. Vérifier qu'aucune de ces opérations ne crash
- **Pourquoi c'est important** : L'application doit résister à Redis down. Tester TOUS les chemins de dégradation.

### 11.2 — Redis `ping()` check dans healthcheck — mais pas dans le code métier
- **Scénario** : Le healthcheck vérifie Redis avec `ping()`. Mais le code métier ne vérifie PAS Redis avant chaque utilisation (il check juste `if (redis)`).
- **Pre-conditions**: Redis démarre puis meurt
- **Étapes Playwright**:
  1. Redis up → `if (redis)` est `true`
  2. Redis crash → `redis` (l'objet client) est toujours truthy
  3. `redis.zcount(key, ...)` throw (connection perdue)
  4. Vérifier que le catch fonctionne (fallback in-memory)
- **Pourquoi c'est important** : `if (redis)` ne vérifie pas la CONNEXION, seulement l'OBJET. Le healthcheck `ping()` est le seul endroit qui vérifie vraiment la connectivité.

### 11.3 — Redis keys `*` pattern : `redis.keys("cache:calls:history:*")` bloque Redis
- **Scénario** : `calls.start` utilise `redis.keys("cache:calls:history:${userId}:*")`. `KEYS *` est un anti-pattern qui bloque Redis sur les grosses bases.
- **Pre-conditions**: Beaucoup de clés de cache
- **Étapes Playwright**:
  1. Créer 10 000+ entrées `cache:calls:history:*`
  2. Initier un appel
  3. Vérifier que `redis.keys()` ne bloque pas Redis
  4. Vérifier que `redis.del(...keys)` passe
- **Pourquoi c'est important** : `KEYS` est documenté comme dangereux en production. Devrait être remplacé par `SCAN`.

### 11.4 — Conversation state : `getConversationState` refresh TTL à chaque accès
- **Scénario** : `getConversationState` fait un `expire()` pour refresh le TTL. Mais si l'expire échoue (erreur Redis), le TTL n'est pas refresh et l'état peut expirer.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Note le TTL d'une clé conversation
  2. Appeler `getConversationState` (refresh TTL)
  3. Vérifier que le TTL est bien réinitialisé
  4. Simuler une erreur Redis sur `expire`
  5. Vérifier que le TTL n'est PAS refresh
- **Pourquoi c'est important** : Le TTL est prolongé à chaque tour de conversation. Si Redis a une erreur, le TTL n'est pas refresh et la conversation peut expirer en plein milieu.

### 11.5 — `redisUnavailableLogged` global — thread-unsafe
- **Scénario** : `let redisUnavailableLogged = false` est une variable module-level. En Node.js, c'est single-thread, donc pas de race condition de lecture/écriture. Mais si deux requêtes arrivent en même temps que la première erreur Redis, un seul log est émis.
- **Pre-conditions**: Redis down, deux requêtes simultanées
- **Étapes Playwright**:
  1. Simuler Redis down
  2. Envoyer deux requêtes simultanées
  3. Vérifier qu'un SEUL log "Redis rate limit failed" apparaît
- **Pourquoi c'est important** : Le comportement est correct (pas de spam de logs) mais les deux requêtes voient le même log manquant.

---

## 12. Circuit Breakers

### 12.1 — `twilioCircuitBreaker` — état OPEN refuse les appels
- **Scénario** : Après N échecs Twilio, le circuit breaker passe OPEN. Les appels sont refusés immédiatement sans tenter Twilio.
- **Pre-conditions**: Circuit breaker OPEN
- **Étapes Playwright**:
  1. Simuler N échecs Twilio pour ouvrir le circuit breaker
  2. Initier un appel
  3. Vérifier que `twilioCircuitBreaker.call(() => ...)` throw
  4. Vérifier que l'appel est refundé (credits remboursés)
  5. Vérifier le message d'erreur : "Échec de l'appel"
- **Pourquoi c'est important** : Le circuit breaker protège Twilio mais l'utilisateur ne voit pas la différence avec une erreur normale.

### 12.2 — Circuit breaker half-open → un appel test
- **Scénario** : Après le temps de recovery, le circuit breaker passe HALF_OPEN et laisse passer un appel test. S'il réussit, il passe CLOSED.
- **Pre-conditions**: Circuit breaker OPEN → temps de recovery écoulé
- **Étapes Playwright**:
  1. Attendre le temps de recovery du circuit breaker
  2. Initier un appel
  3. Vérifier que le circuit breaker permet l'appel
  4. Vérifier que le circuit repasse CLOSED
- **Pourquoi c'est important** : Le mécanisme de récupération automatique est testé.

---

## 13. Spam Detection Edge Cases

### 13.1 — `detectCallSpam` — limite quotidienne
- **Scénario** : `detectCallSpam` vérifie le nombre d'appels récents. Si l'utilisateur dépasse un seuil, il est flaggé.
- **Pre-conditions**: Utilisateur proche du seuil de spam
- **Étapes Playwright**:
  1. Initier plusieurs appels rapidement
  2. Vérifier que le N+1ème appel est rejeté avec TOO_MANY_REQUESTS
  3. Vérifier le message : `spamCheck.reason ?? "Trop de requêtes"`
- **Pourquoi c'est important** : La détection de spam est un filet de sécurité. Tester son activation.

### 13.2 — `detectCallSpam` — flag retiré après la fenêtre
- **Scénario** : Si l'utilisateur attend que la fenêtre de détection expire, les appels sont à nouveau autorisés.
- **Pre-conditions**: Utilisateur flaggé spam, fenêtre passée
- **Étapes Playwright**:
  1. Attendre la fin de la fenêtre de spam
  2. Initier un appel
  3. Vérifier qu'il réussit (le flag est retiré)
- **Pourquoi c'est important** : La détection de spam ne doit pas être permanente.

### 13.3 — `detectScenarioSpam` vs `detectCallSpam` — deux détecteurs différents
- **Scénario** : `detectScenarioSpam` est appelé pour la création de scénario, `detectCallSpam` pour les appels. Ils ont des seuils différents.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Créer 10 scénarios rapidement
  2. Vérifier si `detectScenarioSpam` flag (seuil inconnu)
  3. Initier 10 appels rapidement
  4. Vérifier si `detectCallSpam` flag (seuil inconnu)
- **Pourquoi c'est important** : Les deux détecteurs doivent être testés séparément.

### 13.4 — `detectCommentSpam` — contenu répétitif
- **Scénario** : `detectCommentSpam` est appelé dans `community.comment`. Si l'utilisateur poste le même commentaire plusieurs fois, il est flaggé.
- **Pre-conditions**: Utilisateur postant des commentaires identiques
- **Étapes Playwright**:
  1. Poster le même commentaire 5 fois
  2. Vérifier que le 6ème est rejeté
- **Pourquoi c'est important** : Protection contre le flooding de commentaires.

---

## 14. Content Moderation Blind Spots

### 14.1 — `withContentModeration` AVANT `withRateLimit` dans `community.comment`
- **Scénario** : Ordre : `protectedProcedure.use(withREDMetrics).use(withContentModeration).use(withRateLimit)`. Donc la modération est exécutée AVANT le rate limit.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Envoyer 31 commentaires en 1h
  2. Vérifier que les 30 premiers passent (rate limit = 30/h)
  3. Vérifier que le 31ème est bloqué par rate limit (pas par modération)
- **Pourquoi c'est important** : L'ordre des middlewares détermine quel check s'applique en premier.

### 14.2 — `withContentModeration` check synchrone seulement (blocklist)
- **Scénario** : `withContentModeration` appelle `checkContentBlocklist` (synchrone) qui vérifie UNE blocklist de mots. La modération AI asynchrone (`scheduleAsyncModeration`) est fire-and-forget.
- **Pre-conditions**: Contenu qui passe la blocklist mais serait rejeté par l'IA
- **Étapes Playwright**:
  1. Créer un scénario avec contenu offensant qui n'est pas dans la blocklist
  2. Vérifier que la création réussit (blocklist synchrone OK)
  3. Vérifier que la modération asynchrone est planifiée
  4. Vérifier que le statut est PENDING (en attendant l'IA)
- **Pourquoi c'est important** : La modération synchrone est rapidement contournable. La modération asynchrone est le vrai filet de sécurité.

### 14.3 — `extractTextFromInput` -> ne couvre pas tous les champs texte
- **Scénario** : `TEXT_FIELDS` = `["title", "description", "openingMessage", "aiInstructions", "content", "reason", "name", "text"]`. Mais `social.trackShare` input n'a que `scenarioId` et `platform` — pas de contenu texte. Donc pas de modération sur les partages.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Vérifier que `social.trackShare` n'a PAS `withContentModeration`
  2. Vérifier que `auth.changePassword` n'a PAS `withContentModeration`
  3. Vérifier que `profile.updateProfile` n'a PAS `withContentModeration`
- **Pourquoi c'est important** : Toutes les mutations n'ont pas de modération de contenu. C'est normal pour certaines (ids, plateformes), mais confirmer l'absence intentionnelle.

### 14.4 — Moderation : `moderationStatus` mis à PENDING après update de contenu
- **Scénario** : `scenarios.update` remet `moderationStatus = "PENDING"` si le contenu change. Mais le scénario reste visible (si déjà PUBLIC) jusqu'à ce que la modération AI rejette.
- **Pre-conditions**: Scénario PUBLIC APPROVED, modification du contenu
- **Étapes Playwright**:
  1. Créer un scénario APPROVED
  2. Updater le contenu avec un texte offensant (qui passe la blocklist)
  3. Vérifier que `moderationStatus` = "PENDING"
  4. Vérifier que le scénario est TOUJOURS visible dans le feed (cache ?)
  5. Vérifier que `scheduleAsyncModeration` est appelé
- **Pourquoi c'est important** : Fenêtre de vulnérabilité entre l'update et la modération AI asynchrone. Le contenu offensant est visible jusqu'à ce que l'IA le rejette.

---

## 15. Database Error Handling (Prisma)

### 15.1 — Prisma P2002 sur `reaction.create` (toggleLike rapide)
- **Scénario** : `social.toggleLike` vérifie l'existence AVANT de créer. Mais deux requêtes simultanées peuvent trouver `existing = null` toutes les deux → P2002 sur le create.
- **Pre-conditions**: Deux clics "like" simultanés sur le même scénario
- **Étapes Playwright**:
  1. Envoyer deux `social.toggleLike` en parallèle sur le même scénario
  2. Vérifier qu'aucune ne crash avec P2002
  3. Vérifier que `likeCount` est incrémenté de 1 (pas 2)
- **Pourquoi c'est important** : Race condition sur la création de réaction. Le code ne catch PAS P2002 — il crash.

### 15.2 — Prisma P2025 (RecordNotFound) sur update/delete
- **Scénario** : `scenarios.delete` fait `findUnique` puis `delete`. Si le scénario est supprimé entre les deux, `delete` throw P2025.
- **Pre-conditions**: Deux suppressions simultanées
- **Étapes Playwright**:
  1. Envoyer deux `scenarios.delete` en parallèle sur le même scénario
  2. Vérifier qu'une retourne NOT_FOUND, l'autre FORBIDDEN ou réussit
  3. Vérifier qu'aucune ne retourne une erreur Prisma brute
- **Pourquoi c'est important** : Race condition entre read et write. Le code fait `findUnique` puis unupdate/delete sans transaction.

### 15.3 — Prisma P2003 (Foreign Key) sur suppression d'utilisateur
- **Scénario** : `admin.deleteUser` utilise `$transaction` avec `anonymizePersonalData`. Mais si l'utilisateur a des enregistrements dans d'autres tables, la suppression des données personnelles peut échouer.
- **Pre-conditions**: Utilisateur avec relations dans des tables non couvertes par anonymization
- **Étapes Playwright**:
  1. Supprimer un utilisateur qui a des commentaires, des scénarios, des appels
  2. Vérifier que la transaction réussit (toutes les relations sont gérées par `anonymizePersonalData`)
  3. Vérifier qu'aucune erreur P2003 (FK constraint) n'apparaît
- **Pourquoi c'est important** : `anonymizePersonalData` doit couvrir toutes les tables qui référencent `user.id`.

### 15.4 — `user.updateMany` with `where: { id, credits: { gte: creditDiff } }` — lock optimiste
- **Scénario** : Dans `handleCompletedCall`, le débit supplémentaire utilise `updateMany` avec `credits: { gte: creditDiff }`. Si les crédits sont insuffisants, `result.count === 0` → le call est FAILED.
- **Pre-conditions**: Crédits insuffisants pour la durée réelle
- **Étapes Playwright**:
  1. Initier un appel avec 1 crédit
  2. L'appel dure 5 minutes → coût = 5 crédits
  3. Vérifier que le webhook completed détecte `creditDiff > 0` et `result.count === 0`
  4. Vérifier que l'appel est marqué FAILED (pas COMPLETED avec crédit négatif)
- **Pourquoi c'est important** : Le lock optimiste protège contre les découverts. Tester que l'appel échoue proprement.

---

## 16. Concurrent Operations & Race Conditions

### 16.1 — `admin.featureScenario` + `admin.removeFeatured` concurrent
- **Scénario** : Deux admins feature/défeature le même scénario en même temps.
- **Pre-conditions**: Deux sessions admin
- **Étapes Playwright**:
  1. Session A : `featureScenario({ scenarioId: X })`
  2. Session B : `removeFeatured({ scenarioId: X })` en parallèle
  3. Vérifier l'état final cohérent
  4. Vérifier qu'un audit log existe pour chaque action
- **Pourquoi c'est important** : L'upsert et le deleteMany peuvent interagir de façon non déterministe.

### 16.2 — `purchase.create` avec contrainte unique `stripePaymentId` — double envoi Stripe
- **Scénario** : Si Stripe envoie deux webhooks identiques (rare mais possible), le second catch P2002 et log "Duplicate".
- **Pre-conditions**: Deux webhooks identiques
- **Étapes Playwright**:
  1. Envoyer deux webhooks `checkout.session.completed` avec le même `payment_intent`
  2. Vérifier que le premier réussit (crédits ajoutés)
  3. Vérifier que le second est rejeté par P2002 (log "Duplicate")
  4. Vérifier que les crédits ne sont PAS doublés
- **Pourquoi c'est important** : L'idempotence est assurée par la contrainte unique en base. Tester le double-envoi.

### 16.3 — Like toggle rapide (5 clics) → état final correct
- **Scénario** : L'utilisateur clique 5 fois sur le bouton like très rapidement. Chaque clic toggle l'état.
- **Pre-conditions**: Utilisateur connecté
- **Étapes Playwright**:
  1. Envoyer 5 `social.toggleLike` en parallèle
  2. Vérifier que `likeCount` final est correct (1 ou 0 selon le nombre de toggles)
  3. Vérifier que l'UI affiche l'état correct
- **Pourquoi c'est important** : Les mutations non-idempotentes peuvent laisser l'état dans une position incohérente.

### 16.4 — Concurrent call start : deux appels simultanés avec le même crédit
- **Scénario** : Un utilisateur avec 1 crédit initie deux appels en simultané. `atomicDebit` devrait protéger.
- **Pre-conditions**: Utilisateur avec 1 crédit
- **Étapes Playwright**:
  1. Envoyer deux `calls.start` en parallèle
  2. Vérifier qu'un seul réussit
  3. Vérifier que l'autre retourne INSUFFICIENT_CREDITS
  4. Vérifier que le crédit passe de 1 à 0
- **Pourquoi c'est important** : `atomicDebit` utilise `updateMany` avec `credits: { gte: cost }` — c'est un lock optimiste.

---

## 17. Token & Session Management

### 17.1 — Twilio token HMAC sans expiration → token volé réutilisable
- **Scénario** : `createTwilioToken` crée un HMAC avec `callId`, `scenarioId`, `characterId`. Aucune expiration incluse dans le payload.
- **Pre-conditions**: Token intercepté
- **Étapes Playwright**:
  1. Capturer un token HMAC dans l'URL du webhook
  2. Décoder le token (HMAC est signé, pas encrypté — le payload est visible)
  3. Vérifier qu'il contient des IDs internes (callId, scenarioId, characterId)
  4. Vérifier qu'il n'y a PAS d'expiration (claim `exp` ou `iat` absent)
- **Pourquoi c'est important** : Le token expose des IDs internes et n'expire pas. Si l'URL du webhook est loggée par Twilio, les IDs sont exposés.

### 17.2 — Session JWT `tokenVersion` — déconnexion multi-onglet
- **Scénario** : `withdrawConsent` et `deleteMyAccount` incrémentent `tokenVersion`. La session JWT est invalidée si `tokenVersion` dans le token est inférieur à celui en base.
- **Pre-conditions**: Deux onglets ouverts
- **Étapes Playwright**:
  1. Ouvrir deux onglets avec la même session
  2. Onglet A : `profile.deleteMyAccount` (échec — appel actif)
  3. Onglet B : cliquer sur un bouton qui appelle l'API
  4. Vérifier que la session est encore valide
- **Pourquoi c'est important** : `tokenVersion` est incrémenté dans `deleteMyAccount` et `changePassword`. Mais pas dans `withdrawConsent` ? Si — vérifié : `withdrawConsent` aussi.

### 17.3 — GET `/api/auth/session` → retourne `null` pour session invalide
- **Scénario** : `auth()` de NextAuth gère les sessions invalides silencieusement. Vérifier qu'un cookie de session expiré retourne `null` et pas 500.
- **Pre-conditions**: Cookie de session expiré
- **Étapes Playwright**:
  1. Forger un cookie de session expiré (passer un JWT expired)
  2. GET `/api/auth/session`
  3. Vérifier réponse `null`
- **Pourquoi c'est important** : NextAuth doit gérer les JWT expirés sans crash.

---

## 18. Encryption & Data Masking

### 18.1 — `encryptPhoneNumber` — chiffrement des numéros de téléphone
- **Scénario** : `encryptPhoneNumber` est utilisé dans `initiateCall` et `initConversationState`. Vérifier que le déchiffrement fonctionne.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Initier un appel avec un numéro de téléphone
  2. Lire la base de données (via admin API)
  3. Vérifier que `phoneNumber` est chiffré (pas en clair)
  4. Lire l'état Redis `conversation:xxx`
  5. Vérifier que `callerNumber` est chiffré
- **Pourquoi c'est important** : Les numéros de téléphone sont des données sensibles (PII). Vérifier le chiffrement au repos.

### 18.2 — `maskPhoneNumber` — masquage dans l'export GDPR
- **Scénario** : `profile.exportData` décrypte puis masque les numéros : `xxxx1234`. Si le déchiffrement échoue, fallback sur `call.phoneNumber.length >= 4 ? "xxxx" + slice(-4) : "****"`.
- **Pre-conditions**: Numéro legacy (non chiffré) dans la base
- **Étapes Playwright**:
  1. Créer un appel avec un numéro en clair
  2. Appeler `profile.exportData`
  3. Vérifier que le numéro est masqué (pas en clair)
  4. Vérifier le format : `xxxx1234` (4 derniers chiffres visibles)
- **Pourquoi c'est important** : Les numéros legacy (avant chiffrement) doivent être masqués dans l'export.

### 18.3 — `hashPhoneForAudit` — HMAC avec sel pour audit logs
- **Scénario** : `hashPhoneForAudit` utilise `AUDIT_HASH_SECRET`. Si ce secret change, les hashs précédents ne sont plus vérifiables.
- **Pre-conditions**: `AUDIT_HASH_SECRET` changé entre deux audits
- **Étapes Playwright**:
  1. Bloquer un numéro (audit log créé avec hash)
  2. Changer `AUDIT_HASH_SECRET`
  3. Vérifier que le hash du même numéro est différent
  4. Vérifier qu'on ne peut pas lier les deux logs
- **Pourquoi c'est important** : Le sel HMAC garantit la non-réversibilité. Si le sel change, les logs historiques ne sont plus corrélables.

---

## 19. File Upload & Audio Processing

### 19.1 — `uploadAudioBuffer` → stockage R2 des enregistrements
- **Scénario** : Les enregistrements audio sont uploadés vers R2. Vérifier les métadonnées et la récupération.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Initier un appel (génère des fichiers audio)
  2. Vérifier que les fichiers sont uploadés vers R2
  3. Vérifier que `recordingUrl` dans la base pointe vers R2
  4. Vérifier que `getPresignedUrl` génère une URL valide
- **Pourquoi c'est important** : Les fichiers audio doivent être stockés et accessibles.

### 19.2 — `getPresignedUrl` avec TTL → URL expirée
- **Scénario** : `calls.replay` utilise `getPresignedUrl` sans TTL spécifique (TTL par défaut). Vérifier que l'URL n'expire pas pendant la lecture.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Initier un appel + completer
  2. Appeler `calls.replay`
  3. Vérifier que `recordingUrl` est une URL presignée valide
  4. Attendre que le TTL expire (si court)
  5. Vérifier que l'URL n'est plus valide
- **Pourquoi c'est important** : Les URLs presignées expirent. Si trop court, l'utilisateur ne peut pas écouter son enregistrement.

### 19.3 — `transcribeAudio` avec Deepgram — timeout
- **Scénario** : `transcribeAudio` est appelé SYNC dans `handleCompletedCall`. Si Deepgram est lent (> 30s), le webhook Twilio peut timeout.
- **Pre-conditions**: Fichier audio long
- **Étapes Playwright**:
  1. Simuler un webhook completed avec un long fichier audio
  2. Vérifier que `transcribeAudio` ne timeout pas
  3. Vérifier que le webhook retourne 200 (même si la transcription échoue)
- **Pourquoi c'est important** : La transcription est optionnelle — si elle échoue, l'appel doit quand même être marqué COMPLETED.

---

## 20. Feature Flag & Admin Operations

### 20.1 — `admin.featureScenario` — upsert conflit avec le cron de rotation
- **Scénario** : Le cron `rotate-featured` et l'admin `featureScenario` peuvent tous deux créer/modifier `featuredScenario` pour le même jour.
- **Pre-conditions**: Cron rotation activée
- **Étapes Playwright**:
  1. Admin feature un scénario
  2. Le cron tourne et feature un autre scénario
  3. Vérifier que `featuredScenario` pour le jour en cours contient le dernier (cron écrase admin)
- **Pourquoi c'est important** : Le cron peut écraser la sélection manuelle de l'admin.

### 20.2 — `admin.featureScenario` — scénario inexistant → NOT_FOUND
- **Scénario** : `admin.featureScenario` vérifie l'existence du scénario AVANT l'upsert.
- **Pre-conditions**: Scénario ID inexistant
- **Étapes Playwright**:
  1. Appeler `admin.featureScenario({ scenarioId: "nonexistent-id" })`
  2. Vérifier NOT_FOUND
  3. Vérifier que l'audit log n'est PAS créé
- **Pourquoi c'est important** : La vérification d'existence est correcte — tester qu'elle fonctionne.

### 20.3 — `admin.deleteUser` — utilisateur déjà supprimé → CONFLICT
- **Scénario** : `updateMany` avec `where: { id, deletedAt: null }` — si `result.count === 0`, l'utilisateur est déjà supprimé ou inexistant.
- **Pre-conditions**: Utilisateur déjà supprimé
- **Étapes Playwright**:
  1. Appeler `admin.deleteUser` sur un utilisateur déjà supprimé
  2. Vérifier CONFLICT
  3. Vérifier le message : "Utilisateur introuvable ou déjà supprimé"
- **Pourquoi c'est important** : L'idempotence est assurée par le WHERE `deletedAt: null`.

### 20.4 — `admin.listUsers` — recherche < 2 caractères → requête non envoyée
- **Scénario** : `listUsers` input `.min(2)` sur `search`. Donc la recherche avec 1 caractère ne passe même pas Zod.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Appeler `admin.listUsers({ search: "a" })`
  2. Vérifier que Zod rejette
  3. Vérifier que l'erreur contient le message de validation Zod
- **Pourquoi c'est important** : La validation Zod empêche les recherches trop courtes (évite trop de résultats).

---

## 21. Cache Invalidation

### 21.1 — Cache `admin:moderationQueue` non invalidé après approve/reject
- **Scénario** : `approveScenario` invalide `admin:moderationQueue:*`. Mais le cache peut avoir été lu par un autre admin avant l'invalidation.
- **Pre-conditions**: Deux admins sur la modération
- **Étapes Playwright**:
  1. Admin A lit la file d'attente (cache mis en cache pour 30s)
  2. Admin B approuve un scénario (cache invalidé)
  3. Admin A recharge la page → doit voir le scénario retiré
  4. Vérifier que le cache est bien invalidé
- **Pourquoi c'est important** : Stale cache = l'admin voit des scénarios déjà modérés.

### 21.2 — Cache `admin:blockedNumbers` non invalidé après block
- **Scénario** : `blockNumber` invalide `admin:blockedNumbers`. Mais `getBlockedNumbers` a un TTL de 30s.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Lire la liste des numéros bloqués
  2. Bloquer un nouveau numéro
  3. Relire la liste immédiatement → doit inclure le nouveau
  4. Vérifier que le cache est invalidé
- **Pourquoi c'est important** : L'invalidation de cache après mutation est critique pour la cohérence.

### 21.3 — Cache `cache:calls:history:${userId}` invalidé par `calls.start` avec `redis.keys`
- **Scénario** : `calls.start` utilise `redis.keys` pour trouver et invalider les caches de l'historique. Mais si le cache a expiré entre le `keys` et le `del`, c'est OK.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Initier un appel
  2. Vérifier que les caches `cache:calls:history:${userId}:*` sont invalidés
  3. Vérifier que `redis.keys` n'est pas appelé si `redis` est falsy
- **Pourquoi c'est important** : L'invalidation de cache garantit que l'historique est à jour après un nouvel appel.

---

## 22. Edge Cases d'Input (Zod Validation)

### 22.1 — `phoneNumber` avec normalized NFKC + regex
- **Scénario** : `z.string().transform(val => val.normalize("NFKC")).pipe(z.string().regex(/^\+[1-9]\d{6,14}$/))`. Donc le numéro est d'abord normalisé unicode, PUIS validé.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Envoyer `phoneNumber: "+33\u00A0612345678"` (\u00A0 = non-breaking space)
  2. Vérifier que NFKC transforme \u00A0 en espace normal
  3. La regex avec `\+[1-9]\d{6,14}$` ne match PAS les espaces
  4. Vérifier que la validation échoue (Zod error)
- **Pourquoi c'est important** : NFKC normalise mais n'enlève pas les espaces. Le numéro avec des caractères invisibles échoue.

### 22.2 — `maxDurationSeconds` min 60, max 3600
- **Scénario** : `z.number().int().min(60).max(3600).default(300)`. Donc valeur par défaut = 300s (5 min).
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Appeler `calls.start()` sans `maxDurationSeconds` → doit utiliser 300
  2. Appeler avec `maxDurationSeconds: 30` → min 60 → Zod error
  3. Appeler avec `maxDurationSeconds: 7200` → max 3600 → Zod error
- **Pourquoi c'est important** : Les limites sont validées par Zod.

### 22.3 — `scenarios.create` avec `visibility: "INVALID"`
- **Scénario** : `z.enum(["PRIVATE", "UNLISTED", "PUBLIC"])` — valeur invalide → Zod error.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Appeler `scenarios.create` avec `visibility: "DRAFT"`
  2. Vérifier Zod error avec message "Visibilité invalide"
- **Pourquoi c'est important** : Les valeurs invalides sont rejetées par Zod.

### 22.4 — `scenarios.update` avec `.refine()` — au moins un champ fourni
- **Scénario** : `z.object({...}).refine(data => Object.keys(data).some(k => k !== "id" && data[k] !== undefined), { message: "Au moins un champ doit être fourni" })`.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Appeler `scenarios.update` avec seulement `{ id: "xxx" }`
  2. Vérifier Zod error : "Au moins un champ doit être fourni"
- **Pourquoi c'est important** : La validation empêche les updates vides.

### 22.5 — `clips.create` avec `endTime <= startTime`
- **Scénario** : `z.object({...}).refine(data => data.endTime > data.startTime, { message: "La fin du clip doit être après le début" })`.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Appeler `clips.create` avec `{ startTime: 100, endTime: 50 }`
  2. Vérifier Zod error : "La fin du clip doit être après le début"
- **Pourquoi c'est important** : Validation de cohérence temporelle.

---

## 23. Logging & Observability

### 23.1 — `sanitizeRequestId` — empêche l'injection de logs
- **Scénario** : Un header `x-request-id` avec des caractères dangereux (`\n`, `\r`) pourrait injecter des lignes dans les logs.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Envoyer requête avec `x-request-id: "test\nInjected log line"`
  2. Vérifier que `sanitizeRequestId` supprime les caractères dangereux
  3. Vérifier que le log ne contient PAS de saut de ligne
- **Pourquoi c'est important** : Log injection via header. `sanitizeRequestId` remplace `[^a-zA-Z0-9._~-]` par `""` — donc `\n` supprimé.

### 23.2 — `withREDMetrics` — map in-memory limitée à 1000 entrées
- **Scénario** : Si plus de 1000 endpoints différents sont appelés, les anciennes métriques sont évincées.
- **Pre-conditions**: 1000+ endpoints différents
- **Étapes Playwright**:
  1. Envoyer 1001 appels à des endpoints différents
  2. Vérifier que le Map évince l'entrée la plus ancienne
  3. Vérifier que `getREDMetrics()` n'a que 1000 entrées
- **Pourquoi c'est important** : Protection mémoire. Les métriques des endpoints les moins utilisés sont perdues.

### 23.3 — Log des informations sensibles : `phoneNumber` dans les logs ?
- **Scénario** : Vérifier qu'aucun log ne contient de numéros de téléphone en clair.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Initier un appel
  2. Scanner les logs pour des patterns de numéros de téléphone
  3. Vérifier qu'aucun numéro en clair n'est loggé
- **Pourquoi c'est important** : Les numéros de téléphone ne doivent jamais apparaître dans les logs.

---

## 24. Goodbye Detector — Edge Cases Spécifiques

### 24.1 — `detectGoodbye` avec texte vide ou très court
- **Scénario** : `detectGoodbye("")` ou `detectGoodbye("a")` — `toLowerCase().trim()` donne `""` ou `"a"`. Aucun pattern ne match.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Tester `detectGoodbye("")` → false
  2. Tester `detectGoodbye("a")` → false
  3. Tester `detectGoodbye("!")` → false
- **Pourquoi c'est important** : L'input vide ne doit pas déclencher de goodbye.

### 24.2 — `detectGoodbye` avec input très long (> 10 000 caractères)
- **Scénario** : `speechResult` peut théoriquement être très long. `regex.test()` pourrait catastrophique backtracking.
- **Pre-conditions**: Input très long
- **Étapes Playwright**:
  1. Tester `detectGoodbye("a".repeat(100000))` — doit être rapide (< 100ms)
  2. Tester `detectGoodbye("au revoir " + "a".repeat(100000))` — doit détecter le goodbye
- **Pourquoi c'est important** : ReDoS (Regular Expression Denial of Service) si le pattern est mal construit. Les regex utilisées sont simples (word boundary), mais tester quand même.

### 24.3 — `buildWordBoundaryPattern` — regex Unicode-aware
- **Scénario** : `(?<![\p{L}\p{N}_])mot(?![\p{L}\p{N}_])` avec le flag `iu`. Vérifier que `é`, `ô`, `ç` sont bien traités comme des lettres.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Tester `detectGoodbye("à plus tard")` → true
  2. Tester `detectGoodbye("à plustard")` → true (le mot "à" match, pas "plus tard")
  3. Tester `detectGoodbye("c\'est tout")` → true
- **Pourquoi c'est important** : Les accents français doivent être gérés correctement par `\p{L}`.

---

## 25. Stripe Webhook — Cas d'Échec

### 25.1 — `checkout.session.completed` avec `payment_intent` null → 400
- **Scénario** : Certaines sessions Stripe (setup, subscription) n'ont pas de `payment_intent`. Le handler retourne 400.
- **Pre-conditions**: Session sans payment_intent
- **Étapes Playwright**:
  1. Simuler `checkout.session.completed` avec `payment_intent: null`
  2. Vérifier 400 : "payment_intent manquant"
- **Pourquoi c'est important** : Les sessions sans payment_intent ne sont pas gérées (mais ne devraient pas exister pour les paiements uniques).

### 25.2 — `checkout.session.expired` → juste un log, pas d'action
- **Scénario** : Stripe envoie `checkout.session.expired`. Le handler log juste l'événement.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Simuler `checkout.session.expired`
  2. Vérifier que le handler retourne 200
  3. Vérifier que rien n'est modifié en base
- **Pourquoi c'est important** : Les sessions expirées ne doivent pas créer de crédits.

### 25.3 — `charge.dispute.created` avec dispute déjà traitée → idempotent
- **Scénario** : Si Stripe envoie deux disputes identiques, la seconde est ignorée par `updateMany` avec `disputedAt: null`.
- **Pre-conditions**: Deux disputes identiques
- **Étapes Playwright**:
  1. Simuler `charge.dispute.created`
  2. Resimuler le même événement
  3. Vérifier que le second log "Duplicate or no purchase for dispute"
  4. Vérifier que `disputedAt` n'est pas écrasé
- **Pourquoi c'est important** : L'idempotence est assurée par `updateMany` avec `disputedAt: null`.

### 25.4 — `charge.dispute.closed` avec status "won" → `disputedAt` remis à null
- **Scénario** : Si Stripe gagne le litige, `disputedAt` est remis à `null`. Les crédits ne sont PAS remboursés (car pas de `refundedAt`).
- **Pre-conditions**: Dispute won
- **Étapes Playwright**:
  1. Simuler `charge.dispute.created`
  2. Simuler `charge.dispute.closed` avec `status: "won"`
  3. Vérifier que `disputedAt` = null
  4. Vérifier que `refundedAt` reste null (crédits conservés)
- **Pourquoi c'est important** : Si le marchand gagne le litige, les crédits sont conservés. Inversement, si "lost" → crédits remboursés.

---

## 26. API Route `dynamic` Exports

### 26.1 — Vérifier que toutes les routes API ont les bons exports (`dynamic`, `maxDuration`)
- **Scénario** : Chaque route API Next.js peut avoir des exports comme `dynamic`, `maxDuration`, `preferredRegion`. Certains endpoints sensibles (crons) ont `export const dynamic = "force-dynamic"`.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Vérifier que `cron/gdpr-purge/route.ts` exporte `dynamic = "force-dynamic"`
  2. Vérifier que `cron/cleanup-recordings/route.ts` exporte `maxDuration = 300`
  3. Vérifier que les routes tRPC n'ont PAS ces exports (confiance au défaut)
- **Pourquoi c'est important** : Les routes dynamiques empêchent le caching CDN. Les crons doivent être dynamiques.

---

## 27. Healthcheck — Vérifications Détaillées

### 27.1 — Healthcheck : Redis non configuré → "unhealthy" sans crash
- **Scénario** : Si `redis` est undefined (pas de config), le healthcheck check `if (redis)` et set `"unhealthy"` sans appeler `ping()`.
- **Pre-conditions**: Redis non configuré
- **Étapes Playwright**:
  1. Désactiver Redis (retirer la config)
  2. GET `/api/health`
  3. Vérifier `checks.redis === "unhealthy"`
  4. Vérifier `status === "degraded"` (pas 500, pas de crash)
- **Pourquoi c'est important** : Redis peut ne pas être configuré dans certains environnements. Le healthcheck ne doit pas crash.

### 27.2 — Healthcheck : DB healthy, Redis unhealthy → degraded
- **Scénario** : Si Redis est down mais DB fonctionne, le status est "degraded".
- **Pre-conditions**: Redis down, DB up
- **Étapes Playwright**:
  1. Stopper Redis
  2. GET `/api/health`
  3. Vérifier `checks.redis === "unhealthy"` et `checks.database === "healthy"`
  4. Vérifier `status === "degraded"` (pas "healthy")
- **Pourquoi c'est important** : Le healthcheck reflète l'état réel du système.

---

## 28. Procédure `me()` vs `exportData()` — Champs Legacy vs Sub-aggregates

### 28.1 — `profile.me` — migration legacy → sub-aggregate cohérente
- **Scénario** : `credits` peut venir de `user.credits` (legacy) ou `userBilling.credits` (nouveau). Le code retourne `user.billing?.credits ?? user.credits`.
- **Pre-conditions**: Utilisateur avec billing mais aussi legacy credits
- **Étapes Playwright**:
  1. Créer un utilisateur (billing initialisé par `upsert`)
  2. Vérifier que `credits` retourné = billing.credits (pas legacy)
  3. Simuler une incohérence : legacy = 0, billing = 10
  4. Vérifier que `me()` retourne 10
- **Pourquoi c'est important** : La cohérence entre legacy et sub-aggregate doit être testée.

---

## 29. Procédure `createClip` — `endTime` vs `startTime` inversé

### 29.1 — `createClip` avec `startTime > endTime` (refine Zod)
- **Scénario** : Zod refine vérifie `data.endTime > data.startTime`. Mais si l'utilisateur inverse les valeurs, la validation échoue.
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Appeler `clips.create` avec `{ startTime: 500, endTime: 100 }`
  2. Vérifier Zod error : "La fin du clip doit être après le début"
- **Pourquoi c'est important** : La vérification protège contre les valeurs incohérentes.

---

## 30. Procédure `trackShare` — Doublons

### 30.1 — `trackShare` — Pas de vérification de doublon
- **Scénario** : `trackShare` crée un `shareEvent` sans vérifier si le même partage a déjà été effectué. Donc un utilisateur peut spammer les partages (rate limit: 60/h).
- **Pre-conditions**: Aucune
- **Étapes Playwright**:
  1. Appeler `social.trackShare` 10 fois avec les mêmes paramètres
  2. Vérifier que 10 entrées sont créées (pas de déduplication)
  3. Vérifier que le rate limit (60/h) protège contre l'abus
- **Pourquoi c'est important** : `trackShare` est volontairement non-idempotent (chaque partage compte).

---

## Résumé des Scénarios Non Documentés

| Catégorie | Nombre de scénarios |
|-----------|:-------------------:|
| 1. tRPC Error Handling & Middleware Chain | 12 |
| 2. Routes API Edge Cases | 10 |
| 3. Permissions & Authorization | 8 |
| 4. API Versioning | 6 |
| 5. Twilio Telephony Deep Dive | 15 |
| 6. Webhook Edge Cases | 10 |
| 7. Cron Jobs & Background Jobs | 6 |
| 8. GDPR & Data Privacy | 5 |
| 9. Rate Limiting & DDoS Protection | 6 |
| 10. CSRF Protection Failures | 4 |
| 11. Redis Failure Modes | 5 |
| 12. Circuit Breakers | 2 |
| 13. Spam Detection Edge Cases | 4 |
| 14. Content Moderation Blind Spots | 4 |
| 15. Database Error Handling (Prisma) | 4 |
| 16. Concurrent Operations & Race Conditions | 4 |
| 17. Token & Session Management | 3 |
| 18. Encryption & Data Masking | 3 |
| 19. File Upload & Audio Processing | 3 |
| 20. Feature Flag & Admin Operations | 4 |
| 21. Cache Invalidation | 3 |
| 22. Edge Cases d'Input (Zod Validation) | 5 |
| 23. Logging & Observability | 3 |
| 24. Goodbye Detector Edge Cases | 3 |
| 25. Stripe Webhook Cas d'Échec | 4 |
| 26. API Route dynamic Exports | 1 |
| 27. Healthcheck Détaillé | 2 |
| 28. Migration Legacy Sub-aggregate | 1 |
| 29. createClip edge case | 1 |
| 30. trackShare Doublons | 1 |
| **TOTAL** | **142 nouveaux scénarios** |

> **Note** : Ces 142 scénarios s'ajoutent aux ~389 déjà documentés dans SCENARIOS_MANQUANTS.md et aux 534 de TEST_SCENARIOS.md, portant le potentiel total à **~1065 scénarios E2E**.
