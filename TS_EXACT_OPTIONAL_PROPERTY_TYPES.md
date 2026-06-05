# 🔧 Guide d'implémentation — `exactOptionalPropertyTypes: true`

> **Projet** : EchoRoom — `echoroom-web` uniquement  
> **Erreurs** : 37 (après Round 1 + Round 2)  
> **Fichiers** : ~25  
> **Risque principal** : Prisma — `undefined` ≠ `null` en base de données  
> **Temps estimé** : 2-3 heures (si fait dans l'ordre optimal)

---

## 0. Préparation

### 0.1 Activer l'option dans le tsconfig

```json
// echoroom-web/tsconfig.json — AJOUTER dans compilerOptions
"exactOptionalPropertyTypes": true
```

Ou en ligne de commande pour tester sans modifier le fichier :
```bash
cd echoroom-web
npx tsc --noEmit --exactOptionalPropertyTypes 2>&1 | Select-String "error TS"
```

### 0.2 Comprendre le comportement

```typescript
interface Config { name?: string; }

// SANS exactOptionalPropertyTypes :
const a: Config = { name: undefined }; // ✅ OK — undefined assignable à prop optionnelle

// AVEC exactOptionalPropertyTypes :
const b: Config = { name: undefined }; // ❌ Erreur
// Une prop optionnelle (name?: string) signifie :
//   - LA PROPRIÉTÉ PEUT ÊTRE ABSENTE
//   - PAS "la propriété peut être présente avec la valeur undefined"

// Corrections valides :
const c: Config = {};                 // ✅ OK — name absent
const d: Config = { name: "test" };  // ✅ OK — name présent
```

---

## 1. Ordre d'implémentation recommandé

Corriger dans CET ordre (du plus sûr au plus risqué) :

```
Phase 1 : Tests            (6 erreurs, 3 fichiers)  → 5 min  → risque nul
Phase 2 : Logger/metrics   (3 erreurs, 2 fichiers)  → 5 min  → risque nul
Phase 3 : Config files     (2 erreurs, 2 fichiers)  → 5 min  → risque nul
Phase 4 : UI Composants    (8 erreurs, 4 fichiers)  → 15 min → risque faible
Phase 5 : Services/routers (11 erreurs, 9 fichiers) → 20 min → risque modéré
Phase 6 : Prisma           (4 erreurs, 3 fichiers)  → 10 min → RISQUÉ (DB)
Phase 7 : tRPC provider    (2 erreurs, 1 fichier)   → 5 min  → risque faible
Phase 8 : OG image route   (1 erreur, 1 fichier)    → 5 min  → risque nul
```

---

## 2. Phase 1 — Tests (6 erreurs, 3 fichiers, 5 min)

### 2.1 `src/components/social/__tests__/ShareButtons.test.tsx` (2 erreurs)

**Ligne 82** et **ligne 191** :
```typescript
// ❌ AVANT
render(<ShareButtons description={undefined} scenarioId="..." title="..." />);

// ✅ APRÈS — Omettre la prop description
render(<ShareButtons scenarioId="..." title="..." />);
// ou utiliser empty string (si logique métier l'accepte) :
render(<ShareButtons description="" scenarioId="..." title="..." />);
```

---

### 2.2 `src/hooks/__tests__/usePaginatedQuery.test.ts` (3 erreurs)

**Lignes 90, 150, 352** :
```typescript
// ❌ AVANT (ligne 90)
const mockData = { items: mockItems, nextCursor: undefined };

// ✅ APRÈS — Omettre la prop nextCursor
const mockData = { items: mockItems };

// ❌ AVANT (ligne 352 — type différent mais même pattern)
const mockData = { items: mockItems, nextCursor: undefined };

// ✅ APRÈS
const mockData = { items: mockItems };
```

---

### 2.3 `prisma/rollback.ts` (1 erreur)

**Ligne 58** — stocker `string | undefined` dans une variable typée `string` :
```typescript
// ❌ AVANT
const val: string = maybeUndefined; // Erreur si undefined

// ✅ APRÈS
const val: string | undefined = maybeUndefined;
```

→ Vérifier le contexte exact pour adapter la correction.

---

## 3. Phase 2 — Logger/metrics (3 erreurs, 2 fichiers, 5 min)

### 3.1 `src/server/lib/logger.ts` (1 erreur)

**Ligne 70-75** :
```typescript
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  meta?: Record<string, unknown>;  // ← CHANGER : rendre optionnel
  // ou : meta: Record<string, unknown> | undefined;
}
```

La création de l'entrée (ligne 70-76) est déjà correcte si `meta` devient optionnel :
```typescript
const entry: LogEntry = {
  timestamp: new Date().toISOString(),
  level,
  module,
  message,
  meta: enhancedMeta,  // enhancedMeta peut être undefined → OK si meta?:
};
```

---

### 3.2 `src/server/middleware/metrics.ts` (2 erreurs)

**Lignes 32-41 et 55-63** — `userId` passé à `trackEvent` :
```typescript
// ❌ AVANT
trackEvent({
  event: "trpc_request",
  userId: ctx.session?.user?.id,  // string | undefined
  properties: { ... },
});

// ✅ APRÈS — Option A : ne passer userId que s'il existe
trackEvent({
  event: "trpc_request",
  ...(userId ? { userId } : {}),
  properties: { ... },
});

// ✅ APRÈS — Option B : rendre userId optionnel dans le type TrackEventParams
// (dans le fichier où TrackEventParams est défini)
interface TrackEventParams {
  event: string;
  userId?: string;  // ← optionnel
  properties: Record<string, unknown>;
}
```

---

## 4. Phase 3 — Config files (2 erreurs, 2 fichiers, 5 min)

### 4.1 `playwright.config.ts` (1 erreur)

**Ligne 3** — `workers: number | undefined` non assignable à `string | number` :
```typescript
// ❌ AVANT
const config: PlaywrightTestConfig = {
  workers: process.env.CI ? 2 : undefined,
};

// ✅ APRÈS — Omettre workers quand undefined
const config: PlaywrightTestConfig = {
  ...(process.env.CI ? { workers: 2 } : {}),
};
```

---

### 4.2 `prisma/rollback.ts` (1 erreur — déjà dans Phase 1, à traiter là-bas)

---

## 5. Phase 4 — Composants UI (8 erreurs, 4 fichiers, 15 min)

### 5.1 `src/app/(dashboard)/history/page.tsx` (2 erreurs)

**Lignes 15 et 25** — `PaginatedQueryResult` et hook tRPC :
```typescript
// Problème : le type PaginatedQueryResult déclare error?: { message?: string } | null
// mais la valeur réelle peut être undefined (tRPC retourne | undefined)

// ✅ CORRECTION DANS LE TYPE PaginatedQueryResult (voir Phase 5/7)
// Rendre error: { message?: string } | null | undefined
// Rendre nextCursor?: string
```

→ Ces 2 erreurs sont des **problèmes de type dans le wrapper PaginatedQueryResult**.
La correction est centralisée dans le type (voir 5.3 et Phase 5).

---

### 5.2 `src/app/(dashboard)/library/page.tsx` (3 erreurs)

**Lignes 16, 34, 63** :

**Lignes 16 et 34** — Même problème de `PaginatedQueryResult` que 5.1 :
```typescript
// ✅ CORRECTION : voir le type PaginatedQueryResult
```

**Ligne 63** — `scenario is of type 'unknown'` :
```typescript
// ❌ AVANT
<ScenarioCard scenario={scenario as any} />

// ✅ APRÈS — Typer correctement (ou vérifier que scenario n'est pas unknown)
// Si scenario vient de items[i], ajouter un guard :
if (scenario) {
  <ScenarioCard scenario={scenario} />
}
```

---

### 5.3 Type `PaginatedQueryResult` — Correction centralisée

**Fichier : `src/hooks/usePaginatedQuery.ts`** (ou le fichier où le type est défini) :
```typescript
// ❌ AVANT
interface PaginatedQueryResult<T> {
  data?: PaginatedResult<T>;
  isLoading: boolean;
  isFetching?: boolean;
  isError: boolean;
  error?: { message?: string } | null;  // ← null mais pas undefined
  refetch: (opts?: Record<string, unknown>) => void;
}

// ✅ APRÈS
interface PaginatedQueryResult<T> {
  data?: PaginatedResult<T>;
  isLoading: boolean;
  isFetching?: boolean;
  isError: boolean;
  error?: { message?: string } | null | undefined;  // ← ajouter undefined
  refetch: (opts?: Record<string, unknown>) => void;
}
```

**Type `PaginatedResult`** (même fichier) :
```typescript
// ❌ AVANT
interface PaginatedResult<T> {
  items: T[];
  nextCursor: string;  // ← requis, mais tRPC retourne string | undefined
}

// ✅ APRÈS
interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;  // ← optionnel
}
```

---

### 5.4 `src/app/(dashboard)/leaderboard/LeaderboardPageClient.tsx` (1 erreur)

**Ligne 113** — `extra: string | undefined` non assignable à `string` :
```typescript
// ❌ AVANT
const entries: LeaderboardEntry[] = items.map(item => ({
  rank: item.rank,
  id: item.id,
  name: item.name,
  image: item.image,
  value: item.value,
  extra: item.extra,        // string | undefined
}));

// ✅ APRÈS — Rendre extra optionnel dans LeaderboardEntry
interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  image: string;
  value: number;
  extra?: string;  // ← optionnel
  // ou ne pas inclure extra si undefined
}
```

---

### 5.5 `src/app/call/[callId]/page.tsx` (3 erreurs)

**Ligne 35** — `ReplayHeaderProps` :
```typescript
// ❌ AVANT
<ReplayHeader
  scenarioTitle={scenarioTitle ?? undefined} // undefined explicite
  characterName={characterName ?? undefined}
  durationSeconds={durationSeconds}
  status={status}
/>

// ✅ APRÈS — Option 1 : omettre les props undefined
<ReplayHeader
  {...(scenarioTitle ? { scenarioTitle } : {})}
  {...(characterName ? { characterName } : {})}
  durationSeconds={durationSeconds}
  status={status}
/>

// ✅ APRÈS — Option 2 : rendre les props optionnelles dans l'interface
interface ReplayHeaderProps {
  scenarioTitle?: string;
  characterName?: string;
  durationSeconds?: number;
  status?: string;
}
```

**Ligne 46** — `AudioPlayerProps` :
```typescript
// ✅ APRÈS — Rendre title optionnel
interface AudioPlayerProps {
  recordingUrl: string | null;
  title?: string;  // ← optionnel au lieu de string
}
```

**Ligne 51** — `TranscriptViewProps` :
```typescript
// ✅ APRÈS — Rendre scenarioName optionnel
interface TranscriptViewProps {
  transcript: TranscriptLine[] | null;
  isLoading: boolean;
  scenarioName?: string;  // ← optionnel au lieu de string
}
```

---

## 6. Phase 5 — Services/routers (11 erreurs, 9 fichiers, 20 min)

### 6.1 Pattern général : correction des paramètres optionnels

**Problème récurrent** : Des fonctions/services reçoivent `{ title: string | undefined }` mais attendent `{ title: string }`.

**Solution générale** — 2 approches au choix selon le contexte :

```typescript
// APPROCHE A — Filtrer undefined avant l'appel (recommandé pour les appels uniques)
const params = {
  callId,
  userId,
  startTime,
  endTime,
  ...(title ? { title } : {}),  // title n'est PAS inclus si undefined
};
createClip(params);

// APPROCHE B — Rendre le paramètre optionnel dans le type (recommandé si c'est toujours optionnel)
interface CreateClipParams {
  callId: string;
  userId: string;
  startTime: number;
  endTime: number;
  title?: string;  // ← changer de string à string?
}
```

---

### 6.2 Détail fichier par fichier

#### `src/server/routers/clips.ts` (1 erreur — ligne 88)
```typescript
// ✅ APPROCHE B — Rendre title optionnel
const clip = clipRepository.create({
  callId: params.callId,
  userId: params.userId,
  title: params.title,     // params.title devient string | undefined
  startTime: params.startTime,
  endTime: params.endTime,
});
// → Changer le type CreateClipParams.title en optionnel
```

#### `src/server/routers/social.ts` (1 erreur — ligne 139)
```typescript
// MÊME PATTERN que clips.ts — créerClip attend title?: string
```

#### `src/server/routers/v1/clips.ts` (1 erreur — ligne 97)
```typescript
// MÊME PATTERN
```

#### `src/server/routers/v1/social.ts` (1 erreur — ligne 148)
```typescript
// MÊME PATTERN
```

#### `src/server/services/social/clips.ts` (1 erreur — ligne 44)
```typescript
// ✅ APPROCHE B — Rendre title optionnel dans le type du paramètre
// Changer le type de params.title en title?: string
```

---

#### `src/server/routers/scenarios.ts` (2 erreurs — lignes 206, 301)
```typescript
// ❌ AVANT
getCachedTrendingFeed({ limit: input.limit, cursor: input.cursor });
// cursor: string | undefined

// ✅ APPROCHE A — Filtrer cursor
getCachedTrendingFeed({
  limit: input.limit,
  ...(input.cursor ? { cursor: input.cursor } : {}),
});

// ✅ APPROCHE B — Rendre cursor optionnel dans FeedCacheParams
interface FeedCacheParams {
  limit: number;
  cursor?: string;  // ← optionnel
}
```

---

#### `src/server/routers/characters.ts` (2 erreurs — lignes 22, 42)
```typescript
// ❌ AVANT
const cacheParams = { category: input?.category };
// category: "ROMANTIC" | ... | undefined

// ✅ APPROCHE A — Filtrer category
const cacheParams = {
  ...(input?.category ? { category: input.category } : {}),
};
```

#### `src/server/routers/v1/characters.ts` (2 erreurs — lignes 31, 51)
```typescript
// MÊME PATTERN que characters.ts
```

---

#### `src/server/trpc.ts` (1 erreur — ligne 188)
```typescript
// ❌ AVANT
runWithContext(
  { requestId, userId, source: "tRPC" },
  // userId: string | undefined → RequestContext attend userId: string
);

// ✅ APRÈS — Rendre userId optionnel dans RequestContext
interface RequestContext {
  requestId: string;
  userId?: string;  // ← optionnel
  source: string;
}
```

---

## 7. Phase 6 — Prisma (4 erreurs, 3 fichiers, 10 min) ⚠️ RISQUÉ

### ⚠️ Rappel critique : `undefined` vs `null` dans Prisma

| Valeur | Comportement Prisma |
|--------|---------------------|
| `undefined` | **IGNORE** le champ — pas de modification en DB |
| `null` | **ÉCRIT NULL** dans la DB — efface la valeur |
| `champOptionnel?: { connect: { id } }` | Passe l'objet de relation |
| `champOptionnel: undefined` | ❌ Erreur avec exactOptionalPropertyTypes |
| `champOptionnel: null` | ⚠️ Peut ne pas être accepté par Prisma selon le type |

**Règle d'or** : `undefined` = "ne pas toucher ce champ" ≠ "mettre à null"
Pour les relations Prisma (`connect`), `undefined` signifie "ne pas créer la relation".
NE PAS remplacer `undefined` par `null` pour les relations — Prisma n'accepte pas `null` pour `connect`.

---

### 7.1 `src/server/repositories/callRepository.ts` (1 erreur — ligne 60)

```typescript
// ❌ AVANT
data: {
  user: { connect: { id: data.userId } },
  scenario: data.scenarioId ? { connect: { id: data.scenarioId } } : undefined,
  // ↑ undefined passé comme valeur de propriété → erreur avec exactOptionalPropertyTypes
  phoneNumber: data.phoneNumber,
  status: data.status as $Enums.CallStatus,
  costCredits: data.costCredits,
},

// ✅ APRÈS — Conditionner la PROPRIÉTÉ, pas sa valeur
data: {
  user: { connect: { id: data.userId } },
  ...(data.scenarioId ? { scenario: { connect: { id: data.scenarioId } } } : {}),
  // ↑ si scenarioId est undefined, la propriété scenario n'est PAS dans l'objet
  phoneNumber: data.phoneNumber,
  status: data.status as $Enums.CallStatus,
  costCredits: data.costCredits,
},
```

---

### 7.2 `src/server/routers/admin.ts` (1 erreur — ligne 409)

```typescript
// ❌ AVANT
data: {
  phoneNumber: input.phoneNumber,
  reason: input.reason,        // string | undefined
  blockedById: ctx.session.user.id,
},

// ✅ APRÈS
data: {
  phoneNumber: input.phoneNumber,
  ...(input.reason ? { reason: input.reason } : {}),
  // ↑ si reason est undefined, la prop est absente → Prisma ne touche pas le champ
  blockedById: ctx.session.user.id,
},
```

---

### 7.3 `src/server/routers/v1/admin.ts` (1 erreur — ligne 416)

```typescript
// ✅ MÊME PATTERN que admin.ts
data: {
  phoneNumber: input.phoneNumber,
  ...(input.reason ? { reason: input.reason } : {}),
  blockedById: ctx.session.user.id,
},
```

---

## 8. Phase 7 — tRPC provider (2 erreurs, 1 fichier, 5 min)

### 8.1 `src/lib/trpc-provider.tsx` (2 erreurs — ligne 35)

```typescript
// ❌ AVANT
fetch(url, options) {
  return fetch(url, { ...options, credentials: "include" });
  // options.signal: AbortSignal | undefined non assignable à AbortSignal | null
  // La librairie standard TypeScript pour fetch() attend signal?: AbortSignal | null
  // mais l'implémentation de next utilise une union qui n'accepte pas undefined
},

// ✅ APRÈS — Cast spécifique pour ce cas
fetch(url, options) {
  return fetch(url, { ...options, credentials: "include" } as RequestInit);
},
```

Note : ce `as RequestInit` est un **cas particulier** où le type de `options` vient de la surcharge tRPC et n'est pas parfaitement aligné avec le type natif `fetch`. Le cast est acceptable car `credentials: "include"` ne modifie pas `signal`.

---

## 9. Phase 8 — OG Image route (1 erreur, 1 fichier, 5 min)

### 9.1 `src/app/api/og/route.tsx` (1 erreur — ligne 102)

```typescript
// ❌ AVANT
const imageResponse = new ImageResponse(
  <OGImage {...props} />,
  {
    width: 1200,
    height: 630,
    fonts: fonts.length > 0 ? fonts : undefined,  // ← undefined explicite
  }
);

// ✅ APRÈS — Omettre fonts quand pas de polices
const imageResponse = new ImageResponse(
  <OGImage {...props} />,
  {
    width: 1200,
    height: 630,
    ...(fonts.length > 0 ? { fonts } : {}),
  }
);
```

---

## 10. Vérification finale

Après toutes les corrections, exécuter :

```bash
# 1. Activer l'option dans le tsconfig
# Ajouter "exactOptionalPropertyTypes": true dans echoroom-web/tsconfig.json

# 2. Vérifier qu'il n'y a plus d'erreurs
cd echoroom-web
npx tsc --noEmit

# 3. Lancer les tests
pnpm test

# 4. Vérifier les autres projets (non impactés mais vérifier quand même)
cd ../echoroom-mobile && npx tsc --noEmit
cd ../echoroom-desktop-electron && npx tsc --noEmit
```

---

## 11. Tableau récapitulatif complet

| # | Fichier | Ligne(s) | Erreur | Correction | Risque |
|---|---------|:--------:|:-------|:-----------|:------:|
| 1 | `playwright.config.ts` | 3 | `workers: undefined` | Omettre `workers` si undefined | 🟢 Aucun |
| 2 | `prisma/rollback.ts` | 58 | `string \| undefined` → `string` | Changer le type de la variable | 🟢 Aucun |
| 3 | `history/page.tsx` | 15, 25 | `nextCursor` / `error` type mismatch | Corriger `PaginatedQueryResult` | 🟢 Aucun |
| 4 | `LeaderboardPageClient.tsx` | 113 | `extra: string \| undefined` | Rendre `extra` optionnel | 🟢 Aucun |
| 5 | `library/page.tsx` | 16, 34, 63 | `nextCursor` / `scenario` unknown | Corriger type + guard scenario | 🟢 Aucun |
| 6 | `call/[callId]/page.tsx` | 35, 46, 51 | props undefined explicites | Rendre props optionnelles ou filtrer | 🟢 Aucun |
| 7 | `lib/logger.ts` | 70 | `meta` undefined | Rendre `meta?` optionnel | 🟢 Aucun |
| 8 | `metrics.ts` | 32, 55 | `userId: string \| undefined` | Filtrer ou rendre optionnel | 🟢 Aucun |
| 9 | `trpc-provider.tsx` | 35 | `signal: AbortSignal \| undefined` | `as RequestInit` | 🟢 Aucun |
| 10 | `clips.ts` (router) | 88 | `title: string \| undefined` | Rendre `title?` optionnel | 🟢 Faible |
| 11 | `social.ts` (router) | 139 | `title: string \| undefined` | Rendre `title?` optionnel | 🟢 Faible |
| 12 | `v1/clips.ts` | 97 | `title: string \| undefined` | Rendre `title?` optionnel | 🟢 Faible |
| 13 | `v1/social.ts` | 148 | `title: string \| undefined` | Rendre `title?` optionnel | 🟢 Faible |
| 14 | `scenarios.ts` | 206, 301 | `cursor: string \| undefined` | Filtrer ou rendre optionnel | 🟢 Faible |
| 15 | `characters.ts` | 22, 42 | `category: ... \| undefined` | Filtrer | 🟢 Faible |
| 16 | `v1/characters.ts` | 31, 51 | `category: ... \| undefined` | Filtrer | 🟢 Faible |
| 17 | `services/social/clips.ts` | 44 | `title: string \| undefined` | Rendre `title?` optionnel | 🟢 Faible |
| 18 | `server/trpc.ts` | 188 | `userId: string \| undefined` | Rendre `userId?` optionnel | 🟢 Faible |
| 19 | `og/route.tsx` | 102 | `fonts: undefined` | Omettre si pas de polices | 🟢 Aucun |
| 20 | `callRepository.ts` | 60 | `scenario: undefined` | Conditionner la prop **⚠️** | 🟠 **Moyen** |
| 21 | `admin.ts` | 409 | `reason: undefined` | Conditionner la prop **⚠️** | 🟠 **Moyen** |
| 22 | `v1/admin.ts` | 416 | `reason: undefined` | Conditionner la prop **⚠️** | 🟠 **Moyen** |
| 23 | `ShareButtons.test.tsx` | 82, 191 | `description: undefined` | Omettre la prop | 🟢 Aucun |
| 24 | `usePaginatedQuery.test.ts` | 90, 150, 352 | `nextCursor: undefined` | Omettre la prop | 🟢 Aucun |

### Légende des risques

| Risque | Signification |
|:------:|:--------------|
| 🟢 Aucun | Changement de type uniquement, aucun impact runtime |
| 🟢 Faible | Changement qui peut affecter le comportement si la logique est mal comprise |
| 🟠 Moyen | Changement qui affecte les écritures DB — **IMPOSSIBLE À TESTER AUTOMATIQUEMENT** |

---

## 12. Script de vérification automatisée

```powershell
# Script de vérification post-correction complet
# À exécuter depuis la racine du monorepo

$ErrorActionPreference = "Stop"

Write-Host "=== 1. Vérification de la compilation web ===" -ForegroundColor Cyan
Set-Location echoroom-web
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw "Erreur de compilation web" }
Write-Host "WEB OK" -ForegroundColor Green

Write-Host "=== 2. Vérification de la compilation desktop ===" -ForegroundColor Cyan
Set-Location ../echoroom-desktop-electron
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw "Erreur de compilation desktop" }
Write-Host "DESKTOP OK" -ForegroundColor Green

Write-Host "=== 3. Vérification de la compilation mobile ===" -ForegroundColor Cyan
Set-Location ../echoroom-mobile
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw "Erreur de compilation mobile" }
Write-Host "MOBILE OK" -ForegroundColor Green

Write-Host "=== 4. Exécution des tests web ===" -ForegroundColor Cyan
Set-Location ../echoroom-web
pnpm test 2>&1
if ($LASTEXITCODE -ne 0) { throw "Tests échoués" }
Write-Host "TESTS OK" -ForegroundColor Green

Write-Host "=== 5. Vérification des 0 nouvelles erreurs ===" -ForegroundColor Cyan
npx tsc --noEmit --exactOptionalPropertyTypes 2>&1
if ($LASTEXITCODE -eq 0) { 
  Write-Host "✅ SUCCÈS — exactOptionalPropertyTypes activé, 0 erreur" -ForegroundColor Green
} else {
  $errors = npx tsc --noEmit --exactOptionalPropertyTypes 2>&1 | Measure-Object -Line
  Write-Host "❌ ÉCHEC — $($errors.Lines) erreurs restantes" -ForegroundColor Red
  npx tsc --noEmit --exactOptionalPropertyTypes 2>&1 | Select-String "error TS" | ForEach-Object { Write-Host $_ -ForegroundColor Red }
}

Set-Location ..
```

---

## 13. Rollback plan

Si une correction Prisma (Phase 6) cause un problème en production :

```bash
# 1. Désactiver l'option immédiatement
git revert <commit-hash> --no-commit
git commit -m "hotfix: desactiver exactOptionalPropertyTypes (regression DB)"

# 2. Déployer le rollback
git push

# 3. Analyser la cause
# Les 3 fichiers Prisma sont sensibles :
# - callRepository.ts: scenario connect/undefined
# - admin.ts + v1/admin.ts: reason undefined/null

# 4. Réappliquer avec précaution en testant chaque correction Prisma individuellement
```
