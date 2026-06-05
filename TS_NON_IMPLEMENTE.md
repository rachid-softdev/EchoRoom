# ❌ Analyse détaillée — Ce qui n'a PAS été implémenté

> Document autonome expliquant pourquoi 2 items du plan TypeScript n'ont **pas** été activés, avec analyse technique complète, cas par cas, et pistes de résolution futures.

---

## 1. `exactOptionalPropertyTypes: true`

### 1.1 Résumé

| Propriété | Valeur |
|-----------|--------|
| **Option** | `exactOptionalPropertyTypes: true` |
| **Impact** | 🔴 **37 erreurs de compilation** (echoroom-web uniquement) |
| **Projets** | Web uniquement testé (le plus complexe) |
| **Bénéfice** | 🔵 Modéré — distingue `prop?: string` (absente) de `prop: string \| undefined` (présente mais undefined) |
| **Coût** | Refactoring dans ~25 fichiers, impacts sur Prisma, tRPC, composants React |

### 1.2 Ce que fait cette option

Sans `exactOptionalPropertyTypes` :
```typescript
interface Config { name?: string; }
const c: Config = { name: undefined }; // ✅ OK — undefined est assignable à une prop optionnelle
```

Avec `exactOptionalPropertyTypes` :
```typescript
interface Config { name?: string; }
const c: Config = { name: undefined }; // ❌ Erreur — name est optionnel, pas "string | undefined"
// Une prop optionnelle signifie "peut être absente", pas "peut être undefined"
```

Le comportement correct attendu :
```typescript
const c1: Config = {};            // ✅ OK — name absent
const c2: Config = { name: "" };  // ✅ OK — name présent avec une string
const c3: Config = { name: undefined }; // ❌ Erreur
```

### 1.3 Analyse des 37 erreurs (par catégorie)

#### 🔴 1.3.1 `undefined` passé à une prop optionnelle de composant React (8 erreurs)

**Fichiers impactés** : `history/page.tsx`, `library/page.tsx`, `call/[callId]/page.tsx`, `leaderboard/page.tsx`

**Erreur type** :
```
src/app/call/[callId]/page.tsx(35,10):
Type '{ scenarioTitle: string | undefined; characterName: string | undefined; ... }'
is not assignable to type 'ReplayHeaderProps' with 'exactOptionalPropertyTypes: true'.
  Types of property 'scenarioTitle' are incompatible.
    Type 'string | undefined' is not assignable to type 'string'.
```

**Cause** : Un composant React attend `scenarioTitle: string` (non optionnel), mais le parent lui passe une valeur potentiellement `undefined` (parce que la donnée vient d'une API/DB qui peut être null). Avec `exactOptionalPropertyTypes`, le type `string | undefined` n'est plus assignable à `string` même si la prop était déclarée comme optionnelle dans le type d'origine.

**Correction possible** :
```typescript
// Avant
<ReplayHeader
  scenarioTitle={call.scenarioTitle ?? undefined} // ❌ undefined explicite
/>

// Après — 3 options :
// 1. Rendre la prop vraiment optionnelle dans l'interface
interface ReplayHeaderProps { scenarioTitle?: string; }

// 2. Fournir une valeur par défaut au lieu de undefined
<ReplayHeader scenarioTitle={call.scenarioTitle ?? "Inconnu"} />

// 3. Utiliser null au lieu de undefined (si l'interface l'accepte)
<ReplayHeader scenarioTitle={call.scenarioTitle ?? null} />
```

---

#### 🔴 1.3.2 `T | undefined` passé à un paramètre de type `T` (non optionnel) (7 erreurs)

**Fichiers impactés** : `routers/clips.ts`, `routers/scenarios.ts`, `routers/social.ts`, `routers/v1/clips.ts`, `routers/v1/social.ts`, `services/social/clips.ts`

**Erreur type** :
```
src/server/routers/clips.ts(88,33):
Argument of type '{ ..., title: string | undefined; }' is not assignable to
parameter of type 'CreateClipParams' with 'exactOptionalPropertyTypes: true'.
  Types of property 'title' are incompatible.
    Type 'string | undefined' is not assignable to type 'string'.
```

**Cause** : Une fonction attend `title: string` (requis), mais on lui passe `title: string | undefined` parce que la source de données (tRPC input, paramètre optionnel) peut ne pas fournir de valeur.

**Correction possible** :
```typescript
// Avant : { callId, userId, title, startTime, endTime }
// title vient d'un input tRPC optionnel → string | undefined

// Après — 2 options :
// 1. Filtrer undefined avant d'appeler
const params = { callId, userId, startTime, endTime, ...(title && { title }) };
createClip(params); // title n'est pas passé si undefined → prop absente ✅

// 2. Modifier le type CreateClipParams pour rendre title vraiment optionnel
interface CreateClipParams { callId: string; userId: string; title?: string; ... }
```

---

#### 🔴 1.3.3 Prisma — champ `T | undefined` non assignable à `T | null` (4 erreurs)

**Fichiers impactés** : `routers/admin.ts`, `routers/v1/admin.ts`, `repositories/callRepository.ts`

**Erreur type** :
```
src/server/routers/admin.ts(409,9):
Type '{ phoneNumber: string; reason: string | undefined; blockedById: string; }'
is not assignable to type 'BlockedNumberUncheckedCreateInput' with
'exactOptionalPropertyTypes: true'.
  Types of property 'reason' are incompatible.
    Type 'string | undefined' is not assignable to type 'string | null'.
      Type 'undefined' is not assignable to type 'string | null'.
```

**Cause** : Prisma génère des types où les champs optionnels de la DB sont `string | null` (pas `string | undefined` ni `string?`). Avec `exactOptionalPropertyTypes`, `undefined` n'est plus converti silencieusement en `null`.

**Correction possible** :
```typescript
// Avant
const data = { phoneNumber, reason, blockedById };
// reason peut être undefined

// Après
const data = { phoneNumber, reason: reason ?? null, blockedById };
// undefined → null explicitement ✅
```

---

#### 🔴 1.3.4 tRPC — `nextCursor: string | undefined` (5 erreurs)

**Fichiers impactés** : `history/page.tsx`, `library/page.tsx`, `hooks/usePaginatedQuery.ts`

**Erreur type** :
```
src/app/(dashboard)/history/page.tsx(15,15):
The types of 'data.nextCursor' are incompatible between these types.
  Type 'string | undefined' is not assignable to type 'string'.
```

**Cause** : Les hooks tRPC paginés retournent `nextCursor: string | undefined` mais le wrapper `PaginatedQueryResult` le déclare comme `string` requis. C'est un **désalignement de types** entre le contrat tRPC et le type local.

**Correction possible** :
```typescript
// Dans le type local PaginatedQueryResult :
interface PaginatedQueryResult<T> {
  items: T[];
  nextCursor?: string; // ← rendre optionnel au lieu de requis
  // ou : nextCursor: string | undefined; // ← accepter explicitement undefined
}
```

---

#### 🔴 1.3.5 `Record<string, unknown>` avec props optionnelles (3 erreurs)

**Fichiers impactés** : `server/lib/logger.ts`, `server/middleware/metrics.ts`

**Erreur type** :
```
src/server/lib/logger.ts(70,9):
Type '{ ..., meta: Record<string, unknown> | undefined; }'
is not assignable to type 'LogEntry' with 'exactOptionalPropertyTypes: true'.
  Types of property 'meta' are incompatible.
    Type 'Record<string, unknown> | undefined' is not assignable to type 'Record<string, unknown>'.
```

**Cause** : La propriété `meta` est déclarée comme `Record<string, unknown>` (requis) mais reçoit `Record<string, unknown> | undefined`.

**Correction** :
```typescript
// Avant
interface LogEntry { meta: Record<string, unknown>; }
const entry: LogEntry = { meta: undefined }; // ❌

// Après
interface LogEntry { meta?: Record<string, unknown>; }
// ou
interface LogEntry { meta: Record<string, unknown> | undefined; }
```

---

#### 🔴 1.3.6 Tests — `undefined` passé explicitement (6 erreurs)

**Fichiers impactés** : `ShareButtons.test.tsx`, `usePaginatedQuery.test.ts`

**Erreur type** :
```
src/components/social/__tests__/ShareButtons.test.tsx(82,13):
Type '{ description: undefined; scenarioId: string; title: string; }'
is not assignable to type 'ShareButtonsProps' with 'exactOptionalPropertyTypes: true'.
  Types of property 'description' are incompatible.
    Type 'undefined' is not assignable to type 'string'.
```

**Cause** : Les tests passent `{ description: undefined }` parce que la prop est optionnelle. Avec `exactOptionalPropertyTypes`, `undefined` explicite n'est pas autorisé.

**Correction** :
```typescript
// Avant
render(<ShareButtons description={undefined} scenarioId="..." title="..." />);

// Après — 2 options :
// 1. Omettre la prop
render(<ShareButtons scenarioId="..." title="..." />);

// 2. Utiliser une string vide
render(<ShareButtons description="" scenarioId="..." title="..." />);
```

---

### 1.4 Arbre de décision — Correction ou pas ?

```
exactOptionalPropertyTypes: true
├── Bénéfice : empêche d'assigner undefined à une prop optionnelle
│   → Évite des bugs subtils (obj.config = { timeout: undefined } au lieu d'omettre timeout)
│   → Sécurité : faible à modérée
│
├── Coût actuel : 37 erreurs, ~25 fichiers à modifier
│   → Prisma : 4 fichiers (cast null explicite)
│   → tRPC : 5 fichiers (types désalignés)
│   → Composants React : 8 fichiers (rendre props optionnelles ou filtrer)
│   → Tests : 6 fichiers (omettre les props)
│   → Services : 7 fichiers (filtrer undefined avant appel)
│   → UI/logger : 3 fichiers (corriger les interfaces)
│
├── Risque : les corrections Prisma (null vs undefined) sont délicates
│   → undefined = "pas de valeur" (propriété absente) → Prisma IGNORE le champ
│   → null = "valeur explicitement nulle" → Prisma ÉCRIT NULL en DB
│   → Confondre les deux peut corrompre des données
│
└── Verdict : NE PAS ACTIVER maintenant
    → Trop de risques de régression sur les écritures Prisma
    → Bénéfice marginal pour une codebase React/Next.js
    → Réévaluer dans 6 mois quand le codebase sera plus stable
```

### 1.5 Procédure si on décide d'activer plus tard

```bash
# 1. Activer l'option temporairement
cd echoroom-web
# Ajouter "exactOptionalPropertyTypes": true dans tsconfig.json

# 2. Compter les erreurs
npx tsc --noEmit 2>&1 | Measure-Object -Line

# 3. Corriger par catégorie (dans l'ordre) :
# a) Tests — les plus simples, omettre les props
# b) Prisma — remplacer ?? par ?? null
# c) tRPC — aligner les types PaginatedQueryResult
# d) Composants — rendre les props optionnelles
# e) Services — filtrer undefined avant appel

# 4. Vérifier qu'aucun test ne casse (surtout Prisma)
pnpm test

# 5. Vérifier la compilation
pnpm typecheck
```

---

## 2. Intégrer mobile dans le tsconfig partagé

### 2.1 Résumé

| Propriété | Valeur |
|-----------|--------|
| **Problème** | `echoroom-mobile/tsconfig.json` ne peut PAS étendre la base partagée |
| **Cause** | Il étend déjà `"expo/tsconfig.base"` — TypeScript n'autorise qu'UN SEUL `extends` |
| **Solution 1** | Copier les options communes manuellement (solution actuelle) |
| **Solution 2** | Créer une chaîne d'extension : `expo/tsconfig.base` → `tsconfig/expo-override.json` → mobile |
| **Solution 3** | Intégrer les options Expo dans la base partagée et ne plus étendre Expo |

### 2.2 Analyse technique

**Contrainte TypeScript** : Le champ `extends` dans tsconfig.json accepte **exactement une** chaîne de caractères. Pas de tableau, pas de multiple inheritance.

```
Actuel :
  expo/tsconfig.base ──────────────→ echoroom-mobile/tsconfig.json
                                       ├── strict: true (surcouche)
                                       ├── moduleResolution: bundler
                                       └── verbatimModuleSyntax: true

Souhaité (impossible) :
  tsconfig/base.json ──────┐
                           ├─→ echoroom-mobile/tsconfig.json  ❌ Deux extends
  expo/tsconfig.base ──────┘

Possible :
  tsconfig/base.json ──────→ echoroom-web/tsconfig.json      ✅ OK
                          ──→ echoroom-desktop-electron/tsconfig.json  ✅ OK

  expo/tsconfig.base ──────→ echoroom-mobile/tsconfig.json   ✅ Seul extends possible
```

### 2.3 Comparaison des options héritées vs partagées

| Option | Base partagée | Expo base | Mobile (surcouche) |
|--------|:-------------:|:---------:|:------------------:|
| `strict` | ✅ | ❌ | ✅ |
| `esModuleInterop` | ✅ | ✅ | — |
| `resolveJsonModule` | ✅ | ✅ | — |
| `skipLibCheck` | ✅ | ✅ | — |
| `forceConsistentCasingInFileNames` | ✅ | ❌ | ✅ |
| `isolatedModules` | ✅ | ❌ | — |
| `noFallthroughCasesInSwitch` | ✅ | ❌ | ✅ |
| `noImplicitReturns` | ✅ | ❌ | ✅ |
| `noImplicitOverride` | ✅ | ❌ | ✅ |
| `noPropertyAccessFromIndexSignature` | ✅ | ❌ | ✅ |
| `noUncheckedIndexedAccess` | ✅ | ❌ | ✅ |
| `useUnknownInCatchVariables` | ✅ | ❌ | ✅ |
| `noUnusedLocals` | ✅ | ❌ | ✅ |
| `noUnusedParameters` | ✅ | ❌ | ✅ |
| `verbatimModuleSyntax` | ✅ | ❌ | ✅ |
| `allowJs` | ❌ | ✅ | — |
| `jsx: "react-native"` | ❌ | ✅ | — |
| `lib` | ❌ | `["DOM","ESNext"]` | — |
| `moduleResolution` | ❌ | `"node"` | ✅ **overridé** `"bundler"` |
| `noEmit` | ❌ | ✅ | — |
| `target` | ❌ | `"ESNext"` | — |

**Légende** : ✅ présent | ❌ absent | — hérité tel quel

### 2.4 Solutions possibles

#### 🟢 Solution 1 : Statu quo (actuelle) — ✅ Recommandée

Copier manuellement les options communes dans le tsconfig mobile. C'est ce qui est fait actuellement — 10 options de la base partagée sont dupliquées dans le mobile.

**Avantages** :
- Simple, aucun risque
- Mobile reste isolé des changements de la base partagée
- Expo peut mettre à jour sa base sans conflit

**Inconvénients** :
- Duplication (10 lignes)
- Si la base partagée ajoute une option, mobile ne l'hérite pas automatiquement

**Verdict** : **Solution pragmatique et recommandée** pour un projet Expo dans un monorepo.

---

#### 🟡 Solution 2 : Chaîne d'extension (intermédiaire)

Créer un fichier `tsconfig/expo-base.json` qui étend la base partagée et ajoute les options Expo, puis le mobile étend ce fichier.

```
tsconfig/base.json ──────→ tsconfig/expo-base.json ──────→ echoroom-mobile/tsconfig.json
                              ├── jsx: "react-native"         ├── moduleResolution: bundler
                              ├── allowJs: true               ├── baseUrl: .
                              └── target: ESNext              └── paths: @/*
```

**Fichier `tsconfig/expo-base.json`** :
```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "allowJs": true,
    "jsx": "react-native",
    "lib": ["DOM", "ESNext"],
    "noEmit": true,
    "target": "ESNext",
    "exclude": ["node_modules", "babel.config.js", "metro.config.js", "jest.config.js"]
  }
}
```

**Fichier `echoroom-mobile/tsconfig.json`** :
```json
{
  "extends": "../tsconfig/expo-base.json",
  "compilerOptions": {
    "moduleResolution": "bundler",
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["**/*.ts", "**/*.tsx"]
}
```

**Avantages** :
- Plus de duplication : les options communes sont héritées de la base
- Si la base partagée évolue, mobile suit
- Expo n'est plus un facteur bloquant

**Inconvénients** :
- Si Expo met à jour `expo/tsconfig.base`, il faut refléter les changements manuellement dans `tsconfig/expo-base.json`
- Risque de désynchronisation avec Expo
- Nécessite une maintenance proactive

**Verdict** : **Envisageable** mais nécessite de surveiller les releases Expo pour maintenir la synchronisation.

---

#### 🔴 Solution 3 : Base totalement indépendante d'Expo (déconseillée)

Ne plus étendre `expo/tsconfig.base` du tout. Copier toutes les options Expo directement dans le tsconfig mobile.

```json
{
  "compilerOptions": {
    // De la base partagée :
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    // ... toutes les options de sécurité ...

    // D'Expo (copiées manuellement) :
    "allowJs": true,
    "jsx": "react-native",
    "lib": ["DOM", "ESNext"],
    "noEmit": true,
    "target": "ESNext",

    // Surcharges locales :
    "moduleResolution": "bundler",
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

**Avantages** :
- Contrôle total
- Pas de dépendance à la config Expo

**Inconvénients** :
- ⚠️ **Fragile** — si Expo modifie sa config de base (ex: nouveau lib, nouveau target), le projet peut cesser de fonctionner sans raison apparente
- ⚠️ **Risque de régression** — les options Expo ne sont pas documentées comme stables
- Beaucoup de duplication
- **Déconseillé** par l'équipe Expo

**Verdict** : ❌ **Déconseillé** — trop risqué.

### 2.5 Recommandation finale

```
Solution 1 (Statu quo)  ——— ⭐ RECOMMANDÉE
   ├── Simple, robuste
   ├── 10 lignes dupliquées (acceptable)
   └── Aucun risque de désynchronisation Expo

Solution 2 (Chaîne)     ——— 🔶 Acceptable si maintenance proactive
   ├── Plus élégant
   ├── Moins de duplication
   └── Nécessite veille Expo

Solution 3 (Indépen.)   ——— ❌ Déconseillé
   └── Trop risqué
```

### 2.6 Procédure pour implémenter la Solution 2

```bash
# 1. Créer le fichier de pont Expo
cat > tsconfig/expo-base.json << 'EOF'
{
  "extends": "./base.json",
  "compilerOptions": {
    "allowJs": true,
    "jsx": "react-native",
    "lib": ["DOM", "ESNext"],
    "noEmit": true,
    "target": "ESNext"
  },
  "exclude": ["node_modules", "babel.config.js", "metro.config.js", "jest.config.js"]
}
EOF

# 2. Modifier le tsconfig mobile
# Remplacer "extends": "expo/tsconfig.base" par "extends": "../tsconfig/expo-base.json"

# 3. Vérifier la compilation
cd echoroom-mobile && npx tsc --noEmit

# 4. Vérifier que l'app Expo fonctionne toujours
npx expo start --web
```

---

## 3. Tableau récapitulatif

| Item | Statut | Erreurs | Effort | Risque | Bénéfice | Recommandation |
|------|:------:|:-------:|:------:|:-----:|:--------:|:--------------:|
| `exactOptionalPropertyTypes` | ❌ Reporté | **37** | 2-3 jours | 🟠 Élevé (Prisma null vs undefined) | 🔵 Faible | Attendre 6 mois |
| Mobile → base partagée | ⚠️ Statu quo | 0 | 1 heure | 🟢 Faible | 🟢 Faible | Solution 1 (statu quo) pour l'instant |

### Prochaine évaluation recommandée

- **Dans 3 mois** : Réévaluer `exactOptionalPropertyTypes` — le codebase aura évolué et les types Prisma/tRPC seront peut-être mieux alignés
- **Prochaine release Expo (53+)** : Vérifier si l'équipe Expo publie un tsconfig.base mis à jour avec `strict` inclus (ce qui résoudrait le problème de duplication)
