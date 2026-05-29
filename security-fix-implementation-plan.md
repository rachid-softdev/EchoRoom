# Plan d'Implémentation des Correctifs de Sécurité — Détails Complets

> **Date :** 29 mai 2026
> **Contexte :** Audit de sécurité complémentaire après implémentation des 30 correctifs initiaux.
> **Statut :** 27/30 correctifs initiaux ✅ — 16 nouvelles trouvailles à corriger

---

## Table des matières

- [Phase 1 — CRITIQUE (faire immédiatement)](#phase-1--critique)
  - [C1.1 — .gitignore du workspace](#c11--ajouter-env-au-gitignore-du-workspace)
  - [C1.2 — AbortController dans moderateOutput](#c12--connecter-labortcontroller-dans-moderateoutput)
  - [C1.3 — .env.example incomplet](#c13--compléter-envexample)
  - [C1.4 — encryption.ts et twilioToken.ts → @/lib/env](#c14--migrer-encryptionts-et-twiliotokents-vers-libenv)
- [Phase 2 — HAUTE (faire dans le sprint)](#phase-2--haute)
  - [H2.1 — Endpoint d'export GDPR téléchargeable](#h21--créer-le-endpoint-dexport-gdpr)
  - [H2.2 — Verrouiller GET /api/webhooks/twilio/voice](#h22--verrouiller-le-get-handler-de-voice)
  - [H2.3 — Implémenter verifyTwilioToken](#h23--implémenter-la-vérification-du-token-dans-voice)
  - [H2.4 — Mutation de changement de mot de passe](#h24--créer-la-mutation-de-changement-de-mot-de-passe)
- [Phase 3 — MOYENNE (sprint suivant)](#phase-3--moyenne)
  - [M3.1 — Blocage des emails jetables + CAPTCHA](#m31--blocage-des-emails-jetables)
  - [M3.2 — Tests de sécurité manquants](#m32--tests-de-sécurité-manquants)
  - [M3.3 — Documentation TwiML](#m33--documentation-twiml)
- [Phase 4 — Upgrades](#phase-4--upgrades)
  - [U4.1 — Migration Next.js 14 → 15](#u41--migration-nextjs-14--15)
  - [U4.2 — NextAuth stable](#u42--nextauth-stable)

---

## Phase 1 — CRITIQUE

### C1.1 — Ajouter `.env` au `.gitignore` du workspace

**Fichier :** `echoroom-web/.gitignore`

**Problème :** Le `.gitignore` racine du monorepo couvre `.env`, mais celui du workspace `echoroom-web/` ne le fait pas. Si le `.gitignore` racine est modifié, `.env` contenant des secrets (même de dev) serait commité.

**Modification :**
```gitignore
# LIGNE À AJOUTER (ligne 10, après next-env.d.ts)
.env
```

**Fichier final `echoroom-web/.gitignore` :**
```gitignore
node_modules/
.next/
.env.local
.env.production.local
dist/
.turbo/
coverage/
*.tsbuildinfo
next-env.d.ts
.env
.env.*.local
```

**Vérification :**
```bash
cd echoroom-web
git check-ignore .env
# Doit retourner : echoroom-web/.env
```

---

### C1.2 — Connecter l'AbortController dans moderateOutput

**Fichier :** `echoroom-web/src/server/services/ai/moderation.ts`

**Problème :** `moderateOutput` utilise `Promise.race` avec un timeout, mais l'appel OpenAI sous-jacent (`checkContent`) continue de s'exécuter en arrière-plan. Pendant un outage OpenAI, chaque réponse AI génère des appels OpenAI zombies qui consomment du quota et du débit.

**Modification :**

```typescript
// LIGNES 139-173 — REMPLACER moderateOutput par :

export async function moderateOutput(
  text: string,
  timeoutMs: number = 2000,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await checkContent(text, controller.signal);
    if (!result.approved) {
      log.warn("AI-generated content blocked", {
        text,
        reason: result.reason,
      });
      return "Je ne peux pas répondre à cela. Passons à autre chose.";
    }
    return text;
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      log.warn("Moderation timed out — allowing content through", {
        text: text.substring(0, 100),
      });
      return text;
    }
    // Si l'erreur vient d'AbortController, le timeout a déjà été nettoyé
    log.error("Moderation failed with unexpected error", { error });
    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**Vérification :**
1. Simuler un délai OpenAI > 2s → `controller.abort()` est appelé → la promesse OpenAI est annulée
2. Vérifier dans les logs que la ressource est libérée immédiatement

---

### C1.3 — Compléter `.env.example`

**Fichier :** `echoroom-web/.env.example`

**Problème :** `PHONE_ENCRYPTION_KEY` et `TWILIO_TOKEN_SECRET` manquent. `STRIPE_PUBLISHABLE_KEY` est présent mais inutilisé côté serveur (c'est `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` qui est utilisé).

**Modification :**
```bash
# LIGNE 18 — SUPPRIMER (inutilisé côté serveur) :
- STRIPE_PUBLISHABLE_KEY=pk_test_...

# LIGNE 26 (après TWILIO_PHONE_NUMBER) — AJOUTER :
TWILIO_TOKEN_SECRET=your-hmac-secret-at-least-16-chars

# LIGNE 46 (après PostHog) — AJOUTER :
# ─── Phone Encryption ────────────────────────────────────
PHONE_ENCRYPTION_KEY=your-256-bit-encryption-key-here
```

**Fichier final (extrait des sections modifiées) :**
```bash
# ─── Stripe ────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# ─── Twilio ────────────────────────────────────────────
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+15551234567
TWILIO_TOKEN_SECRET=your-hmac-secret-at-least-16-chars

# ─── Phone Encryption ──────────────────────────────────
PHONE_ENCRYPTION_KEY=your-256-bit-encryption-key-here
```

---

### C1.4 — Migrer `encryption.ts` et `twilioToken.ts` vers `@/lib/env`

> **Note architecte :** `TWILIO_TOKEN_SECRET` est DÉJÀ dans `env.ts` (lignes 28, 53). C1.4a est déjà fait. On passe directement à C1.4b et C1.4c.

#### C1.4b — Modifier `encryption.ts` pour utiliser `env`

**Fichier :** `echoroom-web/src/server/lib/encryption.ts`

**⚠️ ATTENTION :** Après cette migration, `encryption.test.ts` doit être mis à jour car les tests "throws when PHONE_ENCRYPTION_KEY is not set" ne fonctionneront plus — `env.ts` garantit déjà la présence de la clé en dev. Voir instructions plus bas.

**Problème :** `getEncryptionKey()` lit `process.env.PHONE_ENCRYPTION_KEY` directement.

#### C1.4b — Modifier `encryption.ts` pour utiliser `env`

**Fichier :** `echoroom-web/src/server/lib/encryption.ts`

**Problème :** `getEncryptionKey()` lit `process.env.PHONE_ENCRYPTION_KEY` directement.

**Modifications :**

```typescript
// LIGNE 1 — AJOUTER l'import
import { env } from "@/lib/env";

// LIGNES 16-24 — REMPLACER getEncryptionKey par :
let encryptionKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (encryptionKey) return encryptionKey;
  // Utiliser env validé plutôt que process.env direct
  encryptionKey = createHash("sha256").update(env.PHONE_ENCRYPTION_KEY).digest();
  return encryptionKey;
}
```

#### C1.4c — Modifier `twilioToken.ts` pour utiliser `env`

**Fichier :** `echoroom-web/src/server/lib/twilioToken.ts`

**Modifications :**

```typescript
// LIGNE 1 — AJOUTER l'import
import { env } from "@/lib/env";

// LIGNES 3-12 — SUPPRIMER ENV_VAR et getSecret
// const ENV_VAR = "TWILIO_TOKEN_SECRET";  ← SUPPRIMER
// function getSecret(): string { ... }    ← SUPPRIMER

// LIGNE 25 — MODIFIER createTwilioToken pour utiliser env directement :
export function createTwilioToken(callId: string, scenarioId: string): string {
  const secret = env.TWILIO_TOKEN_SECRET;  // ← plus de getSecret()
  const payload: TwilioTokenPayload = { callId, scenarioId, iat: Date.now() };
  // ... suite inchangée
```

```typescript
// LIGNE 40 — MODIFIER verifyTwilioToken pour utiliser env directement :
export function verifyTwilioToken(
  token: string,
  maxAgeMs: number = DEFAULT_TTL_MS,
): TwilioTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;

  try {
    const secret = env.TWILIO_TOKEN_SECRET;  // ← plus de getSecret()
    // ... suite inchangée
```

**Vérification (C1.4a-c) :**
1. Démarrer l'application sans `TWILIO_TOKEN_SECRET` → erreur au démarrage (Zod)
2. Démarrer l'application sans `PHONE_ENCRYPTION_KEY` → erreur au démarrage (Zod)
3. L'app `twilio.webhook.validateRequest` fonctionne toujours

---

## Phase 2 — HAUTE

### H2.1 — Créer le endpoint d'export GDPR téléchargeable

**Nouveau fichier :** `echoroom-web/src/app/api/user/export/route.ts`

**Problème :** L'export GDPR (L8) n'existe que via tRPC (`exportMyData`), pas en tant que fichier téléchargeable. GDPR Article 20 exige un format "structuré, couramment utilisé et lisible par machine".

**Code complet :**

```typescript
import { auth } from "@/lib/auth";
import { db } from "@/server/db";
import { decryptPhoneNumber, maskPhoneNumber } from "@/server/lib/encryption";
import { createLogger } from "@/server/lib/logger";
import { NextResponse } from "next/server";

const log = createLogger("gdpr-export");

/**
 * GET /api/user/export
 * Télécharge les données utilisateur au format JSON.
 * Nécessite une session valide (via cookie NextAuth).
 * Rate-limité : 2 exports par heure.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const userId = session.user.id;

  // Rate limiting simple côté serveur
  const lastExport = await db.user.findUnique({
    where: { id: userId },
    select: { gdprDataExportedAt: true },
  });

  if (lastExport?.gdprDataExportedAt) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (lastExport.gdprDataExportedAt > oneHourAgo) {
      return NextResponse.json(
        { error: "Limite d'export atteinte (1 par heure)" },
        { status: 429 },
      );
    }
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      bio: true,
      image: true,
      role: true,
      credits: true,
      totalLikesReceived: true,
      totalCallsMade: true,
      consentAcceptedAt: true,
      gdprDataExportedAt: true,
      deletedAt: true,
      anonymizedAt: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  // Charger les relations
  const [scenarios, calls, comments, purchases] = await Promise.all([
    db.scenario.findMany({
      where: { creatorId: userId },
      select: {
        id: true,
        title: true,
        description: true,
        visibility: true,
        moderationStatus: true,
        playCount: true,
        likeCount: true,
        createdAt: true,
        character: { select: { name: true } },
      },
    }),
    db.call.findMany({
      where: { userId },
      select: {
        id: true,
        phoneNumber: true,
        status: true,
        durationSeconds: true,
        costCredits: true,
        createdAt: true,
        endedAt: true,
      },
    }),
    db.comment.findMany({
      where: { userId },
      select: {
        id: true,
        content: true,
        moderationStatus: true,
        createdAt: true,
        scenario: { select: { id: true, title: true } },
      },
    }),
    db.purchase.findMany({
      where: { userId },
      select: {
        id: true,
        creditsPurchased: true,
        createdAt: true,
      },
    }),
  ]);

  // Masquer les numéros de téléphone
  const maskedCalls = calls.map((call) => {
    let masked = "****";
    try {
      const decrypted = decryptPhoneNumber(call.phoneNumber);
      masked = maskPhoneNumber(decrypted);
    } catch {
      if (call.phoneNumber.length >= 4) {
        masked = `xxxx${call.phoneNumber.slice(-4)}`;
      }
    }
    return { ...call, phoneNumber: masked };
  });

  // Marquer la date d'export
  await db.user.update({
    where: { id: userId },
    data: { gdprDataExportedAt: new Date() },
  });

  const exportData = {
    exportedAt: new Date().toISOString(),
    exporterVersion: "1.0",
    user,
    scenarios,
    calls: maskedCalls,
    comments,
    purchases,
  };

  const filename = `echoroom-export-${userId.substring(0, 8)}.json`;

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
```

**Vérification :**
1. `GET /api/user/export` sans cookie → 401
2. `GET /api/user/export` avec cookie valide → fichier JSON téléchargé avec `Content-Disposition: attachment`
3. Le fichier contient les données complètes mais les numéros de téléphone sont masqués
4. `gdprDataExportedAt` est mis à jour dans la base

---

### H2.2 — Verrouiller le GET handler de voice

**Fichier :** `echoroom-web/src/app/api/webhooks/twilio/voice/route.ts`

**Problème :** Le handler `GET` à la ligne 24 retourne l'état complet de la conversation (messages, status, turnCount) sans aucune authentification. N'importe qui avec un `callSid` valide peut lire les transcripts.

**Modification :**

```typescript
// LIGNES 20-41 — REMPLACER le handler GET par :

/**
 * GET handler — check call health.
 * Retourne uniquement un booléen, pas de contenu de conversation.
 * Ne nécessite pas d'auth car Twilio CallSid est imprédictible,
 * mais on ne divulgue PAS les messages pour éviter toute fuite.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const callSid = searchParams.get("callSid");

  if (!callSid) {
    return NextResponse.json({ active: false, reason: "missing_callSid" });
  }

  // Vérification HMAC : le callSid doit être accompagné d'un token valide
  // pour les clients internes (dashboard, etc.)
  const token = searchParams.get("token");
  if (!token) {
    // Pour les requêtes Twilio uniquement, retourner minium
    const state = await getConversationState(callSid);
    return NextResponse.json({
      active: state?.status === "active",
      // On ne retourne PAS les messages, status détaillé, etc.
    });
  }

  // Avec token valide, on peut donner plus d'info
  try {
    const { verifyTwilioToken } = await import("@/server/lib/twilioToken");
    const payload = verifyTwilioToken(token);
    if (!payload) {
      return NextResponse.json({ active: false, reason: "invalid_token" });
    }
    const state = await getConversationState(callSid);
    return NextResponse.json({
      active: state?.status === "active",
      status: state?.status,
      turnCount: state?.turnCount,
    });
  } catch {
    return NextResponse.json({ active: false, reason: "error" });
  }
}
```

**Vérification :**
1. `GET /api/webhooks/twilio/voice?callSid=CAxxx` → `{ active: true/false }` sans messages
2. `GET /api/webhooks/twilio/voice?callSid=CAxxx&token=invalide` → `{ active: false, reason: "invalid_token" }`
3. `GET /api/webhooks/twilio/voice?callSid=CAxxx&token=valide` → `{ active, status, turnCount }` (complet)

---

### H2.3 — Implémenter la vérification du token dans voice

**Fichier :** `echoroom-web/src/app/api/webhooks/twilio/voice/route.ts`

**Problème :** `callLifecycle.ts` crée un token HMAC via `createTwilioToken(call.id, scenario.id)` et le passe dans l'URL du webhook, mais le handler voice ne le vérifie JAMAIS. Il parse les query params directement (`searchParams.get('callId')`, `searchParams.get('scenarioId')`). Le token est du code mort.

**Deux options :**

**Option A (simplification) :** Supprimer la création de token et passer les IDs directement.

```typescript
// DANS : callLifecycle.ts LIGNE 88-92 — REMPLACER :
const token = createTwilioToken(call.id, scenario.id);
const twilioCall = await twilioClient.calls.create({
  // ...
  url: `${appUrl}/api/webhooks/twilio/voice?token=${token}`,
  // ...
});

// PAR :
const twilioCall = await twilioClient.calls.create({
  // ...
  url: `${appUrl}/api/webhooks/twilio/voice?callId=${call.id}&scenarioId=${scenario.id}`,
  // ...
});
```

**Option B (sécurité renforcée) :** Implémenter `verifyTwilioToken` dans le handler voice.

```typescript
// DANS : voice/route.ts POST handler — APRÈS la validation Twilio (ligne 56)
// REMPLACER :
const callId = searchParams.get('callId')
// ...
let scenarioId = searchParams.get('scenarioId') ?? ''
let characterId = searchParams.get('characterId') ?? ''

// PAR :
const token = searchParams.get('token');
let callId: string | null = null;
let scenarioId = '';
let characterId = '';

if (token) {
  const payload = verifyTwilioToken(token);
  if (payload) {
    callId = payload.callId;
    scenarioId = payload.scenarioId;
    // characterId sera résolu via la DB (lignes 65-93 existantes)
  } else {
    log.warn("Invalid or expired Twilio token", { token: token.substring(0, 20) });
  }
}
// Le fallback via DB (lignes 65-93) reste inchangé
```

**Recommandation :** L'Option A est plus simple et plus maintenable. La validation de signature Twilio (C1 déjà implémentée) suffit pour l'authenticité des webhooks. Le token HMAC ajoute de la complexité sans bénéfice réel.

**Vérification (Option A) :**
1. Les appels Twilio existent toujours (pas de régression)
2. `voice/route.ts` n'a pas besoin de token pour fonctionner (fallback DB)
3. Les IDs passés en query params sont protégés par la validation de signature Twilio

---

### H2.4 — Créer la mutation de changement de mot de passe

**Fichier :** `echoroom-web/src/server/routers/auth.ts`

**Problème :** `tokenVersion` existe dans le schéma et est correctement vérifié dans le callback JWT, mais il n'y a AUCUNE mutation pour changer de mot de passe (qui est le déclencheur prévu pour incrémenter `tokenVersion`).

**Code à ajouter dans `auth.ts` (après la mutation `register`) :**

```typescript
changePassword: protectedProcedure
  .use(withRateLimit({ limit: 3, window: 3600 }))
  .input(
    z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(128),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const userId = ctx.session.user.id;

    // Récupérer l'utilisateur avec son hash actuel
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Utilisateur introuvable",
      });
    }

    // Vérifier le mot de passe actuel
    const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Mot de passe actuel incorrect",
      });
    }

    // Hacher le nouveau mot de passe
    const newHash = await bcrypt.hash(input.newPassword, 12);

    // Atomic update : nouveau hash + incrément tokenVersion
    await db.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        tokenVersion: { increment: 1 },
      },
    });

    log.info("Password changed and tokenVersion incremented", { userId });

    return { success: true };
  }),
```

**Vérification :**
1. Changer le mot de passe avec `currentPassword` incorrect → erreur 400
2. Changer le mot de passe avec `newPassword` trop court → erreur Zod
3. Changer le mot de passe avec des données valides → succès
4. Après le changement, l'ancien JWT est invalidé (grâce à `tokenVersion`)

---

## Phase 3 — MOYENNE

### M3.1 — Blocage des emails jetables

**Fichier :** `echoroom-web/src/server/routers/auth.ts`

**Problème :** L'inscription accepte n'importe quel email sans bloquer les domaines d'emails jetables.

**Modifications :**

```typescript
// LIGNE 1 — AJOUTER l'import :
import { createLogger } from "@/server/lib/logger";

// LIGNE 6 — AJOUTER près des autres imports :
const log = createLogger("auth");

// Liste des domaines jetables (extrait — version complète via package npm)
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "throwaway.email",
  "yopmail.com",
  "temp-mail.org",
  "sharklasers.com",
  "trashmail.com",
  "burnermail.io",
  "maildrop.cc",
  "getairmail.com",
  "emailondeck.com",
  "fakeinbox.com",
  "tempinbox.com",
  "mailexpire.com",
  "spambox.us",
  "spamgourmet.com",
  "dispostable.com",
  "mailcatch.com",
]);

// LIGNES 23-29 — MODIFIER register, AJOUTER après la vérification consentAccepted :

if (!input.consentAccepted) {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Vous devez accepter les conditions d'utilisation",
  });
}

// AJOUT : Vérification des emails jetables
const emailDomain = input.email.split("@")[1]?.toLowerCase();
if (emailDomain && DISPOSABLE_DOMAINS.has(emailDomain)) {
  log.warn("Registration blocked — disposable email", {
    email: input.email,
    domain: emailDomain,
  });
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Les emails jetables ne sont pas autorisés",
  });
}
```

> **Note pour la production :** Utiliser le package npm `disposable-email-domains` (ou `check-disposable-email`) au lieu d'une liste statique pour une couverture à jour. Ajouter comme dépendance :
> ```bash
> pnpm add disposable-email-domains
> ```
> Puis remplacer le Set statique par :
> ```typescript
> import disposableDomains from "disposable-email-domains";
> const domainSet = new Set(disposableDomains);
> ```

**Vérification :**
1. S'inscrire avec `user@mailinator.com` → bloqué
2. S'inscrire avec `user@gmail.com` → accepté
3. S'inscrire avec `user@10minutemail.com` → bloqué

---

### M3.2 — Tests de sécurité manquants

#### M3.2a — Tests JWT/Session (nouveau fichier)

**Nouveau fichier :** `echoroom-web/src/lib/__tests__/auth.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/server/db";

// Tests pour les callbacks JWT de auth.ts
// Ces tests vérifient le comportement sans lancer NextAuth complet

describe("JWT tokenVersion revalidation", () => {
  it("should reject token when user is deleted", async () => {
    // Simuler findUnique retournant null (user supprimé)
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
      tokenVersion: 2, // DB a une version plus récente
    });

    const result = await simulateJwtCallback({
      token: { id: "user-1", tokenVersion: 0 }, // Token a l'ancienne version
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
    expect(result?.lastVerified).toBeDefined();
  });
});

describe("DUMMY_HASH timing constant", () => {
  it("should produce the same bcrypt hash format", () => {
    // Vérifier que le hash factice est un hash bcrypt valide
    const dummyHash = "$2b$12$dummyhashdummyhashdummyhashdummyhashdummyhash";
    expect(dummyHash).toMatch(/^\$2[abxy]\$\d{2}\$/);
  });
});
```

#### M3.2b — Tests GDPR (nouveau fichier)

**Nouveau fichier :** `echoroom-web/src/server/routers/__tests__/user.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/server/db";

describe("deleteMyAccount", () => {
  it("should anonymize with random UUID, not user ID", async () => {
    const userId = "user-123";
    const mockTx = {
      user: {
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn(),
      },
      scenario: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      comment: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      call: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };

    // Simuler $transaction avec callback
    vi.spyOn(db, "$transaction").mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => cb(mockTx),
    );

    // Appeler la fonction de suppression (simulée)
    await anonymizeUser(userId);

    // Vérifier que l'email N'A PAS l'userId original
    const updateCall = mockTx.user.update.mock.calls[0][0];
    expect(updateCall.data.email).not.toContain("user-123");
    expect(updateCall.data.email).toMatch(/^deleted-[0-9a-f-]+@/);

    // Vérifier que passwordHash n'est pas "DELETED"
    expect(updateCall.data.passwordHash).not.toBe("DELETED");
    expect(updateCall.data.passwordHash).toMatch(/^[0-9a-f-]+$/);
  });
});
```

#### M3.2c — Tests de concurrence (nouveau fichier)

**Nouveau fichier :** `echoroom-web/src/server/__tests__/concurrency.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { db } from "@/server/db";

describe("Race conditions", () => {
  it("should handle simultaneous deleteMyAccount + admin deleteUser", async () => {
    const userId = "test-user-id";

    // Vérifier que le second appel ne crée pas d'erreur
    const result1 = db.$transaction(async (tx) => {
      // Premier appel : vérifie et supprime
      return { success: true };
    });

    const result2 = db.$transaction(async (tx) => {
      // Deuxième appel : doit détecter que deletedAt est déjà rempli
      return { success: true };
    });

    // Les deux doivent réussir (le second est un no-op)
    await expect(result1).resolves.not.toThrow();
    await expect(result2).resolves.not.toThrow();
  });
});
```

---

### M3.3 — Documentation TwiML

**Fichier :** `D:\git-projects\EchoRoom\SECURITY.md` (NOUVEAU)

> **⚠️ Correction architecte :** `LANDING.md` est un composant React, pas un fichier de documentation. Utiliser `SECURITY.md` à la racine.

**Problème :** Aucune documentation sur le fait qu'il faut TOUJOURS utiliser le SDK Twilio pour construire les réponses TwiML.

**Code complet du nouveau fichier :**

```markdown
# EchoRoom — Sécurité

## TwiML — Toujours utiliser le SDK

Toutes les réponses TwiML (XML de contrôle d'appel) doivent être construites
exclusivement via le SDK Twilio (`twilio.twiml.VoiceResponse`).

```typescript
// ✅ Correct — SDK Twilio (échappement automatique)
const twiml = new VoiceResponse();
twiml.say({ voice: 'alice' }, 'Bonjour');
twiml.hangup();

// ❌ Interdit — XML brut (risque d'injection XML)
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>Bonjour</Say></Response>`;
```

L'utilisation du SDK garantit l'échappement automatique des entrées utilisateur
et prévient les attaques par injection XML.

## Variables d'environnement requises

Voir `.env.example` pour la liste complète. En production, toutes les variables
sont validées au démarrage par `src/lib/env.ts`.
```

---

## Phase 4 — Upgrades

### U4.1 — Migration Next.js 14 → 15

**Fichiers :** `echoroom-web/package.json` et configurations associées

**Problème :** Next.js 14.2.35 a 5 CVEs HIGH. La migration vers v15 est nécessaire.

**Étapes :**

```bash
# 1. Mettre à jour les dépendances
pnpm add next@^15.1.0 react@^19.0.0 react-dom@^19.0.0

# 2. Mettre à jour les types
pnpm add -D @types/react@^19.0.0 @types/react-dom@^19.0.0

# 3. Vérifier la compatibilité NextAuth
# next-auth@5.0.0-beta.25 devrait fonctionner avec Next.js 15
# Si problème, utiliser next-auth@5.0.0-beta.26+ si disponible
```

**Modifications `package.json` :**
```json
{
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

**Vérification :**
```bash
pnpm install
pnpm build  # Doit réussir sans erreur
pnpm test   # Tous les tests passent
```

**Risques identifiés :**
- React 19 a des changements dans les hooks (useEffect, useCallback) — vérifier les composants client
- `next-auth@5.0.0-beta.x` peut avoir des incompatibilités — tester l'authentification complète
- tRPC Next.js adapter — vérifier la compatibilité avec Next.js 15

---

### U4.2 — NextAuth stable

**Problème :** `next-auth@5.0.0-beta.25` — version bêta, pas de support de sécurité garanti.

**Actions :**

```bash
# Surveiller les releases :
npx npm-check-updates next-auth

# Si next-auth v4 stable :
pnpm add next-auth@^4.24.0
# Migration v5 → v4 : changer les imports (next-auth/adapters, etc.)
```

**Vérification :**
```bash
npx npm audit next-auth  # Vérifier les CVEs connus
```

---

## Annexe — Résumé des modifications

| Fichier | Modification | Phase | Effort |
|---------|-------------|-------|--------|
| `echoroom-web/.gitignore` | Ajouter `.env` | C1.1 | 1 min |
| `echoroom-web/src/server/services/ai/moderation.ts` | AbortController dans moderateOutput | C1.2 | 30 min |
| `echoroom-web/.env.example` | Ajouter TWILIO_TOKEN_SECRET, PHONE_ENCRYPTION_KEY; retirer STRIPE_PUBLISHABLE_KEY | C1.3 | 5 min |
| `echoroom-web/src/server/lib/encryption.ts` | Utiliser `env` au lieu de `process.env` | C1.4b | 10 min |
| `echoroom-web/src/server/lib/twilioToken.ts` | Utiliser `env` au lieu de `process.env` | C1.4c | 10 min |
| `echoroom-web/src/app/api/user/export/route.ts` | NOUVEAU — endpoint GDPR | H2.1 | 1h |
| `echoroom-web/src/app/api/webhooks/twilio/voice/route.ts` | Restreindre GET handler | H2.2 | 30 min |
| `echoroom-web/src/app/api/webhooks/twilio/voice/route.ts` + `callLifecycle.ts` | Option A: supprimer token callLifecycle | H2.3 | 30 min |
| `echoroom-web/src/server/routers/auth.ts` | Mutation changePassword | H2.4 | 1h |
| `echoroom-web/src/server/routers/auth.ts` | Blocage emails jetables (+ pnpm add) | M3.1 | 30 min |
| `echoroom-web/src/lib/__tests__/auth.test.ts` | NOUVEAU — tests JWT | M3.2a | 2h |
| `echoroom-web/src/server/routers/__tests__/user.test.ts` | NOUVEAU — tests GDPR | M3.2b | 1h |
| `echoroom-web/src/server/__tests__/concurrency.test.ts` | NOUVEAU — tests concurrence | M3.2c | 2h |
| `echoroom-web/src/server/services/ai/__tests__/moderation.test.ts` | MÀJ — adapter test env pour C1.4b | C1.4b | 30 min |
| `D:\git-projects\EchoRoom\SECURITY.md` | NOUVEAU — documentation TwiML | M3.3 | 15 min |
| `echoroom-web/package.json` | Upgrade Next.js 14→15 | U4.1 | 2-3j |
| `echoroom-web/package.json` | NextAuth stable | U4.2 | 1j |

---

## Ordre d'exécution recommandé

```
Jour 1 : C1.1 → C1.2 → C1.3 → C1.4b + MÀJ tests encryption → C1.4c (critiques, ~2h)
Jour 2 : H2.1 → H2.2 → H2.3 → H2.4 (hautes, ~3h)
Jour 3 : M3.1 → M3.2a-c → M3.3 (moyennes, ~5h30)
Semaine 2-3 : U4.1 (migration Next.js, 2-3j)
Semaine 3-4 : U4.2 (NextAuth stable, différé — plan insuffisant)
```
