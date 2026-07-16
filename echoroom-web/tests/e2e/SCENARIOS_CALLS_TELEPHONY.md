# 📞 Scénarios de Test — Calls, Téléphonie, Audio, Replay, Crédits & Limites

> **Analyse ciblée du code source** — juillet 2026  
> **Périmètre** : `src/server/routers/calls.ts` (+ `v1/calls.ts`), `src/server/services/telephony/*`, `src/server/services/audio/*`, `src/server/services/billing/{creditOps,dailyLimitOps}.ts`, `src/app/api/webhooks/twilio/**`, `src/app/call/[callId]`, `prisma/schema.prisma`  
> **Objectif** : Cataloque de scénarios **NOUVEAUX** (non présents dans `TEST_SCENARIOS.md`, `SCENARIOS_MANQUANTS.md`, `SCENARIOS_OBSCURS.md` §5/§6, `ROUND2_AGENT1_TRPC.md` §9.3).  
> **Légende** : `Succès` / `Échec/Erreur` / `Edge-case` / **`GAP`** (comportement du code contradictoire avec le cahier des charges fourni).  
> **Tiers** : les noms `free`/`starter`/`pro`/`ultra` sont ceux du brief ; en réalité **aucun champ `tier`/`plan` n'existe sur `User`** (voir scénarios GAP).

---

## A. `calls.start` — Validation, Authz, Gating

### A1. `calls.start` — crédits insuffisants → `PRECONDITION_FAILED`
- **Feature**: `calls.start`
- **Type**: Échec/Erreur
- **Description**: Utilisateur `free` avec 0 crédit (`UserBilling.credits = 0`) tente un appel.
- **Préconditions**: User connecté, `UserBilling.credits = 0`, scénario valide.
- **Étapes**: `mutation calls.start({ scenarioId, phoneNumber:"+33612345678", maxDurationSeconds:300 })`.
- **Résultat attendu**: `TRPCError` code `PRECONDITION_FAILED` (map `INSUFFICIENT_CREDITS` → router), message `"Crédits insuffisants"`. Aucun `Call` créé, solde inchangé.
- **Priorité**: P0
- **Flag/Tier**: `free`

### A2. `calls.start` — numéro blacklisté → `FORBIDDEN` **sans création de Call**
- **Feature**: `calls.start`
- **Type**: Échec/Erreur
- **Description**: Le numéro figure dans `BlockedNumber`. Le rejet se fait AVANT `initiateCall` (donc avant débit et avant création de la ligne `Call`).
- **Préconditions**: `blockedNumber` présent pour `+33699999999`.
- **Étapes**: `calls.start` avec ce numéro.
- **Résultat attendu**: `FORBIDDEN` "Ce numéro a été bloqué". **Aucun `Call` créé** et **aucun crédit débité**. Conséquence : le statut `CallStatus.BLOCKED` du schéma est **jamais atteint** par ce chemin (voir A2-GAP).
- **Priorité**: P0

### A3. `calls.start` — format téléphone invalide → `BAD_REQUEST` (frontière regex)
- **Feature**: `calls.start`
- **Type**: Edge-case
- **Description**: La regex `/^\+[1-9]\d{6,14}$/` borne à 7–15 chiffres après le `+`.
- **Préconditions**: User connecté, crédits OK.
- **Étapes**: Tester `+1234567` (7 chiffres = min OK), `+123456` (6 → rejet), `+1234567890123456` (16 → rejet), `0612345678` (sans `+`), `+33 6 12 34 56 78` (espaces), `+abcdefghijk` (lettres).
- **Résultat attendu**: Zod `BAD_REQUEST` pour les cas hors bornes ; message `"Le numéro doit être au format international (ex: +33612345678)"`.
- **Priorité**: P1

### A4. `calls.start` — `maxDurationSeconds` hors bornes → `BAD_REQUEST` (**discrepancy vs brief**)
- **Feature**: `calls.start`
- **Type**: Edge-case / **GAP**
- **Description**: Le brief indique 30–300 s (ultra 600 s). Le code réel : `.min(60).max(3600).default(300)`.
- **Préconditions**: User connecté.
- **Étapes**: `maxDurationSeconds = 59` (→ rejet, alors que 30–59 serait attendu par le brief), `= 3601` (→ rejet), `= 0`, `= 299.5` (float), `= -10` (négatif).
- **Résultat attendu (code actuel)**: `BAD_REQUEST` pour <60 et >3600. **GAP** : le brief promet 30 s min et 600 s max (ultra) — non implémenté.
- **Priorité**: P1
- **Flag/Tier**: `free`/`ultra`

### A5. `calls.start` — détection spam (≥5 appels même numéro / 1 h) → `TOO_MANY_REQUESTS`
- **Feature**: `calls.start`
- **Type**: Échec/Erreur
- **Description**: `detectCallSpam` incrémente une clé Redis `spam:call:{user}:{phone}` et bascule à 5.
- **Préconditions**: Redis dispo, user avec crédits.
- **Étapes**: 5 `calls.start` successifs vers **le même** numéro dans la fenêtre 1 h.
- **Résultat attendu**: Le 5e (count>=5) → `TOO_MANY_REQUESTS` "Trop d'appels vers ce numéro. Réessayez plus tard." Les 4 premiers sont initiés normalement.
- **Priorité**: P1

### A6. `calls.start` — **IDOR : scénario PRIVATE/PENDING/autrui appelable** — **GAP**
- **Feature**: `calls.start`
- **Type**: **GAP** (authz)
- **Description**: `initiateCall` → `scenarioRepository.findByIdWithCharacter` **ne filtre pas** `visibility`/`moderationStatus`, et `calls.start` n'a aucun contrôle de propriété/visibilité.
- **Préconditions**: User A connecté ; scénario de User B en `visibility=PRIVATE` (ou `moderationStatus=PENDING`).
- **Étapes**: `calls.start({ scenarioId: <scenarioB>, phoneNumber:"+33612345678" })`.
- **Résultat attendu (code actuel)**: L'appel est **créé normalement** (débit + Call). **GAP** : le brief exige « scenario must be APPROVED/visible ». À ajouter : contrôle `visibility=PUBLIC && moderationStatus=APPROVED`.
- **Priorité**: P1

### A7. `calls.start` — rate limit 20/h par user → 21e → `TOO_MANY_REQUESTS`
- **Feature**: `calls.start`
- **Type**: Edge-case
- **Description**: `.use(withRateLimit({ limit: 20, window: 3600 }))`.
- **Préconditions**: User avec beaucoup de crédits, numéros différents.
- **Étapes**: 21 `calls.start` (numéros variés pour ne pas déclencher le spam) en < 1 h.
- **Résultat attendu**: Les 20 premiers passent, le 21e → `TOO_MANY_REQUESTS` avec header `Retry-After`.
- **Priorité**: P2

### A8. `calls.start` — **aucun guard « un seul appel actif »** (double submit / 2 onglets) — **GAP**
- **Feature**: `calls.start`
- **Type**: **GAP** (concurrence)
- **Description**: Rien n'empêche 2 `calls.start` simultanés ; chacun débite 1 crédit et crée un `Call` `CALLING`.
- **Préconditions**: User avec 5 crédits, scénario valide.
- **Étapes**: Lancer 2 `calls.start` en parallèle (même scénario, même numéro).
- **Résultat attendu (code actuel)**: 2 `Call` créés, 2 crédits débités. **GAP** : le brief mentionne « concurrent calls per user » → attendu un guard (ex: refus si un `Call` `CALLING`/`RINGING`/`ACTIVE` existe déjà).
- **Priorité**: P2

### A9. `calls.start` — `SCENARIO_NOT_FOUND` → `NOT_FOUND`
- **Feature**: `calls.start`
- **Type**: Échec/Erreur
- **Description**: `scenarioId` inexistant.
- **Étapes**: `calls.start({ scenarioId:"<uuid-invalide>", phoneNumber:"+33612345678" })`.
- **Résultat attendu**: `NOT_FOUND` "Scénario introuvable". Aucun débit.
- **Priorité**: P2

### A10. `calls.start` — AppError non mappé → `500` (code smell)
- **Feature**: `calls.start`
- **Type**: Edge-case
- **Description**: Le `switch` ne gère que `SCENARIO_NOT_FOUND/USER_NOT_FOUND/INSUFFICIENT_CREDITS/TWILIO_ERROR/DAILY_LIMIT_EXCEEDED`. Tout autre `AppError` (ex: `USER_IN_ACTIVE_CALL`, `CREDIT_DEBIT_FAILED`, `NUMBER_BLOCKED`) tombe dans `default` → `INTERNAL_SERVER_ERROR` (500) avec message générique.
- **Étapes**: Forcer un `AppError` hors liste remonté par `initiateCall`.
- **Résultat attendu**: `500` "Erreur inattendue" (message non métier). À corriger : ajouter les codes manquants au mapping.
- **Priorité**: P2

### A11. `calls.start` — `free` peut appeler **n'importe quel personnage** (pas de restriction 8 persos) — **GAP**
- **Feature**: `calls.start`
- **Type**: **GAP** (tier)
- **Description**: Aucune logique de tier. Le brief dit « free : 8 personnages IA only ».
- **Étapes**: User `free` lance un appel sur un scénario utilisant un personnage hors les 8 « gratuits ».
- **Résultat attendu (code actuel)**: Autorisé. **GAP** : restriction non implémentée.
- **Priorité**: P3
- **Flag/Tier**: `free`

---

## B. `billing.creditOps` — Intégrité des crédits (critique revenu)

### B1. **Bug intégrité : la réconciliation en fin d'appel débite `User.credits` legacy, pas `UserBilling`** — **GAP** (P0)
- **Feature**: `billing.creditOps` / `twilio.webhook`
- **Type**: **GAP** (intégrité)
- **Description**: `initiateCall` débite via `atomicDebit` → `userBilling.updateMany` (solde réel, lu par `profile.me`/`billing`). Mais `handleCompletedCall` réconcilie via `tx.user.updateMany({ where:{ id, credits:{gte:creditDiff} } })` → champ **legacy `User.credits`** (jamais affiché).
- **Préconditions**: User avec `UserBilling.credits = 50`, `User.credits` legacy = 5.
- **Étapes**: Appel de 305 s → `costCredits = Math.max(1, ceil(305/60)) = 6` ; `creditDiff = 6 - 1 = 5`.
- **Résultat attendu (code actuel)**: Le solde **réel** `UserBilling.credits` passe à 49 (1 seul crédit débité), et `User.credits` legacy passe de 5 → 0. **GAP** : l'utilisateur n'est débité que de 1 crédit pour un appel de 5+ minutes → **sous-facturation** (fuite de revenu). Correction : réconcilier sur `userBilling`.
- **Priorité**: P0

### B2. **Bug : échec de réconciliation crédit → appel marqué FAILED + perte du crédit prépayé (pas de remboursement)** — **GAP** (P0)
- **Feature**: `billing.creditOps` / `twilio.webhook`
- **Type**: **GAP** (intégrité)
- **Description**: Dans `handleCompletedCall`, si `User.credits` legacy est insuffisant pour `creditDiff`, le `Call` est basculé en `FAILED` mais le `markAsFailedWithRefund` n'est **pas** appelé → le 1 crédit prépayé (sur `UserBilling`) n'est pas remboursé.
- **Préconditions**: `User.credits` legacy = 0, appel de 305 s.
- **Étapes**: Webhook `completed` arrive.
- **Résultat attendu (code actuel)**: `Call` → `FAILED`, `UserBilling.credits` **diminué de 1 et non remboursé**. **GAP** : « les appels échoués remboursent automatiquement » est violé ici. Correction : rembourser via `UserBilling` quand la réconciliation échoue.
- **Priorité**: P0

### B3. Intégrité — concurrence : N appels simultanés, crédits M < N → exactement M réussis, solde jamais négatif
- **Feature**: `billing.creditOps`
- **Type**: Edge-case
- **Description**: `atomicDebit` utilise `updateMany({ where:{ credits:{gte:cost} } })` → atomique au niveau DB.
- **Préconditions**: `UserBilling.credits = 3`.
- **Étapes**: 5 `calls.start` parallèles.
- **Résultat attendu**: Exactement 3 réussis (crédit débité, `Call` créé) ; 2 échouent `INSUFFICIENT_CREDITS` (transaction rollback, pas de `Call`). Solde final = 0, **jamais négatif**.
- **Priorité**: P0

### B4. Échec d'init Twilio → remboursement automatique (1 crédit `UserBilling`)
- **Feature**: `billing.creditOps`
- **Type**: Succès
- **Description**: Si `twilioCircuitBreaker.call(...)` lève (Twilio down / circuit OPEN), `initiateCall` appelle `markAsFailedWithRefund(call.id, 0)`.
- **Préconditions**: User `credits = 10`, circuit breaker Twilio OPEN (5 échecs préalables).
- **Étapes**: `calls.start` → Twilio refuse.
- **Résultat attendu**: `Call` → `FAILED`, `UserBilling.credits` remboursé de 1 (retour à 10). Router → `TWILIO_ERROR` → `INTERNAL_SERVER_ERROR` "Échec de l'appel" (message métier, pas « circuit breaker open »).
- **Priorité**: P0

### B5. **Gap : échec d'init consomme tout de même une place de daily limit** — **GAP**
- **Feature**: `billing.dailyLimitOps`
- **Type**: **GAP**
- **Description**: Dans `initiateCall`, le `dailyCallLimit` est incrémenté **dans la même transaction** que le débit, *avant* l'appel Twilio. En cas d'échec Twilio, seul le crédit est remboursé (`markAsFailedWithRefund`) ; le `dailyCallLimit` n'est **pas** décrémenté.
- **Étapes**: Faire échouer 5 initiations dans la journée.
- **Résultat attendu (code actuel)**: 5 slots de daily limit consommés bien que les appels soient `FAILED`. Le 11e appel *réussi* est refusé `DAILY_LIMIT_EXCEEDED`. **GAP** : un échec d'init ne devrait pas compter comme un appel quotidien.
- **Priorité**: P1

### B6. `atomicRefund` — montant ≤ 0 → `BAD_REQUEST`
- **Feature**: `billing.creditOps`
- **Type**: Edge-case
- **Description**: `atomicRefund` throw `AppError("BAD_REQUEST", "Le montant du remboursement doit être positif")` si `amount <= 0`.
- **Étapes**: Appeler `atomicRefund(tx, { userId, amount: 0 })`.
- **Résultat attendu**: `BAD_REQUEST`. (Note : `markAsFailedWithRefund` rembourse toujours `costCredits` ≥ 1, donc ce chemin n'est pas atteint en prod — mais à tester en unitaire.)
- **Priorité**: P3

### B7. Calcul du coût — durée 0 (CallDuration absent) → `costCredits = 1`
- **Feature**: `billing.creditOps`
- **Type**: Edge-case
- **Description**: `Math.max(1, Math.ceil(0/60)) = 1` (min 1 crédit garanti, conforme brief).
- **Étapes**: Webhook `completed` sans `CallDuration`.
- **Résultat attendu**: `costCredits = 1`, `creditDiff = 0` → pas de réconciliation supplémentaire.
- **Priorité**: P2

### B8. Calcul du coût — durée 305 s → `costCredits = 6`
- **Feature**: `billing.creditOps`
- **Type**: Edge-case
- **Description**: Vérifie la formule `Math.ceil(duration/60)` arrondi par excès.
- **Étapes**: Webhook `completed` avec `CallDuration = "305"`.
- **Résultat attendu**: `costCredits = 6`. (Combien de crédits réellement débités dépend du bug B1 — à coupler avec B1.)
- **Priorité**: P2

### B9. Concurrence — 2 `calls.start` avec 1 seul crédit → 1 réussi, 1 échoue, solde ≥ 0
- **Feature**: `billing.creditOps`
- **Type**: Edge-case
- **Description**: Course sur `atomicDebit` (updateMany atomique).
- **Préconditions**: `UserBilling.credits = 1`.
- **Étapes**: 2 `calls.start` simultanés.
- **Résultat attendu**: 1 `Call` créé, 1 `INSUFFICIENT_CREDITS`. Solde final = 0 (jamais -1).
- **Priorité**: P0

---

## C. `twilio.webhook` (status callback) — Cycle de vie

### C1. Cycle de vie — `initiated` ignoré (no-op), `ringing`→`RINGING`, `in-progress`→`ACTIVE`
- **Feature**: `twilio.webhook`
- **Type**: Succès
- **Description**: Le `switch` ne traite `initiated` que dans le `default` (status reste `PENDING`, `updateMany` count 0 → no-op). `ringing`/`in-progress` mettent à jour le statut.
- **Étapes**: Poster successivement `CallStatus=initiated` puis `ringing` puis `in-progress`.
- **Résultat attendu**: `Call.status` : PENDING → RINGING → ACTIVE. Aucun doublon, `updateMany` idempotent (count 0 si déjà au bon statut).
- **Priorité**: P1

### C2. Idempotence — webhook `completed` rejoué → effet appliqué une seule fois
- **Feature**: `twilio.webhook`
- **Type**: Edge-case
- **Description**: `handleCompletedCall` vérifie `status === COMPLETED || FAILED` → skip.
- **Étapes**: Poster 2× le même webhook `completed`.
- **Résultat attendu**: 1er → `COMPLETED` + transcript + réconciliation. 2e → ignoré (log "already completed/failed"). **Pas de double débit/réconciliation**.
- **Priorité**: P0

### C3. Ordre inversé — `failed/busy/no-answer/canceled` AVANT `completed`
- **Feature**: `twilio.webhook`
- **Type**: Edge-case
- **Description**: Le 1er webhook échoue l'appel (`failCall` → refund) ; le `completed` suivant doit être ignoré.
- **Étapes**: Poster `busy` puis `completed` (même `CallSid`).
- **Résultat attendu**: `Call` → `FAILED` + remboursement (1er). `completed` → skip (idempotence). Statut final `FAILED`, crédits remboursés.
- **Priorité**: P1

### C4. Ordre inversé — `completed` AVANT `busy`
- **Feature**: `twilio.webhook`
- **Type**: Edge-case
- **Description**: Symétrique de C3.
- **Étapes**: Poster `completed` puis `busy`.
- **Résultat attendu**: `Call` → `COMPLETED` (1er). `busy` → `failCall` (`updateMany where status notIn [FAILED,COMPLETED]` → count 0 → no-op). Statut final `COMPLETED`.
- **Priorité**: P1

### C5. `completed` avec `CallSid` orphelin (pas de `Call` en base) → 200 OK, nettoyage state
- **Feature**: `twilio.webhook`
- **Type**: Edge-case
- **Description**: `handleCompletedCall` : `callRecord` introuvable → `setConversationStatus(completed)` + `deleteConversationState`, retourne.
- **Étapes**: Poster `completed` avec un `CallSid` inconnu.
- **Résultat attendu**: `200 {status:"ok"}`, pas de crash, état Redis nettoyé.
- **Priorité**: P2

### C6. Body > 50 KB → `413`
- **Feature**: `twilio.webhook`
- **Type**: Edge-case
- **Description**: `wrapTwilioWebhook` vérifie `content-length > 50_000`.
- **Étapes**: POST avec `Content-Length: 50001` et body > 50 KB.
- **Résultat attendu**: `413` "Requête trop volumineuse" (avant validation de signature).
- **Priorité**: P2

### C7. **Absence du statut `BAILED` dans le schéma** — **GAP**
- **Feature**: `twilio.webhook`
- **Type**: **GAP**
- **Description**: Le brief cite « RINGING→ACTIVE→COMPLETED/BAILED ». L'enum `CallStatus` = `PENDING/RINGING/ACTIVE/COMPLETED/FAILED/BLOCKED/CALLING`. **Pas de `BAILED`.**
- **Étapes**: Vérifier qu'aucun webhook ne bascule un `Call` en `BAILED`.
- **Résultat attendu (code actuel)**: `BAILED` introuvable → soit à ajouter au schéma, soit à retirer du brief.
- **Priorité**: P3

### C8. Deepgram 429/5xx/timeout → transcription nulle, `Call` COMPLETED avec transcript messages
- **Feature**: `twilio.webhook` / `audio.transcription`
- **Type**: Edge-case
- **Description**: `transcribeAudio` retourne `{transcript:"", confidence:0, words:[]}` sur erreur/timeout (15 s). `handleCompletedCall` fusionne `deepgramTranscript` seulement s'il existe.
- **Étapes**: Simuler Deepgram en échec sur le fetch d'enregistrement.
- **Résultat attendu**: `Call` → `COMPLETED`, `recordingUrl` renseigné, `transcript.messages` présent, **pas** de `deepgramTranscript`. Pas de crash.
- **Priorité**: P1

### C9. Fetch enregistrement Twilio en échec (404) → `recordingUrl` null, COMPLETED
- **Feature**: `twilio.webhook` / `audio.r2`
- **Type**: Edge-case
- **Description**: `fetchRecordingAudio` retourne `null` si `statusCode != 200` ou exception.
- **Étapes**: `RecordingUrl` valide (domaine Twilio) mais ressource 404.
- **Résultat attendu**: `Call.recordingUrl = null`, `transcript` = messages conversationnels seulement. `COMPLETED`.
- **Priorité**: P2

---

## D. `twilio.webhook` — Sécurité & Signature

### D1. **Replay attack : même payload signé rejoué N fois** (idempotence end-to-end)
- **Feature**: `twilio.webhook` (security)
- **Type**: Edge-case
- **Description**: Un attaquant rejoue un webhook `completed` légitimement signé 10×.
- **Étapes**: Rejouer 10× le même `completed` signé.
- **Résultat attendu**: 1 seul effet (COMPLETED + réconciliation) ; les 9 autres ignorés (C2). **Aucun débit multiple**.
- **Priorité**: P0

### D2. Token HMAC **expiré (15 min)** dans `voice` → fallback DB par `twilioCallSid`
- **Feature**: `twilio.webhook` / `lib/twilioToken`
- **Type**: Edge-case
- **Description**: `verifyTwilioToken` renvoie `null` si `Date.now()-iat > 15*60*1000`. Dans `voice/route.ts`, le fallback charge le `Call` par `twilioCallSid`.
- **Étapes**: Appel répondu > 15 min après création du token ; `verifyTwilioToken` → null.
- **Résultat attendu**: `voice` résout le scénario via `db.call.findFirst({ where:{ twilioCallSid } })`, statut → `ACTIVE`, TwiML généré. (Comportement tolérant, à documenter.)
- **Priorité**: P2

### D3. Token HMAC expiré dans `handle-input` → `scenarioId="unknown"` → mismatch → hangup
- **Feature**: `twilio.webhook` / `lib/twilioToken`
- **Type**: Edge-case
- **Description**: `handle-input` ne fait **pas** de fallback DB. Token expiré → `scenarioId="unknown"`. Si l'état Redis a un `scenarioId` réel, le check de cohérence `state.scenarioId !== scenarioId` déclenche le rejet.
- **Étapes**: `handle-input` avec token périmé sur une conversation active.
- **Résultat attendu**: TwiML « Erreur de conversation. Veuillez rappeler. » + `hangup`. (Note : si `state.scenarioId === "unknown"`, le mismatch n'est PAS détecté → l'appel continue avec `characterId="unknown"` → voix par défaut.)
- **Priorité**: P2

### D4. Paramètres altérés vs signature → `403`
- **Feature**: `twilio.webhook` (security)
- **Type**: Échec/Erreur
- **Description**: `validateTwilioRequest` recalcule la signature sur `req.url` + `params`. Si un paramètre est modifié (ex: `CallStatus` trafiqué), la signature ne colle pas.
- **Étapes**: Rejouer un webhook valide mais avec `CallStatus` modifié, signature d'origine conservée.
- **Résultat attendu**: `403` "Signature invalide".
- **Priorité**: P0

### D5. Rate limit webhook par IP — `twilio:voice:init` (30/min) → 429
- **Feature**: `twilio.webhook` (security)
- **Type**: Edge-case
- **Description**: `wrapTwilioWebhook` appelle `checkWebhookRateLimit("twilio:voice:init", ip)`.
- **Étapes**: 31 POST vers `/api/webhooks/twilio/voice` depuis la même IP.
- **Résultat attendu**: 31e → `429` + `Retry-After: 60`. Les IP différentes ne sont pas limitées (limite par IP, pas globale).
- **Priorité**: P2

### D6. Clés de rate limit webhook indépendantes (init / input / status / stream)
- **Feature**: `twilio.webhook` (security)
- **Type**: Edge-case
- **Description**: Chaque route utilise sa propre clé (`twilio:voice:init`, `twilio:voice:input`, `twilio:status`, `twilio:voice:stream`).
- **Étapes**: Saturer `twilio:voice:input` (30/min) puis poster sur `twilio:status`.
- **Résultat attendu**: `twilio:status` non impacté (200). Isolation des compteurs.
- **Priorité**: P3

---

## E. `handle-input` / `voice` — Moteur de conversation

### E1. Silence / `SpeechResult` vide (speechTimeout) → message utilisateur vide, pas de crash
- **Feature**: `twilio.webhook` / `handle-input`
- **Type**: Edge-case
- **Description**: Twilio renvoie `SpeechResult=""` en cas de silence. Le code l'ajoute tel quel (`appendMessage user ""`) et interroge le moteur.
- **Étapes**: `handle-input` avec `SpeechResult=""`.
- **Résultat attendu**: Message utilisateur vide ajouté, `generateResponse` appelé, AI répond (possiblement « désolé, je n'ai pas compris »), nouvel `<Gather>` renvoyé. Pas de `goodbye`.
- **Priorité**: P2

### E2. `MAX_TURNS` atteint (20) → `hangup` sans `<Gather>`
- **Feature**: `handle-input`
- **Type**: Edge-case
- **Description**: `if (state.turnCount >= MAX_TURNS) → hangup`.
- **Étapes**: Amener `turnCount` à 20 (ex: seed Redis), puis poster un `SpeechResult`.
- **Résultat attendu**: TwiML `<Hangup/>` (pas de `</Gather>`), pas de nouvel échange.
- **Priorité**: P2

### E3. Dernier tour (`turnCount+1 >= MAX_TURNS`) → message « dernier échange » + `hangup`
- **Feature**: `handle-input`
- **Type**: Edge-case
- **Description**: `isLastTurn = state.turnCount + 1 >= MAX_TURNS`.
- **Étapes**: `turnCount = 19`, poster un `SpeechResult`.
- **Résultat attendu**: Réponse AI suffixée de « Ce sera notre dernier échange. Merci d'avoir appelé! », `status=completed`, `hangup`.
- **Priorité**: P2

### E4. **Faux positif goodbye : « c'est tout à fait vrai » → raccrochage** — nouveau
- **Feature**: `twilio.goodbyeDetector`
- **Type**: Edge-case
- **Description**: La phrase « c'est tout » de la liste matche en préfixe via `(?<![\p{L}\p{N}_])c'est tout(?![\p{L}\p{N}_])`. « c'est tout à fait vrai » → après « tout » vient une espace (non `\p{L}`) → **match** → hangup intempestif.
- **Étapes**: `handle-input` avec `SpeechResult = "c'est tout à fait vrai"`.
- **Résultat attendu (code actuel)**: `detectGoodbye` → `true` → farewell + `hangup`. **Bug UX** : l'utilisateur est coupé alors qu'il n'a pas dit au revoir. À corriger (ex: exiger fin de phrase ou utiliser `c'est tout.`/`c'est tout !`).
- **Priorité**: P2

### E5. **DTMF non géré** — **GAP**
- **Feature**: `twilio.webhook` / `handle-input`
- **Type**: **GAP**
- **Description**: `<Gather input={["speech"]}>` — pas de `dtmf`. Le brief cite « handle-input (DTMF/speech) ».
- **Étapes**: Un utilisateur saisit des touches (DTMF).
- **Résultat attendu (code actuel)**: Les touches ne sont pas traitées (pas de `Digits` dans le route). **GAP** : pas de branche DTMF.
- **Priorité**: P3

### E6. `SpeechResult` très long → pas de crash/truncation
- **Feature**: `handle-input`
- **Type**: Edge-case
- **Description**: Twilio peut renvoyer un `SpeechResult` long.
- **Étapes**: `handle-input` avec un `SpeechResult` de 5000 caractères.
- **Résultat attendu**: Ajouté à l'état, envoyé au moteur (sans troncature côté serveur). Longueur maîtrisée par les limites OpenAI, pas d'exception.
- **Priorité**: P3

### E7. Modération bloque le speech utilisateur → « [Contenu non autorisé] »
- **Feature**: `handle-input` / `ai.moderation`
- **Type**: Edge-case
- **Description**: `checkContent(speechResult)` non approuvé → `moderatedSpeech = "[Contenu non autorisé]"`.
- **Étapes**: `handle-input` avec un speech injurieux.
- **Résultat attendu**: Le message utilisateur stocké = « [Contenu non autorisé] », le moteur répond à ce contenu (fail-open si `checkContent` lève).
- **Priorité**: P2

### E8. TTS ElevenLabs down dans `handle-input` → fallback `<Say>`
- **Feature**: `audio.tts` / `handle-input`
- **Type**: Edge-case
- **Description**: `synthesizeAndUpload` attrape l'erreur → `audioUrl = ""` → `twiml.say`.
- **Étapes**: ElevenLabs indisponible lors d'un `handle-input`.
- **Résultat attendu**: Réponse lue en voix `alice` (Twilio TTS), pas de crash. Conversation continue.
- **Priorité**: P2

### E9. **`handle-input` TTS sans timeout ni circuit breaker** — **GAP**
- **Feature**: `audio.tts` / `handle-input`
- **Type**: **GAP**
- **Description**: `voice/route.ts` et `handle-input` appellent `ttsClient.textToSpeech.convert` **directement** (pas via `synthesizeSpeech` qui a le breaker + 15 s timeout).
- **Étapes**: ElevenLabs lent (répond en 12 s) pendant un `handle-input`.
- **Résultat attendu (code actuel)**: Aucun timeout applicatif ; le webhook dépasse le délai Twilio (10 s) → Twilio retry → potentiel double traitement. **GAP** : utiliser `synthesizeSpeech` (breaker + 15 s) partout.
- **Priorité**: P1

### E10. `voice` — moteur OpenAI down → salutation par défaut
- **Feature**: `ai.conversationEngine` / `voice`
- **Type**: Edge-case
- **Description**: `generateResponse` retourne un fallback si `openai` null ou erreur.
- **Étapes**: OpenAI indisponible au moment du `voice`.
- **Résultat attendu**: `greeting = "Bonjour, vous êtes en ligne avec {character}."` (défaut), statut `ACTIVE`, TwiML généré. Appel continue.
- **Priorité**: P2

### E11. `voice` — token invalide ET pas de `Call` par `twilioCallSid` → scénario « unknown »
- **Feature**: `twilio.webhook` / `voice`
- **Type**: Edge-case
- **Description**: Ni token valide, ni `Call` correspondant → `scenarioId=""`, `systemPrompt` défaut, `voiceId=""`.
- **Étapes**: `voice` avec token falsifié et `CallSid` inconnu.
- **Résultat attendu**: Statut non mis à `ACTIVE` (pas de `callId`), TwiML avec salutation générique + `<Gather>` (car `audioUrl=""` → `<Say>`). Pas de crash.
- **Priorité**: P3

---

## F. Replay (`calls.replay` + UI)

### F1. Forme JSON du `transcript` (shape exacte)
- **Feature**: `calls.replay`
- **Type**: Edge-case
- **Description**: `handleCompletedCall` construit `transcript = { messages:[{id, role, text}], turnCount, deepgramTranscript? }`.
- **Étapes**: Replay d'un `Call` `COMPLETED` avec messages + transcription Deepgram.
- **Résultat attendu**: `transcript.messages[].id` = index 1-based ; `role` ∈ `user`/`assistant` ; `deepgramTranscript` présent seulement si Deepgram a répondu ; `turnCount` = nombre de tours. `recordingUrl` = presigned R2.
- **Priorité**: P1

### F2. Replay d'un `Call` non-`COMPLETED` (FAILED/BLOCKED/PENDING) → `null`/`null`, pas d'erreur
- **Feature**: `calls.replay`
- **Type**: Edge-case
- **Description**: Le brief dit « replay of COMPLETED only ». Le code autorise tout statut et renvoie `recordingUrl=null` (car `recordingUrl` DB null) + `transcript` (peut être null ou partiel).
- **Étapes**: `calls.replay` sur un `Call` `FAILED`.
- **Résultat attendu**: `200`, `recordingUrl=null`, `transcript` = ce qui existe (souvent `null`). **Pas** de `FORBIDDEN`/`NOT_FOUND`. **GAP** vs brief : un `Call` `COMPLETED` est requis pour un replay utile.
- **Priorité**: P2

### F3. **Pas de replay public** — **GAP**
- **Feature**: `calls.replay`
- **Type**: **GAP**
- **Description**: `calls.replay` vérifie strictement `call.userId === ctx.session.user.id` (`FORBIDDEN` sinon). Aucune route publique / lien partageable.
- **Étapes**: User B tente `calls.replay` sur un `Call` `COMPLETED` de User A.
- **Résultat attendu (code actuel)**: `FORBIDDEN` "Cet appel ne vous appartient pas". **GAP** : le brief mentionne « replay permission (owner vs public) » → partage public non implémenté.
- **Priorité**: P2

### F4. Presigned URL R2 expirée (> 1 h) → `403` au playback
- **Feature**: `audio.r2` / `calls.replay`
- **Type**: Edge-case
- **Description**: `getPresignedUrl` (TTL 3600 s). Si l'utilisateur ouvre le replay > 1 h après la génération, l'URL est périmée.
- **Étapes**: Générer le replay, attendre > 1 h, lancer la lecture.
- **Résultat attendu**: `AudioPlayer` → erreur réseau `403` (l'URL signée rejetée par R2). L'UI doit afficher « Chargement impossible » (pas de crash).
- **Priorité**: P2

### F5. `recordingUrl` null (appel échoué) → `AudioPlayer` « Aucun enregistrement disponible »
- **Feature**: `calls.replay` / `AudioPlayer`
- **Type**: Edge-case
- **Description**: `call.recordingUrl` null → `getPresignedUrl(null)` → `null`.
- **Étapes**: `calls.replay` sur un `Call` sans enregistrement.
- **Résultat attendu**: `recordingUrl = null` ; `AudioPlayer` affiche l'état vide « Aucun enregistrement disponible » ; `TranscriptView` affiche le transcript partiel si présent.
- **Priorité**: P3

---

## G. `billing.dailyLimitOps` & Tiers

### G1. 11e appel du jour → `DAILY_LIMIT_EXCEEDED` → `TOO_MANY_REQUESTS`
- **Feature**: `billing.dailyLimitOps`
- **Type**: Edge-case
- **Description**: `atomicIncrementDailyLimit` avec `maxLimit: 10` (hardcodé). Au 11e, `updateMany count=0` + create P2002 retry → `AppError("DAILY_LIMIT_EXCEEDED")`.
- **Étapes**: 11 `calls.start` réussis dans la même journée UTC.
- **Résultat attendu**: 11e → `TOO_MANY_REQUESTS` "Limite quotidienne d'appels atteinte".
- **Priorité**: P1

### G2. Reset à minuit **UTC** (pas local) — edge timezone
- **Feature**: `billing.dailyLimitOps`
- **Type**: Edge-case
- **Description**: `getUTCDayRange()` borne sur UTC. Un utilisateur en fuseau +2 voit sa limite se réinitialiser à 02:00 locale.
- **Étapes**: Atteindre la limite, attendre minuit UTC, relancer.
- **Résultat attendu**: Après minuit UTC, un nouvel `DailyCallLimit` (ou `callCount=0` via nouvelle ligne `date`) → appel autorisé.
- **Priorité**: P2

### G3. **Durée comptée = `maxDurationSeconds` *demandé*, pas durée réelle** — **GAP**
- **Feature**: `billing.dailyLimitOps`
- **Type**: **GAP**
- **Description**: `atomicIncrementDailyLimit` incrémente `totalDurationSeconds` de `currentCallDurationSeconds = params.maxDurationSeconds` (la valeur *demandée*, ex 300), même si l'appel dure 5 s. `effectiveMaxDuration` par défaut = 36000 s (10 h).
- **Étapes**: 10 appels demandés à 300 s mais réels de 5 s.
- **Résultat attendu (code actuel)**: `totalDurationSeconds` = 3000 s, bien que seulement ~50 s consommées. **GAP** : le plafond de durée quotidienne est basé sur la demande, pas l'usage réel.
- **Priorité**: P2

### G4. **Pas de limite « ultra » (maxLimit hardcodé 10 pour tous)** — **GAP**
- **Feature**: `billing.dailyLimitOps` / tiers
- **Type**: **GAP** (tier)
- **Description**: `maxLimit: 10` est constant. Le brief dit « ultra = no daily limit ».
- **Étapes**: User `ultra` (si implémenté) tente un 11e appel.
- **Résultat attendu (code actuel)**: Refusé `DAILY_LIMIT_EXCEEDED` comme les autres tiers. **GAP** : pas de branche `ultra → pas de limite`.
- **Priorité**: P1
- **Flag/Tier**: `ultra`

### G5. **Concurrence daily limit : exactement 10 réussis sous le cap** — race
- **Feature**: `billing.dailyLimitOps`
- **Type**: Edge-case
- **Description**: `updateMany({ where:{ callCount:{lt:10} } })` est atomique.
- **Préconditions**: User avec crédits illimités, journée vierge.
- **Étapes**: 12 `calls.start` parallèles.
- **Résultat attendu**: Exactement 10 `Call` créés ; les 2 restants → `DAILY_LIMIT_EXCEEDED`. Pas de 11e fuité.
- **Priorité**: P1

### G6. **`maxDuration` 3600 pour tous les tiers (pas 600 ultra)** — **GAP**
- **Feature**: `calls.start` / tiers
- **Type**: **GAP** (tier)
- **Description**: Bornes Zod fixes 60–3600. Le brief promet 600 s max pour `ultra`.
- **Étapes**: User `ultra` demande `maxDurationSeconds = 600`.
- **Résultat attendu (code actuel)**: Accepté (≤ 3600). Mais il n'y a **pas** de plafond distinct par tier ; `free` peut aussi demander 3600. **GAP** : pas de gating par tier.
- **Priorité**: P2
- **Flag/Tier**: `ultra`/`free`

---

## H. Audio — TTS / STT résilience

### H1. ElevenLabs `429` → circuit breaker OPEN après 5 échecs → `null` → fallback `<Say>`
- **Feature**: `audio.tts`
- **Type**: Edge-case
- **Description**: `createElevenLabsCircuitBreaker()` (seuil 5, open 15 s). `synthesizeSpeech` (utilisé par `tts.ts` exposé) lève `CircuitBreakerOpenError` → `null`.
- **Étapes**: 6 appels TTS en échec 429.
- **Résultat attendu**: Après 5 échecs, breaker OPEN ; les appels suivants retournent `null` rapidement → `<Say>` fallback. Message « Service temporairement indisponible » (server-side).
- **Priorité**: P2

### H2. ElevenLabs timeout 15 s → `null` → fallback
- **Feature**: `audio.tts`
- **Type**: Edge-case
- **Description**: `synthesizeSpeech` a `setTimeout(15000)` + `AbortController`.
- **Étapes**: ElevenLabs met 20 s à répondre.
- **Résultat attendu**: Abort à 15 s → `null` → `<Say>` fallback. Pas de blocage.
- **Priorité**: P2

### H3. Deepgram timeout 15 s → `null`
- **Feature**: `audio.transcription`
- **Type**: Edge-case
- **Description**: `transcribeAudio` `setTimeout(15000)` + breaker.
- **Étapes**: Deepgram ne répond pas en 15 s.
- **Résultat attendu**: Abort → `null` → `handleCompletedCall` n'ajoute pas `deepgramTranscript`.
- **Priorité**: P3

### H4. Transcription vide / confiance 0 → `transcript:""` stocké
- **Feature**: `audio.transcription`
- **Type**: Edge-case
- **Description**: `result.results.channels[0].alternatives[0]` absent → retour `{transcript:"", confidence:0, words:[]}`.
- **Étapes**: Audio incompréhensible.
- **Résultat attendu**: `deepgramTranscript = ""` (falsy → non fusionné). `Call.transcript` conserve les messages conversationnels.
- **Priorité**: P3

---

## I. Résumé des GAP critiques (à corriger en priorité)

| ID | GAP | Impact | Priorité |
|----|-----|--------|:--------:|
| B1 | Réconciliation fin d'appel débite `User.credits` legacy, pas `UserBilling` → sous-facturation des appels longs | 🔴 Revenu | P0 |
| B2 | Échec de réconciliation → `FAILED` + crédit prépayé non remboursé | 🔴 Revenu/Trust | P0 |
| A6 | `calls.start` n'autorise aucun scénario (PRIVATE/PENDING/autrui) | 🔴 Authz/Abus | P1 |
| G4 | Pas de daily limit « ultra » (hardcodé 10) | 🟠 Tier | P1 |
| A4/E9/A11/G6 | Tiers non implémentés (maxDuration, restriction 8 persos, 600 s) | 🟠 Tier | P1–P3 |
| A8/B5 | Pas de guard « appel actif » / échec d'init consomme un slot daily | 🟠 Concurrence | P1–P2 |
| C7 | Statut `BAILED` absent du schéma | 🟡 Cohérence | P3 |
| E5 | DTMF non géré | 🟡 Fonctionnel | P3 |

> **Note de couverture** : Les scénarios de signature manquante/invalide (403), le stub `stream` → `<Hangup/>`, le GET `voice` → `{active:false}`, l'expiration Redis 30 min en cours d'appel, le mismatch token/Redis, le `costCredits` min 1, et le `redis.keys` O(N) sont **déjà documentés** dans `SCENARIOS_OBSCURS.md` §5/§6 et `ROUND2_AGENT1_TRPC.md` §9.3 — ils ne sont **pas** répétés ici.
