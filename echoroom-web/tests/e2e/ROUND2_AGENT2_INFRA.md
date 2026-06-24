# ROUND 2 — Agent 2 : Analyse des scénarios de test manquants (Couches Infrastructure)

> **Périmètre** : Prisma, Redis, R2, Stripe, Twilio, OpenAI, ElevenLabs, Deepgram, Webhooks, Cron, Circuit Breaker, GDPR, Cache, Spam Detection, Encryption, SSRF, Billing, Telephony  
> **Date** : 2026-06-24  
> **Méthode** : Analyse exhaustive du code source (3000+ lignes de production, 150+ fichiers)

---

## Table des matières

1. [Prisma / Database Layer](#1-prisma--database-layer)
2. [Redis Layer](#2-redis-layer)
3. [R2 / Cloudflare S3](#3-r2--cloudflare-s3)
4. [Stripe (Checkout, Webhooks, Refunds, Disputes)](#4-stripe)
5. [Twilio (Client, Webhooks, Status, Media Streams)](#5-twilio)
6. [OpenAI / AI Services (Moderation, Conversation, Script)](#6-openai--ai-services)
7. [ElevenLabs (Text-to-Speech)](#7-elevenlabs-tts)
8. [Deepgram (Speech-to-Text)](#8-deepgram-stt)
9. [Circuit Breaker](#9-circuit-breaker)
10. [Cron Jobs (Cleanup, GDPR, Rotation)](#10-cron-jobs)
11. [GDPR / Anonymization](#11-gdpr--anonymization)
12. [Spam Detection (Redis-based)](#12-spam-detection)
13. [Webhook Middleware (RateLimit, Idempotency, DLQ, Twilio validation)](#13-webhook-middleware)
14. [Encryption (Phone numbers)](#14-encryption)
15. [SSRF Protection](#15-ssrf-protection)
16. [Twilio HMAC Token](#16-twilio-hmac-token)
17. [Cache Layer (Character Cache, Scenario Feed Cache)](#17-cache-layer)
18. [Credit Ops / Atomic Debit / Daily Limits](#18-credit-ops)
19. [Telephony (Call Lifecycle, Conversation State)](#19-telephony)
20. [Audio Clip Extractor](#20-audio-clip-extractor)
21. [Cross-cutting : Double-dépense crédits & Race conditions](#21-cross-cutting)
22. [Cross-cutting : Secrets & Configuration](#22-cross-cutting)

---

## 1. Prisma / Database Layer

### Fichiers analysés
- `src/server/db.ts` — PrismaClient singleton
- `src/server/repositories/*.ts` — Tous les repositories (call, user, billing, clip, comment, scenario, badge, featuredScenario, userProfile, userSocial)

### ⬜ Nouveaux scénarios

- [ ] **Connexion Prisma en environnement serverless** : Vérifier que le singleton global survit aux recharges à chaud (Next.js hot reload) sans fuite de connexion. `globalForPrisma` n'est pas vidé sur `module.hot.dispose()` — cela peut causer des connexions dormantes.

- [ ] **Transaction rollback implicite** : Dans `initiateCall()` (callLifecycle.ts:57-91), si `atomicIncrementDailyLimit` réussit mais `atomicDebit` échoue, toute la transaction rollback. Vérifier que le compteur daily limit est bien rollbacké (pas d'incrément « fantôme »).

- [ ] **Transaction rollback sur le webhook Stripe `checkout.session.completed`** (stripe/route.ts:90-105): Si `purchase.create` réussit mais `userBilling.upsert` échoue, la transaction rollback. Mais si le rollback échoue (erreur réseau Postgres), le purchase sera créé sans crédits — vérifier le comportement de Prisma `$transaction` avec `callback` vs `interactive`.

- [ ] **`updateMany` avec `count === 0` silencieux** : Dans `updateStatusWithGuard` (callRepository.ts:43-48), si le `currentStatus` ne correspond pas, `count === 0` est retourné silencieusement. Aucun appelant ne vérifie `count` — `initiateCall()` (callLifecycle.ts:120) ne check pas si la mise à jour a réussi. Ajouter test pour status guard qui échoue sans erreur.

- [ ] **`markAsFailedWithRefund` race condition** (callRepository.ts:72-102): Utilise `status: { notIn: ["FAILED", "COMPLETED"] }` dans updateMany. Si deux webhooks Twilio arrivent simultanément (un "busy" puis "completed"), les deux peuvent passer ce guard. Vérifier que seul l'un des deux exécute le refund.

- [ ] **Cursor-based pagination sans `ORDER BY id` unique** : `findPendingQueue` (commentRepository.ts:50-65) utilise `orderBy: { createdAt: "asc" }` avec cursor sur `id`. Si deux commentaires ont le même `createdAt`, le cursor peut sauter ou dupliquer des entrées. Ajouter `id` dans ORDER BY.

- [ ] **`findTopScenario` (featuredScenarioRepository.ts:29-49) requête N+1** : La méthode charge tous les scénarios PUBLIC/APPROVED des 7 derniers jours avec `_count: { select: { reactions: true } }`. Si des milliers de scénarios existent, cette requête peut faire un seq scan + aggregation coûteuse. Test de performance/boundary.

- [ ] **`upsert` Prisma sans `select`** : Dans `featuredScenarioRepository.upsert` (featuredScenarioRepository.ts:22-27), l'upsert retourne l'entité complète (tous les champs) mais l'appelant (`rotateFeaturedScenario.ts:57`) ignore la valeur de retour. Cela ajoute un coût DB inutile.

- [ ] **Déconnexion Prisma sur arrêt du process** : Aucun `$disconnect()` n'est appelé dans les hooks Next.js (`onExit`) ou lors du redémarrage serverless. Cela peut causer des connexions PostgreSQL non fermées. Test d'intégration : simuler un arrêt et vérifier la libération des connexions.

- [ ] **`datetime` tronqué par Prisma** : `Date` passée à Prisma peut être tronquée au millième de seconde selon le driver PostgreSQL. Vérifier que `cutoff.setDate(cutoff.getDate() - retentionDays)` dans `gdprPurge.ts` ne cause pas de timezone boundary issues (UTC vs serveur local).

- [ ] **Requête `findUnique` avec clé inexistante** : Partout dans le code, `findUnique` retourne `null` silencieusement. Aucun test ne vérifie qu'un `findUnique` d'une clé invalide ne throw pas d'erreur.

- [ ] **`Direct URL` pour Prisma dans les transactions** : `DATABASE_URL` est utilisée partout, mais `DIRECT_URL` est optionnel. En environnement serverless (Vercel), l'absence de `DIRECT_URL` peut causer des timeouts de connexion (PgBouncer ne supporte pas les transactions interactives). Test avec `DIRECT_URL` vs sans.

---

## 2. Redis Layer

### Fichiers analysés
- `src/lib/redis.ts` — Client Redis init
- `src/server/services/telephony/conversationState.ts` — Stockage conversation Redis
- `src/server/services/cache/characterCache.ts` — Cache characters
- `src/server/services/cache/scenarioCache.ts` — Cache feed
- `src/server/middleware/webhookIdempotency.ts` — Idempotence Stripe
- `src/server/middleware/webhookDLQ.ts` — Dead letter queue
- `src/server/services/security/spamDetection.ts` — Spam via Redis
- `src/server/middleware/rateLimitStore.ts` — In-memory fallback rate limit

### ⬜ Nouveaux scénarios

- [ ] **Redis en échec silencieux** : `redis.ts:26-28` catch tout `Error` et laisse `redis = null`. 40+ fonctions dans le codebase ont `if (!redis) return null;`. Aucun test ne vérifie que le système fonctionne en degraded mode quand Redis est down. **Tester TOUS les callers** : conversationState, cache, spamDetection, idempotency, DLQ, rateLimit.

- [ ] **`REDIS_URL` malformée** (redis.ts:13-16) : Si `REDIS_URL` ne parse pas comme URL, un `new URL()` throw et le catch log `"REDIS_URL is malformed"` puis `throw new Error("Invalid REDIS_URL")`. Le `throw` est catch ligne 26 et Redis devient `null`. Tester les 3 cas : URL vide, URL invalide, URL valide mais serveur down.

- [ ] **Race condition `getConversationState + set`** (conversationState.ts:78-99) : `appendMessage` fait un `get` puis un `set` sans atomicité. Si deux webhooks Twilio arrivent simultanément (SpeechResult + StatusCallback), un message peut être perdu. Remplacer par `redis.json.arrappend` (RedisJSON) ou Lua script.

- [ ] **TTL conversation non renouvelé si Redis down** (conversationState.ts:69) : `redis.expire().catch(() => {})` est silencieux. Si Redis tombe après le get mais avant l'expire, le TTL n'est pas renouvelé mais la conversation continue en mémoire — la clé expire prématurément. Tester : Redis down entre `get` et `expire`.

- [ ] **Conflit de clé entre spamDetection et conversationState** : `spam:call:${userId}:${phoneNumber}` vs `conversation:${callSid}`. Vérifier qu'aucune collision de préfixe n'est possible.

- [ ] **`redis.incr` sans expiration si Redis crash** (spamDetection.ts:24-27) : Si `redis.incr` réussit mais `redis.expire` échoue (Redis crash entre les deux), la clé n'a pas d'expiration et reste indéfiniment. Vérifier avec `SET ... EX` atomique.

- [ ] **Cache invalidation par version (characterCache + scenarioCache)** : `invalidateCharacterCache` fait `redis.incr(VERSION_KEY)` suivi de `redis.expire(VERSION_KEY, 3600)`. Si l'incr réussit mais l'expire échoue (Redis down), la version key n'expire jamais. Test de fuite mémoire après 10M invalidations.

- [ ] **Cache feed : clés infinies** (scenarioCache.ts:35-38) : `buildCacheKey` inclut `sort`, `limit`, `cursor` dans la clé. Avec des curseurs différents à chaque page, le nombre de clés peut croître indéfiniment sans mécanisme de garbage collection. Test de croissance mémoire.

- [ ] **Idempotency Stripe : TTL trop court** (webhookIdempotency.ts:6) : 24h de TTL. Si Stripe retransmet un événement après 24h+1s, il sera traité à nouveau. Le downstream `unique constraint` sur `stripePaymentId` stoppe le duplicata, mais la réponse 200 sera envoyée sans l'erreur P2002 — le webhook sera considéré comme réussi. Vérifier que `checkIdempotency` + P2002 sont suffisants.

- [ ] **DLQ Redis : `lrange + del + lpush` non atomique** (webhookDLQ.ts:71-77) : `lrange` lit tous les messages, puis `del` vide la queue, puis `lpush` repousse les messages retryés. Si le processus crash entre `del` et `lpush`, TOUS les messages DLQ sont perdus. Utiliser `lpop` en boucle ou Lua script.

- [ ] **Rate limit Redis + in-memory désynchronisé** (rateLimit.ts:47-76) : Si Redis tombe en cours de route, le fallback in-memory redémarre de zéro — les compteurs Redis sont perdus. Test de transition Redis UP→DOWN→UP.

- [ ] **Conversation state : `JSON.parse` peut throw** (conversationState.ts:66) : `JSON.parse(raw)` sans try/catch direct (catch global ligne 72). Si Redis stocke des données corrompues, `JSON.parse` throw → catch général → retourne `null`. Tester avec données malformées en Redis.

- [ ] **`deleteConversationState` silencieux** (conversationState.ts:147-155) : Si Redis est down, la fonction ne throw pas mais le message d'erreur est loggé. Aucun appelant ne vérifie que la suppression a fonctionné. Tester : Redis down + `del` échoué → état conversation jamais nettoyé.

---

## 3. R2 / Cloudflare S3

### Fichiers analysés
- `src/lib/r2.ts` — S3Client, getR2Key()
- `src/server/services/audio/r2.ts` — uploadAudioBuffer, getPresignedUrl, getAudioStream, deleteAudioFile
- `src/server/services/audio/r2Check.ts` — Bucket privacy check startup

### ⬜ Nouveaux scénarios

- [ ] **`r2Client` non initialisé si R2_ENDPOINT invalide** (lib/r2.ts:4-11) : Le `S3Client` est créé immédiatement sans vérification. Si `R2_ENDPOINT` est une URL invalide, le client throw une erreur seulement au premier appel. Tester avec endpoint malformé.

- [ ] **Upload audio buffer > 100MB** (r2.ts:22-44) : `PutObjectCommand` sans `partNumber` ni multipart upload. Les fichiers > 5GB throw. Les fichiers > 100MB sans `ContentLength` peuvent timeout. Tester avec fichier volumineux (5MB+, 100MB+).

- [ ] **`getR2Key` avec URL malformée** (lib/r2.ts:36-44) : Si `storedUrl` est une URL valide mais qui ne contient pas le bon path pattern (`audio/callSid/turn`), `pathname.replace(/^\//, '')` retourne le path complet sans vérification. Tester avec URL arbitraire : `https://evil.com/path`.

- [ ] **`getR2Key` avec URL ayant des caractères Unicode** : Le pathname peut contenir des caractères non-ASCII. Vérifier le comportement de `new URL()` avec des caractères encodés et non-encodés.

- [ ] **`uploadAudioBuffer` retourne URL publique mais pas la clé** (r2.ts:39-43) : Si `R2_PUBLIC_URL` est configuré, retourne l'URL publique. Sinon, retourne la bare key. Les consommateurs (`synthesizeAndUpload` dans handle-input, r2.ts) supposent que la valeur peut être utilisée avec `getR2Key`. Tester les deux cas.

- [ ] **`getPresignedUrl` timeout** (r2.ts:55-76) : Le TTL par défaut est 3600s (1h). Si le client appelle après 1h, le presigned URL expire avec une erreur 403 (AccessDenied). Le catch log et retourne `null` — l'appelant (`clipExtractor.ts:48`) throw si null. Tester expiration du presigned URL.

- [ ] **`deleteAudioFile` sur clé inexistante** (r2.ts:99-116) : `DeleteObjectCommand` réussit même si l'objet n'existe pas (idempotent). Mais `getR2Key` peut retourner une clé valide pointant vers un objet qui n'existe pas. Aucun log warning. Tester NoSuchKey.

- [ ] **Startup privacy check : échec en production** (r2.ts:119-126) : Le check est non-blocking et ne bloque pas le démarrage. Mais si `ensureBucketPrivacy` throw (erreur réseau), le `.catch()` log juste un warning. Tester : bucket privé, bucket public, bucket inexistant.

- [ ] **`getAudioStream` retourne `ReadableStream` ou `null`** (r2.ts:78-97) : Le cast `response.Body as ReadableStream` peut échouer si la version du SDK retourne un type différent (Readable vs ReadableStream). Tester avec différentes versions du SDK.

- [ ] **`r2Check.ts` : `randomBytes(4).toString("hex")`** (r2Check.ts:7) : Le path de sécurité est déterministe à 8 hex chars = 32 bits. Probabilité de collision faible mais non nulle. Si un vrai fichier existe à ce path, le check HEAD retournera 200 (faux positif).

- [ ] **Credentials R2 expirés** : Si les tokens R2 (accessKeyId/secretAccessKey) expirent entre le démarrage et l'upload, `S3Client` retourne `ExpiredToken`. Vérifier que le catch dans `uploadAudioBuffer` propage correctement (ne throw pas 500).

---

## 4. Stripe

### Fichiers analysés
- `src/lib/stripe.ts` — Stripe client
- `src/server/services/billing/stripe.ts` — createCheckoutSession
- `src/app/api/webhooks/stripe/route.ts` — Webhook handler (POST)

### ⬜ Nouveaux scénarios

- [ ] **Webhook Stripe signature malformée** (stripe/route.ts:42-49) : Si `stripe-signature` header est vide, mal formaté, ou contient des caractères non-ASCII. `constructEvent` throw → catch → pushToDLQ → 400. Tester les variantes d'erreur de signature.

- [ ] **`content-length` manquant ou falsifié** (stripe/route.ts:17-19) : Si `content-length` header est absent, `parseInt("0", 10)` retourne 0, bypassant la limite 100KB. Tester : body > 100KB sans content-length.

- [ ] **Checkout session sans `payment_intent`** (stripe/route.ts:83-87) : Certains modes de paiement (comme les wallets) peuvent compléter une session sans `payment_intent` immédiat. Le code retourne 400. Tester checkout.session.completed avec `payment_intent: null`.

- [ ] **Double `checkout.session.completed` : dépendance unique constraint uniquement** (stripe/route.ts:106-114) : La protection P2002 est au niveau DB, mais si deux webhooks arrivent avant que la première transaction soit commitée, les deux peuvent passer le `findUnique` guard (snapshot isolation PostgreSQL). Tester avec isolation level `SERIALIZABLE` vs `READ COMMITTED`.

- [ ] **`charge.refunded` avant `checkout.session.completed`** (stripe/route.ts:126-174) : Si Stripe envoie `charge.refunded` avant `checkout.session.completed` (rare mais possible avec des paiements asynchrones), `payment_intent` n'existe pas encore dans `Purchase`. Le `updateMany` avec `refundedAt: null` ne match rien → le refund est silencieusement ignoré. Tester l'ordre non-déterministe des webhooks.

- [ ] **Refund partiel : `charge.refunded` avec `amount_refunded < amount`** : Stripe envoie `charge.refunded` même pour des remboursements partiels. Le code révoque TOUS les crédits (`creditsPurchased`), même si seul un montant partiel a été remboursé. Tester refund partiel → sur-révocation de crédits.

- [ ] **Dispute perdue + déjà refundée** (stripe/route.ts:222-255) : Si `charge.dispute.closed` avec `status=lost` arrive après `charge.refunded`, `refundedAt` est déjà défini, donc `updateMany` avec `refundedAt: null` match 0 entrées. Mais le code ne vérifie PAS le `disputedAt` uniquement — il dépend de `refundedAt: null`. Tester dispute lost après refund déjà traité → double perte.

- [ ] **Dispute gagnée mais déjà refundée** (stripe/route.ts:256-274) : Si le merchant gagne une dispute après avoir déjà émis un refund, `disputedAt` est NOT NULL donc le updateMany match. Mais `refundedAt` est déjà défini et les crédits déjà révoqués. Tester `disputedAt: { not: null }` sans vérifier `refundedAt`.

- [ ] **`createCheckoutSession` avec `priceId` inexistant** (stripe/billing.ts:11-14) : Le code throw `Error("Identifiant de tarif inconnu")`. Ce n'est pas un `AppError` mais un `Error` standard — aucun appelant ne catch spécifiquement cette erreur. Tester qu'elle est bien propagée à l'API.

- [ ] **`createCheckoutSession` : mismatch credits/priceId** (stripe/billing.ts:15-18) : Si un attaquant manipule les paramètres client pour demander 1000 crédits avec un priceId qui n'en donne que 100, le throw protège. Mais le test est fait côté serveur — vérifier qu'il n'y a pas de client-side bypass possible.

- [ ] **Webhook Stripe : body déjà parsé par Next.js** : `req.text()` lit le body brut. Si un middleware Next.js a déjà parsé le body (JSON), `req.text()` peut retourner `"[object Object]"` ou être vide. Tester avec différents content-types.

---

## 5. Twilio

### Fichiers analysés
- `src/server/services/telephony/twilio.ts` — Twilio client + circuit breaker
- `src/lib/env.ts` — TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
- `src/app/api/webhooks/twilio/validate.ts` — Twilio request validation
- `src/app/api/webhooks/twilio/route.ts` — Status webhook handler
- `src/app/api/webhooks/twilio/voice/route.ts` — Voice initiation handler
- `src/app/api/webhooks/twilio/voice/handle-input/route.ts` — Gather handler
- `src/app/api/webhooks/twilio/voice/stream/route.ts` — Media Streams (stub)
- `src/server/middleware/twilioWebhook.ts` — Twilio webhook wrapper

### ⬜ Nouveaux scénarios

- [ ] **Twilio client timeout** (twilio.ts:5-7) : Timeout de 10s configuré. Si Twilio API met plus de 10s à répondre (réseau lent, dégradation Twilio), le circuit breaker peut ne pas s'ouvrir car `timeout` est géré par Axios/HTTP, pas par le circuit breaker. Tester : timeout Twilio → circuit breaker half-open.

- [ ] **`wrapTwilioWebhook` : `formData()` body déjà consommé** (twilioWebhook.ts:45) : Si un middleware précédent (Next.js body parser, logger) a déjà lu `req.formData()`, le second appel retourne un FormData vide ou throw. Tester avec body déjà lu.

- [ ] **Twilio signature validation : URL avec token fragment** (validate.ts:17) : `twilio.validateRequest` utilise `req.url`. Si l'URL contient un token avec des caractères spéciaux non-encodés, la validation peut échouer même si la requête est légitime. Tester URL avec token contenant `&`, `=`, `%`.

- [ ] **Twilio webhook status : `callDuration` non-numeric** (twilio/route.ts:55, 189-190) : `Number.parseInt(callDuration, 10)` peut retourner `NaN` si Twilio envoie une chaîne non-numérique. `Number.isNaN` n'est pas vérifié. Tester `callDuration = "abc"` → `NaN` propagé dans le calcul de `duration`.

- [ ] **`completed` webhook avant `handle-input` final** (twilio/route.ts:95-263) : Si l'utilisateur raccroche pendant que `handle-input` traite, le webhook `completed` et `handle-input` peuvent s'exécuter concurrentment. `completed` va update le status et nettoyer Redis, pendant que `handle-input` lit un état Redis déjà nettoyé → `null`. Tester la course handle-input vs statusCallback.

- [ ] **Double `completed` webhook** (twilio/route.ts:125-131) : Le guard `callRecord.status === "COMPLETED"` est checké AVANT la transaction. Mais entre le check et la transaction, un deuxième webhook peut passer le check aussi. La transaction interne double-check (lignes 198-209) protège. Tester spécifiquement ce TOCTOU.

- [ ] **Recording URL invalide / SSRF** (twilio/route.ts:153-158) : `validateRecordingUrl` check l'origine Twilio, mais si l'URL pointe vers un endpoint Twilio valide mais d'un autre compte (`AC_other_account`), la requête Twilio SDK inclut l'Auth Token du compte courant, exposant les credentials. Tester RecordingUrl cross-compte.

- [ ] **`fetchRecordingAudio` via Twilio SDK** (twilio/route.ts:265-298) : `twilioClient.request` est appelé avec l'URI fournie par le webhook. Si `validateRecordingUrl` a une faille, un attaquant peut forcer le serveur à faire une requête vers une URL arbitraire avec le Auth Token Twilio en authentification. Tester bypass de `validateRecordingUrl`.

- [ ] **Voice init : token invalide ou expiré** (twilio/voice/route.ts:56-83) : Si `verifyTwilioToken` retourne `null`, le code tombe dans le fallback (recherche par twilioCallSid). Un attaquant peut forger un token invalide pour forcer le fallback. Tester : token mal formé, token expiré, token avec signature modifiée.

- [ ] **Voice init : fallback par twilioCallSid sans vérification** (twilio/voice/route.ts:86-110) : Si aucun token n'est fourni, le code cherche le call par `twilioCallSid` (fourni par Twilio). Mais un attaquant contrôlant le `CallSid` dans un webhook pourrait initier une conversation avec un scenario/caractère qu'il n'a pas payé. Tester : pas de token → fallback sur un call inexistant.

- [ ] **Handle-input : `speechResult` vide ou null** (handle-input/route.ts:35) : Si `SpeechResult` est null (parole non reconnue par Twilio), le code continue avec `speechResult = ""`. `detectGoodbye("")` retourne false. `checkContent("")` retourne `{ approved: true }`. La conversation tourne sans input utilisateur. Tester boucle infinie sur parole vide.

- [ ] **Handle-input : `SpeechResult` > 10K caractères** (handle-input/route.ts:100-112) : `checkContent` tronque à `MAX_MODERATION_INPUT_LENGTH = 10_000`. Mais le message entier est stocké dans Redis (`appendMessage` ligne 115). Tester overflow de stockage Redis.

- [ ] **Media Streams stub (phase 1) : retourne `<Hangup/>`** (stream/route.ts:30-36) : Le stub actuel raccroche immédiatement. Si ce endpoint est appelé pendant un appel réel, l'appel est coupé. Tester que le stub n'est PAS accessible accidentellement en production (vérifier que la route n'est pas utilisée dans le TwiML).

- [ ] **`wrapTwilioWebhook` : rate limit bypass** (twilioWebhook.ts:35-38) : Si `checkWebhookRateLimit` throw (Redis down, timeout), le catch log warning et laisse passer la requête. Tester la dégradation du rate limit.

---

## 6. OpenAI / AI Services

### Fichiers analysés
- `src/lib/openai.ts` — OpenAI client factory
- `src/server/services/ai/moderation.ts` — Content moderation (blocklist + OpenAI)
- `src/server/services/ai/asyncModeration.ts` — Async moderation (fire-and-forget)
- `src/server/services/ai/conversationEngine.ts` — Conversation engine (GPT-4o-mini)
- `src/server/services/ai/generateScript.ts` — Script generation

### ⬜ Nouveaux scénarios

- [ ] **OpenAI client non initialisé** (openai.ts:10-29) : Si `OPENAI_API_KEY` est manquant, `new OpenAI()` throw et le client devient `null`. Tous les appels à `getOpenAIClient()` retournent `null`, et chaque service (moderation, conversation, generateScript) doit gérer ce cas. **Tester tous les services avec OpenAI down.**

- [ ] **OpenAI `maxRetries=2` + circuit breaker** : Le client OpenAI a ses propres retries (2). Le circuit breaker a aussi sa logique. En cas d'erreur 429 (rate limit), OpenAI retry automatiquement, mais le circuit breaker peut s'ouvrir ENTRE les retries d'OpenAI. Tester l'interaction entre les deux mécanismes de retry.

- [ ] **Moderation : `AbortSignal.timeout(5000)` non nettoyé** (moderation.ts:102) : `AbortSignal.timeout(5000)` est créé à chaque appel. Si la fonction `checkContent` est appelée 1000 fois par seconde (DoS), 1000 timers sont créés. Vérifier le cleanup des AbortSignal.

- [ ] **Moderation : `omni-moderation-latest` modèle non disponible** (moderation.ts:119) : OpenAI peut renommer/déprécier ce modèle. Le catch ligne 137 tombe dans fallback blocklist-only. Tester avec modèle inexistant.

- [ ] **Moderation AI timeout** (moderation.ts:116-124) : Le `signal` passé à OpenAI timeout après 5s. Si OpenAI met plus de 5s, la requête est annulée et le fallback blocklist est utilisé. Mais `signal` est `AbortSignal.timeout(5000)` par défaut, qui ne peut pas être annulé une fois créé. Tester overlap de timeouts.

- [ ] **`moderateOutput` : timeout de 2s** (moderation.ts:157-160) : Si `checkContent` prend plus de 2s (OpenAI lent + blocklist long), `controller.abort()` est appelé mais `checkContent` peut déjà avoir fait sa requête OpenAI (non-annulable après envoi). Tester timeout partiel.

- [ ] **`MODERATION_FAIL_OPEN` jamais testé en production** (moderation.ts:172-176) : Si `MODERATION_FAIL_OPEN` n'est pas défini (ou défini à `"false"` selon la logique de parsing `v !== "false"`), un timeout de modération retourne un message de fallback. Tester les deux valeurs : `"true"`, `"false"`, `"0"`, absent.

- [ ] **AsyncModeration : saturation de la queue** (asyncModeration.ts:13-15) : `MAX_CONCURRENT_JOBS = 5` et `pendingQueue` non limité. Si 10 000 commentaires sont soumis rapidement, la queue mémoire peut atteindre des tailles critiques. Tester : 10 000 appels `scheduleAsyncModeration` simultanés → mémoire saturée.

- [ ] **AsyncModeration : `queueMicrotask` peut ne pas s'exécuter** (asyncModeration.ts:38) : En environnement serverless (Vercel), après la réponse HTTP, le process peut être gelé/arrêté avant que `Promise.resolve().then()` ne s'exécute. Le moderation async est perdu. Tester en environnement serverless.

- [ ] **ConversationEngine : tokens 0 si completion.usage manquant** (conversationEngine.ts:67) : `completion.usage?.total_tokens ?? 0` — si `usage` est `undefined` (modèle plus ancien ou streaming), `tokensUsed = 0`. Mais la facturation réelle est basée sur les tokens réels. Tester avec `usage: undefined`.

- [ ] **`generateScript` : `parseResponses` regression** (generateScript.ts:43-60) : Si OpenAI change le format de sa réponse (ajoute markdown, emojis, etc.), `parseResponses` peut échouer à extraire les réponses, retombant sur `generateDefaultResponses`. Tester avec différents formats de réponse.

- [ ] **generateScript : appel réseau bloquant dans la boucle d'UI** : `generateScenarioScript` est appelé côté client lors de la création d'un scénario. Si OpenAI est lent (5s+), l'utilisateur voit un spinner sans savoir que l'appel API est en cours. Tester timeout utilisateur vs timeout OpenAI.

---

## 7. ElevenLabs (TTS)

### Fichiers analysés
- `src/server/services/audio/tts.ts` — Synthesis speech

### ⬜ Nouveaux scénarios

- [ ] **ElevenLabs client non initialisé** (tts.ts:12-16) : Si `ELEVENLABS_API_KEY` manquant, `new ElevenLabsClient()` throw → `ttsClient = null`. 4 callers différents utilisent `ttsClient` : voice/route.ts, handle-input/route.ts (2 fois : farewell + response), et dans les tests. Tester tous les callers avec ElevenLabs down.

- [ ] **`synthesizeSpeech` timeout 15s** (tts.ts:26-27) : Le timeout est géré via AbortController. Si ElevenLabs met plus de 15s pour un long texte (>1000 car), la requête est annulée. Mais le `finally` (ligne 56) ne catch pas l'AbortError — l'erreur est propagée. Tester timeout → stack trace non catchée.

- [ ] **Stream ElevenLabs : `for await (const chunk of response)` peut boucler indéfiniment** (tts.ts:43) : Si la connexion streaming est interrompue sans erreur explicite, la boucle peut rester bloquée jusqu'au timeout. Ajouter un timeout de lecture de stream.

- [ ] **Texte vide pour ElevenLabs** (tts.ts:18) : Si `text` est vide ou ne contient que des espaces, ElevenLabs peut retourner une erreur ou un stream vide. Tester `text = ""`, `text = "   "`, `text = "\n"`.

- [ ] **`voiceId` invalide** (tts.ts:20) : Si `voiceId` est une chaîne vide ou un ID qui n'existe pas, ElevenLabs throw 422. Le caller `voice/route.ts:169` appelle `ttsClient.textToSpeech.convert` sans try/catch spécifique — l'erreur est propagée et la réponse TwiML est partielle. Tester voiceId inexistant.

- [ ] **ElevenLabs rate limit (429)** : Si trop de requêtes sont envoyées (chaque turn = 1 TTS), ElevenLabs retourne 429. Le circuit breaker s'ouvre après 5 échecs. Mais le délai de 15s (openTimeout) peut être insuffisant pour une rate limit window de 60s. Tester 429 → circuit breaker half-open trop tôt.

- [ ] **Mémoire : accumulation de chunks Uint8Array** (tts.ts:43-53) : La fonction lit tout le stream en mémoire avant de retourner le buffer. Pour un long texte (10 min d'audio ulaw_8000 = 4.8MB), cela passe. Mais en serverless (limite mémoire 1GB), plusieurs appels concurrents peuvent OOM. Tester avec max-size audio.

---

## 8. Deepgram (STT)

### Fichiers analysés
- `src/server/services/audio/transcription.ts` — Deepgram transcription

### ⬜ Nouveaux scénarios

- [ ] **Deepgram client non initialisé** (transcription.ts:12-16) : Si `DEEPGRAM_API_KEY` manquant, `createClient()` throw → `deepgram = null`. `transcribeAudio` retourne `null`. Mais le caller `twilio/route.ts:171` ne check PAS `null` avant de déstructurer `transcriptionResult.transcript`. Tester : Deepgram down → `Cannot read properties of null (reading 'transcript')`.

- [ ] **Timeout Deepgram 15s** (transcription.ts:39-40) : Peut être insuffisant pour un enregistrement de 60+ min. L'AbortController annule la requête mais ne nettoie pas le circuit breaker (`deepgramCircuitBreaker.call` reçoit l'erreur → `onFailure()` → compteur d'échecs incrémenté). Tester timeout long audio → circuit breaker s'ouvre.

- [ ] **Deepgram `error || !result`** (transcription.ts:58-65) : Le SDK Deepgram peut retourner `error` null mais `result` aussi null. Le code retourne `{ transcript: "", confidence: 0, words: [] }` — pas d'erreur loggée. Tester : API retourne `{ error: null, result: null }`.

- [ ] **`alternative.words` peut être `undefined`** (transcription.ts:81-89) : Si le modèle Deepgram retourne un transcript sans word timings. Le `?.map` protège, mais `words` sera un tableau vide. La fonction retourne toujours `words: []`. Tester avec modèle sans word timings.

- [ ] **Deepgram `mimetype` incorrect** (transcription.ts:51) : Le type MIME passé peut ne pas correspondre au format audio réel. Twilio envoie du WAV, mais le `mimetype` par défaut est `"audio/wav"`. Si Twilio change le format (MP3, OGG), la transcription échoue silencieusement. Tester avec différents formats audio.

- [ ] **Enregistrement trop long / trop court** : Deepgram a des limites de taille de fichier. Si l'enregistrement dépasse la limite (typiquement 100MB ou 4h), l'API retourne une erreur. Tester avec un enregistrement vide (0 bytes).

---

## 9. Circuit Breaker

### Fichiers analysés
- `src/server/lib/circuitBreaker.ts` — CircuitBreaker class + factory functions

### ⬜ Nouveaux scénarios

- [ ] **Circuit breaker `HALF_OPEN` → `CLOSED` jamais reset** (circuitBreaker.ts:76-82) : En state `HALF_OPEN`, après `successThreshold` succès, le breaker passe à `CLOSED`. Mais si une erreur survient pendant HALF_OPEN (même une seule), il repasse à `OPEN`. Tester la transition HALF_OPEN→OPEN sur une seule erreur.

- [ ] **Circuit breaker Twilio : `reset()` jamais appelé** : Les 4 circuit breakers sont créés au module load. Il n'y a **aucun mécanisme programmatique de reset** (pas de cron, pas d'admin endpoint). Si un breaker s'ouvre, il reste ouvert jusqu'au timeout (30s pour Twilio, 15s pour les autres). Tester : breaker ouvert → service dead pendant 30s → half-open → un succès le referme.

- [ ] **Circuit breaker non partagé entre instances** : Chaque instance serverless (Vercel) a son propre breaker en mémoire. Si l'instance A a le breaker OPEN (Twilio down), l'instance B (fraîche) démarre avec CLOSED. Tester : plusieurs instances → comportement non cohérent.

- [ ] **`CircuitBreakerOpenError` catché par les appelants** (ex: conversationEngine.ts:43) : `openaiCircuitBreaker.call()` throw `CircuitBreakerOpenError` si le breaker est OPEN. Mais `generateResponse` n'a pas de try/catch autour de l'appel au breaker — l'erreur remonte jusqu'à `handle-input/route.ts:183` où le catch log "Failed to generate response". Tester que `CircuitBreakerOpenError` est bien catché et non propagé en 500.

- [ ] **`onFailure()` appelé pour des erreurs non-liées au service** (circuitBreaker.ts:67) : Si une erreur réseau (DNS, timeout HTTP) survient, elle incrémente le compteur d'échecs, ce qui est correct. Mais si l'erreur vient d'un bug dans le code (TypeError, JSON parse error), le breaker s'ouvre aussi. Tester que les erreurs applicatives ne polluent pas le breaker.

---

## 10. Cron Jobs

### Fichiers analysés
- `src/app/api/cron/cleanup-recordings/route.ts` — Cleanup recordings
- `src/app/api/cron/gdpr-purge/route.ts` — GDPR purge
- `src/app/api/cron/rotate-featured/route.ts` — Rotate featured scenario
- `src/server/jobs/cleanupRecordings.ts` — Batching + deletion
- `src/server/jobs/gdprPurge.ts` — Batching + hard delete
- `src/server/jobs/cleanupAuditLogs.ts` — Delete old audit logs

### ⬜ Nouveaux scénarios

- [ ] **🔴 CRITIQUE : Aucun verrou Redis pour `cleanup-recordings`** (cleanupRecordings.ts) : `gdprPurge.ts` a un lock Redis (`LOCK_KEY = "job:gdpr-purge:lock"`), mais `cleanupRecordings.ts` **n'en a pas**. Si Vercel Cron déclenche deux exécutions simultanées (rare mais possible avec des délais réseau), les deux vont itérer sur les mêmes lots et tenter de supprimer les mêmes fichiers R2 + update DB en même temps. Tester double exécution concurrente → corruption possible.

- [ ] **🔴 CRITIQUE : `cleanupOldRecordings` — `deleteAudioFile` suivi de DB update non atomique** (cleanupRecordings.ts:32-36) : Si `deleteAudioFile` réussit (fichier R2 supprimé) mais `db.call.update` échoue (DB down), le fichier R2 est perdu mais le `recordingUrl` n'est pas null dans la DB → état incohérent. Utiliser transaction qui marque d'abord `recordingUrl = null`, puis suppression async.

- [ ] **🔴 CRITIQUE : Aucun verrou Redis pour `rotate-featured`** : La route cron rotate-featured n'a PAS de lock Redis non plus. Si deux rotations arrivent en même temps (ou le même jour), la seconde va sur-écrire la première. L'upsert est idempotent (même date) mais l'engagement score peut différer entre les deux appels.

- [ ] **Cron auth : `CRON_SECRET` manquant** (tous les cron routes) : Si `CRON_SECRET` n'est pas défini, `expected = ''`, et la comparaison `timingSafeEqual` n'est jamais atteinte car `!expected` retourne 401. Mais en dev, `CRON_SECRET` a une valeur par défaut. Tester : CRON_SECRET vide → 401.

- [ ] **Cron `timingSafeEqual` avec Buffer de longueur différente** (ex: cleanup-recordings/route.ts:42-44) : `tokenBuf.length === expectedBuf.length` est checké, mais si `expected` contient des caractères Unicode multi-byte, `Buffer.from(expected).length` peut différer de la longueur de chaîne. Tester CRON_SECRET avec caractères UTF-8.

- [ ] **GDPR Purge : lock Redis sans release si crash** (gdprPurge.ts:52-55) : Le `finally` exécute `redis.del(LOCK_KEY)`. Mais si le processus est tué (OOM killer, time limit Vercel 300s) entre le lock et le finally, la clé reste avec un TTL de 300s. Pendant 5 minutes, le job ne peut pas s'exécuter. Tester : process tué → lock fantôme.

- [ ] **GDPR Purge : `hardDeleteUser` peut planter en milieu de batch** (gdprPurge.ts:40-43) : Si `hardDeleteUser(userId)` throw (contrainte FK, timeout), l'exception remonte et le `cursor` n'est pas mis à jour. Le job va réessayer le même user au prochain démarrage (boucle infinie de tentatives échouées). Tester : erreur sur un user → arrêt du batch.

- [ ] **`cleanupAuditLogs` : `deleteMany` sans limite** (cleanupAuditLogs.ts:10-12) : Supprime TOUS les audit logs plus vieux que 365 jours en une seule requête. Si des millions d'audit logs existent, cette requête peut locker la table pendant plusieurs secondes/minutes. Tester purge massive (>1M lignes).

- [ ] **`rotateFeaturedScenario` : `findTopScenario` peut retourner des scénarios supprimés** : Il n'y a pas de filtre `deletedAt: null` dans la requête. Si un scénario est soft-deleted (non visible en UI), il peut quand même être sélectionné comme featured.

---

## 11. GDPR / Anonymization

### Fichiers analysés
- `src/server/services/user/anonymization.ts` — anonymizePersonalData
- `src/server/jobs/gdprPurge.ts` — purgeAnonymizedUsers + hardDeleteUser
- `src/app/api/cron/gdpr-purge/route.ts` — Cron endpoint

### ⬜ Nouveaux scénarios

- [ ] **`anonymizePersonalData` : `catch` trop large** (anonymization.ts:21-27) : Si `userProfileRepository.anonymize(tx, userId)` throw (user pas encore créé dans UserProfile), le code upsert crée un nouveau UserProfile propre. Mais si l'exception est d'un autre type (timeout, contrainte DB), l'upsert masque l'erreur. Tester : `anonymize` throw pour timeout → création d'un profil vide non souhaité.

- [ ] **`hardDeleteUser` (gdprPurge.ts:59-109) : ordre des deleteMany peut causer FK violations** : Les deleteMany sont dans un ordre spécifique (calls → scenarios → réactions → comments → purchases → etc.). Si l'ordre est incorrect, une FK violation peut stopper toute la transaction. Tester chaque ordre de suppression.

- [ ] **`hardDeleteUser` : `status: { in: [...] as any }`** (gdprPurge.ts:69) : Le cast `as any` bypass la typage TypeScript. Si l'enum `CallStatus` change (ajout/suppression d'un statut), le code devient silencieusement invalide. Tester avec des status manquants.

- [ ] **`anonymizePersonalData` : `comment.updateMany` avec `userId` (anonymization.ts:47) : Les commentaires sont anonymisés avec le texte "[Commentaire supprimé]". Mais si l'utilisateur re-s'inscrit avec le même email, ses anciens commentaires (avec le contenu effacé) sont toujours associés à son nouveau compte via `userId` qui n'a PAS été changé. Le `userId` dans la table Comment n'est pas supprimé — juste le contenu. GDPR require la suppression du lien personnel, pas juste un pseudonyme.

- [ ] **`hardDeleteUser` : `call.deleteMany` ne supprime pas les enregistrements R2** (gdprPurge.ts:62) : Les calls sont supprimés de la DB, mais les fichiers audio dans R2 (recording URL) restent. **Data leak potentiel** : les enregistrements vocaux d'un utilisateur supprimé persistent jusqu'au cron cleanup-recordings (90 jours). GDPR exige une suppression sous 30 jours.

- [ ] **`purgeAnonymizedUsers` : pas de vérification `anonymizedAt` pour les users sans subscriptions** : La condition WHERE inclut `anonymizedAt: { not: null }`. Si un utilisateur est supprimé (deletedAt) mais n'a jamais été anonymisé (anonymizedAt = null), il n'est jamais purgé. Tester : user deletedAt not null, anonymizedAt null → oublié par la purge.

---

## 12. Spam Detection

### Fichiers analysés
- `src/server/services/security/spamDetection.ts` — Call, scenario, comment spam

### ⬜ Nouveaux scénarios

- [ ] **`redis.incr` race condition : `count === 1` mais expire déjà défini** (spamDetection.ts:24-27) : Si deux requêtes arrivent simultanément, les deux peuvent voir `count === 1` (atomicité garantie par incr) mais une seule appelle `redis.expire`. Si le TTL n'est pas défini (premier appel gagne, second voit count > 1), tout va bien. Tester 1000 appels concurrents → pas de clé sans TTL.

- [ ] **Call spam : clé inclut le numéro de téléphone non hashé** (spamDetection.ts:23) : `spam:call:${userId}:${phoneNumber}` stocke le numéro en clair dans la clé Redis. **Donnée personnelle dans Redis** — potentiel violation GDPR car Redis peut ne pas être encrypté au repos.

- [ ] **Comment spam : hash SHA-256 tronqué à 16 hex** (spamDetection.ts:82,106-107) : `contentHash` tronque le SHA-256 à 64 bits (16 hex chars = 64 bits). Probabilité de collision : ~2^32 pour 4 milliards d'entrées (birthday paradox). Acceptable mais pas documenté. Tester collision de hash.

- [ ] **Comment spam : contenu normalisé avec `trim().toLowerCase()`** (spamDetection.ts:82) : Deux commentaires avec des espaces insécables (U+00A0) vs espaces normaux auront des hash différents. Bypass possible en utilisant des caractères Unicode homoglyphes.

- [ ] **Scenario spam : pas de vérification de contenu** (spamDetection.ts:44-68) : Seulement un compteur par userId. Un attaquant peut créer 10 scénarios différents avec le même contenu sans être détecté. Ajouter hash de contenu optionnel.

---

## 13. Webhook Middleware

### Fichiers analysés
- `src/server/middleware/twilioWebhook.ts` — Twilio webhook wrapper
- `src/server/middleware/webhookIdempotency.ts` — Stripe idempotency
- `src/server/middleware/webhookDLQ.ts` — Dead letter queue
- `src/app/api/webhooks/rateLimit.ts` — Webhook rate limiting (Redis + in-memory)
- `src/server/middleware/rateLimitStore.ts` — In-memory rate limit store

### ⬜ Nouveaux scénarios

- [ ] **`wrapTwilioWebhook` : X-Forwarded-For spoofing** (twilioWebhook.ts:31) : L'IP est extraite du header `x-forwarded-for` qui peut être falsifié par un attaquant. Un attaquant peut ajouter `X-Forwarded-For: 127.0.0.1` pour contourner le rate limit. Tester : IP forgée → rate limit contourné.

- [ ] **`wrapTwilioWebhook` : Twilio validateRequest peut throw** (twilioWebhook.ts:58) : Si `env.TWILIO_AUTH_TOKEN` est undefined ou vide, `twilio.validateRequest` peut throw une erreur non-catchée. Tester : TWILIO_AUTH_TOKEN manquant.

- [ ] **Rate limit Redis : `zremrangebyscore` + `zcard` non atomique** (rateLimit.ts:50-53) : Entre `zremrangebyscore` et `zcard`, une autre requête peut ajouter une entrée, causant un count légèrement supérieur. Acceptable pour du rate limiting mais pas documenté. Tester : la fenêtre glissante peut laisser passer +1 requête.

- [ ] **Rate limit config `stripe:checkout`** (rateLimit.ts:21) : Limite = 20 requêtes par 60 secondes, global (pas par IP). Si Stripe a une indisponibilité et retransmet 20 webhooks en 1s, le 21e est rejeté avec 429. Stripe retry automatiquement les webhooks rejetés, mais cela ajoute du délai. Tester : burst de 20 webhooks Stripe → throttle.

- [ ] **Rate limit in-memory : éviction 25% sans clé prioritaire** (rateLimitStore.ts:67-79) : Quand le store atteint 100 000 entrées, les 25% plus vieilles sont supprimées. Mais une entrée qui vient d'être créée (Twilio voice:init) peut être supprimée immédiatement, permettant un deuxième appel. Tester : éviction → rate limit bypass.

- [ ] **DLQ : `pushToDLQ` sans protection contre les doublons** (webhookDLQ.ts:23-52) : Si un webhook échoue 5 fois, 5 entrées DLQ sont créées. Chaque entrée est indépendante avec `retryCount: 0`. `retryDLQ` va retryer les 5 entrées, et si une réussit, les 4 autres échoueront (4 fois), et seront re-pushées. Tester : boucle de retry infinie pour les doublons DLQ.

---

## 14. Encryption

### Fichiers analysés
- `src/server/lib/encryption.ts` — AES-256-GCM phone encryption

### ⬜ Nouveaux scénarios

- [ ] **Clé d'encryption dérivée par SHA-256** (encryption.ts:19) : `createHash("sha256").update(env.PHONE_ENCRYPTION_KEY).digest()` — une clé à faible entropie (ex: "clé_de_test_32_car_oui_oui_32_") produit des bytes AES-256 déterministes. Pas de KDF (PBKDF2, Argon2). Tester : clé de 32 chars mais faible entropie → pas de protection offline.

- [ ] **Rotation de clé non implémentée** : Le format `v1:` dans le ciphertext est conçu pour supporter la rotation de clé, mais `getEncryptionKey()` utilise TOUJOURS la clé actuelle. Si la clé est changée, les anciens numéros encryptés avec l'ancienne clé ne peuvent plus être déchiffrés. Tester : changement de PHONE_ENCRYPTION_KEY → déchiffrement échoue.

- [ ] **`maskPhoneNumber` : numéro < 6 caractères** (encryption.ts:102-105) : Si `phone.length < 6`, retourne `"******"`. Les numéros d'urgence (15, 17, 18, 112) sont complètement masqués. Tester : numéros courts (15, 112).

- [ ] **`isEncrypted` : faux positif sur texte normal** (encryption.ts:115-119) : Une chaîne comme `"abc:def:ghi:jkl"` ne match pas les patterns. Mais une chaîne comme `"0123456789abcdef0123456789abcdef:..."` match le pattern legacy. Tester : collision de format.

- [ ] **`decryptPhoneNumber` : GCM auth tag mismatch** (encryption.ts:82-89) : Si le ciphertext est corrompu (un bit changé), `setAuthTag` + `final` throw avec un message d'erreur contenant potentiellement des infos cryptographiques. Le message d'erreur est propagé sans sanitization. Tester : corrupt ciphertext → info leak dans le message d'erreur.

---

## 15. SSRF Protection

### Fichiers analysés
- `src/server/lib/ssrf.ts` — URL origin validation

### ⬜ Nouveaux scénarios

- [ ] **`isAllowedTwilioOrigin` regex trop large** (ssrf.ts:1) : `ALLOWED_HOST_PATTERNS = [/^[a-z0-9-]+\.twilio\.com$/i]` — match `evil-twilio.com` (ce n'est PAS un sous-domaine de twilio.com). Tester : `evil-twilio.com` → validé à tort.

- [ ] **`isAllowedTwilioOrigin` ne vérifie pas les sous-domaines imbriqués** : `sub.sub.twilio.com` → match (correct). Mais `twilio.com.evil.com` → ne match pas (correct). Cependant `twili-o.com` (homoglyphe avec tiret vs vrai) passe car le regex ne check pas les caractères Unicode. Tester : `twɪlio.com` (I cyrillique).

- [ ] **`validateRecordingUrl` pathname check** (ssrf.ts:15-16) : Vérifie que le path commence par `/2010-04-01/Accounts/` et contient `/Recordings/`. Mais `//2010-04-01/Accounts//../evil/Recordings/` peut bypass. Tester path traversal.

- [ ] **URL avec credentials** (ssrf.ts:3-10) : `https://user:pass@api.twilio.com/...` → le parse URL fonctionne, mais le hostname est `api.twilio.com` (correct). Cependant les credentials peuvent être utilisés pour de l'information leakage via logs. Tester : credentials dans l'URL.

- [ ] **`fetchRecordingAudio` utilise Twilio SDK avec l'URI non-sécurisée** (twilio/route.ts:270-272) : Même avec `validateRecordingUrl` en amont, si le regex est bypassé, `twilioClient.request` va envoyer une requête signée (avec Auth Token) vers une URL arbitraire. **SSRF critique si `validateRecordingUrl` est bypassé.**

---

## 16. Twilio HMAC Token

### Fichiers analysés
- `src/server/lib/twilioToken.ts` — Token creation + verification

### ⬜ Nouveaux scénarios

- [ ] **Token sans expiration absolue** (twilioToken.ts:50) : Le TTL par défaut est 15 minutes. Mais `verifyTwilioToken` accepte un `maxAgeMs` optionnel. Aucun appelant ne passe de `maxAgeMs` personnalisé. Si l'horloge du serveur est décalée (NTP skew), les tokens peuvent expirer prématurément ou trop tard.

- [ ] **`timingSafeEqual` peut throw** (twilioToken.ts:68) : Si `sigBuf` et `expectedBuf` sont de même longueur mais l'un est vide, `Buffer.from("")` retourne un buffer vide. `timingSafeEqual(buffer, buffer)` ne throw pas. Mais si un des deux est undefined (ce qui ne peut pas arriver ici), ça throw. Tester : token avec signature vide.

- [ ] **Token payload en base64 non signé déchiffrable** (twilioToken.ts:33) : Le payload est en base64url, pas en base64url-encoded cipher. N'importe qui peut décoder le payload (callId, scenarioId). HMAC protège seulement contre la falsification, pas la confidentialité. Tester : token décodé → fuite d'IDs internes.

- [ ] **Token sans `characterId` dans les anciens formats** (twilioToken.ts:14) : `TwilioTokenPayload` a toujours `characterId`, mais `createTwilioToken` dans `handle-input/route.ts:227` passe `"unknown"` si non résolu. Tester : `characterId = "unknown"` → résolution voiceId échoue → pas de synthèse vocale.

---

## 17. Cache Layer

### Fichiers analysés
- `src/server/services/cache/characterCache.ts` — Character list cache
- `src/server/services/cache/scenarioCache.ts` — Feed page cache

### ⬜ Nouveaux scenarii

- [ ] **Cache invalidation : `redis.incr(VERSION_KEY)` sans vérification de débordement** (characterCache.ts:25) : `INCR` sur une clé Redis peut dépasser `Number.MAX_SAFE_INTEGER` (2^53 - 1) après des milliards d'invalidations. En pratique impossible, mais théoriquement, le nombre deviendrait un float approximatif.

- [ ] **Cache serving stale data si Redis est down** : `getCachedCharacters` retourne `null` si Redis est down. L'appelant doit re-query la DB. Mais si Redis est intermittent (down/up), le cache retourne null → DB overload. Tester : Redis flapping → DB spike.

- [ ] **`setCachedCharacters` stocke `JSON.stringify(data)` avec `T` générique** (characterCache.ts:55) : Si `data` contient des `Date` objects, `JSON.stringify` les convertit en string. Au retrieval, `JSON.parse` ne restaure pas les Dates — ce sont des strings. Tester : Date serialization dans le cache.

- [ ] **Feed cache : clé par `cursor` sans limite** (scenarioCache.ts:36-37) : Un utilisateur qui scrolle 100 pages crée 100 clés de cache. Aucune éviction n'est faite sur les vieilles clés de feed. Tester : fuite de mémoire Redis pour les power users.

---

## 18. Credit Ops

### Fichiers analysés
- `src/server/services/billing/creditOps.ts` — atomicDebit, atomicRefund, atomicSafeDecrement
- `src/server/services/billing/dailyLimitOps.ts` — atomicIncrementDailyLimit
- `src/server/repositories/userBillingRepository.ts` — IUserBillingRepository

### ⬜ Nouveaux scénarios

- [ ] **🔴 CRITIQUE : `atomicSafeDecrement` utilise `updateMany` avec `WHERE credits >= amount`** (creditOps.ts:84-93) : Ceci est une opération atomique et correcte. Mais le catch P2014 (creditOps.ts:106-108) : `Prisma.PrismaClientKnownRequestError && error.code === "P2014"` — P2014 signifie "The change you are trying to make would violate the required constraint". Ce code peut être throwé pour d'autres raisons qu'un solde insuffisant (ex: FK violation). Tester : P2014 pour une FK violation → faux message "Crédits insuffisants".

- [ ] **🔴 CRITIQUE : Race condition double-dépense dans `initiateCall`** (callLifecycle.ts:57-91) : La transaction inclut `atomicIncrementDailyLimit` + `atomicDebit` + `create call`. C'est atomique. Mais si l'utilisateur a exactement 1 crédit et lance 2 appels simultanément, les deux `atomicDebit` (via `updateMany` with `WHERE credits >= cost`) vont réussir — un seul passera (updateMany retourne count=0 pour le second). Test spécifique : 100 appels concurrents avec 1 crédit → 1 seul passe.

- [ ] **`atomicRefund` : montant négatif** (creditOps.ts:59-60) : `params.amount <= 0` throw. Mais un appelant peut passer `amount = 0` ou `amount = -5`. L'erreur `AppError` avec code `BAD_REQUEST`. Tester : `atomicRefund(tx, { userId: 'x', amount: -5 })`.

- [ ] **`atomicIncrementDailyLimit` : `currentCallDurationSeconds` undefined** (dailyLimitOps.ts:30-36) : Si `currentCallDurationSeconds` est undefined, `undefined ?? 36000` → `effectiveMaxDuration = 36000`. Mais `whereExtra` est vide, donc la contrainte de durée n'est PAS appliquée. Tester : duration non fournie → limite de durée non appliquée.

- [ ] **`atomicIncrementDailyLimit` : P2002 retry peut échouer avec `count === 0`** (dailyLimitOps.ts:66-88) : Si une transaction concurrente crée la ligne ET incrémente le compteur au-dessus de la limite, le retry `updateMany` retourne `count = 0` et throw `DAILY_LIMIT_EXCEEDED`. Mais si la limite de durée est dépassée et pas la limite de count, le message d'erreur est trompeur. Tester : limite de durée dépassée → message de durée.

- [ ] **`getPurchaseHistory` ordre décroissant** (userBillingRepository.ts:62-74) : Retourne l'historique du plus récent au plus ancien. Aucun appelant ne limite la taille (`take`). Un utilisateur avec 10 000 achats (attaque ou bug) ferait planter la requête. Tester : 10 000 achats → buffer overflow.

---

## 19. Telephony

### Fichiers analysés
- `src/server/services/telephony/callLifecycle.ts` — initiateCall, failCall, withRetry
- `src/server/services/telephony/conversationState.ts` — Conversation Redis state
- `src/server/services/telephony/goodbyeDetector.ts` — Goodbye phrase detection

### ⬜ Nouveaux scénarios

- [ ] **🔴 CRITIQUE : `withRetry` sans vérification d'idempotence** (callLifecycle.ts:15-38) : `withRetry` est utilisé autour de `twilioClient.calls.create` (callLifecycle.ts:104-116). Si `calls.create` réussit côté Twilio mais la réponse HTTP est perdue (timeout réseau), `withRetry` va créer un **DEUXIÈME appel** vers le même numéro. L'utilisateur reçoit deux appels. Tester : timeout réseau → double appel Twilio.

- [ ] **`initiateCall` : `twilioCircuitBreaker.call()` avec `withRetry` imbriqué** (callLifecycle.ts:101-117) : Le circuit breaker englobe `withRetry`. Si un appel échoue 2 fois (withRetry), le circuit breaker voit 1 échec (car withRetry catch et rethrow après 2 tentatives). Mais si withRetry échoue (3 tentatives), le breaker voit 1 échec. Tester : 10 appels échouant chacun 2 fois → breaker s'ouvre après 5 appels (10 échecs réels, 5 breaker).

- [ ] **`initiateCall` : refund sur échec Twilio** (callLifecycle.ts:127-133) : Si `twilioClient.calls.create` échoue (circuit breaker ou Twilio error), `callRepository.markAsFailedWithRefund(call.id, 0)` est appelé. Mais `markAsFailedWithRefund` utilise `$transaction` et upsert le UserBilling. Si l'upsert échoue (contrainte unique issue), le refund est perdu. Tester : refund échoue → crédits consommés sans appel.

- [ ] **`initiateCall` : `createTwilioToken` peut fail si `TWILIO_TOKEN_SECRET` manquant** (callLifecycle.ts:99) : `createTwilioToken` est appelé avec `call.id`, `scenario.id`, `scenario.characterId`. Si `TWILIO_TOKEN_SECRET` est vide, `createHmac("sha256", "")` ne throw pas immédiatement mais `digest()` peut throw. Tester : TWILIO_TOKEN_SECRET vide → token creation échoue.

- [ ] **`updateStatusWithGuard` : pas de vérification si count === 0** (callLifecycle.ts:120-122) : Le retour de `updateStatusWithGuard` n'est pas vérifié. Si le guard échoue (status n'est pas "CALLING"), le call reste en CALLING avec un Twilio SID, mais le code continue comme si tout allait bien. Tester : status déjà changé → état incohérent.

- [ ] **`goodbyeDetector.ts` : regex Unicode peut causer ReDoS** (goodbyeDetector.ts:38-41) : Le pattern `(?<![\\p{L}\\p{N}_])` est un lookbehind qui peut être lent sur de très longues entrées (plusieurs KB). Tester : input de 100KB → temps polynomial.

---

## 20. Audio Clip Extractor

### Fichiers analysés
- `src/server/services/social/clipExtractor.ts` — extractAndUploadClip
- `src/server/services/social/clips.ts` — createClip, getClips, deleteClip

### ⬜ Nouveaux scénarios

- [ ] **🔴 CRITIQUE : `extractAndUploadClip` : Range request sur URL publique** (clipExtractor.ts:60-64) : Le clip extractor génère un presigned URL, puis fait une requête Range avec `fetch`. Si le bucket R2 est public (le startup check n'est peut-être pas encore exécuté), le presigned URL est inutile mais la Range request fonctionne. Si le bucket est privé, le presigned URL est nécessaire. Tester : bucket privé vs public.

- [ ] **`extractAndUploadClip` : timeout de 30s** (clipExtractor.ts:9) : `EXTRACTION_TIMEOUT_MS = 30_000`. Pour un clip de 60 minutes (start=0, end=3600), le byte range est de 0 à 28 800 000 (28MB). Le téléchargement + upload peut prendre plus de 30s. Tester : clip long → timeout → FAILED status.

- [ ] **`extractAndUploadClip` : `startTime` > `endTime`** (clipExtractor.ts:57-58) : Aucune validation que `startTime < endTime`. Si un client envoie `startTime: 100, endTime: 10`, le Range header est `bytes=800000-80000` (invalide). Le serveur R2 retourne 416 (Range Not Satisfiable). Tester : start > end → status FAILED.

- [ ] **`extractAndUploadClip` : `clip.call.recordingUrl` utilisé pour presigned URL** (clipExtractor.ts:47) : `getPresignedUrl(clip.call.recordingUrl)` — si `recordingUrl` est déjà une URL présignée (et non une clé R2), `getR2Key` peut extraire la clé incorrectement. Tester : recordingUrl = presigned URL → extraction échoue.

- [ ] **`getClips` : presign toutes les URLs sans vérification d'expiration** (clips.ts:62-68) : Pour chaque clip, `getPresignedUrl` est appelé avec TTL par défaut (3600s). Si un clip n'a pas de `clipUrl` (encore en PROCESSING), `getPresignedUrl(null)` retourne `null`. Tester : clip en PROCESSING → pas d'URL.

---

## 21. Cross-cutting

### ⬜ Nouveaux scénarios

- [ ] **🔴 CRITIQUE : Double-dépense crédits — race condition généralisée** : Analyse de tous les chemins :
  1. `initiateCall` : transaction atomique (OK)
  2. `handleCompletedCall` : credit reconciliation dans la transaction (OK)
  3. `failCall` → `markAsFailedWithRefund` : transaction avec updateMany guard (OK)
  4. **Mais** : Si `completed` webhook arrive AVANT que `initiateCall` ait fini sa transaction, le call n'a pas encore de `twilioCallSid` → `findUnique` ne trouve rien → pas de completed (perte de l'enregistrement).
  5. **Mais** : Si deux webhooks `completed` arrivent (cf section Twilio), la double-check dans la transaction protège.
  6. **Scenario** : Test spécifique de 100 webhooks concurrents avec timing précis pour trouver la fenêtre TOCTOU.

- [ ] **🔴 CRITIQUE : Circuit breaker telephony : jamais reset** : `createTwilioCircuitBreaker` retourne un breaker `(5, 3, 30_000, "twilio")`. Après 5 échecs, 30 secondes d'OPEN, puis HALF_OPEN. **Aucun reset automatique programmatique** (cron, admin endpoint). Si Twilio est down 10 minutes, le breaker reste OPEN 30s, puis HALF_OPEN, puis referme si échec. Tester : breaker OPEN → impossible de passer des appels → utilisateurs frustrés → pas de monitoring.

- [ ] **Prisma + R2 : incohérence de données si R2 delete fail** : `cleanupRecordings.ts` delete R2 puis update DB. Si R2 échoue (erreur réseau), retry dans le catch mais pas de retry exponentiel. Tester : R2 down → recordingUrl jamais null → fuite de storage.

- [ ] **Twilio + Stripe : dépendances externes simultanées** : Un appel implique Twilio (calls.create), OpenAI (greeting generation), ElevenLabs (TTS), R2 (upload). Si une dépendance est lente (OpenAI 10s), toutes les autres attendent (Twilio timeout 10s). Tester : chien de traîneau (slowest dependency).

- [ ] **Horloge système : dépendance à `Date.now()`** : Partout dans le code (`lastActiveAt`, `iat`, `endedAt`, etc.). Si l'horloge du serveur est modifiée (NTP sync, DST), les calculs de durée peuvent devenir négatifs. Tester : DST change pendant un appel.

- [ ] **Logging avec `getRequestId()`** : Utilisé dans OpenAI, transcription, TTS. Si `requestContext` n'est pas initialisé (ex: appel hors HTTP, comme un cron job), `getRequestId()` peut retourner `undefined`. Tester : cron job → requestId undefined.

- [ ] **PostHog analytics : `flush()` synchrone dans une fonction async** (events.ts:18) : `await flushPosthog()` est appelé après chaque événement. Si PostHog est lent (>500ms), tous les événements analytics ralentissent l'API. Tester : PostHog down → API time.

---

## 22. Configuration & Secrets

### Fichiers analysés
- `src/lib/env.ts` — Zod validation schema + loadEnv()

### ⬜ Nouveaux scénarios

- [ ] **Dev defaults en production** (env.ts:87-96) : Si un secret est encore à la valeur de développement en production, un `Error` est throwé au démarrage. Mais la vérification compare avec `DEV_DEFAULTS[key]` — si le développeur a changé manuellement la valeur dans env.ts (ex: `min(32)` dans le schéma) sans changer la valeur par défaut, le check est obsolète.

- [ ] **`MODERATION_FAIL_OPEN` parsing** (env.ts:35-38) : `v !== "false" && v !== "0"` signifie que `undefined` → `"true"` (default), `"true"` → `true`, `"false"` → `false`, mais `"False"` → `true` (case-sensitive). Tester : `MODERATION_FAIL_OPEN=False` → `true` (bug !).

- [ ] **`NEXTAUTH_SECRET` généré aléatoirement en dev** (env.ts:115-119) : Si `NEXTAUTH_SECRET` n'est pas défini en dev, un secret aléatoire est généré à chaque démarrage. Toutes les sessions existantes deviennent invalides. Tester : redémarrage du serveur → session invalidée.

- [ ] **Variables requises en production mais pas en dev** (env.ts:97-106 vs 109-134) : `NEXT_PUBLIC_APP_URL` n'est pas validé en prod vs dev. Si un développeur oublie de mettre `NEXT_PUBLIC_APP_URL` en production, le fallback `"http://localhost:3000"` est utilisé dans `initiateCall` (callLifecycle.ts:95) → les webhooks Twilio pointent vers localhost !

- [ ] **`validateProductionEnv` incomplet** (env.ts:144-149) : Ne vérifie que `STRIPE_PRICE_STARTER` et `STRIPE_PRICE_PRO`. Manque des variables critiques comme `CRON_SECRET`, `TWILIO_TOKEN_SECRET`, etc.

---

## Récapitulatif

| Service | Scénarios identifiés | 🟡 Critique |
|---------|---------------------|-------------|
| Prisma/DB | 11 | 3 |
| Redis | 16 | 5 |
| R2/Cloudflare | 11 | 2 |
| Stripe | 10 | 3 |
| Twilio | 12 | 4 |
| OpenAI/AI | 10 | 2 |
| ElevenLabs | 7 | 1 |
| Deepgram | 6 | 1 |
| Circuit Breaker | 5 | 2 |
| Cron Jobs | 10 | 4 |
| GDPR/Anonymization | 6 | 3 |
| Spam Detection | 5 | 1 |
| Webhook Middleware | 7 | 2 |
| Encryption | 5 | 2 |
| SSRF | 5 | 2 |
| Twilio Token | 4 | 1 |
| Cache Layer | 4 | 1 |
| Credit Ops | 6 | 2 |
| Telephony | 6 | 3 |
| Audio Clip Extractor | 5 | 1 |
| Cross-cutting | 7 | 2 |
| Configuration | 6 | 2 |
| **TOTAL** | **~168** | **~49** |

Légende : 🟡 Critique = race condition, perte de données, sécurité, ou incohérence d'état en production.

*(Fin du document)*
