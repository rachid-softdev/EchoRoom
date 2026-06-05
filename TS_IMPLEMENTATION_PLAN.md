# 🔧 Plan d'implémentation — Renforcement TypeScript EchoRoom

> **Date** : 2026-06-05  
> **TypeScript** : ^5.6.0  
> **Monorepo** : Turborepo (pnpm workspaces)  
> **Projets** : `echoroom-web` (Next.js 14), `echoroom-mobile` (Expo 52), `echoroom-desktop-electron` (Electron 33)

> **Round 1 (PR #24)** ✅ — `strict` socle + 7 options avancées, migration desktop ESM, ~280 corrections  
> **Round 2 (cette PR)** ✅ — `tsconfig/base.json` partagé, `target: ES2022`, `verbatimModuleSyntax`  
> **Restant** : `exactOptionalPropertyTypes` (30+ erreurs, trop disruptif), tsconfig partagé mobile (contrainte Expo)

---

## 1. État des lieux détaillé

### 1.1 Architecture des fichiers tsconfig

```
tsconfig/base.json                → Base partagée (créée Round 2)
echoroom-web/tsconfig.json        → extends "../tsconfig/base.json"
echoroom-mobile/tsconfig.json     → extends "expo/tsconfig.base" (trop spécifique)
echoroom-desktop-electron/tsconfig.json → extends "../tsconfig/base.json"
```

**✅ Tsconfig racine partagé créé** → les règles de sécurité sont uniformisées entre web et desktop.

### 1.2 Contenu actuel des fichiers

#### `echoroom-web/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{"name": "next"}],
    "paths": {"@/*": ["./src/*"]}
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

#### `echoroom-mobile/tsconfig.json`
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {"@/*": ["src/*"]}
  },
  "include": ["**/*.ts", "**/*.tsx"]
}
```

> **Base Expo héritée** (`expo/tsconfig.base.json`) :  
> `allowJs`, `esModuleInterop`, `jsx: "react-native"`, `lib: ["DOM","ESNext"]`,  
> `moduleResolution: "node"`, `noEmit`, `resolveJsonModule`, `skipLibCheck`, `target: "ESNext"`  
> → **Ne contient PAS `strict`** (ajouté manuellement dans la surcouche).

#### `echoroom-desktop-electron/tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 1.3 Analyse option par option

Légende : ✅ Activé | ❌ Non activé | ⏺️ Défaut (bon) | ⚠️ Problème potentiel

| Option | Web | Mobile | Desktop | Inclus dans `strict` | Recommandée |
|--------|:---:|:------:|:-------:|:--------------------:|:-----------:|
| `strict` | ✅ | ✅ | ✅ | — | ✅ **Obligatoire** |
| `noImplicitAny` | ✅ (hérité) | ✅ (hérité) | ✅ (hérité) | ✅ | ✅ |
| `strictNullChecks` | ✅ (hérité) | ✅ (hérité) | ✅ (hérité) | ✅ | ✅ |
| `strictFunctionTypes` | ✅ (hérité) | ✅ (hérité) | ✅ (hérité) | ✅ | ✅ |
| `strictBindCallApply` | ✅ (hérité) | ✅ (hérité) | ✅ (hérité) | ✅ | ✅ |
| `strictPropertyInitialization` | ✅ (hérité) | ✅ (hérité) | ✅ (hérité) | ✅ | ✅ |
| `noImplicitThis` | ✅ (hérité) | ✅ (hérité) | ✅ (hérité) | ✅ | ✅ |
| `alwaysStrict` | ✅ (hérité) | ✅ (hérité) | ✅ (hérité) | ✅ | ✅ |
| `useUnknownInCatchVariables` | ❌ | ❌ | ❌ | ❌ | ✅ **Haute** |
| `exactOptionalPropertyTypes` | ❌ | ❌ | ❌ | ❌ | 🔵 Faible |
| `noUncheckedIndexedAccess` | ❌ | ❌ | ❌ | ❌ | ✅ **Haute** |
| `noImplicitOverride` | ❌ | ❌ | ❌ | ❌ | ✅ **Haute** |
| `noPropertyAccessFromIndexSignature` | ❌ | ❌ | ❌ | ❌ | 🟠 Moyenne |
| `noFallthroughCasesInSwitch` | ❌ | ❌ | ❌ | ❌ | ✅ **Critique** |
| `noImplicitReturns` | ❌ | ❌ | ❌ | ❌ | ✅ **Haute** |
| `noUnusedLocals` | ✅ | ❌ | ❌ | ❌ | ✅ Standard |
| `noUnusedParameters` | ✅ | ❌ | ❌ | ❌ | ✅ Standard |
| `isolatedModules` | ✅ | ✅ (hérité) | ❌ | ❌ | ✅ **Nécessaire** |
| `verbatimModuleSyntax` | ❌ | ❌ | ❌ | ❌ | 🟠 Moyenne |
| `skipLibCheck` | ✅ | ✅ (hérité) | ✅ | ❌ | ⚠️ Pragmatique |
| `moduleDetection` | ⏺️ auto | ⏺️ auto | ⏺️ auto | ❌ | ⏺️ OK |
| `forceConsistentCasingInFileNames` | ❌ | ❌ (hérité) | ✅ | ❌ | ✅ Standard |

---

## 2. Analyse détaillée de chaque option

### 2.1 `strict: true` ✅ — Activé dans les 3 projets

**Ce qu'il active** (7 sous-options) :
| Sous-option | Rôle |
|-------------|------|
| `noImplicitAny` | Interdit les types `any` implicites |
| `strictNullChecks` | `null`/`undefined` non assignables à tous les types |
| `strictFunctionTypes` | Vérification contravariante des paramètres de fonction |
| `strictBindCallApply` | Vérification des arguments de `.bind`/`.call`/`.apply` |
| `strictPropertyInitialization` | Propriétés de classe doivent être initialisées |
| `noImplicitThis` | `this` doit être typable |
| `alwaysStrict` | Code analysé en mode strict ECMAScript |

**Risque si désactivé** : TypeScript devient un "JavaScript avec annotations". Les bugs null/undefined passent en production.

**Exemple de bug évité** :
```typescript
function processItems(items) {
  // ❌ Sans strict : items est `any` → tout compile, tout explose
  return items.filter(x => x.active);
}
// ✅ Avec strict : obligé de typer `items: {active: boolean}[]`
```

---

### 2.2 `noImplicitAny` ✅ — Activé via `strict`

**Bug évité** :
```typescript
// ❌ Sans noImplicitAny : compile, crash à runtime
function calculateTotal(price, tax) {
  return price + tax; // price et tax sont `any`
}

// ✅ Avec noImplicitAny : erreur → obligation de typer
function calculateTotal(price: number, tax: number): number {
  return price + tax;
}
```

---

### 2.3 `strictNullChecks` ✅ — Activé via `strict`

**Bug évité** :
```typescript
// ❌ Sans strictNullChecks : pas d'erreur
const user = getUser(); // peut retourner null
console.log(user.name); // TypeError: Cannot read properties of null

// ✅ Avec strictNullChecks : erreur → traitement obligatoire
if (user !== null) {
  console.log(user.name);
}
```

---

### 2.4 `strictFunctionTypes` ✅ — Activé via `strict`

**Bug évité** :
```typescript
type EventHandler = (e: Event) => void;

// ❌ Sans SFT : compile, mais crash si on passe autre chose qu'un MouseEvent
const handleClick: EventHandler = (e: MouseEvent) => {
  console.log(e.button);
};

// ✅ Avec SFT : détecte l'incompatibilité de variance
```

---

### 2.5 `strictBindCallApply` ✅ — Activé via `strict`

**Bug évité** :
```typescript
function greet(greeting: string) {}

// ❌ Sans strictBindCallApply : compile, exécute avec 42
greet.call(null, 42);

// ✅ Avec : Argument of type 'number' is not assignable to parameter of type 'string'
```

---

### 2.6 `strictPropertyInitialization` ✅ — Activé via `strict`

**Bug évité** :
```typescript
class User {
  name: string;  // ❌ Sans SPI : pas d'erreur, mais undefined à runtime
  constructor() {}  // Oubli de this.name = ...
}
// ✅ Avec SPI : Property 'name' has no initializer
```

---

### 2.7 `noImplicitThis` ✅ — Activé via `strict`

**Bug évité** :
```typescript
const obj = {
  name: "test",
  later() {
    setTimeout(function() {
      console.log(this.name); // ❌ this = window/global, pas obj
    }, 100);
  }
};
// ✅ Avec noImplicitThis : 'this' implicitly has type 'any'
```

---

### 2.8 `alwaysStrict` ✅ — Activé via `strict`

Émet `"use strict"` dans tous les fichiers. Empêche les assignations silencieuses à des variables globales, les doublons de paramètres, etc.

---

### 2.9 `useUnknownInCatchVariables` ❌ — NON activé (🔴 Critique)

**Ce que ça change** : Les variables `catch` passent de `any` à `unknown` — **obligation** de vérifier le type avant d'accéder aux propriétés.

**Bug évité** :
```typescript
// ❌ Sans : error est `any`, crash silencieux
try {
  await api.fetch();
} catch (error) {
  console.log(error.message); // Crash si error est une string
  reportError(error);         // Propage `any` dans toute la stack
}

// ✅ Avec : error est `unknown`, traitement sécurisé
try {
  await api.fetch();
} catch (error) {
  if (error instanceof Error) {
    console.log(error.message);
  } else if (typeof error === "string") {
    console.log(error);
  }
}
```

**Impact EchoRoom**: Architecture tRPC + Next.js → les erreurs sont levées via des mécanismes structurés. Le typage `unknown` assure que toutes les erreurs sont traitées correctement, notamment les erreurs réseau, les rejets de promesse, et les erreurs API.

---

### 2.10 `exactOptionalPropertyTypes` ❌ — NON activé (🔵 Faible priorité)

**Ce que ça change** : `prop?: string` ≠ `prop: string | undefined`. Empêche d'assigner `undefined` là où la propriété est simplement optionnelle.

**Bug évité** :
```typescript
interface Config {
  name?: string;
  timeout?: number;
}

// ❌ Sans : timeout est optionnel, mais on lui assigne undefined
const config: Config = { name: "test", timeout: undefined };
// Le sens est différent : "pas de timeout" vs "timeout explicitement undefined"

// ✅ Avec : erreur
// Type 'undefined' is not assignable to type 'number' in property 'timeout'
```

**Note** : Peut nécessiter un refactoring lourd. Priorité basse.

---

### 2.11 `noUncheckedIndexedAccess` ❌ — NON activé (🟠 Haute priorité)

**Ce que ça change** : L'accès par index `arr[i]` retourne `T | undefined` au lieu de `T`.

**Bug évité** :
```typescript
// ❌ Sans : compile, crash à runtime
const users: User[] = await fetchUsers();
console.log(users[5].name); // undefined si < 6 éléments

// ✅ Avec : users[5] est `User | undefined` → vérification obligatoire
const user = users[5];
if (user !== undefined) {
  console.log(user.name);
}
```

**Impact EchoRoom** : Accès fréquents à des tableaux d'utilisateurs, messages, conversations. Particulièrement critiques dans les composants React qui itèrent sur des listes.

---

### 2.12 `noImplicitOverride` ❌ — NON activé (🟠 Haute priorité)

**Ce que ça change** : Oblige le mot-clé `override` quand une méthode de sous-classe surcharge une méthode parente.

**Bug évité** :
```typescript
class BaseService {
  async process(data: any) { /* ... */ }
}

// ❌ Sans : si BaseService.process devient execute(), UserService.process()
// devient une méthode orpheline jamais appelée → bug silencieux
class UserService extends BaseService {
  async process(data: any) { /* ... */ }
}

// ✅ Avec : mot-clé obligatoire, changement détecté
class UserService extends BaseService {
  override async process(data: any) { /* ... */ }
}
```

---

### 2.13 `noPropertyAccessFromIndexSignature` ❌ — NON activé (🟠 Moyenne)

**Ce que ça change** : Interdit l'accès par point aux propriétés indexées (`obj.prop` → `obj["prop"]`).

**Bug évité** :
```typescript
interface Settings {
  [key: string]: string;
  theme: string;  // déclarée explicitement → accès par point OK
}

// ❌ Sans : fautes de frappe non détectées
const s: Settings = { theme: "dark" };
console.log(s.theme);  // OK
console.log(s.theem);  // Oups : undefined, pas d'erreur TS

// ✅ Avec : seules les props déclarées explicitement acceptent le point
s.theme;   // ✅ OK (propriété déclarée)
s["dark_mode_preference"];  // ✅ OK (accès indexé)
s.theem;   // ❌ Erreur
```

---

### 2.14 `noFallthroughCasesInSwitch` ❌ — NON activé (🔴 Critique)

**Ce que ça change** : Interdit le passage implicite d'un `case` au suivant sans `break`/`return`.

**Bug évité** :
```typescript
function getCategory(type: string): string {
  switch (type) {
    case "admin":
      return "Gestion";
    case "user":
      return "Utilisateur";  // ❌ Oubli de break → fallthrough vers "Modérateur"
    case "moderator":
      return "Modérateur";
    default:
      return "Inconnu";
  }
}
// getCategory("user") retourne "Modérateur" au lieu de "Utilisateur"
```

**Impact EchoRoom** : Particulièrement dangereux dans les reducers, les handlers d'événements, et les traitements de statuts (messages, utilisateurs, conversations).

---

### 2.15 `noImplicitReturns` ❌ — NON activé (🟠 Haute priorité)

**Ce que ça change** : Tous les chemins d'une fonction doivent retourner une valeur si le type de retour est non-`void`.

**Bug évité** :
```typescript
function getUserRole(id: string): "admin" | "user" | "guest" {
  if (id === "admin") return "admin";
  if (id.startsWith("user_")) return "user";
  // ❌ Sans : aucun return pour les autres cas → retourne undefined
  // Le type annonce "admin" | "user" | "guest" mais undefined est possible

  // ✅ Avec : erreur → il manque return "guest"
}
```

---

### 2.16 `noUnusedLocals` — Web ✅ | Mobile ❌ | Desktop ❌

**Ce que ça change** : Erreur si une variable locale n'est pas utilisée.

**Bug évité** :
```typescript
function processOrder(order: Order) {
  const discount = calculateDiscount(order); // ❌ Déclarée mais jamais utilisée
  const total = order.total;
  return formatPrice(total);
  // discount est soit un bug (devait être utilisé), soit du code mort
}
```

---

### 2.17 `noUnusedParameters` — Web ✅ | Mobile ❌ | Desktop ❌

**Ce que ça change** : Erreur si un paramètre de fonction n'est pas utilisé. Solution : préfixer avec `_`.

```typescript
// ❌ Sans : paramètre mort non détecté
function onClick(event: MouseEvent, item: Item) {
  console.log("Clicked!");  // item jamais utilisé
}

// ✅ Avec : erreur → soit supprimer, soit préfixer
function onClick(_event: MouseEvent, item: Item) {
  console.log(item.name);
}
// ou : function onClick(_event: MouseEvent) { ... }
```

---

### 2.18 `isolatedModules` — Web ✅ | Mobile ✅ (hérité) | Desktop ❌

**Ce que ça change** : Interdit les constructions TS qui nécessitent une analyse inter-module (`const enum`, `export =`).

**Pourquoi c'est important** : Next.js utilise SWC, Expo utilise Babel/Metro — ces transpileurs traitent chaque fichier isolément. Sans `isolatedModules`, le code peut compiler avec `tsc` mais pas avec le bundler.

**Impact Desktop** : Actuellement le desktop compile avec `tsc` pur, mais si un jour on passe à esbuild/SWC, les `const enum` et `export =` casseront.

---

### 2.19 `verbatimModuleSyntax` ❌ — NON activé (🔵 Amélioration)

**Ce que ça change** : Oblige à utiliser `import type` / `export type` de façon explicite.

**Bug évité** :
```typescript
// ❌ Sans : ambiguïté import/type
import { User, getUser } from "./user";
// User est-il un type ou une valeur ? Le compilateur le détermine, mais
// un bundler peut mal interpréter

// ✅ Avec : clair et explicite
import type { User } from "./user";
import { getUser } from "./user";
```

---

### 2.20 `skipLibCheck: true` ⚠️ — Activé (pragmatique)

**Ce que ça change** : Ignore la vérification de type des fichiers `.d.ts` (bibliothèques tierces).

**Risque si désactivé** : Temps de compilation x10+. Incompatibilités de types entre bibliothèques qui bloquent le build.

**Decision** : Pragmatique et nécessaire. Compenser par `typesync` en CI pour détecter les incohérences de versions.

---

### 2.21 `moduleDetection` ⏺️ — `"auto"` (défaut)

Détecte automatiquement si un fichier est un module (contient des import/export) ou un script. OK par défaut. `"force"` serait plus strict.

---

### 2.22 `forceConsistentCasingInFileNames` — Web ❌ | Mobile ❌ (hérité) | Desktop ✅

**Ce que ça change** : Vérifie la casse des imports de fichiers (évite les bugs "File `User.tsx` importé comme `user.tsx`" qui marchent sur Windows/Mac mais cassent sur Linux).

**Impact** : Obligatoire en CI/déploiement si le serveur est Linux (ce qui est le cas de Vercel pour Next.js).

---

## 3. Problèmes spécifiques par projet

### 3.1 `echoroom-web` (Next.js 14 + React 18 + tRPC)

| Problème | Détail | Gravité |
|----------|--------|:-------:|
| `target: "ES2017"` vs `lib: ["esnext"]` | Incohérence. Next.js/SWC gère la compilation, mais c'est confus. Devrait être aligné. | 🟠 |
| Pas de `noFallthroughCasesInSwitch` | Switch non protégés dans les reducers/handlers | 🔴 |
| Pas de `useUnknownInCatchVariables` | Erreurs tRPC/API non typées → propagation `any` | 🔴 |
| Pas de `noUncheckedIndexedAccess` | Accès tableaux d'utilisateurs/messages non sécurisés | 🟠 |
| Pas de `noImplicitOverride` | Classes de services Prisma non protégées | 🟠 |
| Pas de `noImplicitReturns` | Fonctions avec oubli de return | 🟠 |

### 3.2 `echoroom-mobile` (Expo 52 + React Native)

| Problème | Détail | Gravité |
|----------|--------|:-------:|
| `moduleResolution: "node"` (hérité) | Obsolète. Expo SDK 52 supporte `"bundler"` | 🟠 |
| Pas de `noUnusedLocals` / `noUnusedParameters` | Code mort non détecté | 🟠 |
| Base Expo sans `strict` (mais surchargé) | Heureusement overridé manuellement | ⚠️ |
| Mêmes options manquantes que le web | `noFallthrough`, `useUnknownInCatch`, etc. | 🔴🟠 |

### 3.3 `echoroom-desktop-electron` (Electron 33)

| Problème | Détail | Gravité |
|----------|--------|:-------:|
| `module: "commonjs"` | Obsolète. Devrait être `"node16"` pour ESM | 🟠 |
| Pas d'`isolatedModules` | Incompatible si migration vers esbuild | 🟠 |
| Pas de `noUnusedLocals` / `noUnusedParameters` | Code mort non détecté | 🟠 |
| Mêmes options manquantes que le web | `noFallthrough`, `useUnknownInCatch`, etc. | 🔴🟠 |

---

## 4. Solutions proposées

### 4.1 Fichiers tsconfig corrigés

#### `echoroom-web/tsconfig.json` (amélioré)
```jsonc
{
  "compilerOptions": {
    // === Niveau de langage ===
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "incremental": true,

    // === Émission ===
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,

    // === Interop & résolution ===
    "allowJs": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,

    // === Base strict (socle) ===
    "strict": true,

    // === Sûreté avancée ===
    "useUnknownInCatchVariables": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,

    // === Qualité de code ===
    "noUnusedLocals": true,
    "noUnusedParameters": true,

    // === Libs ===
    "skipLibCheck": true,

    // === Next.js ===
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

#### `echoroom-mobile/tsconfig.json` (amélioré)
```jsonc
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    // === Surcharge des options héritées ===
    "strict": true,

    // === Correction moduleResolution ===
    "moduleResolution": "bundler",

    // === Sûreté avancée ===
    "useUnknownInCatchVariables": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "verbatimModuleSyntax": true,

    // === Qualité de code ===
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "forceConsistentCasingInFileNames": true,

    // === Chemins ===
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["**/*.ts", "**/*.tsx"]
}
```

#### `echoroom-desktop-electron/tsconfig.json` (amélioré)
```jsonc
{
  "compilerOptions": {
    // === Niveau de langage ===
    "target": "ES2022",
    "module": "node16",
    "moduleResolution": "node16",
    "lib": ["ES2022"],

    // === Émission ===
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true,

    // === Base strict ===
    "strict": true,

    // === Interop ===
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,

    // === Sûreté avancée ===
    "useUnknownInCatchVariables": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,

    // === Qualité de code ===
    "noUnusedLocals": true,
    "noUnusedParameters": true,

    // === Libs ===
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

### 4.2 Liste de vérification pré-implémentation

Avant d'activer chaque option, vérifier :

| Option | Vérification préalable |
|--------|------------------------|
| `noFallthroughCasesInSwitch` | Chercher les switchs sans break : `rg "case .*:" -A 3` — vérifier les fallthrough intentionnels (ajouter `// falls through`) |
| `useUnknownInCatchVariables` | Chercher `catch (e)` / `catch (error)` — traiter chaque bloc catch |
| `noUncheckedIndexedAccess` | Chercher les accès par index : `rg "\[.*\]"` dans les fichiers `.tsx?` |
| `noImplicitOverride` | Chercher les sous-classes avec méthodes : `rg "extends" -A 10` |
| `noImplicitReturns` | Chercher les fonctions avec type de retour explicite |
| `noPropertyAccessFromIndexSignature` | Chercher les signatures d'index : `rg "\[key:"` |
| `verbatimModuleSyntax` | Chercher les imports sans `type` : `rg "^import "` |
| `module: "node16"` (desktop) | Vérifier que les imports sont compatibles ESM |
| `forceConsistentCasingInFileNames` | Chercher les imports avec casse différente |

---

## 5. Procédure d'implémentation

### Phase 1 — Activation des options sans risque de régression

1. `noFallthroughCasesInSwitch: true` — **aucune régression attendue** (comportement normal)
2. `useUnknownInCatchVariables: true` — vérifier les blocs catch
3. `noUnusedLocals: true` (mobile, desktop) — nettoyer les variables mortes
4. `noUnusedParameters: true` (mobile, desktop) — préfixer avec `_`
5. `forceConsistentCasingInFileNames: true` (web, mobile) — corriger les imports

### Phase 2 — Activation avec refactoring modéré

6. `noUncheckedIndexedAccess: true` — ajouter des guards `if`
7. `noImplicitOverride: true` — ajouter `override` aux méthodes
8. `noImplicitReturns: true` — ajouter les retours manquants

### Phase 3 — Activation avec changements structurels

9. `noPropertyAccessFromIndexSignature: true` — migrer les accès par point en accès indexé
10. `verbatimModuleSyntax: true` — ajouter `import type` partout
11. `module: "node16"` (desktop) + `isolatedModules: true` — adapter le module system

### Phase 4 — Option facultative

12. `exactOptionalPropertyTypes: true` — refactoring lourd, bénéfice modéré

---

## 6. Impact sur les frameworks

### Next.js 14 (echoroom-web)
| Option | Impact |
|--------|--------|
| `noUncheckedIndexedAccess` | Sécurise l'accès aux props `params`, `searchParams` |
| `useUnknownInCatchVariables` | Protège les `try/catch` des Server Actions et API routes |
| `noImplicitReturns` | Évite les retours `undefined` silencieux dans les Server Components |
| `verbatimModuleSyntax` | Clarifie les imports de types Next.js (`PageProps`, `Metadata`) |

### React 18 (web + mobile)
| Option | Impact |
|--------|--------|
| `noUncheckedIndexedAccess` | Sécurise `map`, `filter`, accès aux tableaux dans les renders |
| `noImplicitOverride` | Protège les composants de classe (si utilisés) |
| `noPropertyAccessFromIndexSignature` | Pas d'impact (les props React sont explicitement déclarées) |

### Expo / React Native (echoroom-mobile)
| Option | Impact |
|--------|--------|
| `moduleResolution: "bundler"` | Compatible avec Metro, résout correctement les modules |
| `noUnusedLocals`/`noUnusedParameters` | Nettoyage du code, réduit le bundle |

### Electron (echoroom-desktop-electron)
| Option | Impact |
|--------|--------|
| `module: "node16"` | Permet d'utiliser `import`/`export` ESM natif |
| `isolatedModules: true` | Prépare le projet pour esbuild/electron-builder |

---

## 7. Compromis DX vs Sécurité

| Option | Réticence DX | Bénéfice Sécurité | Verdict |
|--------|:------------:|:------------------:|:-------:|
| `noFallthroughCasesInSwitch` | Nulle | Très élevé | ✅ Activer immédiatement |
| `useUnknownInCatchVariables` | Faible | Très élevé | ✅ Activer immédiatement |
| `noUncheckedIndexedAccess` | Moyenne | Élevé | ✅ Activer |
| `noImplicitReturns` | Faible | Élevé | ✅ Activer |
| `noImplicitOverride` | Faible | Élevé | ✅ Activer |
| `noPropertyAccessFromIndexSignature` | Faible | Moyen | ✅ Activer |
| `verbatimModuleSyntax` | Moyenne | Moyen | 🔵 Activer |
| `exactOptionalPropertyTypes` | Élevée | Faible | 🔴 Reporter |
| `forceConsistentCasingInFileNames` | Faible | Moyen | ✅ Activer |
| `noUnusedLocals`/`noUnusedParameters` | Moyenne | Faible (qualité) | ✅ Activer |

---

## 8. Note globale et classification

### Note par projet (actuelle → cible)

| Projet | Actuelle | Cible |
|--------|:--------:|:-----:|
| `echoroom-web` | **7/10** 🔶 | **9.5/10** ✅ |
| `echoroom-mobile` | **5/10** 🟠 | **9/10** ✅ |
| `echoroom-desktop-electron` | **5/10** 🟠 | **9/10** ✅ |
| **GLOBAL** | **6/10** 🟡 | **9/10** ✅ |

### Classification des problèmes

#### 🔴 CRITIQUE (corriger immédiatement)
1. `noFallthroughCasesInSwitch` absent partout
2. `useUnknownInCatchVariables` absent partout
3. `noUnusedLocals` / `noUnusedParameters` absents dans mobile et desktop

#### 🟠 IMPORTANT (corriger dans la semaine)
4. `noUncheckedIndexedAccess` absent partout
5. `noImplicitOverride` absent partout
6. `noImplicitReturns` absent partout
7. `moduleResolution: "node"` hérité d'Expo (mobile)
8. `module: "commonjs"` + pas d'`isolatedModules` (desktop)
9. `forceConsistentCasingInFileNames` absent (web + mobile)

#### 🔵 AMÉLIORATION (corriger dans le mois)
10. `verbatimModuleSyntax` absent partout
11. `noPropertyAccessFromIndexSignature` absent partout
12. `exactOptionalPropertyTypes` absent partout (optionnel)
13. Créer un tsconfig racine partagé pour le monorepo
14. Aligner `target` et `lib` dans le web

---

## 9. Actions prioritaires immédiates

### Jour 1 — Sécurité immédiate (aucun risque de régression)
```bash
# 1. Ajouter les options sans impact runtime
# 2. Lancer tsc --noEmit pour vérifier
pnpm typecheck
```

### Jour 2 — Nettoyage du code mort
```bash
# 3. Activer noUnusedLocals / noUnusedParameters sur mobile + desktop
# 4. Nettoyer les variables/paramètres morts
```

### Jour 3 — Refactoring des accès non sécurisés
```bash
# 5. Activer noUncheckedIndexedAccess
# 6. Ajouter des guards sur les accès tableaux
```

### Jour 4 — Finalisation
```bash
# 7. Activer les options restantes
# 8. Validation finale : pnpm typecheck && pnpm build
```

---

## Annexe : Scripts utiles

### Vérifier les problèmes avant activation
```bash
# Switch fallthrough
rg "case .*:" --include "*.ts" --include "*.tsx" -A 3 -B 1

# Blocs catch
rg "catch \(" --include "*.ts" --include "*.tsx"

# Signatures d'index
rg "\[key: " --include "*.ts" --include "*.tsx"

# Méthodes override potentielles
rg "extends " --include "*.ts" --include "*.tsx" -A 5 | rg "^\s+(async |)\w+\(.*\)"

# Imports sans type
rg "^import " --include "*.ts" --include "*.tsx" | rg -v "import type"
```

### Tester la compilation
```bash
# Vérifier chaque projet
pnpm --filter echoroom-web typecheck
pnpm --filter echoroom-mobile exec tsc --noEmit
pnpm --filter echoroom-desktop-electron exec tsc --noEmit

# Ou globalement
pnpm typecheck
```
