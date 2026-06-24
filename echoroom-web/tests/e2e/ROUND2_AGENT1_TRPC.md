# ROUND 2 — Agent 1 : Coins Obscurs tRPC, Middleware & Routage Avancé

> **Analyse exhaustive du code source** — 24 juin 2026  
> **Périmètre** : `src/server/trpc.ts`, `src/lib/auth.ts`, `src/middleware.ts`, `src/server/middleware/*`, `src/server/routers/*`, `src/server/procedures.ts`  
> **Méthode** : Reverse-engineering ligne par ligne de chaque procédure, middleware, et gestion d'erreur  
> **Objectif** : Identifier 146 scénarios de test manquants dans les coins les plus obscurs

---

## Legende

| Symbole | Signification |
|---------|---------------|
| [ ] | Nouveau scenario identifie (non couvert par les tests existants) |
| [x] | Deja couvert par un test unitaire ou E2E |
| CRITIQUE | Risque critique - bug potentiel ou faille de securite |
| ELEVE | Risque eleve - incoherence fonctionnelle |
| MOYEN | Risque moyen - edge case non teste |

---

## 1. `src/server/trpc.ts` - Middleware Foundation (tRPC Core)

### 1.1 - `createTRPCContext` - Session sans requete HTTP

#### Deja teste
- [x] CSRF validation pour les mutations POST avec Origin header valide (csrf.test.ts)
- [x] CSRF validation pour les mutations POST sans Origin (allowMissingOrigin en dev)
- [x] CSRF validation pour les mutations POST avec Origin interdit -> FORBIDDEN
- [x] CSRF validation pour les requetes GET (skip)

#### Nouveaux scenarios
- [ ] **[CRITIQUE] Scenario 1** : `createTRPCContext` appele **sans aucun opts** (ex: contexte serveur direct). Le `opts?.req?.method` est `undefined` -> la condition `opts.req.method === "POST"` ne throw PAS. Verifier que CSRF est bien contourne quand il n'y a pas de `req`.
- [ ] **[MOYEN] Scenario 2** : `sanitizeRequestId` avec entree de plus de 64 caracteres -> doit tronquer. Tester avec exactement 64, 65, et 200 caracteres.
- [ ] **[MOYEN] Scenario 3** : `sanitizeRequestId` avec caracteres interdits (emoji, espaces, caracteres Unicode). Doit remplacer ou supprimer, jamais crasher.
- [ ] **[CRITIQUE] Scenario 4** : `sanitizeRequestId` avec chaine vide après sanitization -> retourne `null`. Le `randomUUID()` de fallback doit etre utilise.
- [ ] **[MOYEN] Scenario 5** : `parseTrustedOrigins` avec `TRUSTED_ORIGINS` vide, avec une seule origine, avec 50 origines (overflow test), avec des espaces autour des virgules.
- [ ] **[CRITIQUE] Scenario 6** : CSRF - Mutation POST avec Origin **vide** (`""`) en production (`allowMissingOrigin: false`). Le `sourceOrigin` est `""` (truthy car string non-null mais vide). `isOriginAllowed("", config)` -> `new URL("")` throw -> catch -> return `false` -> FORBIDDEN. Verifier ce chemin exact.
- [ ] **[MOYEN] Scenario 7** : CSRF - Mutation POST avec Referer malforme (ex: `htt:///bad-url`). `new URL(referer)` throw -> `sourceOrigin = null` -> selon `allowMissingOrigin` en production -> FORBIDDEN.
- [ ] **[ELEVE] Scenario 8** : `createTRPCContext` - La session peut etre `null` (retour de `auth()` quand NextAuth n'est pas configure). Verifier que `ctx.session?.user?.id` ne crashe pas dans les middlewares.
- [ ] **[MOYEN] Scenario 9** : Headers `x-request-id` present mais vide -> `sanitizeRequestId("")` -> retourne `null` -> `randomUUID()` est utilise.

### 1.2 - `errorFormatter` - Formatage des erreurs Zod

#### Deja teste
- [x] Verification que `error.cause instanceof ZodError` -> `zodError: error.cause.flatten()` (dans extractText.test.ts, test partiel)

#### Nouveaux scenarios
- [ ] **[MOYEN] Scenario 10** : `errorFormatter` quand `error.cause` est une **erreur Prisma** (ex: `P2002` unique constraint violation). Ce n'est PAS un ZodError -> `zodError: null`. Verifier que le message d'erreur Prisma brut n'est PAS expose au client.
- [ ] **[CRITIQUE] Scenario 11** : `errorFormatter` quand `error.cause` est un objet non-Error (ex: `{ custom: "error" }`). `instanceof ZodError` est false -> pas de crash. Mais `TRPCError` pourrait encapsuler n'importe quoi - tester la resilience.
- [ ] **[MOYEN] Scenario 12** : `errorFormatter` avec un `ZodError` qui a des issues imbriquees (ex: `z.object({ a: z.object({ b: z.string() }) })`). `flatten()` gere-t-il correctement les erreurs imbriquees ?

### 1.3 - `isAuthenticated` middleware

#### Deja teste
- [x] Session null -> UNAUTHORIZED (authorization.test.ts)
- [x] Session sans user -> UNAUTHORIZED
- [x] Session avec user.id -> OK, contexte type

#### Nouveaux scenarios
- [ ] **[CRITIQUE] Scenario 13** : Session avec `user.id` present mais **`user.role` absent** (undefined). Le cast `as AuthenticatedSession["user"]` va passer, mais les procedures qui lisent `ctx.session.user.role` recevront `undefined`. Tester `profile.me` avec un token qui n'a pas de role -> pas de crash, mais `user.role` est `undefined` sur le frontend.
- [ ] **[ELEVE] Scenario 14** : Session avec `user.id === ""` (chaine vide). `if (!ctx.session?.user?.id)` -> `!""` est `true` -> UNAUTHORIZED. Mais est-ce que le JWT peut avoir un `id: ""` ? Verifier la resilience.
- [ ] **[MOYEN] Scenario 15** : Session expiree mais JWT pas encore nettoye. `isAuthenticated` ne verifie PAS `session.expires`. C'est la responsabilite de NextAuth. Mais si NextAuth ne nettoie pas -> procedure protegee accessible avec session expiree.

### 1.4 - `isAdmin` middleware

#### Deja teste
- [x] Role USER -> FORBIDDEN (authorization.test.ts)
- [x] Role ADMIN -> OK
- [x] Role MODERATOR -> FORBIDDEN

#### Nouveaux scenarios
- [ ] **[MOYEN] Scenario 16** : `isAdmin` avec `session` presente mais `session.user` absent (undefined). L'expression `ctx.session?.user?.role !== "ADMIN"` -> `undefined !== "ADMIN"` -> `true` -> FORBIDDEN. Pas de crash, mais important a verifier.
- [ ] **[CRITIQUE] Scenario 17** : `isAdmin` avec `session.user.role = "ADMIN"` mais en minuscules (`"admin"` au lieu de `"ADMIN"`). La comparaison est STRICT : `"admin" !== "ADMIN"` -> `true` -> FORBIDDEN. Un admin authentifie serait bloque par son propre admin panel.
- [ ] **[MOYEN] Scenario 18** : `isAdmin` - Que se passe-t-il si `ctx.session.user.role` est un tableau ou un nombre ? `["ADMIN"] !== "ADMIN"` -> FORBIDDEN. Test d'injection de type.
- [ ] **[ELEVE] Scenario 19** : MODERATOR essayant d'acceder aux routes admin. Le middleware `isAdmin` rejette avec FORBIDDEN. Mais **y a-t-il des routes reservees aux MODERATOR** ? Actuellement, `community.reportAbuse`, `social.toggleLike` etc. utilisent `protectedProcedure` sans distinction USER/MODERATOR. Un MODERATOR peut faire les memes actions qu'un USER - c'est peut-etre voulu, mais non documente.

### 1.5 - `withRateLimit` middleware

#### Deja teste
- [x] Rate limit avec Redis disponible (rateLimit.test.ts)
- [x] Rate limit avec Redis down -> fallback in-memory (rateLimit.test.ts)

#### Nouveaux scenarios
- [ ] **[CRITIQUE] Scenario 20** : `withRateLimit` construit l'identifier avec `ctx.session?.user?.id` OU `x-forwarded-for` OU `x-real-ip` OU `"anonymous"`. Si un utilisateur authentifie a un `userId` valide mais que son IP est aussi presente, l'identifier utilise l'userId (plus specifique). Mais si `ctx.session?.user?.id` est `null` (session existante mais `user.id = null`), alors le fallback IP est utilise.
- [ ] **[ELEVE] Scenario 21** : **Identifier collision** : `${path}:${identifier}` - deux identifiants differents peuvent produire le meme path:identifier si l'identifier contient `:`. Ex: path=`scenarios:create`, identifier=`user:123` -> `scenarios:create:user:123`. Pas de collision reelle, mais tester les identifiers avec des caracteres exotiques.
- [ ] **[CRITIQUE] Scenario 22** : Rate limit avec `limit=0` ou `limit=-1`. La condition `count >= limit` serait vraie des la premiere requete (0 >= 0) -> TOO_MANY_REQUESTS immediat. Tester la validation des configs.
- [ ] **[ELEVE] Scenario 23** : Rate limit avec `window=0`. `windowStart = now - 0 = now` -> `zcount(key, now, now)` -> 0 -> jamais limite. Un administrateur qui configure mal les rate limits peut les desactiver accidentellement.
- [ ] **[MOYEN] Scenario 24** : **TOCTOU dans Redis** : `zcount` puis `zadd` ne sont PAS atomiques. Si deux requetes arrivent exactement au meme moment et que `zcount` retourne `limit-1` pour les DEUX, les DEUX verront `count < limit` et les DEUX feront `zadd`. Le compteur depasserait la limite de 1.

### 1.6 - `withContentModeration` middleware

#### Deja teste
- [x] `extractTextFromInput` : null, undefined, non-object, objet vide, champs texte simples (extractText.test.ts)
- [x] Simulation du blocage de contenu (test unitaire partiel)

#### Nouveaux scenarios
- [ ] **[CRITIQUE] Scenario 25** : `withContentModeration` **verifie l'authentification** avant d'executer `extractTextFromInput`. Si `withContentModeration` throw UNAUTHORIZED, le rate limit n'est PAS incremente. Verifier que ce comportement est intentionnel et documente.
- [ ] **[ELEVE] Scenario 26** : `withContentModeration` avec **tous les champs vide** (`""`). `extractTextFromInput({ title: "", description: "" })` -> retourne `" "` (espace). `checkContentBlocklist(" ")` est appele avec un espace. Est-ce que ca devrait skip si le texte extrait est juste un espace ?
- [ ] **[MOYEN] Scenario 27** : `withContentModeration` avec `input` qui a des champs texte mais aussi des champs non-string (ex: `{ title: "test", count: 0, active: false }`). Seul `title` est extrait.
- [ ] **[CRITIQUE] Scenario 28** : `withContentModeration` - le message d'erreur quand le contenu est bloque est **en anglais** : `"Authentication required for content moderation"` vs `"Contenu refuse par la moderation"` pour le blocklist. **Incoherence i18n** - toutes les autres erreurs sont en francais.
- [ ] **[MOYEN] Scenario 29** : `withContentModeration` avec `input` qui a des champs texte contenant 100 000 caracteres. `extractTextFromInput` va concatener avec `join(" ")` -> chaine potentiellement enorme. Risque de performance ou crash sur tres longues entrees.

### 1.7 - `withVersioning` middleware

#### Deja teste
- [x] Structure du routeur versionne (api-versioning.test.ts)
- [x] Header X-API-Version prioritaire sur path version

#### Nouveaux scenarios
- [ ] **[ELEVE] Scenario 30** : `withVersioning` detecte la version depuis le path (`path.startsWith("v1.")`). Pour des paths comme `v10.scenarios.feed` : `path.startsWith("v10.")` -> `pathVersion = "v10"` (car pas de verification que c'est exactement "v1").
- [ ] **[MOYEN] Scenario 31** : Header `x-api-version` avec valeur **invalide** (ex: `"v0.5"`, `"latest"`, `"1.0"`, `"abc"`). Il n'y a AUCUNE validation sur la valeur du header.
- [ ] **[MOYEN] Scenario 32** : Header `x-api-version` avec **espaces** (ex: `" v1 "`). `.toLowerCase()` -> `" v1 "` (espaces conserves). Le trim n'est pas fait.
- [ ] **[ELEVE] Scenario 33** : Les routeurs v1 sont des clones des routeurs non-versionnes - ils n'utilisent PAS `ctx.apiVersion`. Tester qu'une procedure v1 ignore le header si elle ne le lit pas.

### 1.8 - `withTracing` middleware

#### Nouveaux scenarios
- [ ] **[MOYEN] Scenario 34** : `withTracing` avec `ctx.requestId` deja present (ex: appel depuis un autre middleware). `runWithContext` recoit `requestId` et `userId`. Si le contexte est deja present, il est ecrase.
- [ ] **[ELEVE] Scenario 35** : `withTracing` est execute **MEME** si `isAuthenticated` throw UNAUTHORIZED. Verifier E2E qu'une requete non-auth a une procedure protegee laisse une trace (log + `runWithContext`).

---

## 2. `src/lib/auth.ts` - Sessions, Tokens & Authentification

### 2.1 - `authorize` - Rate limit sur login

#### Deja teste
- [x] Timing-constant avec DUMMY_HASH (auth.test.ts)
- [x] Format bcrypt valide du DUMMY_HASH

#### Nouveaux scenarios
- [ ] **[ELEVE] Scenario 36** : Rate limit login : `checkRateLimit` est appele mais **le catch est vide** `.catch(() => {})`. Si le rate limit lui-meme echoue (Redis down, exception), l'erreur est avalee et la connexion continue. Tester avec Redis down et verifier que le login passe.
- [ ] **[CRITIQUE] Scenario 37** : Rate limit login : le `checkRateLimit` NE THROW PAS quand la limite est atteinte (`TRPCError`). Mais le `catch(() => {})` avale TOUS les throws, y compris le `TOO_MANY_REQUESTS` ! Donc meme si le rate limit est depasse, le login continue. **BUG : le .catch() devrait rethrow le TRPCError.**
- [ ] **[MOYEN] Scenario 38** : **Email normalisation** : le register normalise avec `.toLowerCase()`. C'est coherent avec login. OK.
- [ ] **[MOYEN] Scenario 39** : `authorize` avec un email qui a des **espaces au debut/fin**. `" user@test.com "` -> `.toLowerCase()` -> `" user@test.com "` (espaces conserves). La recherche `findUnique` ne trouvera pas l'email.

### 2.2 - `jwt` callback - Revalidation a chaque acces

#### Deja teste
- [x] Token initial sign-in (auth.test.ts)
- [x] Token re-validation (`tokenVersion` mismatch -> empty token)
- [x] User deleted -> empty token

#### Nouveaux scenarios
- [ ] **[CRITIQUE] Scenario 40** : **Performance** : Le callback `jwt()` fait une requete DB (`db.user.findUnique`) à **CHAQUE acces au token**. C'est une requete DB pour chaque appel tRPC, chaque page load, chaque API call. Tester avec 1000 requetes simultanees -> mesurer le nombre de requetes DB.
- [ ] **[MOYEN] Scenario 41** : **Race condition** : Si deux requetes arrivent exactement au moment ou le `tokenVersion` est incremente (ex: changement de mot de passe), la premiere voit l'ancien tokenVersion, la deuxieme voit le nouveau.
- [ ] **[MOYEN] Scenario 42** : `token["lastVerified"] = Date.now()` est stocke mais JAMAIS LU. C'est une valeur morte.
- [ ] **[ELEVE] Scenario 43** : **Token vide** : Si `dbUser` non trouve ou `deletedAt` set ou `tokenVersion` mismatch -> `return {}`. Tester E2E : modifier `tokenVersion` en DB -> la prochaine requete doit deconnecter l'utilisateur.
- [ ] **[CRITIQUE] Scenario 44** : **Race condition de suppression** : Admin supprime un utilisateur -> `tokenVersion` incremente. Mais si la requete DB arrive ENTRE l'update et le commit, elle peut voir `deletedAt: null`.

### 2.3 - `session` callback

#### Nouveaux scenarios
- [ ] **[MOYEN] Scenario 45** : Le callback `session()` lit le `role` depuis le token JWT, PAS depuis la DB. Si `jwt()` ne s'execute pas (ex: requete sans token refresh), la session peut retourner un role perime.
- [ ] **[MOYEN] Scenario 46** : `session.user.role = t.role` ou `t` est caste du token. Si `t.role` est `undefined`, `session.user.role = undefined`.

### 2.4 - Configuration NextAuth

#### Nouveaux scenarios
- [ ] **[ELEVE] Scenario 47** : `maxAge: 24 * 60 * 60` (24 heures). Tester une session qui dure exactement 24h + 1 seconde -> deconnexion forcee.

---

## 3. `src/server/middleware/csrf.ts` - Protection CSRF

#### Deja teste
- [x] `isOriginAllowed` : meme origine, sous-domaine, port different, schema different, trusted origins (csrf.test.ts)
- [x] `validateCSRF` : Origin present, Origin absent avec allowMissingOrigin, Origin interdit

#### Nouveaux scenarios
- [ ] **[ELEVE] Scenario 48** : `isOriginAllowed` avec origin qui a un **port par defaut explicite** (ex: `https://echoroom.app:443`). `new URL("https://echoroom.app:443").origin` != `new URL("https://echoroom.app").origin`.
- [ ] **[MOYEN] Scenario 49** : `isOriginAllowed` avec des **origins trusted mal formatees** dans `trustedOrigins`. La boucle a un try/catch pour `new URL(trusted)`. Si une URL est invalide, silencieusement ignoree.
- [ ] **[MOYEN] Scenario 50** : `validateCSRF` avec Origin = `"null"` (chaine litterale). `isOriginAllowed("null", config)` -> `new URL("null")` throw -> return false -> FORBIDDEN.
- [ ] **[ELEVE] Scenario 51** : `validateCSRF` avec **Origin et Referer tous deux absents** et `allowMissingOrigin: false`. `sourceOrigin = null` -> `throw CSRFFailure`.

---

## 4. `src/server/middleware/rateLimit.ts` - Rate Limiting Redis

#### Deja teste
- [x] Redis disponible -> rate limit fonctionne (rateLimit.test.ts)
- [x] Redis down -> fallback in-memory
- [x] Limite atteinte -> TRPCError TOO_MANY_REQUESTS

#### Nouveaux scenarios
- [ ] **[CRITIQUE] Scenario 52** : `redisUnavailableLogged` est une variable **module-level**. Une fois passee `true`, elle ne repasse JAMAIS `false`, meme si Redis redevient disponible puis re-crash. Tester : Redis down -> up -> down -> verifier un seul log warning.
- [ ] **[ELEVE] Scenario 53** : **Race condition Redis** : `zcount` puis `zadd` non atomiques. Sous charge concurrente elevee, le compteur peut depasser la limite.
- [ ] **[MOYEN] Scenario 54** : Fallback in-memory : en **multi-instance**, le compteur in-memory est PER-INSTANCE. Tester : 3 processus Node.js, simuler Redis down, verifier que `3 * limit` requetes passent.
- [ ] **[ELEVE] Scenario 55** : `redis.expire(key, windowSec)` appele APRES chaque `zadd`. Si Redis crash entre `zadd` et `expire`, la cle n'expire jamais. Fuite memoire Redis.

---

## 5. `src/server/middleware/ipRateLimit.ts` - IP Rate Limiting

#### Deja teste
- [x] Redis disponible -> rate limit (ipRateLimit.test.ts)
- [x] Redis down -> fallback in-memory

#### Nouveaux scenarios
- [ ] **[CRITIQUE] Scenario 56** : **IP Spoofing** : `x-forwarded-for` peut etre un header forge par le client. `x-forwarded-for?.split(",")[0]?.trim()` prend la PREMIERE IP. Un attaquant peut changer le header a chaque requete pour contourner le rate limit.
- [ ] **[ELEVE] Scenario 57** : `x-forwarded-for` avec **IP multiples** : `"client, proxy1, proxy2"`. `.split(",")[0]?.trim()` -> `"client"`. Si le proxy reseau ajoute l'IP en TETE, la premiere IP est le proxy.
- [ ] **[MOYEN] Scenario 58** : **IPv6** dans les headers : `x-forwarded-for` peut contenir `"2001:db8::1"`. Pas de traitement special pour IPv6.
- [ ] **[MOYEN] Scenario 59** : `warnLogged` variable module-level - meme pattern que `redisUnavailableLogged`. Limite.

---

## 6. `src/server/middleware/rateLimitStore.ts` - In-Memory Store

#### Deja teste
- [x] Check basique (rateLimitStore.test.ts)
- [x] Nettoyage periodique, eviction 25% quand > 100K entrees

#### Nouveaux scenarios
- [ ] **[ELEVE] Scenario 60** : **Window alignment** : `const windowStart = now - (now % (windowSec * 1000))` aligne la fenetre sur l'horloge. Comportement deterministe.
- [ ] **[ELEVE] Scenario 61** : **Eviction quand > 100 000 entrees** : trie toutes les entrees par `resetAt` et supprime les 25%. Tester le comportement avec 100 000+ entrees pour la memoire.
- [ ] **[MOYEN] Scenario 62** : La methode `check` cree une nouvelle entree avec `count: 1` meme si la cle n'existait pas. Edge case avec `limit = 0`.

---

## 7. `src/server/middleware/metrics.ts` - RED Metrics

#### Deja teste
- [x] Collecte des metriques sur requete reussie (metrics.test.ts)
- [x] Collecte sur erreur, PostHog tracking

#### Nouveaux scenarios
- [ ] **[ELEVE] Scenario 63** : La map `metricsMap` a taille max 1000 entrees. Quand pleine, une entree aleatoire est supprimee. Tester avec 1001+ endpoints uniques.
- [ ] **[MOYEN] Scenario 64** : `trackEvent` est **fire-and-forget** avec `.catch(() => {})`. Si PostHog est down, evenements perdus.
- [ ] **[MOYEN] Scenario 65** : Le endpoint est `${type}:${path}`. `type` peut etre `"query"`, `"mutation"`, ou `"subscription"`.
- [ ] **[MOYEN] Scenario 66** : `getREDMetrics()` retourne un snapshot. Peut etre incoherent si appele entre deux updates.

---

## 8. `src/middleware.ts` - Next.js Middleware

#### Deja teste
- [x] Chemins publics accessibles sans auth (middleware.test.ts)
- [x] Redirection `/dashboard` sans auth -> `/login?callbackUrl=...`
- [x] Admin guard : USER redirect, ADMIN pass
- [x] Security headers

#### Nouveaux scenarios
- [ ] **[CRITIQUE] Scenario 67** : **callbackUrl sanitization** : Le parametre `callbackUrl` est mis a `pathname` sans validation. Open redirect possible : `https://echoroom.app/login?callbackUrl=https://evil.com`.
- [ ] **[MOYEN] Scenario 68** : MODERATOR role sur `/admin` : `"MODERATOR" !== "ADMIN"` -> true -> redirect. Cohrent mais limitant.
- [ ] **[MOYEN] Scenario 69** : **Trailing slash** : `/dashboard/` attrape par `startsWith`. Mais `/Dashboard` (capital D) -> pas attrape car case-sensitive.
- [ ] **[ELEVE] Scenario 70** : `withSecurityHeaders` ajoute `Permissions-Policy: microphone=()` mais le site utilise la microphone pour les appels Twilio. Verifier que les appels vocaux passent par telephone, pas navigateur.
- [ ] **[ELEVE] Scenario 71** : **HSTS manquant** : `Strict-Transport-Security` n'est PAS dans la liste. Verifier que next.config.mjs le definit.
- [ ] **[MOYEN] Scenario 72** : **Matcher** : le pattern inclut `/api/*`. Verifier que le middleware s'execute bien sur les routes API.

---

## 9. Routeurs tRPC - Scenarios Obscurs par Router

### 9.1 - `auth.ts` (Register & ChangePassword)

#### Deja teste
- [x] Validation mot de passe (auth-router.test.ts)
- [x] Rejet email existant, username existant
- [x] Rejet email jetable, Rate limit register (3/h)
- [x] ChangePassword avec mot de passe incorrect

#### Nouveaux scenarios
- [ ] **[ELEVE] Scenario 73** : **Register - email jetable avec sous-domaines profonds** : `user@a.b.c.mailinator.com`. La verification remonte de `c.mailinator.com` -> pas trouve dans set. Potentiel contournement.
- [ ] **[MOYEN] Scenario 74** : **Register - username avec caracteres speciaux** : `z.string().min(3).max(20)` - pas de regex. Emojis, espaces, Unicode acceptes.
- [ ] **[MOYEN] Scenario 75** : **Register - rate limit (3/h) non teste** : Tester 4 inscriptions -> la 4eme doit retourner TOO_MANY_REQUESTS.
- [ ] **[ELEVE] Scenario 76** : **Register - consentAccepted: false** : Le schema Zod attend `z.boolean()`. `false` accepte par Zod mais le handler throw BAD_REQUEST.
- [ ] **[CRITIQUE] Scenario 77** : **ChangePassword - tokenVersion increment** : Quand le mot de passe change, `tokenVersion: { increment: 1 }` invalide tous les autres JWT. Tester : changer mot de passe -> les autres sessions deconnectees.

### 9.2 - `scenarios.ts` (Create, Feed, Trending, Update, Delete)

#### Deja teste
- [x] Create avec spam detecte, Feed avec pagination
- [x] Trending avec calcul de score, GetById avec permissions
- [x] Update avec verification createur, Delete avec verification createur
- [x] Cache Redis, WithContentModeration, WithRateLimit

#### Nouveaux scenarios
- [ ] **[ELEVE] Scenario 78** : **Feed - TRENDING sort avec cache incoherent** : Le cache est base sur `{ sort, limit }`. Si les donnees changent (nouveau like) pendant que le cache est chaud, cache retourne donnees perimees.
- [ ] **[MOYEN] Scenario 79** : **Feed - effectiveLimit = 50 pour TRENDING** : On fetch 50 items puis sort in-memory. Si > 50 scenarios, les plus vieux sont perdus.
- [ ] **[CRITIQUE] Scenario 80** : **Feed - curseur invalide** : Si le curseur est un ID inexistant, `skip: 1, cursor: { id: cursor }` throw Prisma P2023. Non catche -> 500.
- [ ] **[ELEVE] Scenario 81** : **Create - asyncModeration fire-and-forget** : `void scheduleAsyncModeration(...)`. Si throw, erreur avalee. Contenu potentiellement à risque jamais modere.
- [ ] **[CRITIQUE] Scenario 82** : **Update - race condition** : Entre `findUnique` (verification createur) et `update`, un autre appel peut supprimer le scenario. `update` sur ID inexistant throw P2025 -> 500 au lieu de NOT_FOUND.
- [ ] **[MOYEN] Scenario 83** : **Delete - invalidateFeedCache** : Si Redis down, cache non invalide.

### 9.3 - `calls.ts` (Start, History, TodayCount, Replay)

#### Deja teste
- [x] todayCount avec mock date, start avec blocked number
- [x] history avec pagination, replay avec ownership check

#### Nouveaux scenarios
- [ ] **[ELEVE] Scenario 84** : **Start - Phone number NFKC normalization** : `.transform(val => val.normalize("NFKC"))` normalise Unicode. Tester `+33612345678` avec caracteres fullwidth.
- [ ] **[ELEVE] Scenario 85** : **Start - Cache invalidation avec `redis.keys`** : `redis.keys('cache:calls:history:${userId}:*')`. `KEYS` est O(N) et bloque Redis. Devrait utiliser `SCAN`.
- [ ] **[MOYEN] Scenario 86** : **Start - AppError mapping manquant** : `NUMBER_BLOCKED`, `CREDIT_DEBIT_FAILED`, `USER_IN_ACTIVE_CALL` non mappes -> 500.
- [ ] **[MOYEN] Scenario 87** : **Replay - getPresignedUrl throw** : Si R2 down, erreur 500 non-catchee.

### 9.4 - `admin.ts` (Moderation, Users, DLQ)

#### Deja teste
- [x] Moderation queue, Approve/reject scenario/comment
- [x] Block/unblock number, Delete user
- [x] Audit logs, Abuse reports, DLQ, GDPR purge

#### Nouveaux scenarios
- [ ] **[ELEVE] Scenario 88** : **featureScenario - upsert race condition** : Deux admins feature le meme jour -> Prisma P2002 non catche -> 500.
- [ ] **[CRITIQUE] Scenario 89** : **deleteUser - `updateMany` avec `deletedAt: null`** : Tester appel sur compte deja supprime -> CONFLICT.
- [ ] **[MOYEN] Scenario 90** : **blockNumber - hashPhoneForAudit avec AUDIT_HASH_SECRET manquant** : `createHmac("sha256", undefined)` throw.
- [ ] **[MOYEN] Scenario 91** : **getAuditLogs - cache invalidation jamais faite** : Logs mis en cache 60s mais jamais invalides.
- [ ] **[ELEVE] Scenario 92** : **listUsers - search avec caracteres speciaux** : `%` et `_` interpretes comme wildcards LIKE.
- [ ] **[ELEVE] Scenario 93** : **getDLQ - JSON.parse sans validation** : Entree corrompue -> JSON.parse throw -> 500.

### 9.5 - `profile.ts` (Me, Update, Export, Delete Account)

#### Deja teste
- [x] me - credits fallback, updateProfile - username validation
- [x] exportData - phone masking, GDPR data export
- [x] deleteMyAccount - soft delete + anonymization + tokenVersion

#### Nouveaux scenarios
- [ ] **[ELEVE] Scenario 94** : **me - credits fallback** : Si `billing` ET `user.credits` sont null/undefined, `credits` = undefined.
- [ ] **[CRITIQUE] Scenario 95** : **deleteMyAccount - PAS de verification d'appels actifs** : Contrairement a `withdrawConsent`, l'utilisateur peut supprimer le compte pendant un appel actif.
- [ ] **[ELEVE] Scenario 96** : **exportData - decryptPhoneNumber throw catch** : Si `call.phoneNumber.length < 4`, `slice(-4)` peut retourner chaine plus courte.

### 9.6 - `community.ts` (Comment, GetComments, ReportAbuse)

#### Deja teste
- [x] comment - spam detection, asyncModeration schedule
- [x] getComments - seulement APPROVED, pagination
- [x] reportAbuse - CONFLICT sur double report

#### Nouveaux scenarios
- [ ] **[ELEVE] Scenario 97** : **comment - XSS dans content** : Aucune sanitization HTML. `<script>alert('XSS')</script>` stocke tel quel.
- [ ] **[MOYEN] Scenario 98** : **reportAbuse - targetType sans validation** : `z.string().min(1).max(50)`. Pas d'enum.
- [ ] **[MOYEN] Scenario 99** : **reportAbuse - rate limit (10/h)** : Tester 11 signalements.

### 9.7 - `social.ts` (ToggleLike, GetReactions, Leaderboard, Share)

#### Deja teste
- [x] toggleLike - add/remove, UserSocial upsert, badge award
- [x] getReactions, leaderboard, getBadges, trackShare

#### Nouveaux scenarios
- [ ] **[ELEVE] Scenario 100** : **toggleLike - race condition** : Deux clics simultanes -> `reaction.create` sur unique constraint throw P2002 non catche -> 500.
- [ ] **[MOYEN] Scenario 101** : **toggleLike - emoji validation** : `emoji: z.string().min(1).max(10)`. N'importe quelle string, pas seulement des emojis.
- [ ] **[MOYEN] Scenario 102** : **trackShare - rate limits doubles** : 60/h user + 30/min IP.

### 9.8 - `dashboard.ts` (GetData)

#### Deja teste
- [x] Agregation des 4 queries, resilience individuelle

#### Nouveaux scenarios
- [ ] **[CRITIQUE] Scenario 103** : **Promise.all avec .catch() sur CHAQUE requete** : Si TOUTES echouent, dashboard vide mais pas crash.
- [ ] **[ELEVE] Scenario 104** : **GetData - pas de cache** : Chaque chargement = 4 requetes DB.

### 9.9 - `user.ts` (Badges, Deletion, Consent)

#### Deja teste
- [x] badges, myDeletionStatus, withdrawConsent, reconsent, getConsentStatus

#### Nouveaux scenarios
- [ ] **[ELEVE] Scenario 105** : **withdrawConsent - active call guard TOCTOU** : Entre findFirst et update dans la transaction, un appel peut etre initie.
- [ ] **[MOYEN] Scenario 106** : **reconsent - PAS de rate limit** : Procedure sans protection.

### 9.10 - `characters.ts`, `billing.ts`, `clips.ts`

#### Nouveaux scenarios
- [ ] **[ELEVE] Scenario 107** : **billing.createCheckout - URL non validee** : `successUrl` construit avec `env.NEXT_PUBLIC_APP_URL`. Si mal formatee, URL invalide.
- [ ] **[MOYEN] Scenario 108** : **clips.create - endTime === startTime** : Refuse par `.refine()`. Duree 0 rejetee.

---

## 10. Routeurs v1 - Snapshot API

#### Nouveaux scenarios
- [ ] **[CRITIQUE] Scenario 109** : **Les routeurs v1 utilisent les MEMES dependances** (db, services) que les routeurs non-versionnes. Si un service change, les deux versions impactees.
- [ ] **[MOYEN] Scenario 110** : **v1 vs latest - differences reelles** : v1 n'a PAS `detectScenarioSpam`, `withREDMetrics`, `generateScript`.
- [ ] **[MOYEN] Scenario 111** : **v1/auth.ts vs auth.ts** : Differences potentielles de validation.

---

## 11. `src/lib/trpc-error.ts` - Client Error Handling

#### Nouveaux scenarios
- [ ] **[ELEVE] Scenario 112** : **useApiToast - message d'erreur non traduit** : `"Authentication required for content moderation"` en anglais -> melange anglais/francais.
- [ ] **[MOYEN] Scenario 113** : **useApiToast - error option jamais utilisee** : `tRPCClientErrorLike.message` est toujours present.
- [ ] **[MOYEN] Scenario 114** : **useApiToast - mutate sans await** : Les erreurs sont avalees (Promise non geree).

---

## 12. Erreurs Prisma Non Catchees (Transverses)

#### Nouveaux scenarios
- [ ] **[CRITIQUE] Scenario 115** : **P2002 (Unique constraint)** - non catche dans `scenarios.create`, `auth.register`, `admin.blockNumber`.
- [ ] **[CRITIQUE] Scenario 116** : **P2025 (Record not found)** - non catche dans `scenarios.update`, `scenarios.delete`, `calls.replay`.
- [ ] **[CRITIQUE] Scenario 117** : **P2023 (Inconsistent cursor)** - non catche dans `scenarios.feed`, `admin.moderationQueue`.
- [ ] **[MOYEN] Scenario 118** : **P2003 (Foreign key)** - non catche dans `community.comment`.
- [ ] **[MOYEN] Scenario 119** : **Timeout DB P1001** - aucun catch dans les handlers.

---

## 13. Transverse - Cache & Redis

#### Nouveaux scenarios
- [ ] **[ELEVE] Scenario 120** : **JSON.parse sans try/catch** dans `admin.getFeaturedScenario`, `admin.moderationQueue`, `calls.history`. Donnees corrompues -> 500.
- [ ] **[MOYEN] Scenario 121** : **Cache invalidation avec wildcard** : `redis.del("admin:moderationQueue:*")` peut bloquer Redis si 10 000 cles.

---

## 14. Transverse - Securite & Permissions

#### Nouveaux scenarios
- [ ] **[CRITIQUE] Scenario 122** : **IDOR** : `calls.replay` verifie ownership. Mais d'autres procedures ? Audit fait.
- [ ] **[ELEVE] Scenario 123** : **Mass assignment** : `scenarios.update` protege par Zod. Tenter d'injecter `creatorId`.

---

## Resume des Decouvertes

| Categorie | Nb scenarios | Critique | Eleve | Moyen |
|-----------|:-----------:|:--------:|:-----:|:-----:|
| 1. trpc.ts - Foundation | 35 | 7 | 10 | 18 |
| 2. auth.ts - Sessions | 11 | 3 | 3 | 5 |
| 3. csrf.ts - CSRF | 4 | 0 | 2 | 2 |
| 4. rateLimit.ts | 4 | 1 | 2 | 1 |
| 5. ipRateLimit.ts | 4 | 1 | 1 | 2 |
| 6. rateLimitStore.ts | 3 | 0 | 2 | 1 |
| 7. metrics.ts | 4 | 0 | 1 | 3 |
| 8. middleware.ts Next.js | 6 | 1 | 3 | 2 |
| 9. Routeurs tRPC (9 routers) | 36 | 6 | 16 | 14 |
| 10. Routeurs v1 | 3 | 1 | 0 | 2 |
| 11. trpc-error.ts | 3 | 0 | 1 | 2 |
| 12. Erreurs Prisma | 5 | 3 | 0 | 2 |
| 13. Cache & Redis | 2 | 0 | 1 | 1 |
| 14. Securite | 2 | 1 | 1 | 0 |
| **TOTAL** | **122** | **23** | **43** | **56** |

### Top 10 Priorites - Bugs Potentiels

| # | Scenario | Risque | Description |
|---|----------|--------|-------------|
| 1 | **Scen. 37** | CRITIQUE | Rate limit login ne throw PAS - `.catch(() => {})` avale aussi TRPCError |
| 2 | **Scen. 80** | CRITIQUE | Curseur invalide dans feed -> Prisma P2023 -> 500 |
| 3 | **Scen. 82** | CRITIQUE | Race condition update scenario -> P2025 -> 500 |
| 4 | **Scen. 115-117** | CRITIQUE | Erreurs Prisma non catchees (P2002, P2025, P2023) dans TOUS les routeurs |
| 5 | **Scen. 67** | CRITIQUE | Open redirect via callbackUrl non validee |
| 6 | **Scen. 40** | CRITIQUE | Performance : requete DB a chaque acces token |
| 7 | **Scen. 95** | CRITIQUE | deleteMyAccount sans verification appel actif |
| 8 | **Scen. 77** | CRITIQUE | tokenVersion increment non verifie E2E |
| 9 | **Scen. 100** | ELEVE | toggleLike race condition -> P2002 -> 500 |
| 10 | **Scen. 52** | CRITIQUE | redisUnavailableLogged ne se reset jamais |

### Fichiers de test impactes

A creer dans `tests/e2e/` ou `src/server/routers/__tests__/`:
- `trpc-csrf-no-req.spec.ts` - Scenarios 1, 6, 7, 8
- `trpc-sanitize-request-id.spec.ts` - Scenarios 2, 3, 4, 9
- `trpc-error-format.spec.ts` - Scenarios 10, 11, 12
- `trpc-authz-edge.spec.ts` - Scenarios 13, 14, 15, 16, 17, 18
- `trpc-ratelimit-edge.spec.ts` - Scenarios 20, 21, 22, 23, 24, 52, 53, 54, 55
- `trpc-content-moderation.spec.ts` - Scenarios 25, 26, 27, 28, 29
- `trpc-versioning-edge.spec.ts` - Scenarios 30, 31, 32, 33
- `auth-rate-limit-bypass.spec.ts` - Scenarios 36, 37
- `auth-jwt-revalidation.spec.ts` - Scenarios 40, 41, 42, 43, 44
- `auth-email-normalization.spec.ts` - Scenario 39
- `csrf-origin-edge.spec.ts` - Scenarios 48, 49, 50, 51
- `middleware-callbackurl-open-redirect.spec.ts` - Scenario 67
- `middleware-case-sensitive.spec.ts` - Scenario 69
- `scenarios-feed-invalid-cursor.spec.ts` - Scenario 80
- `scenarios-update-race-condition.spec.ts` - Scenario 82
- `scenarios-trending-cache-stale.spec.ts` - Scenario 78
- `calls-redis-keys-performance.spec.ts` - Scenario 85
- `admin-featured-race-condition.spec.ts` - Scenario 88
- `admin-dlq-corrupted-data.spec.ts` - Scenario 93
- `profile-delete-active-call.spec.ts` - Scenario 95
- `social-toggle-like-race.spec.ts` - Scenario 100
- `prisma-errors-unhandled.spec.ts` - Scenarios 115, 116, 117
- `redis-cache-json-parse.spec.ts` - Scenario 120
- `auth-tokenversion-invalidation.spec.ts` - Scenario 77
