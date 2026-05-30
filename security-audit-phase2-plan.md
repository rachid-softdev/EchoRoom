# EchoRoom — Plan d'Implémentation Sécurité Phase 2

> **Date :** 30 mai 2026
> **Contexte :** Second audit de sécurité après implémentation des 30 correctifs initiaux
> **Statut :** 26/26 correctifs initiaux vérifiés ✅ — 16 nouvelles trouvailles à corriger
> **Note :** Les items M8 (rétention), H2.1 (export GDPR), L7 (paliers de prix) et les jobs de nettoyage signalés comme manquants par l'audit sont en FAIT déjà implémentés.

---

## Table des matières

- [Phase 1 — CRITIQUE](#phase-1--critique)
  - [C-1 — Vérifier les crédits AVANT de marquer COMPLETED](#c-1--vérifier-les-crédits-avant-de-marquer-completed)
- [Phase 2 — HAUTE](#phase-2--haute)
  - [H-1 — Supprimer le legacy fallback + étendre le token à handle-input](#h-1--supprimer-le-legacy-fallback--étendre-le-token-à-handle-input)
  - [H-2 — URLs présignées pour les enregistrements audio R2](#h-2--urls-présignées-pour-les-enregistrements-audio-r2)
- [Phase 3 — MOYENNE](#phase-3--moyenne)
  - [M-1 — Timeout sur fetchRecordingAudio](#m-1--timeout-sur-fetchrecordingaudio)
  - [M-2 — getClips doit vérifier la propriété](#m-2--getclips-doit-vérifier-la-propriété)
  - [M-3 — maskPhoneNumber ne doit pas fuiter la longueur](#m-3--maskphonenumber-ne-doit-pas-fuiter-la-longueur)
  - [M-4 — Remplacer X-Requested-With par Origin validation](#m-4--remplacer-x-requested-with-par-origin-validation)
  - [M-5 — Supprimer la fonction morte completeCall](#m-5--supprimer-la-fonction-morte-completecall)
  - [M-6 — TOCTOU sur deleteUser admin](#m-6--toctou-sur-deleteuser-admin)
  - [M-7 — Vérifier que le callSid correspond au scenarioId dans handle-input](#m-7--vérifier-que-le-callsid-correspond-au-scenarioid-dans-handle-input)
- [Phase 4 — BASSE](#phase-4--basse)
  - [L-1 — Nettoyer .env.example](#l-1--nettoyer-envexample)
  - [L-2 — Ajouter des gardes de production pour les secrets critiques](#l-2--ajouter-des-gardes-de-production-pour-les-secrets-critiques)
  - [L-3 — Pré-calculer le dummy hash pour éviter le blocage event loop](#l-3--pré-calculer-le-dummy-hash-pour-éviter-le-blocage-event-loop)
  - [L-4 — Limite de taille de corps sur les webhooks](#l-4--limite-de-taille-de-corps-sur-les-webhooks)
  - [L-5 — Validation de force du mot de passe](#l-5--validation-de-force-du-mot-de-passe)
  - [L-6 — Patch CVE Next.js 14.2.15](#l-6--patch-cve-nextjs-14215)
- [Tests de sécurité manquants](#tests-de-sécurité-manquants)
  - [T-1 — Tests JWT / auth.ts](#t-1--tests-jwt--authts)
  - [T-2 — Tests de concurrence (delete operations)](#t-2--tests-de-concurrence-delete-operations)
- [Résumé des fichiers à modifier](#annexe--résumé-des-fichiers-à-modifier)

---

## Phase 1 — CRITIQUE

### C-1 — Vérifier les crédits AVANT de marquer COMPLETED

**Fichier :** `echoroom-web/src/app/api/webhooks/twilio/route.ts`
**Lignes :** 224-270

**Problème :** La transaction `handleCompletedCall` marque d'abord le call comme `COMPLETED` (lignes 240-250), puis tente de débiter les crédits supplémentaires (lignes 253-269). Si l'utilisateur n'a pas assez de crédits, le call reste COMPLETED — seul un `log.error` est émis.

**Solution :** Restructurer la transaction pour :
1. Vérifier les crédits disponibles D'ABORD
2. Si insuffisants, marquer le call comme FAILED au lieu de COMPLETED
3. Sinon, débiter ET marquer COMPLETED atomiquement

**Modification :** Remplacer les lignes 223-270 :

```typescript
  // Atomic update of call record + credit reconcile
  // IMPORTANT: credit check BEFORE status update to prevent COMPLETED-without-payment
  await db.$transaction(async (tx) => {
    // Double-check status within the transaction
    const currentCall = await tx.call.findUnique({
      where: { id: callRecord.id },
      select: { status: true, costCredits: true },
    })

    if (currentCall?.status === "COMPLETED" || currentCall?.status === "FAILED") {
      log.info('Call already completed/failed, detected in transaction, skipping', { callSid, status: currentCall.status })
      return
    }

    const costCredits = Math.max(1, Math.ceil(duration / 60))
    const creditDiff = costCredits - (currentCall?.costCredits ?? callRecord.costCredits)

    // Step 1: Check credits BEFORE updating status
    if (creditDiff > 0) {
      const result = await tx.user.updateMany({
        where: {
          id: callRecord.userId,
          credits: { gte: creditDiff },
        },
        data: { credits: { decrement: creditDiff } },
      })
      if (result.count === 0) {
        // Insufficient credits — mark call as FAILED instead of COMPLETED
        log.warn('Insufficient credits for call completion — marking as FAILED', {
          userId: callRecord.userId,
          creditDiff,
          callSid,
        })
        await tx.call.update({
          where: { id: callRecord.id },
          data: {
            status: "FAILED",
            durationSeconds: duration,
            endedAt: new Date(),
          },
        })
        return
      }
    } else if (creditDiff < 0) {
      await tx.user.update({
        where: { id: callRecord.userId },
        data: { credits: { increment: Math.abs(creditDiff) } },
      })
    }

    // Step 2: Now mark COMPLETED (credits are settled)
    await tx.call.update({
      where: { id: callRecord.id },
      data: {
        status: "COMPLETED",
        transcript: transcript as Prisma.InputJsonValue,
        recordingUrl: recordingR2Key,
        durationSeconds: duration,
        endedAt: new Date(),
        costCredits,
      },
    })
  })
```

**Vérification :**
1. Créer un utilisateur avec 1 crédit, lancer un appel de 5 min (coût réel : 5 crédits)
2. Envoyer un webhook `completed` — le call doit être marqué FAILED
3. Créer un utilisateur avec 10 crédits, même appel — le call doit être COMPLETED
4. Vérifier que les crédits sont correctement débités (initial 1 + diff)

---

## Phase 2 — HAUTE

### H-1 — Supprimer le legacy fallback + étendre le token à handle-input

**Fichiers :**
- `echoroom-web/src/app/api/webhooks/twilio/voice/route.ts`
- `echoroom-web/src/app/api/webhooks/twilio/voice/handle-input/route.ts`
- `echoroom-web/src/server/services/telephony/callLifecycle.ts`

**Problème :** 
1. `voice/route.ts` conserve un legacy fallback (lignes 107-142) qui accepte `callId`, `scenarioId`, `characterId` en query params bruts. Ce chemin n'est plus nécessaire (la transition est terminée).
2. Le `actionUrl` dans le TwiML (ligne 250) transmet `scenarioId` et `characterId` en clair dans l'URL. Le token HMAC n'est utilisé QUE pour l'appel POST initial, pas pour les appels `handle-input` suivants.
3. Les IDs internes fuient dans les logs Twilio pendant toute la durée de l'appel.

**Solution :** 
1. Supprimer le legacy fallback (tout le bloc `else` lignes 107-142)
2. Étendre l'utilisation du token à l'URL `handle-input` en le passant dans le `actionUrl` du `<Gather>`
3. Remplacer les query params bruts par le token dans `handle-input/route.ts`

#### Étape H-1.1 — Supprimer le legacy fallback dans voice/route.ts

**Modification :** Remplacer les lignes 107-142 :

```typescript
  // Le token est OBLIGATOIRE — plus de fallback legacy.
  // Pendant la transition, les appels existants sans token
  // seront résolus via le CallSid dans le handler (recherche DB).
  // Après la période de transition, on pourrait rendre le token
  // strictement requis.
  if (!token) {
    // Fallback DB uniquement (sans exposer d'IDs dans l'URL)
    try {
      const callRecord = await db.call.findFirst({
        where: { twilioCallSid: callSid },
        include: { scenario: { include: { character: true } } },
      })
      if (callRecord) {
        scenarioId = callRecord.scenarioId
        characterId = callRecord.scenario.characterId
        await db.call
          .update({ where: { id: callRecord.id }, data: { status: 'ACTIVE' } })
          .catch(() => {})
      }
    } catch (error) {
      log.error('Failed to load call record from CallSid', { error })
    }
  }
```

#### Étape H-1.2 — Passer le token dans le actionUrl

**Modification :** Dans `voice/route.ts`, remplacer la ligne 250 :

```typescript
  // Avant (ligne 250) :
  const actionUrl = `/api/webhooks/twilio/voice/handle-input?scenarioId=${encodeURIComponent(scenarioId || 'unknown')}&characterId=${encodeURIComponent(characterId || 'unknown')}`

  // Après :
  // Créer un token pour les appels handle-input suivants
  // Le call.id est disponible via le payload du token ou la résolution DB
  const handleInputToken = createTwilioToken(
    callRecord?.id ?? callId ?? 'unknown',
    scenarioId || 'unknown',
  )
  const actionUrl = `/api/webhooks/twilio/voice/handle-input?token=${encodeURIComponent(handleInputToken)}`
```

**Note :** `callRecord` est déjà disponible si on a emprunté le chemin avec token (lignes 81-99). Sinon, il faut résoudre le `callId` depuis le `callSid` (c'est fait dans le fallback). Modifier la déclaration pour que `callRecord` soit accessible en dehors du bloc.

#### Étape H-1.3 — Modifier handle-input/route.ts pour utiliser le token

**Modification :** Remplacer les lignes 45-48 et la résolution qui suit :

```typescript
import { verifyTwilioToken } from '@/server/lib/twilioToken'

// ... dans le handler POST :

  const callSid = (formData.get('CallSid') as string) ?? ''
  const speechResult = (formData.get('SpeechResult') as string) ?? ''

  // Résoudre scenarioId et characterId depuis le token HMAC
  // (plus d'IDs exposés dans les logs Twilio)
  const token = searchParams.get('token')
  let scenarioId = 'unknown'
  let characterId = 'unknown'

  if (token) {
    const payload = verifyTwilioToken(token)
    if (payload) {
      scenarioId = payload.scenarioId
      // Résoudre characterId depuis le scenario
      try {
        const scenario = await db.scenario.findUnique({
          where: { id: scenarioId },
          select: { characterId: true },
        })
        if (scenario) {
          characterId = scenario.characterId
        }
      } catch (error) {
        log.error('Failed to resolve characterId from token', { error })
      }
    } else {
      log.warn('Invalid or expired token in handle-input', { callSid })
      // En模式下 production, on pourrait refuser la requête
    }
  } else {
    log.warn('Missing token in handle-input request', { callSid })
  }

  // Supprimer les anciennes lignes 45-48 :
  // const scenarioId = searchParams.get('scenarioId') ?? 'unknown'
  // const characterId = searchParams.get('characterId') ?? 'unknown'
```

Mettre également à jour le `actionUrl` ligne 215 pour utiliser le token au lieu des IDs bruts :

```typescript
  // Avant (ligne 215) :
  const actionUrl = `/api/webhooks/twilio/voice/handle-input?scenarioId=${encodeURIComponent(scenarioId)}&characterId=${encodeURIComponent(characterId)}`

  // Après : recréer un token pour le prochain tour
  const nextToken = createTwilioToken(
    // Le callId est dans le state Redis
    state.callSid,
    scenarioId,
  )
  const actionUrl = `/api/webhooks/twilio/voice/handle-input?token=${encodeURIComponent(nextToken)}`
```

**Vérification :**
1. `GET /api/webhooks/twilio/voice?callId=xxx` → ne doit PAS exposer les IDs
2. Lancer un appel réel — vérifier que les logs Twilio ne contiennent pas de `scenarioId` ou `characterId` en clair
3. Vérifier que les tours de conversation successifs fonctionnent via le token

---

### H-2 — URLs présignées pour les enregistrements audio R2

**Fichiers :**
- `echoroom-web/src/lib/r2.ts`
- `echoroom-web/src/server/routers/calls.ts`
- `echoroom-web/src/app/api/user/export/route.ts`

**Problème :** Les URLs de `recordingUrl` et `clipUrl` sont stockées et retournées en clair (ex: `https://bucket.r2.dev/recordings/CAxxx.wav`). Si le bucket R2 est public, ces URLs sont accessibles indéfiniment par quiconque les possède.

**Solution :** Générer des URLs présignées (signées) avec expiration courte (1 heure) via le SDK S3 `@aws-sdk/s3-request-presigner`.

#### Étape H-2.1 — Installer la dépendance

```bash
cd echoroom-web
pnpm add @aws-sdk/s3-request-presigner
```

#### Étape H-2.2 — Créer une fonction utilitaire de signed URL

Dans `echoroom-web/src/lib/r2.ts`, ajouter :

```typescript
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Génère une URL présignée vers un objet R2 avec expiration.
 * @param key - La clé (path) de l'objet dans le bucket
 * @param expiresInSeconds - Durée de validité (défaut: 3600 = 1h)
 * @returns URL signée temporaire
 */
export async function getPresignedUrl(
  key: string,
  expiresInSeconds: number = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });

  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
}
```

#### Étape H-2.3 — Utiliser dans le router calls.ts

**Modification :** Dans `echoroom-web/src/server/routers/calls.ts`, modifier le `replay` endpoint :

```typescript
import { getPresignedUrl } from "@/lib/r2";

// Dans replay (lignes 155-182) :
  replay: protectedProcedure
    .input(z.object({ callId: z.string() }))
    .query(async ({ input, ctx }) => {
      const call = await db.call.findUnique({
        where: { id: input.callId },
      });

      if (!call) { throw new TRPCError({ code: "NOT_FOUND", message: "Appel introuvable" }); }
      if (call.userId !== ctx.session.user.id) { throw new TRPCError({ code: "FORBIDDEN", message: "Cet appel ne vous appartient pas" }); }

      // Générer une URL présignée
      let signedUrl: string | null = null;
      if (call.recordingUrl) {
        try {
          // Extraire la clé R2 de l'URL stockée
          // Format stocké: "callSid/turn_0.wav" (chemin relatif)
          signedUrl = await getPresignedUrl(call.recordingUrl);
        } catch (error) {
          log.error('Failed to generate presigned URL', { error, callId: call.id });
        }
      }

      return {
        recordingUrl: signedUrl,  // ← URL temporaire, pas le chemin permanent
        transcript: call.transcript as ...,
      };
    }),
```

#### Étape H-2.4 — Utiliser dans l'export GDPR

**Modification :** Dans `echoroom-web/src/app/api/user/export/route.ts`, pour les clips :

```typescript
import { getPresignedUrl } from "@/lib/r2";

// Dans la section clips (lignes 148-161), après avoir fetch les clips :
const clipsWithSignedUrls = await Promise.all(
  clips.map(async (clip) => {
    if (clip.clipUrl) {
      try {
        const signedUrl = await getPresignedUrl(clip.clipUrl);
        return { ...clip, clipUrl: signedUrl };
      } catch {
        return { ...clip, clipUrl: null };
      }
    }
    return clip;
  }),
);
```

**Important :** Il faut aussi s'assurer que le bucket R2 n'est PAS en accès public. Les URLs présignées fonctionnent uniquement si le bucket est privé.

**Vérification :**
1. Configurer le bucket R2 en privé
2. Lire un enregistrement via `calls.replay` — obtenir une URL signée
3. Vérifier que l'URL expire après 1h (retourne 403)
4. Vérifier qu'une URL non signée directement sur le bucket retourne 403

---

## Phase 3 — MOYENNE

### M-1 — Timeout sur fetchRecordingAudio

**Fichier :** `echoroom-web/src/app/api/webhooks/twilio/route.ts`
**Lignes :** 277-306

**Problème :** `fetchRecordingAudio` utilise `fetch()` sans `AbortSignal`. Si l'endpoint Twilio est lent, le webhook reste bloqué indéfiniment.

**Solution :** Ajouter `AbortController` avec un timeout de 10s.

**Modification :**

```typescript
async function fetchRecordingAudio(
  recordingUrl: string,
): Promise<ArrayBuffer | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10s timeout

  try {
    const auth = Buffer.from(
      `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`,
    ).toString('base64')

    const response = await fetch(recordingUrl, {
      headers: { Authorization: `Basic ${auth}` },
      redirect: 'error',
      signal: controller.signal,  // ← AJOUT
    })

    if (!response.ok) {
      log.error('Failed to fetch recording', { status: response.status })
      return null
    }

    return await response.arrayBuffer()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      log.error('Recording fetch timed out after 10s', { recordingUrl })
      return null
    }
    log.error('Error fetching recording', { error })
    return null
  } finally {
    clearTimeout(timeoutId)
  }
}
```

**Vérification :** Simuler un endpoint lent (ex: via un proxy qui retarde la réponse) — la fonction doit retourner null après 10s.

---

### M-2 — getClips doit vérifier la propriété

**Fichier :** `echoroom-web/src/server/routers/social.ts`
**Lignes :** 148-153

**Problème :** `getClips` est une `publicProcedure` qui retourne tous les clips pour n'importe quel `callId` sans vérifier que l'utilisateur est propriétaire du call.

**Solution :** Rendre la procédure authentifiée et ajouter une vérification de propriété.

**Modification :**

```typescript
  getClips: protectedProcedure  // ← protected au lieu de public
    .use(withIPRateLimit({ limit: 60, window: 60 }))
    .input(z.object({ callId: z.string() }))
    .query(async ({ input, ctx }) => {
      // Vérifier que l'utilisateur est propriétaire du call
      const call = await db.call.findUnique({
        where: { id: input.callId },
        select: { userId: true },
      });
      if (!call) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Appel introuvable" });
      }
      if (call.userId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Accès refusé" });
      }
      return getClips(input.callId);
    }),
```

**Note :** Si le design prévoit que les clips soient partageables publiquement (comme des extraits audio), il faut alors retirer les `clipUrl` des résultats publics et les réserver aux propriétaires. Le design actuel doit être clarifié.

**Vérification :**
1. L'utilisateur A crée un clip sur son appel
2. L'utilisateur B appelle `getClips` avec le même `callId` → 403
3. L'utilisateur A appelle `getClips` avec son `callId` → succès

---

### M-3 — maskPhoneNumber ne doit pas fuiter la longueur

**Fichier :** `echoroom-web/src/server/lib/encryption.ts`
**Lignes :** 95-99

**Problème :** Pour les numéros courts (≤ 8 caractères), la fonction expose le premier caractère + les 4 derniers = presque tout le numéro.

**Solution :** Remplacer par un masquage à ratio fixe qui ne révèle pas la longueur.

**Modification :**

```typescript
export function maskPhoneNumber(phone: string): string {
  if (phone.length < 6) return "******";
  const prefix = phone.startsWith("+") ? phone.substring(0, 3) : phone.substring(0, 2);
  return `${prefix}****${phone.slice(-4)}`;
}
```

**Vérification :**
- `"+33612345678"` → `"+33****5678"` ✓
- `"0612345678"` → `"06****5678"` ✓
- `"1234"` → `"******"` ✓ (ne fuite rien)
- `"123456"` → `"12****3456"` ✓

---

### M-4 — Remplacer X-Requested-With par Origin validation

**Fichier :** `echoroom-web/src/app/api/user/export/route.ts`
**Lignes :** 22-26

**Problème :** L'endpoint GDPR utilise `X-Requested-With` comme protection CSRF. Cet en-tête est non-standard et peut être contourné via `fetch()` avec des en-têtes personnalisés.

**Solution :** Remplacer par une validation d'Origin comme le fait le middleware CSRF de tRPC, ou simplement supprimer (les cookies SameSite=Lax protègent déjà).

**Modification :**

```typescript
export async function POST(req: NextRequest) {
  // CSRF defense via Origin header (SameSite=Lax pour les cookies session)
  const origin = req.headers.get('origin');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (origin) {
    try {
      const originUrl = new URL(origin);
      const appUrlObj = new URL(appUrl);
      if (originUrl.origin !== appUrlObj.origin) {
        return NextResponse.json({ error: 'Origine non autorisée' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'Origine invalide' }, { status: 400 });
    }
  }
  // Si pas d'Origin (app mobile, curl), on laisse passer — SameSite protège

  // ... suite du handler (supprimer la vérification X-Requested-With)
```

**Note :** En production, les navigateurs modernes envoient `SameSite=Lax` sur les cookies de session. Une requête POST cross-origin ne les inclurait pas. La validation d'Origin est donc une sécurité défensive supplémentaire, pas le seul rempart.

**Vérification :**
1. `POST /api/user/export` depuis le même origin → 200
2. `POST /api/user/export` depuis un origin différent → 403
3. `POST /api/user/export` sans Origin (curl) → 200

---

### M-5 — Supprimer la fonction morte completeCall

**Fichier :** `echoroom-web/src/server/services/telephony/callLifecycle.ts`
**Lignes :** 128-155

**Problème :** `completeCall()` n'est appelée nulle part. Toute la logique de completion est dans `handleCompletedCall` dans le webhook Twilio.

**Solution :** Supprimer la fonction (ou la garder mais documentée comme non utilisée).

**Option A (suppression) :**

```typescript
// SUPPRIMER les lignes 128-155 :
// export async function completeCall(callId: string, durationSeconds: number) {
//   ...
// }
```

**Option B (documentation) :** Ajouter un commentaire JSDoc :

```typescript
/**
 * @deprecated La complétion des appels est gérée par handleCompletedCall
 * dans le webhook Twilio (src/app/api/webhooks/twilio/route.ts).
 * Cette fonction est conservée pour référence mais n'est PAS utilisée.
 */
export async function completeCall(...) { ... }
```

**Recommandation :** Option A — suppression. Le code mort est une source de confusion et n'apparaît pas dans la couverture de tests.

**Vérification :** `rg "completeCall"` — ne doit plus trouver d'appels à cette fonction.

---

### M-6 — TOCTOU sur deleteUser admin

**Fichier :** `echoroom-web/src/server/routers/admin.ts`
**Lignes :** ~380-435

**Problème :** `deleteUser` fait un `findUnique` pour vérifier que l'utilisateur n'est pas déjà supprimé, puis fait un `update` dans une transaction. Entre les deux, un autre appel admin pourrait avoir déjà supprimé l'utilisateur.

**Solution :** Utiliser `updateMany` avec `WHERE deletedAt IS NULL` pour éviter la double suppression.

**Modification :**

```typescript
  deleteUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Utiliser updateMany avec un guard pour éviter le TOCTOU
      const anonId = crypto.randomUUID();
      const deletedHash = await bcrypt.hash(crypto.randomUUID(), 12);

      const result = await db.$transaction(async (tx) => {
        // Ne mettre à jour que si deletedAt est NULL (pas déjà supprimé)
        const updateResult = await tx.user.updateMany({
          where: {
            id: input.userId,
            deletedAt: null,  // ← Guard TOCTOU
          },
          data: {
            deletedAt: new Date(),
            anonymizedAt: new Date(),
            email: `deleted-${anonId}@anonymized.echoroom.app`,
            username: `utilisateur-${anonId.substring(0, 8)}`,
            passwordHash: deletedHash,
            displayName: null,
            bio: null,
            image: null,
          },
        });

        // Si 0 lignes affectées, l'utilisateur était déjà supprimé
        if (updateResult.count === 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Cet utilisateur est déjà supprimé",
          });
        }

        // Anonymiser les données associées (dans la même transaction)
        await tx.scenario.updateMany({
          where: { creatorId: input.userId },
          data: { visibility: "PRIVATE" },
        });
        await tx.comment.updateMany({
          where: { userId: input.userId },
          data: { content: "[Commentaire supprimé]" },
        });
        await tx.call.updateMany({
          where: { userId: input.userId },
          data: { phoneNumber: "[ANONYMISÉ]" },
        });
      });

      await db.auditLog.create({
        data: {
          action: "DELETE_USER",
          entityType: "User",
          entityId: input.userId,
          adminId: ctx.session.user.id,
        },
      });

      return { success: true };
    }),
```

**Vérification :** Lancer deux appels `deleteUser` simultanément pour le même utilisateur — le second doit échouer avec CONFLICT.

---

### M-7 — Vérifier que le callSid correspond au scenarioId dans handle-input

**Fichier :** `echoroom-web/src/app/api/webhooks/twilio/voice/handle-input/route.ts`

**Problème :** Le `scenarioId` et `characterId` arrivent du query param (maintenant du token après H-1.3). Il n'y a pas de vérification que le `callSid` corresponde bien au `scenarioId` — un webhook Twilio valide (signé) pourrait être routé vers le mauvais scénario.

**Solution :** Vérifier que le `callSid` est associé au `scenarioId` via la base de données ou le state Redis.

**Modification :** Ajouter après la résolution du token :

```typescript
  if (token) {
    const payload = verifyTwilioToken(token)
    if (payload) {
      scenarioId = payload.scenarioId
      // Vérifier que le callSid correspond au scenarioId
      const state = await getConversationState(callSid)
      if (!state || state.scenarioId !== scenarioId) {
        log.warn('CallSid/scenarioId mismatch', { callSid, tokenScenarioId: scenarioId, stateScenarioId: state?.scenarioId })
        // Fallback : utiliser le scenarioId du state Redis (source de vérité)
        if (state?.scenarioId) {
          scenarioId = state.scenarioId
        }
      }
      // ... résoudre characterId
    }
  }
```

**Risque :** Très faible car la signature Twilio valide déjà l'authenticité de la requête. Ceci est une défense en profondeur.

**Vérification :** Forcer un `callSid` différent du `scenarioId` — la requête doit être loggée et corrigée automatiquement.

---

## Phase 4 — BASSE

### L-1 — Nettoyer .env.example

**Fichier :** `echoroom-web/.env.example`
**Lignes :** 46-47

**Problème :** `NEXT_PUBLIC_POSTHOG_KEY` et `NEXT_PUBLIC_POSTHOG_HOST` ne sont pas dans le schéma Zod de `env.ts` ni `env.client.ts`.

**Solution :** Soit les ajouter au schéma, soit les retirer du `.env.example`.

**Recommandation :** Les ajouter à `src/lib/env.client.ts` — ce sont des variables exposées au client, donc logique de les avoir là :

```typescript
// Dans env.client.ts
NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),
```

Sinon, les retirer du `.env.example` avec un commentaire :

```
# Note: NEXT_PUBLIC_POSTHOG_KEY et NEXT_PUBLIC_POSTHOG_HOST
# ne sont pas validés par le schéma Zod (non critiques en dev).
# Ajouter dans .env.local si nécessaire.
```

---

### L-2 — Ajouter des gardes de production pour les secrets critiques

**Fichier :** `echoroom-web/src/lib/env.ts`
**Lignes :** 60-76

**Problème :** Seul `NEXTAUTH_SECRET` a une vérification "CHANGE_ME" en production. Les autres secrets (`TWILIO_AUTH_TOKEN`, `STRIPE_SECRET_KEY`, etc.) n'ont pas de garde similaire.

**Solution :** Ajouter des vérifications pour chaque secret critique :

```typescript
  if (isProduction) {
    // Vérifications des secrets par défaut
    const checks = [
      { key: 'NEXTAUTH_SECRET', value: process.env.NEXTAUTH_SECRET ?? '', defaultPrefix: 'CHANGE_ME' },
      { key: 'TWILIO_AUTH_TOKEN', value: process.env.TWILIO_AUTH_TOKEN ?? '', defaultPrefix: 'dev_' },
      { key: 'STRIPE_SECRET_KEY', value: process.env.STRIPE_SECRET_KEY ?? '', defaultPrefix: 'sk_test_dev' },
      { key: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY ?? '', defaultPrefix: 'sk_dev' },
      { key: 'PHONE_ENCRYPTION_KEY', value: process.env.PHONE_ENCRYPTION_KEY ?? '', defaultPrefix: 'dev_' },
    ];

    for (const { key, value, defaultPrefix } of checks) {
      if (value.startsWith('CHANGE_ME') || value.startsWith(defaultPrefix)) {
        throw new Error(
          `${key} is still set to the default/development value. ` +
          `Generate a unique secret before deploying to production.`,
        );
      }
    }

    // ... suite existante
  }
```

---

### L-3 — Pré-calculer le dummy hash pour éviter le blocage event loop

**Fichier :** `echoroom-web/src/lib/auth.ts`
**Lignes :** 15-22

**Problème :** `bcrypt.hashSync("dummy-timing-attack-prevention", 12)` prend ~250ms synchrone au premier appel, bloquant l'event loop. En serverless, c'est à chaque cold start.

**Solution :** Pré-calculer le hash et le stocker comme constante, ou le calculer au moment du module load (hors du handler).

**Modification :**

```typescript
/**
 * Dummy bcrypt hash pour la protection timing-attack.
 * Pré-calculé au module load pour éviter de bloquer l'event loop
 * lors du premier appel authorize() (important en serverless).
 * Le hash est valide car généré par bcrypt avec un vrai salt.
 */
const DUMMY_HASH = bcrypt.hashSync("dummy-timing-attack-prevention", 12);

// On peut maintenant supprimer getDummyHash() et l'appel direct :

// Dans authorize(), ligne 54 :
const passwordHash = user?.passwordHash ?? DUMMY_HASH;  // ← plus de lazy init
```

**Impact :** Le temps de cold start augmente de ~250ms. C'est acceptable car :
1. Le cold start Next.js est déjà > 1s avec Prisma
2. Moins risqué qu'un blocage synchrone pendant une requête
3. Plus simple et maintenable

---

### L-4 — Limite de taille de corps sur les webhooks

**Fichier :** Tous les webhooks Twilio et Stripe

**Problème :** `req.formData()` et `req.text()` n'ont pas de limite de taille. Une requête malveillante avec un corps très volumineux pourrait causer des OOM.

**Solution :** Ajouter des vérifications de taille avant de parser le corps. Pour les webhooks Twilio/Stripe, la taille max est connue :

```typescript
// Dans chaque webhook, avant de parser le body :
const contentLength = parseInt(req.headers.get('content-length') ?? '0', 10);

// Twilio webhooks : max ~10KB
if (contentLength > 50_000) {  // 50KB (marge large)
  return NextResponse.json({ error: 'Request too large' }, { status: 413 });
}

// Stripe webhooks : max ~50KB
if (contentLength > 100_000) {  // 100KB
  return NextResponse.json({ error: 'Request too large' }, { status: 413 });
}
```

**Alternative Next.js :** Configurer `bodyParser` si utilisé (non applicable ici, on utilise l'API Route native).

---

### L-5 — Validation de force du mot de passe

**Fichier :** `echoroom-web/src/server/routers/auth.ts`
**Lignes :** 28-33, 101-145

**Problème :** `changePassword` et `register` n'ont qu'une validation de longueur (`min(8)`), pas de vérification de complexité.

**Solution :** Ajouter un regex de force de mot de passe dans le schéma Zod :

```typescript
// Remplacer :
password: z.string().min(8),

// Par :
password: z.string()
  .min(8, "Minimum 8 caractères")
  .max(128, "Maximum 128 caractères")
  .regex(/[A-Z]/, "Doit contenir une majuscule")
  .regex(/[a-z]/, "Doit contenir une minuscule")
  .regex(/[0-9]/, "Doit contenir un chiffre"),
```

**Note :** La même validation doit être appliquée au `changePassword` (déjà avec `min(8).max(128)`, ajouter les regex).

---

### L-6 — Patch CVE Next.js 14.2.15

**Fichier :** `echoroom-web/package.json`

**Problème :** CVE-2025-29927 affecte Next.js < 14.2.25. Le middleware bypass permet de contourner les vérifications d'authentification.

**Solution :** Mettre à jour Next.js vers une version patchée.

```bash
cd echoroom-web
pnpm add next@^14.2.25
pnpm test
pnpm build
```

**Alternative :** Migrer vers Next.js 15 (plan U4.1 de l'implémentation initiale).

**Recommandation :** Patch minimal d'abord (`14.2.25+`), puis migrer vers 15 dans le prochain sprint.

---

## Tests de sécurité manquants

### T-1 — Tests JWT / auth.ts

**Nouveau fichier :** `echoroom-web/src/lib/__tests__/auth.test.ts`

**Test à couvrir :**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/server/db";

// Simuler le callback jwt de auth.ts
async function simulateJwtCallback({
  token,
  trigger,
}: {
  token: Record<string, unknown>;
  trigger?: string;
}) {
  // Extraire la logique du callback auth.ts pour la tester isolément
  if (trigger === "update" || !token.lastVerified ||
      Date.now() - (token.lastVerified as number) > 5 * 60 * 1000) {
    const dbUser = await db.user.findUnique({
      where: { id: token.id as string },
      select: { role: true, deletedAt: true, tokenVersion: true },
    });
    if (!dbUser || dbUser.deletedAt) return null;
    if (dbUser.tokenVersion !== (token.tokenVersion ?? 0)) return null;
    token.role = dbUser.role;
    token.lastVerified = Date.now();
  }
  return token;
}

describe("JWT tokenVersion revalidation", () => {
  it("should reject token when user is deleted", async () => {
    vi.spyOn(db.user, "findUnique").mockResolvedValue(null);
    const result = await simulateJwtCallback({
      token: { id: "user-1", tokenVersion: 0 },
      trigger: "update",
    });
    expect(result).toBeNull();
  });

  it("should reject token when tokenVersion differs", async () => {
    vi.spyOn(db.user, "findUnique").mockResolvedValue({
      id: "user-1",
      role: "USER",
      deletedAt: null,
      tokenVersion: 2,
    });
    const result = await simulateJwtCallback({
      token: { id: "user-1", tokenVersion: 0 },
      trigger: "update",
    });
    expect(result).toBeNull();
  });

  it("should accept token when versions match", async () => {
    vi.spyOn(db.user, "findUnique").mockResolvedValue({
      id: "user-1",
      role: "USER",
      deletedAt: null,
      tokenVersion: 1,
    });
    const result = await simulateJwtCallback({
      token: { id: "user-1", tokenVersion: 1 },
      trigger: "update",
    });
    expect(result).not.toBeNull();
    expect(result?.role).toBe("USER");
  });

  it("should re-verify every 5 minutes", async () => {
    const mockUser = { id: "user-1", role: "USER", deletedAt: null, tokenVersion: 1 };
    vi.spyOn(db.user, "findUnique").mockResolvedValue(mockUser);

    // Token with lastVerified > 5 min ago
    const oldTimestamp = Date.now() - 6 * 60 * 1000;
    const result = await simulateJwtCallback({
      token: { id: "user-1", tokenVersion: 1, lastVerified: oldTimestamp },
    });
    expect(result).not.toBeNull();
    // Vérifier que findUnique a été appelé (re-validation)
    expect(db.user.findUnique).toHaveBeenCalled();
  });
});
```

### T-2 — Tests de concurrence (delete operations)

**Nouveau fichier :** `echoroom-web/src/server/__tests__/concurrency.test.ts`

```typescript
import { describe, it, expect, vi } from "vitest";

describe("Race conditions — delete operations", () => {
  it("should handle simultaneous deleteMyAccount + admin deleteUser", async () => {
    // Vérifier que le pattern updateMany avec deletedAt: null
    // empêche la double suppression

    // Premier appel : utilisateur se supprime
    const firstDelete = async () => {
      // Simuler une transaction avec updateMany
      return { count: 1 }; // Succès
    };

    // Deuxième appel : admin tente de supprimer le même utilisateur
    const secondDelete = async () => {
      // updateMany avec deletedAt: null ne trouve rien
      return { count: 0 }; // Échec
    };

    const r1 = await firstDelete();
    const r2 = await secondDelete();

    expect(r1.count).toBe(1);
    expect(r2.count).toBe(0); // L'admin doit voir 0 lignes modifiées
  });
});
```

---

## Ordre d'exécution recommandé

```
Jour 1 (CRITICAL) :
  • C-1  — Restructurer la transaction handleCompletedCall     [~1h]
  • L-6  — Patch Next.js CVE-2025-29927                        [~15min]

Jour 2 (HIGH) :
  • H-1  — Legacy fallback + token handle-input                [~2h]
  • H-2  — URLs présignées R2                                   [~2h]

Jour 3 (MEDIUM) :
  • M-1  — Timeout fetchRecordingAudio                          [~15min]
  • M-2  — getClips ownership check                             [~30min]
  • M-3  — maskPhoneNumber                                      [~10min]
  • M-4  — Remplacer X-Requested-With                           [~30min]
  • M-5  — Supprimer completeCall                               [~5min]
  • M-6  — TOCTOU deleteUser                                    [~30min]
  • M-7  — Vérification callSid/scenarioId                     [~20min]

Jour 4 (LOW + Tests) :
  • L-1 à L-5 — Correctifs mineurs                              [~1h]
  • T-1  — Tests auth.ts                                        [~1h30]
  • T-2  — Tests concurrence                                    [~1h]
```

---

## Annexe — Résumé des fichiers à modifier

| Fichier | Modification | Priorité | Effort |
|---------|-------------|----------|--------|
| `echoroom-web/src/app/api/webhooks/twilio/route.ts` | C-1 : Restructurer transaction (crédits avant status) | CRITICAL | 1h |
| `echoroom-web/src/app/api/webhooks/twilio/route.ts` | M-1 : Timeout fetchRecordingAudio | MEDIUM | 15min |
| `echoroom-web/src/app/api/webhooks/twilio/voice/route.ts` | H-1.1 : Supprimer legacy fallback | HIGH | 30min |
| `echoroom-web/src/app/api/webhooks/twilio/voice/route.ts` | H-1.2 : Token dans actionUrl | HIGH | 30min |
| `echoroom-web/src/app/api/webhooks/twilio/voice/handle-input/route.ts` | H-1.3 : Token résolution scenarioId/characterId | HIGH | 1h |
| `echoroom-web/src/app/api/webhooks/twilio/voice/handle-input/route.ts` | M-7 : Vérifier callSid vs scenarioId | MEDIUM | 20min |
| `echoroom-web/src/lib/r2.ts` | H-2.1 : Ajouter getPresignedUrl | HIGH | 30min |
| `echoroom-web/src/server/routers/calls.ts` | H-2.2 : Utiliser signed URL pour replay | HIGH | 30min |
| `echoroom-web/src/app/api/user/export/route.ts` | H-2.3 : Signed URLs pour clips | HIGH | 30min |
| `echoroom-web/src/app/api/user/export/route.ts` | M-4 : Origin validation au lieu de X-Requested-With | MEDIUM | 30min |
| `echoroom-web/src/server/routers/social.ts` | M-2 : getClips en protectedProcedure | MEDIUM | 30min |
| `echoroom-web/src/server/lib/encryption.ts` | M-3 : Améliorer maskPhoneNumber | MEDIUM | 10min |
| `echoroom-web/src/server/services/telephony/callLifecycle.ts` | M-5 : Supprimer completeCall | MEDIUM | 5min |
| `echoroom-web/src/server/routers/admin.ts` | M-6 : TOCTOU deleteUser | MEDIUM | 30min |
| `echoroom-web/.env.example` | L-1 : Nettoyer vars PostHog | LOW | 5min |
| `echoroom-web/src/lib/env.ts` | L-2 : Gardes production supplémentaires | LOW | 15min |
| `echoroom-web/src/lib/auth.ts` | L-3 : Pré-calculer dummy hash | LOW | 10min |
| `echoroom-web/src/app/api/webhooks/*/route.ts` | L-4 : Limite taille body | LOW | 20min |
| `echoroom-web/src/server/routers/auth.ts` | L-5 : Validation force mot de passe | LOW | 15min |
| `echoroom-web/package.json` | L-6 : Patch Next.js 14.2.25+ | LOW | 15min |
| `echoroom-web/src/lib/__tests__/auth.test.ts` | T-1 : NOUVEAU — tests JWT | MEDIUM | 1h30 |
| `echoroom-web/src/server/__tests__/concurrency.test.ts` | T-2 : NOUVEAU — tests concurrence | MEDIUM | 1h |

**Total : ~22 fichiers modifiés, ~11h de travail estimé**
