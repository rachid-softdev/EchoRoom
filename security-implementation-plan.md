# EchoRoom — Plan d'Implémentation des Correctifs de Sécurité

> **Date :** 29 mai 2026  
> **Portée :** 30 findings (3 CRITICAL, 5 HIGH, 14 MEDIUM, 8 LOW, 3 INFO)  
> **Priorité :** Les correctifs CRITIQUES doivent être déployés avant toute mise en production

---

## Table des matières

- [Phase 1 — CRITICAL (avant production)](#phase-1--critical-avant-production)
  - [C1 — Validation des webhooks Twilio](#c1--validation-des-signatures-twilio-sur-tous-les-webhooks)
  - [C2 — SSRF via RecordingUrl](#c2--ssrf-via-recordingurl)
  - [C3 — Fallback rate limiting in-memory](#c3--fallback-rate-limiting-in-memory-quand-redis-est-indisponible)
- [Phase 2 — HIGH](#phase-2--high)
  - [H1 — Rotation des tokens JWT](#h1--rotation-des-tokens-jwt-avec-re-validation-db)
  - [H2 — Prisma where clause injection](#h2--correction-de-la-clause-where-dans-getauditlogs)
  - [H3 — Chiffrement des numéros de téléphone](#h3--chiffrement-des-numéros-de-téléphone-au-repos)
  - [H4 — Transaction Stripe atomique](#h4--correction-de-la-transaction-stripe)
  - [H5 — Anonymisation irréversible](#h5--anonymisation-irréversible-des-comptes)
- [Phase 3 — MEDIUM](#phase-3--medium)
  - [M1 — Énumération de comptes](#m1--prévention-de-lénumération-de-comptes)
  - [M2 — Credits dans le JWT](#m2--retrait-des-credits-du-jwt)
  - [M3 — CSRF allowMissingOrigin](#m3--durcissement-de-la-protection-csrf)
  - [M4 — Idempotence de failCall](#m4--idempotence-de-failcall)
  - [M5 — Modération des réponses AI](#m5--modération-des-sorties-générées-par-lia)
  - [M6 — ReDoS, homoglyphes, blocklist](#m6--correction-redos-homoglyphes-et-blocklist)
  - [M7 — Retrait de consentement](#m7--mécanisme-de-retrait-de-consentement)
  - [M8 — Rétention des données](#m8--politique-de-rétention-des-données)
- [Phase 4 — LOW](#phase-4--low)
- [Phase 5 — INFO](#phase-5--info)
- [Résumé des fichiers à modifier](#annexe--résumé-des-fichiers-à-modifier)

---

## Phase 1 — CRITICAL (avant production)

### C1 — Validation des signatures Twilio sur tous les webhooks

**Fichiers :**
- `src/app/api/webhooks/twilio/route.ts`
- `src/app/api/webhooks/twilio/voice/route.ts`
- `src/app/api/webhooks/twilio/voice/handle-input/route.ts`

**Problème :** Aucune vérification de signature Twilio. N'importe quel POST HTTP est accepté comme authentique. Un attaquant peut forger des statuts d'appel pour déclencher des remboursements de crédits.

**Solution :** Créer un utilitaire de validation partagé et l'appliquer à tous les endpoints webhook Twilio.

#### Étape 1.1 — Créer le middleware de validation Twilio

```typescript
// NOUVEAU FICHIER : src/app/api/webhooks/twilio/validate.ts

import type { NextRequest } from "next/server";
import twilio from "twilio";
import { env } from "@/lib/env";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("twilio-validate");

export function validateTwilioRequest(
  req: NextRequest,
  params: Record<string, string>,
  url?: string,
): boolean {
  const signature = req.headers.get("x-twilio-signature");
  if (!signature) {
    log.warn("Missing x-twilio-signature header");
    return false;
  }

  const requestUrl = url ?? req.url;

  const isValid = twilio.webhook.validateRequest(
    env.TWILIO_AUTH_TOKEN,
    signature,
    requestUrl,
    params,
  );

  if (!isValid) {
    log.warn("Invalid Twilio signature", {
      url: requestUrl,
      signature: signature.substring(0, 10) + "...",
    });
  }

  return isValid;
}

/**
 * Extrait les paramètres du body form-data pour la validation Twilio.
 * L'ordre des paramètres est important pour la validation.
 */
export function extractParams(formData: FormData): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      params[key] = value;
    }
  }
  return params;
}
```

#### Étape 1.2 — Modifier le webhook de statut

**Fichier :** `src/app/api/webhooks/twilio/route.ts`

```typescript
// AJOUT en haut du fichier
import { validateTwilioRequest, extractParams } from "./validate";

// MODIFIER la fonction POST — ajouter la validation après avoir lu le formData
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params = extractParams(formData);

  // VALIDATION TWILIO
  if (!validateTwilioRequest(req, params)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  // ... suite du code existant (callSid, callStatus, etc.)
  const callSid = formData.get("CallSid") as string | null;
  // ...
}
```

#### Étape 1.3 — Modifier le webhook voice (initiation d'appel)

**Fichier :** `src/app/api/webhooks/twilio/voice/route.ts`

```typescript
// AJOUT en haut du fichier
import { validateTwilioRequest, extractParams } from "../validate";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params = extractParams(formData);

  // VALIDATION TWILIO
  if (!validateTwilioRequest(req, params)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  // ... suite du code existant
}
```

#### Étape 1.4 — Modifier le webhook handle-input

**Fichier :** `src/app/api/webhooks/twilio/voice/handle-input/route.ts`

```typescript
// AJOUT en haut du fichier
import { validateTwilioRequest, extractParams } from "../validate";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params = extractParams(formData);

  // VALIDATION TWILIO
  if (!validateTwilioRequest(req, params)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  // ... suite du code existant
}
```

**Vérification :**
1. Envoyer un POST forgé **sans** `x-twilio-signature` → **403**
2. Envoyer un POST forgé **avec** `x-twilio-signature` invalide → **403**
3. Envoyer un vrai webhook Twilio (signé) → **200**

---

### C2 — SSRF via RecordingUrl

**Fichier :** `src/app/api/webhooks/twilio/route.ts`

**Problème :** `fetchRecordingAudio()` prend une URL contrôlée par l'attaquant (RecordingUrl) et la fetch avec les identifiants Twilio en Basic Auth. Même avec la validation de signature (C1), une défense en profondeur est nécessaire.

**Solution :** Valider que l'URL pointe bien vers un endpoint Twilio légitime.

#### Étape 2.1 — Ajouter une validation d'URL de recording

```typescript
// DANS : src/app/api/webhooks/twilio/route.ts

// AJOUTER cette fonction utilitaire
function isValidTwilioRecordingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Les URLs de recording Twilio sont toujours sur api.twilio.com
    // et commencent par /2010-04-01/Accounts/{AccountSid}/Recordings/
    return (
      parsed.hostname === "api.twilio.com" &&
      parsed.pathname.startsWith("/2010-04-01/Accounts/") &&
      parsed.pathname.includes("/Recordings/")
    );
  } catch {
    return false;
  }
}
```

#### Étape 2.2 — Ajouter la vérification dans `handleCompletedCall`

```typescript
// DANS : src/app/api/webhooks/twilio/route.ts
// MODIFIER la section recording dans handleCompletedCall

if (recordingUrl) {
  // DÉFENSE EN PROFONDEUR : valider l'URL
  if (!isValidTwilioRecordingUrl(recordingUrl)) {
    log.warn("Invalid RecordingUrl origin — skipping recording fetch", {
      recordingUrl,
    });
    // Continuer sans recording plutôt que de blocker le webhook
  } else {
    try {
      const recordingResponse = await fetchRecordingAudio(recordingUrl);
      if (recordingResponse) {
        recordingR2Key = await uploadAudioBuffer(
          callSid,
          RECORDING_TURN_NUMBER,
          Buffer.from(recordingResponse),
          "audio/wav",
        );
        const transcriptionResult = await transcribeAudio(recordingResponse);
        if (transcriptionResult?.transcript) {
          deepgramTranscript = transcriptionResult.transcript;
        }
      }
    } catch (error) {
      log.error("Failed to fetch/transcribe recording", { error });
    }
  }
}
```

**Alternative préférée — utiliser le SDK Twilio :**

```typescript
// Option 2 : Utiliser le SDK Twilio au lieu du fetch direct
// Ceci élimine complètement le risque SSRF
async function fetchRecordingViaSDK(
  recordingUrl: string,
): Promise<ArrayBuffer | null> {
  try {
    // Extraire le RecordingSid de l'URL
    const parsed = new URL(recordingUrl);
    const pathParts = parsed.pathname.split("/");
    const recordingIndex = pathParts.indexOf("Recordings");
    if (recordingIndex === -1 || recordingIndex >= pathParts.length - 1) {
      return null;
    }
    const recordingSid = pathParts[recordingIndex + 1];

    // Utiliser le SDK Twilio (pas de fetch raw)
    const recording = await twilioClient.recordings(recordingSid).fetch();
    const media = await twilioClient
      .recordings(recordingSid)
      .media()
      .fetch();

    // Télécharger via l'URL du media (toujours via SDK)
    const response = await fetch(media.location, {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`,
        ).toString("base64")}`,
      },
    });

    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch (error) {
    log.error("Failed to fetch recording via SDK", { error });
    return null;
  }
}
```

**Vérification :**
1. POST avec `RecordingUrl=https://evil.com/steal-credentials` → ignoré (log warning, pas de fetch)
2. POST avec `RecordingUrl=https://api.twilio.com/2010-04-01/Accounts/ACxxx/Recordings/RExxx` → accepté

---

### C3 — Fallback rate limiting in-memory quand Redis est indisponible

**Fichiers :**
- `src/server/middleware/rateLimit.ts`
- `src/server/middleware/ipRateLimit.ts`

**Problème :** Si Redis est down, TOUS les rate limits sont désactivés en silence.

**Solution :** Implémenter un fallback in-memory avec un store Map.

#### Étape 3.1 — Créer un utilitaire de rate limiting partagé

```typescript
// NOUVEAU FICHIER : src/server/middleware/rateLimitStore.ts

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Fallback in-memory store pour le rate limiting quand Redis est indisponible.
 * Utilise une Map simple avec nettoyage périodique.
 * N'est PAS persistant — les compteurs sont perdus au redémarrage du serveur.
 */
class InMemoryRateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private lastCleanup = Date.now();
  private readonly CLEANUP_INTERVAL_MS = 60_000; // nettoyage toutes les 60s

  check(key: string, limit: number, windowSec: number): boolean {
    const now = Date.now();
    this.periodicCleanup(now);

    const entry = this.store.get(key);

    if (!entry || entry.resetAt <= now) {
      // Nouvelle fenêtre
      this.store.set(key, { count: 1, resetAt: now + windowSec * 1000 });
      return true; // autorisé
    }

    if (entry.count >= limit) {
      return false; // refusé
    }

    entry.count++;
    return true; // autorisé
  }

  private periodicCleanup(now: number): void {
    if (now - this.lastCleanup < this.CLEANUP_INTERVAL_MS) return;
    this.lastCleanup = now;

    for (const [key, entry] of this.store.entries()) {
      if (entry.resetAt <= now) {
        this.store.delete(key);
      }
    }

    // Éviter les fuites mémoire : si le store est très grand, forcer un cleanup complet
    if (this.store.size > 100_000) {
      this.store.clear();
    }
  }

  /** Pour les tests */
  get size(): number {
    return this.store.size;
  }
}

export const inMemoryRateLimitStore = new InMemoryRateLimitStore();
```

#### Étape 3.2 — Modifier `checkRateLimit` avec fallback

**Fichier :** `src/server/middleware/rateLimit.ts`

```typescript
import { inMemoryRateLimitStore } from "./rateLimitStore";

// MODIFIER la fonction checkRateLimit
export async function checkRateLimit({
  identifier,
  limit,
  window: windowSec,
}: RateLimitConfig): Promise<void> {
  if (!redis) {
    // FALLBACK IN-MEMORY
    const allowed = inMemoryRateLimitStore.check(
      `ratelimit:${identifier}`,
      limit,
      windowSec,
    );
    if (!allowed) {
      if (!redisUnavailableLogged) {
        log.warn("Redis unavailable — using in-memory rate limiting fallback");
        redisUnavailableLogged = true;
      }
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Trop de requêtes. Veuillez réessayer plus tard.",
      });
    }
    return;
  }

  // ... suite du code Redis existant
}
```

#### Étape 3.3 — Modifier `withIPRateLimit` avec fallback

**Fichier :** `src/server/middleware/ipRateLimit.ts`

```typescript
import { inMemoryRateLimitStore } from "./rateLimitStore";

// MODIFIER le middleware
export function withIPRateLimit(config: { limit: number; window: number }) {
  return middleware(async ({ ctx, next, path }) => {
    if (!redis) {
      // FALLBACK IN-MEMORY
      const ip =
        ctx.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        ctx.headers?.get("x-real-ip") ??
        "unknown";

      const allowed = inMemoryRateLimitStore.check(
        `iplimit:${path}:${ip}`,
        config.limit,
        config.window,
      );
      if (!allowed) {
        if (!warnLogged) {
          log.warn("Redis unavailable — using in-memory IP rate limiting");
          warnLogged = true;
        }
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Trop de requêtes. Veuillez réessayer plus tard.",
        });
      }
      return next();
    }

    // ... suite du code Redis existant
  });
}
```

**Vérification :**
1. Arrêter le service Redis
2. Envoyer plus de requêtes que la limite → doit recevoir `TOO_MANY_REQUESTS`
3. Redémarrer Redis → le rate limiting Redis reprend normalement

---

## Phase 2 — HIGH

### H1 — Rotation des tokens JWT avec re-validation DB

**Fichier :** `src/lib/auth.ts`

**Problème :** Les tokens JWT durent 30 jours sans rotation. Un token volé reste valide même si le mot de passe change ou si le rôle est révoqué.

**Solution :** Re-vérifier l'utilisateur en base de données à chaque accès à la session et ajouter un `tokenVersion`.

#### Étape H1.1 — Ajouter `tokenVersion` au schéma Prisma

```prisma
// DANS : prisma/schema.prisma
model User {
  // ... champs existants ...
  tokenVersion Int @default(0)
}
```

#### Étape H1.2 — Modifier les callbacks JWT et session

```typescript
// DANS : src/lib/auth.ts

// MODIFIER le callback jwt
async jwt({ token, user, trigger }) {
  if (user) {
    token.id = user.id as string;
    token.role = (user.role ?? "USER") as "USER" | "ADMIN" | "MODERATOR";
    token.username = (user.username ?? "") as string;
    // Ne plus stocker credits dans le token
  }

  // Si le token est rafraîchi (session.getToken), re-valider depuis la DB
  if (trigger === "update") {
    const dbUser = await db.user.findUnique({
      where: { id: token.id as string },
      select: { role: true, deletedAt: true, tokenVersion: true },
    });

    if (!dbUser || dbUser.deletedAt) {
      // L'utilisateur a été supprimé — invalider le token
      return null;
    }

    // Vérifier que la version du token correspond
    if (token.tokenVersion !== undefined && 
        token.tokenVersion !== dbUser.tokenVersion) {
      return null; // Token obsolète, forcer re-login
    }

    // Mettre à jour le rôle (au cas où il aurait changé)
    token.role = dbUser.role;
  }

  return token;
},

async session({ session, token }) {
  const t = token as unknown as {
    id: string;
    role: "USER" | "ADMIN" | "MODERATOR";
    username: string;
    tokenVersion?: number;
  };

  // Re-vérifier l'utilisateur depuis la DB
  const user = await db.user.findUnique({
    where: { id: t.id },
    select: { role: true, deletedAt: true, tokenVersion: true },
  });

  if (!user || user.deletedAt) {
    throw new Error("User no longer exists");
  }

  // Vérifier la version du token
  if (t.tokenVersion !== undefined && t.tokenVersion !== user.tokenVersion) {
    throw new Error("Token version mismatch — session invalidated");
  }

  session.user.id = t.id;
  session.user.role = user.role; // Toujours depuis la DB, pas du token
  session.user.username = t.username;
  // session.user.credits est retiré (M2)
  return session;
},
```

#### Étape H1.3 — Incrémenter `tokenVersion` lors du changement de mot de passe

```typescript
// DANS le router auth.ts, lors du changement de mot de passe (à implémenter)
await db.user.update({
  where: { id: userId },
  data: { 
    passwordHash: newHash,
    tokenVersion: { increment: 1 }  // Invalide tous les autres tokens
  },
});
```

**Vérification :**
1. Connecter un utilisateur, récupérer son JWT
2. Changer son mot de passe (via admin ou reset)
3. L'ancien JWT doit être rejeté

---

### H2 — Correction de la clause WHERE dans getAuditLogs

**Fichier :** `src/server/routers/admin.ts`

**Problème :** `Record<string, unknown>` utilisé comme clause `where` Prisma — risque d'injection de filtre.

**Solution :** Utiliser des types Prisma forts.

#### Étape H2.1 — getAuditLogs

```typescript
// MODIFIER la procédure getAuditLogs (ligne ~164-192)

getAuditLogs: adminProcedure
  .input(
    z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
      action: z.string().max(100).optional(),
      entityType: z.string().max(50).optional(),
    }),
  )
  .query(async ({ input }) => {
    const where: Prisma.AuditLogWhereInput = {};
    if (input.action) where.action = { equals: input.action };
    if (input.entityType) where.entityType = { equals: input.entityType };

    const logs = await db.auditLog.findMany({
      where,
      take: input.limit + 1,
      ...(input.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
      orderBy: { createdAt: "desc" },
      include: {
        admin: { select: { id: true, username: true } },
      },
    });

    const items = logs.slice(0, input.limit);
    const nextCursor = logs.length > input.limit ? items[items.length - 1]?.id : undefined;

    return { items, nextCursor };
  }),
```

#### Étape H2.2 — getAbuseReports

```typescript
// MODIFIER la procédure getAbuseReports (ligne ~229-256)

getAbuseReports: adminProcedure
  .input(
    z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
      status: z.string().max(50).optional(),
    }),
  )
  .query(async ({ input }) => {
    const where: Prisma.AbuseReportWhereInput = {};
    if (input.status) where.status = { equals: input.status };

    const reports = await db.abuseReport.findMany({
      where,
      // ... suite inchangée
```

**Vérification :** Les requêtes doivent fonctionner exactement comme avant, mais avec des types forts.

---

### H3 — Chiffrement des numéros de téléphone au repos

**Fichiers :**
- `prisma/schema.prisma`
- Nouveau fichier `src/server/lib/encryption.ts`
- `src/server/services/telephony/callLifecycle.ts`
- `src/server/routers/user.ts` (export GDPR)
- `src/app/api/webhooks/twilio/route.ts`
- `src/server/routers/calls.ts`

**Problème :** Les numéros de téléphone sont stockés en clair dans la base de données.

**Solution :** Chiffrer AES-256-GCM au niveau applicatif.

#### Étape H3.1 — Créer le module de chiffrement

```typescript
// NOUVEAU FICHIER : src/server/lib/encryption.ts

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.PHONE_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("PHONE_ENCRYPTION_KEY environment variable is required");
  }
  // Dériver une clé de 32 bytes depuis n'importe quelle longueur de clé
  return createHash("sha256").update(key).digest();
}

export function encryptPhoneNumber(phone: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(phone, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  // Format: iv:authTag:encryptedData (hex)
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptPhoneNumber(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted phone number format");
  }

  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encryptedData = parts[2];

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Masque un numéro de téléphone pour l'affichage / logs.
 * Affiche seulement les 4 derniers chiffres.
 */
export function maskPhoneNumber(phone: string): string {
  if (phone.length < 4) return "****";
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}
```

#### Étape H3.2 — Modifier le schéma Prisma

```prisma
// DANS : prisma/schema.prisma
// Le champ phoneNumber reste String mais contiendra désormais
// du texte chiffré. Ajouter un champ de date d'expiration.
model Call {
  // ...
  phoneNumber      String    // Stocké chiffré
  phoneExpiresAt   DateTime? // Date de purge
  // ...
}
```

#### Étape H3.3 — Chiffrer à l'insertion

```typescript
// DANS : src/server/services/telephony/callLifecycle.ts
// MODIFIER initiateCall — chiffrer le numéro avant de le stocker

import { encryptPhoneNumber } from "@/server/lib/encryption";

// Dans initiateCall, avant db.$transaction :
const encryptedPhone = encryptPhoneNumber(params.phoneNumber);

// Dans la création du call :
const newCall = await tx.call.create({
  data: {
    userId: params.userId,
    scenarioId: params.scenarioId,
    phoneNumber: encryptedPhone, // Stocké chiffré
    status: "PENDING",
    costCredits: 1,
  },
});
```

#### Étape H3.4 — Déchiffrer pour la réconciliation (webhook Twilio)

```typescript
// DANS : src/app/api/webhooks/twilio/route.ts
// Le webhook n'a PAS besoin de déchiffrer — il utilise le CallSid.
// Laisser le phoneNumber chiffré, on ne l'utilise pas dans ce handler.
```

#### Étape H3.5 — Masquer dans l'export GDPR

```typescript
// DANS : src/server/routers/user.ts
// MODIFIER la section de masquage des numéros

import { decryptPhoneNumber, maskPhoneNumber } from "@/server/lib/encryption";

// Dans exportMyData :
const maskedCalls = calls.map((call) => {
  let maskedNumber = "****";
  try {
    const decrypted = decryptPhoneNumber(call.phoneNumber);
    maskedNumber = maskPhoneNumber(decrypted);
  } catch {
    // Si le déchiffrement échoue (ancien format), afficher masqué
  }
  return {
    ...call,
    phoneNumber: maskedNumber,
  };
});
```

#### Étape H3.6 — Ajouter la variable d'environnement

```bash
# DANS : .env
PHONE_ENCRYPTION_KEY=your-256-bit-encryption-key-here
```

Et dans `src/lib/env.ts` :

```typescript
// AJOUTER dans le schéma envSchema
PHONE_ENCRYPTION_KEY: z.string().min(32),
```

**Vérification :**
1. Lancer un appel — le numéro en DB doit être chiffré (hex:hex:hex)
2. L'export GDPR doit montrer `+33****6789`
3. Sans `PHONE_ENCRYPTION_KEY`, l'application doit refuser de démarrer

---

### H4 — Correction de la transaction Stripe

**Fichier :** `src/app/api/webhooks/stripe/route.ts`

**Problème :** `db.$transaction([promises])` n'est pas une vraie transaction atomique.

**Solution :** Utiliser le pattern callback.

```typescript
// MODIFIER la section checkout.session.completed

case "checkout.session.completed": {
  const session = event.data.object;
  const userId = session.metadata?.userId;
  const creditsStr = session.metadata?.credits;
  if (!userId || !creditsStr) {
    log.error("Missing metadata on checkout session", { sessionId: session.id });
    return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
  }

  const credits = Number.parseInt(creditsStr, 10);
  if (Number.isNaN(credits) || credits <= 0) {
    log.error("Invalid credits value", { creditsStr });
    return NextResponse.json({ error: "Invalid credits" }, { status: 400 });
  }

  // Transaction atomique avec callback + gestion des doublons
  try {
    await db.$transaction(async (tx) => {
      // Créer la purchase en premier — échouera si stripePaymentId existe déjà
      await tx.purchase.create({
        data: {
          userId,
          stripePaymentId: session.id,
          creditsPurchased: credits,
        },
      });

      // Ajouter les crédits
      await tx.user.update({
        where: { id: userId },
        data: { credits: { increment: credits } },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Duplicate — déjà traité
      log.info("Duplicate checkout.session.completed, skipped", {
        sessionId: session.id,
      });
      return NextResponse.json({ received: true });
    }
    throw error; // Erreur inattendue
  }

  log.info("Credits added", { credits, userId, sessionId: session.id });
  break;
}
```

**Vérification :**
1. Envoyer deux webhooks identiques simultanément — un seul doit réussir
2. Simuler un échec de `purchase.create` — les crédits ne doivent PAS être ajoutés

---

### H5 — Anonymisation irréversible des comptes

**Fichiers :**
- `src/server/routers/user.ts` (deleteMyAccount)
- `src/server/routers/admin.ts` (deleteUser admin)

**Problème :** L'email anonymisé contient l'ID original (`deleted-{userId}@...`). Le passwordHash est mis à "DELETED".

**Solution :** Utiliser un UUID aléatoire au lieu de l'userId.

#### Étape H5.1 — deleteMyAccount

```typescript
// DANS : src/server/routers/user.ts
// MODIFIER la mutation deleteMyAccount

deleteMyAccount: protectedProcedure
  .use(withRateLimit({ limit: 1, window: 3600 }))
  .input(
    z.object({
      confirmation: z.literal("SUPPRIMER"),
    }),
  )
  .mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const anonId = crypto.randomUUID(); // ← UUID aléatoire, pas dérivé de userId

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          anonymizedAt: new Date(),
          email: `deleted-${anonId}@anonymized.echoroom.app`, // ← UUID aléatoire
          username: `utilisateur-${anonId.substring(0, 8)}`,   // ← UUID tronqué
          passwordHash: crypto.randomUUID(),  // ← hash invalide non-guessable
          displayName: null,
          bio: null,
          image: null,
        },
      });

      await tx.scenario.updateMany({
        where: { creatorId: userId },
        data: { visibility: "PRIVATE" },
      });

      await tx.comment.updateMany({
        where: { userId },
        data: { content: "[Commentaire supprimé]" },
      });

      // SUPPRIMER les numéros de téléphone dans les appels
      await tx.call.updateMany({
        where: { userId },
        data: { phoneNumber: "[ANONYMISÉ]" },
      });
    });

    return { success: true };
  }),
```

#### Étape H5.2 — Admin deleteUser (identique)

```typescript
// DANS : src/server/routers/admin.ts
// MODIFIER la mutation deleteUser

deleteUser: adminProcedure
  .input(z.object({ userId: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const user = await db.user.findUnique({
      where: { id: input.userId },
      select: { id: true, deletedAt: true },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Utilisateur introuvable",
      });
    }

    if (user.deletedAt) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Cet utilisateur est déjà supprimé",
      });
    }

    const anonId = crypto.randomUUID();

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: input.userId },
        data: {
          deletedAt: new Date(),
          anonymizedAt: new Date(),
          email: `deleted-${anonId}@anonymized.echoroom.app`,
          username: `utilisateur-${anonId.substring(0, 8)}`,
          passwordHash: crypto.randomUUID(),
          displayName: null,
          bio: null,
          image: null,
        },
      });

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

**Vérification :**
1. Supprimer un compte
2. Vérifier que l'email est `deleted-{uuid}@...` (pas l'userId original)
3. Vérifier que `passwordHash` est un UUID, pas "DELETED"

---

## Phase 3 — MEDIUM

### M1 — Prévention de l'énumération de comptes

**Fichier :** `src/lib/auth.ts`

**Problème :** La fonction `authorize` fait un `findUnique` avant le `bcrypt.compare`, créant une différence de timing.

**Solution :** Toujours exécuter `bcrypt.compare`, même si l'utilisateur n'existe pas.

```typescript
// MODIFIER authorize dans src/lib/auth.ts

async authorize(credentials) {
  if (!credentials?.email || !credentials?.password) {
    return null;
  }

  const email = credentials.email as string;
  const password = credentials.password as string;

  const user = await db.user.findUnique({
    where: { email },
  });

  // Toujours comparer le hash, même si l'utilisateur n'existe pas
  const passwordHash = user?.passwordHash ?? "$2b$12$" + 
    "dummyhash".repeat(4) + "dummy"; // Hash factice pour timing constant

  const isValid = await bcrypt.compare(password, passwordHash);

  if (!user || !isValid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.username,
    username: user.username,
    image: user.image,
    role: user.role,
    // credits retiré — ne pas mettre dans le JWT
  };
}
```

**Note :** Le hash factice doit être un hash bcrypt valide pour que `bcrypt.compare` ne lance pas d'erreur. Générer un vrai hash de secours :

```typescript
// Générer le hash factice une fois au démarrage
const DUMMY_HASH = await bcrypt.hash("dummy-timing-attack-prevention", 12);
// Stocker dans une constante, réutiliser dans authorize()
```

**Vérification :** Mesurer le temps de réponse pour un email existant vs inexistant — ils doivent être identiques.

---

### M2 — Retrait des credits du JWT

**Fichiers :**
- `src/lib/auth.ts`
- `src/types/next-auth.d.ts`

**Problème :** Le champ `credits` est stocké dans le JWT et n'est jamais rafraîchi.

**Solution :** Le retirer du JWT et le récupérer depuis la DB via la query `getCredits`.

#### Étape M2.1 — Modifier le type Session

```typescript
// DANS : src/types/next-auth.d.ts

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      username: string;
      role: "USER" | "ADMIN" | "MODERATOR";
      // credits SUPPRIMÉ — toujours fetch depuis la DB
      image: string | null;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role?: "USER" | "ADMIN" | "MODERATOR";
    // credits SUPPRIMÉ
    username?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: "USER" | "ADMIN" | "MODERATOR";
    // credits SUPPRIMÉ
    username: string;
  }
}
```

#### Étape M2.2 — Modifier les callbacks

```typescript
// DANS : src/lib/auth.ts

// MODIFIER jwt callback — retirer credits
async jwt({ token, user }) {
  if (user) {
    token.id = user.id as string;
    token.role = (user.role ?? "USER") as "USER" | "ADMIN" | "MODERATOR";
    token.username = (user.username ?? "") as string;
    // token.credits SUPPRIMÉ
  }
  return token;
},

// MODIFIER session callback — retirer credits
async session({ session, token }) {
  const t = token as unknown as {
    id: string;
    role: "USER" | "ADMIN" | "MODERATOR";
    username: string;
  };
  session.user.id = t.id;
  session.user.role = t.role;
  session.user.username = t.username;
  // session.user.credits SUPPRIMÉ
  return session;
},
```

#### Étape M2.3 — Modifier le type AuthenticatedSession

```typescript
// DANS : src/server/trpc.ts

export interface AuthenticatedSession {
  user: {
    id: string;
    email: string;
    username: string;
    role: "USER" | "ADMIN" | "MODERATOR";
    // credits SUPPRIMÉ — utiliser la query getCredits
    image: string | null;
  };
  expires: string;
}
```

**Vérification :** Vérifier que les composants UI qui affichent les crédits utilisent bien `getCredits` et non `session.user.credits`.

---

### M3 — Durcissement de la protection CSRF

**Fichier :** `src/server/trpc.ts`

**Problème :** `allowMissingOrigin: true` permet aux requêtes sans en-tête Origin de passer.

**Solution :** N'autoriser les requêtes sans Origin qu'en développement.

```typescript
// DANS : src/server/trpc.ts
// MODIFIER la création du contexte TRPC

export async function createTRPCContext(opts?: CreateContextOptions) {
  const session = await auth();

  if (opts?.req && opts.req.method === "POST") {
    try {
      validateCSRF(opts.req, {
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        trustedOrigins: parseTrustedOrigins(process.env.TRUSTED_ORIGINS),
        // ← PRODUCTION : false. Développement : true
        allowMissingOrigin: process.env.NODE_ENV !== "production",
      });
    } catch (error) {
      if (error instanceof CSRFFailure) {
        log.warn("CSRF rejection", { ... });
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Requête rejetée — origine non autorisée",
        });
      }
      throw error;
    }
  }

  return { db, session, ... };
}
```

**Vérification :** En production, une requête POST sans en-tête Origin doit être rejetée avec 403.

---

### M4 — Idempotence de failCall

**Fichier :** `src/server/services/telephony/callLifecycle.ts`

**Problème :** `failCall` peut être appelé plusieurs fois pour le même appel, remboursant les crédits à chaque fois.

**Solution :** Vérifier le statut avant de rembourser.

```typescript
// MODIFIER failCall dans callLifecycle.ts

export async function failCall(
  callId: string,
  durationSeconds: number = 0,
) {
  const call = await db.call.findUnique({
    where: { id: callId },
  });

  if (!call) return;

  // IDEMPOTENCE : ne pas rembourser deux fois
  if (call.status === "FAILED") {
    log.warn("failCall called twice for same call", { callId });
    return;
  }

  // Refund credits and update status atomically
  await db.$transaction([
    db.user.update({
      where: { id: call.userId },
      data: { credits: { increment: call.costCredits } },
    }),
    db.call.update({
      where: { id: callId },
      data: {
        status: "FAILED",
        durationSeconds,
        endedAt: new Date(),
      },
    }),
  ]);
}
```

**Vérification :** Appeler `failCall("call-1", 30)` deux fois — le second appel ne doit pas rembourser.

---

### M5 — Modération des sorties générées par l'IA

**Fichiers :**
- `src/server/services/ai/conversationEngine.ts`
- `src/app/api/webhooks/twilio/voice/handle-input/route.ts`
- `src/app/api/webhooks/twilio/voice/route.ts`

**Problème :** Les réponses générées par l'IA ne sont jamais modérées — un personnage AI pourrait générer du contenu interdit.

**Solution :** Ajouter `checkContent` sur chaque sortie AI.

#### Étape M5.1 — Créer un wrapper de modération pour les sorties

```typescript
// DANS : src/server/services/ai/moderation.ts
// AJOUTER

/**
 * Modère une sortie générée par l'IA.
 * Si le contenu est refusé, retourne un message de remplacement sécurisé.
 */
export async function moderateOutput(text: string): Promise<string> {
  const result = await checkContent(text);
  if (!result.approved) {
    log.warn("AI-generated content blocked", {
      text: text.substring(0, 100),
      reason: result.reason,
    });
    return "Je ne peux pas répondre à cela. Passons à autre chose.";
  }
  return text;
}
```

#### Étape M5.2 — Appliquer dans handle-input

```typescript
// DANS : src/app/api/webhooks/twilio/voice/handle-input/route.ts
// MODIFIER après la génération de la réponse

import { moderateOutput } from "@/server/services/ai/moderation";

// Après generateResponse, dans le handler principal :
const result = await generateResponse({ ... });
let aiResponse = result.response;

// MODÉRATION DE LA SORTIE AI
aiResponse = await moderateOutput(aiResponse);

// Même chose pour le farewell :
let farewell = "Merci pour cette conversation. Au revoir!";
try {
  const result = await generateResponse({ ... });
  farewell = await moderateOutput(result.response); // ← modéré
} catch (error) { ... }
```

#### Étape M5.3 — Appliquer dans le voice route (greeting)

```typescript
// DANS : src/app/api/webhooks/twilio/voice/route.ts

import { moderateOutput } from "@/server/services/ai/moderation";

// Après generateResponse pour le greeting :
let greeting = `Bonjour, vous êtes en ligne avec ${characterName}.`;
try {
  const result = await generateResponse({ ... });
  greeting = await moderateOutput(result.response); // ← modéré
} catch (error) { ... }
```

**Vérification :** Provoquer l'IA à générer du contenu interdit via le prompt — vérifier que la réponse est remplacée.

---

### M6 — Correction ReDoS, homoglyphes et blocklist

**Fichier :** `src/server/services/ai/moderation.ts`

#### Étape M6.1 — Normalisation NFKC

```typescript
// MODIFIER checkContent — ajouter normalize()
export async function checkContent(text: string): Promise<ModerationResult> {
  // NORMALISATION UNICODE — empêche les homoglyphes
  const normalized = text.normalize("NFKC");

  // Step 1: Blocklist check (sur le texte normalisé)
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(normalized)) {
      return {
        approved: false,
        reason: "Contenu interdit détecté (mot-clé bloqué)",
      };
    }
  }

  // Step 2: AI-based check
  if (openai) {
    try {
      // OpenAI API gère déjà l'unicode, envoyer le texte original ou normalisé
      const response = await openai.moderations.create({
        model: "omni-moderation-latest",
        input: normalized,
      });
      // ... suite inchangée
    } catch {
      log.warn("AI moderation call failed, falling back to blocklist");
    }
  }

  return { approved: true };
}
```

#### Étape M6.2 — Correction ReDoS

```typescript
// MODIFIER les patterns problématiques dans forbiddenPatterns

const forbiddenPatterns = [
  // Remplacer /nu(e)?/i par /nue?/i (pas de groupe capturant)
  /nue?/i,

  // Ajouter des limites de répétition aux patterns qui pourraient causer du backtracking
  // /0[1-9]\d{8}/ → /\b0[1-9]\d{8}\b/ (avec \b)
  /\b0[1-9]\d{8}\b/,
  /\b\+33[1-9]\d{8}\b/,

  // Les autres patterns sont simples et sans risque de ReDoS
  // ... (garder les autres inchangés)
];

// Alternative : remplacer les regex par des includes quand possible
// pour les mots-clés simples (plus performant et sans risque ReDoS)
const BLOCKLIST_WORDS = [
  "nazi", "hitler", "trump", "biden", "musk", // ... etc
];

// Dans checkContent, en complément des regex :
function checkBlocklistWords(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKLIST_WORDS.some(word => lower.includes(word));
}
```

**Vérification :**
1. Tester `ｎａｚｉ` (fullwidth) → doit être bloqué
2. Tester `𝓃𝒶𝓏𝒾` (mathematical bold) → doit être bloqué
3. Tester `nu` suivi de 1000 caractères → ne doit pas planter (ReDoS)
4. Tester un texte long de 10 000 caractères → doit répondre en < 100ms

---

### M7 — Mécanisme de retrait de consentement

**Fichiers :**
- `src/server/routers/user.ts` (nouvelle procédure)
- `prisma/schema.prisma` (ajout champ)

**Problème :** Pas de mécanisme pour retirer le consentement (RGPD Art. 7) sans supprimer complètement le compte.

#### Étape M7.1 — Ajouter un champ `consentWithdrawnAt`

```prisma
// DANS : prisma/schema.prisma
model User {
  // ... champs existants ...
  consentAcceptedAt   DateTime?
  consentWithdrawnAt  DateTime? // ← NOUVEAU
  gdprDataExportedAt  DateTime?
  deletedAt           DateTime?
  anonymizedAt        DateTime?
  // ...
}
```

#### Étape M7.2 — Ajouter la procédure TRPC

```typescript
// DANS : src/server/routers/user.ts
// AJOUTER après deleteMyAccount

withdrawConsent: protectedProcedure
  .use(withRateLimit({ limit: 2, window: 3600 }))
  .input(
    z.object({
      confirmation: z.literal("RETIRER"),
    }),
  )
  .mutation(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          consentWithdrawnAt: new Date(),
          // Anonymiser les données personnelles
          displayName: null,
          bio: null,
          image: null,
        },
      });

      // Rendre les scénarios privés
      await tx.scenario.updateMany({
        where: { creatorId: userId },
        data: { visibility: "PRIVATE" },
      });

      // Anonymiser les commentaires
      await tx.comment.updateMany({
        where: { userId },
        data: { content: "[Commentaire supprimé]" },
      });

      // Anonymiser les numéros de téléphone
      await tx.call.updateMany({
        where: { userId },
        data: { phoneNumber: "[ANONYMISÉ]" },
      });
    });

    // Invalider la session
    await db.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });

    return { success: true };
  }),
```

**Vérification :**
1. L'utilisateur retire son consentement
2. Le `consentWithdrawnAt` est rempli
3. Les données personnelles sont anonymisées
4. L'utilisateur est déconnecté (tokenVersion incrémentée)

---

### M8 — Politique de rétention des données

#### Étape M8.1 — Nettoyage des enregistrements audio

```typescript
// NOUVEAU FICHIER : src/server/jobs/cleanupRecordings.ts

import { db } from "@/server/db";
import { createLogger } from "@/server/lib/logger";
import { deleteAudioFile } from "@/server/services/audio/r2";

const log = createLogger("cleanup-recordings");

/**
 * Nettoie les enregistrements audio plus vieux que maxAgeDays.
 * À exécuter via cron (daily) ou après chaque déploiement.
 */
export async function cleanupOldRecordings(maxAgeDays = 90): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);

  const oldCalls = await db.call.findMany({
    where: {
      endedAt: { lte: cutoff },
      recordingUrl: { not: null },
    },
    select: { id: true, recordingUrl: true },
  });

  let deleted = 0;
  for (const call of oldCalls) {
    if (call.recordingUrl) {
      try {
        await deleteAudioFile(call.recordingUrl);
        await db.call.update({
          where: { id: call.id },
          data: { recordingUrl: null },
        });
        deleted++;
      } catch (error) {
        log.error("Failed to delete recording", {
          callId: call.id,
          error,
        });
      }
    }
  }

  log.info("Old recordings cleanup complete", { deleted, maxAgeDays });
  return deleted;
}
```

#### Étape M8.2 — Nettoyage des logs d'audit

```typescript
// NOUVEAU FICHIER : src/server/jobs/cleanupAuditLogs.ts

import { db } from "@/server/db";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("cleanup-audit-logs");

/**
 * Purge les logs d'audit plus vieux que maxAgeDays.
 */
export async function cleanupOldAuditLogs(
  maxAgeDays = 365,
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);

  const result = await db.auditLog.deleteMany({
    where: { createdAt: { lte: cutoff } },
  });

  log.info("Old audit logs cleanup complete", {
    deleted: result.count,
    maxAgeDays,
  });

  return result.count;
}
```

#### Étape M8.3 — Script combiné

```typescript
// NOUVEAU FICHIER : src/server/jobs/run.ts
// Point d'entrée pour un cron job

import { cleanupOldRecordings } from "./cleanupRecordings";
import { cleanupOldAuditLogs } from "./cleanupAuditLogs";

async function main() {
  console.log("Starting cleanup jobs...");
  await cleanupOldRecordings(90);  // 90 jours
  await cleanupOldAuditLogs(365);  // 1 an
  console.log("Cleanup jobs completed.");
}

main().catch(console.error);
```

**Ajouter au package.json :**

```json
{
  "scripts": {
    "cleanup": "tsx src/server/jobs/run.ts",
    "cleanup:recordings": "tsx src/server/jobs/cleanupRecordings.ts",
    "cleanup:audit": "tsx src/server/jobs/cleanupAuditLogs.ts"
  }
}
```

**Vérification :**
1. Exécuter `pnpm cleanup:audit`
2. Vérifier que les logs > 365 jours sont supprimés

---

## Phase 4 — LOW

### L1 — Masquer stripePaymentId dans l'export GDPR

```typescript
// DANS : src/server/routers/user.ts
// MODIFIER la section purchases

const purchases = await db.purchase.findMany({
  where: { userId },
  select: {
    id: true,
    creditsPurchased: true,
    // stripePaymentId SUPPRIMÉ — ne pas exposer
    createdAt: true,
  },
});
```

### L2 — Longueur minimale pour la recherche admin

```typescript
// DANS : src/server/routers/admin.ts
// MODIFIER l'input de listUsers

listUsers: adminProcedure
  .input(
    z.object({
      cursor: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
      search: z.string().max(100).min(2).optional(), // ← min 2 chars
    }),
  )
```

### L3 — Normalisation NFKC pour les numéros de téléphone

```typescript
// DANS : src/server/routers/calls.ts
// MODIFIER l'input de calls.start

phoneNumber: z.string().transform(val => val.normalize("NFKC"))
  .pipe(z.string().regex(/^\+[1-9]\d{6,14}$/, "Format international requis")),
```

### L4 — Alerte OpenAI en production

```typescript
// DANS : src/server/services/ai/moderation.ts
// MODIFIER le catch OpenAI

catch (error) {
  log.error("AI moderation call failed — falling back to blocklist", { error });
  // Alerter en production
  if (process.env.NODE_ENV === "production") {
    // Idéalement : envoyer une alerte PagerDuty/Slack
    console.error("[ALERT] OpenAI moderation unavailable!");
  }
}
```

### L5 — Motifs \b pour les regex de téléphone

```typescript
// DANS : src/server/services/ai/moderation.ts
// MODIFIER les patterns phone
/\b0[1-9]\d{8}\b/,   // ← avec \b
/\b\+33[1-9]\d{8}\b/, // ← avec \b
```

### L6 — Réduire le cap du TRENDING sort

```typescript
// DANS : src/server/routers/scenarios.ts
// MODIFIER le effectiveLimit pour TRENDING

const effectiveLimit = input.sort === "TRENDING" ? 50 : input.limit + 1;
//                                             ^^ 200 → 50
```

### L7 — Vérification des crédits vs priceId

```typescript
// DANS : src/server/services/billing/stripe.ts
// AJOUTER une validation des paliers de prix

const PRICE_TIERS: Record<string, number> = {
  "price_1_credits_10": 10,
  "price_2_credits_50": 50,
  "price_3_credits_200": 200,
};

export async function createCheckoutSession(params: { ... }) {
  const expectedCredits = PRICE_TIERS[params.priceId];
  if (expectedCredits !== params.credits) {
    throw new AppError("INVALID_CREDIT_AMOUNT", "Credit amount doesn't match price tier");
  }
  // ... suite
}
```

### L8 — Portabilité GDPR (fichier téléchargeable)

```typescript
// NOUVEAU FICHIER : src/app/api/user/export/route.ts
// Endpoint dédié pour télécharger les données au format JSON

import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    // ... select identique à exportMyData
  });

  return new NextResponse(JSON.stringify(user, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="echoroom-export-${session.user.id}.json"`,
    },
  });
}
```

---

## Phase 5 — INFO

### I1 — Surveiller les versions de NextAuth

```bash
# Commande à exécuter régulièrement
npx npm-check-updates next-auth
```

### I2 — Sécurité TwiML (documentation uniquement)

Documenter dans le README du projet : "Toujours utiliser le SDK Twilio `twilio.twiml.VoiceResponse` pour construire les réponses TwiML. Ne jamais construire de XML brut."

### I3 — Race condition deleteUser

Documenter que `deleteMyAccount` et admin `deleteUser` peuvent entrer en conflit. Ajouter un `WHERE deletedAt IS NULL`:

```typescript
// Dans les deux mutations, vérifier deletedAt avant de procéder
const user = await tx.user.findUnique({
  where: { id: userId },
  select: { deletedAt: true },
});
if (user?.deletedAt) {
  // Déjà supprimé, ignorer
}
```

---

## Annexe — Résumé des fichiers à modifier

| Fichier | Modifications |
|---------|---------------|
| `prisma/schema.prisma` | `tokenVersion`, `consentWithdrawnAt`, `phoneExpiresAt` |
| `src/lib/auth.ts` | Callbacks JWT/session retravaillés, timing attack fix |
| `src/types/next-auth.d.ts` | `credits` retiré des types |
| `src/server/trpc.ts` | `allowMissingOrigin` conditionnel, `AuthenticatedSession` sans credits |
| `src/server/lib/encryption.ts` | NOUVEAU — chiffrement AES-256-GCM |
| `src/server/middleware/rateLimit.ts` | Fallback in-memory |
| `src/server/middleware/ipRateLimit.ts` | Fallback in-memory |
| `src/server/middleware/rateLimitStore.ts` | NOUVEAU — store in-memory |
| `src/app/api/webhooks/twilio/validate.ts` | NOUVEAU — validation Twilio |
| `src/app/api/webhooks/twilio/route.ts` | Validation Twilio, SSRF fix, recording URL validation |
| `src/app/api/webhooks/twilio/voice/route.ts` | Validation Twilio, modération greeting |
| `src/app/api/webhooks/twilio/voice/handle-input/route.ts` | Validation Twilio, modération sortie AI |
| `src/app/api/webhooks/stripe/route.ts` | Transaction callback + idempotence |
| `src/server/routers/admin.ts` | Types Prisma forts, log retention, guard deletedAt |
| `src/server/routers/auth.ts` | `tokenVersion` incrémentation |
| `src/server/routers/user.ts` | Anonymisation UUID, retrait consentement, export sans stripePaymentId |
| `src/server/routers/calls.ts` | Normalisation NFKC téléphone |
| `src/server/routers/scenarios.ts` | Cap TRENDING 50 |
| `src/server/services/ai/moderation.ts` | Normalisation NFKC, ReDoS fix, alerte prod, moderateOutput |
| `src/server/services/ai/conversationEngine.ts` | Export moderateOutput |
| `src/server/services/telephony/callLifecycle.ts` | failCall idempotence, chiffrement téléphone |
| `src/server/services/billing/stripe.ts` | Validation paliers prix |
| `src/server/jobs/cleanupRecordings.ts` | NOUVEAU — nettoyage R2 |
| `src/server/jobs/cleanupAuditLogs.ts` | NOUVEAU — purge logs |
| `src/server/jobs/run.ts` | NOUVEAU — cron entrypoint |
| `src/app/api/user/export/route.ts` | NOUVEAU — téléchargement GDPR |
| `src/lib/env.ts` | `PHONE_ENCRYPTION_KEY` ajoutée |
| `package.json` | Scripts cleanup |

---

## Ordre de déploiement recommandé

1. **Phase 1 (CRITICAL)** — À faire avant tout déploiement en production
2. **H1, H4, M4** — Impact direct sur la sécurité des tokens et paiements
3. **H2, M1, M3** — Renforcement de l'infrastructure existante
4. **H3, H5** — Protection des données personnelles
5. **M2, M5, M6** — Améliorations de la modération
6. **M7, M8, L1-L8** — Conformité et nettoyage
7. **I1-I3** — Documentation et monitoring
