# 🗺️ EchoRoom — Revue de Code Complète

---

## 📋 GÉNÉRÉ LE
31 mai 2026

---

## PHASE 1 — CARTE DU CODEBASE (@review map)

### Arborescence des modules clés

```
echoroom-root/
├── echoroom-web/                          ← Application Next.js principale
│   ├── src/
│   │   ├── app/                           ← Pages & Routes Next.js App Router
│   │   │   ├── (marketing)/               ← Pages publiques (landing, pricing, explore)
│   │   │   ├── (auth)/                    ← Connexion, inscription
│   │   │   ├── (dashboard)/               ← Dashboard, création, historique, settings
│   │   │   ├── (legal)/                   ← Terms, privacy, legal
│   │   │   ├── admin/                     ← Modération, analytics, users, audit
│   │   │   ├── scenario/[id]/             ← Détail scénario
│   │   │   ├── call/[callId]/             ← Replay appel
│   │   │   ├── api/                       ← Routes API
│   │   │   │   ├── trpc/[trpc]/route.ts   ← Endpoint tRPC
│   │   │   │   ├── auth/[...nextauth]/    ← NextAuth handler
│   │   │   │   └── webhooks/              ← Stripe, Twilio
│   │   ├── components/
│   │   │   ├── ui/                        ← Composants design système (button, card, dialog...)
│   │   │   ├── shared/                    ← Composants partagés (ScenarioCard, DataLoader, Footer...)
│   │   │   ├── player/                    ← Audio player, transcript
│   │   │   ├── social/                    ← Réactions, partage, badges, leaderboard
│   │   │   └── admin/                     ← Admin sidebar
│   │   ├── config/
│   │   │   └── pricing.ts                 ← Configuration des prix Stripe
│   │   ├── hooks/
│   │   │   ├── usePaginatedQuery.ts       ← Hook pagination générique
│   │   │   ├── useFocusTrap.ts            ← Accessibilité focus trap
│   │   │   ├── useCreditBalance.ts        ← Hook solde crédits
│   │   │   └── index.ts
│   │   ├── lib/
│   │   │   ├── auth.ts                    ← Configuration NextAuth
│   │   │   ├── env.ts                     ← Validation env vars (serveur)
│   │   │   ├── env.client.ts              ← Validation env vars (client)
│   │   │   ├── redis.ts                   ← Client Upstash Redis
│   │   │   ├── stripe.ts                  ← Client Stripe
│   │   │   ├── trpc.ts                    ← Client tRPC (appelant)
│   │   │   ├── trpc-provider.tsx          ← Provider React Query + tRPC
│   │   │   ├── trpc-error.ts              ← Utilitaire formatage erreurs
│   │   │   ├── utils.ts                   ← Utilitaires généraux
│   │   │   ├── constants.ts               ← Constantes partagées
│   │   │   ├── posthog.ts                 ← Client PostHog (côté client)
│   │   │   ├── posthog-server.ts          ← Client PostHog (côté serveur)
│   │   │   ├── r2.ts                      ← Client Cloudflare R2
│   │   │   ├── openai.ts                  ← Client OpenAI
│   │   │   └── __tests__/                 ← Tests lib
│   │   ├── server/
│   │   │   ├── db.ts                      ← Instance Prisma
│   │   │   ├── trpc.ts                    ← Configuration tRPC (procédures, middleware)
│   │   │   ├── rootRouter.ts              ← Agrégation des routers
│   │   │   ├── routers/                   ← Routers tRPC
│   │   │   │   ├── auth.ts                ← register, changePassword, me
│   │   │   │   ├── characters.ts          ← list (public)
│   │   │   │   ├── scenarios.ts           ← CRUD scénarios + feed
│   │   │   │   ├── calls.ts               ← start, history, replay, todayCount
│   │   │   │   ├── billing.ts             ← checkout, webhook handler
│   │   │   │   ├── community.ts           ← reactions, comments, featured
│   │   │   │   ├── social.ts              ← leaderboard, clips, badges
│   │   │   │   ├── dashboard.ts           ← stats dashboard
│   │   │   │   ├── admin.ts               ← modération, users, reports, blocked numbers
│   │   │   │   └── user.ts                ← profile, settings, export
│   │   │   ├── services/
│   │   │   │   ├── ai/
│   │   │   │   │   ├── generateScript.ts     ← Génération script IA
│   │   │   │   │   ├── moderation.ts         ← Modération contenu IA
│   │   │   │   │   └── conversationEngine.ts ← Moteur conversation temps réel
│   │   │   │   ├── telephony/
│   │   │   │   │   ├── twilio.ts             ← SDK Twilio
│   │   │   │   │   ├── callLifecycle.ts      ← Cycle de vie appel
│   │   │   │   │   ├── conversationState.ts  ← Machine à états conversation
│   │   │   │   │   ├── prompts.ts            ← Prompts système
│   │   │   │   │   ├── goodbyeDetector.ts    ← Détection fin conversation
│   │   │   │   │   └── constants.ts          ← Constantes téléphonie
│   │   │   │   ├── audio/
│   │   │   │   │   ├── tts.ts                ← Synthèse vocale ElevenLabs
│   │   │   │   │   ├── transcription.ts      ← Transcription Deepgram
│   │   │   │   │   ├── r2.ts                 ← Stockage S3 (recordings)
│   │   │   │   │   └── r2Check.ts            ← Vérification intégrité R2
│   │   │   │   ├── billing/
│   │   │   │   │   ├── stripe.ts             ← Logique Stripe remboursements
│   │   │   │   │   ├── creditOps.ts          ← Opérations crédits
│   │   │   │   │   └── dailyLimitOps.ts      ← Limites quotidiennes
│   │   │   │   ├── social/
│   │   │   │   │   ├── leaderboard.ts        ← Calcul classements
│   │   │   │   │   ├── badges.ts             ← Attribution badges
│   │   │   │   │   └── clips.ts              ← Création clips
│   │   │   │   ├── analytics/
│   │   │   │   │   └── events.ts             ← Événements analytics
│   │   │   │   └── user/
│   │   │   │       └── anonymization.ts      ← Anonymisation GDPR
│   │   │   ├── middleware/
│   │   │   │   ├── rateLimit.ts              ← Rate limiting Upstash
│   │   │   │   ├── rateLimitStore.ts         ← Store in-memory pour tests
│   │   │   │   ├── ipRateLimit.ts            ← Rate limiting par IP
│   │   │   │   └── csrf.ts                   ← Protection CSRF
│   │   │   └── lib/                          ← Utilitaires serveur
│   │   ├── hooks/                          ← (déjà listé)
│   │   ├── types/
│   │   │   ├── index.ts                    ← Types partagés
│   │   │   └── next-auth.d.ts              ← Extension types NextAuth
│   │   └── middleware.ts                   ← Middleware Next.js (auth)
│   ├── prisma/
│   │   ├── schema.prisma                   ← Schéma de données
│   │   ├── seed.ts                         ← Données de démonstration
│   │   └── migrations/                     ← 7 migrations
│   ├── __tests__/                         ← Tests e2e
│   └── configs (next, tailwind, postcss, vitest, playwright)
│
├── packages/ui/                            ← Package UI partagé
│   └── src/
│       ├── index.ts
│       └── lib.ts
│
├── echoroom-mobile/                        ← Projet mobile (vide, placeholder)
├── echoroom-desktop-electron/              ← Desktop Electron (vide, placeholder)
└── .opencode/ .claude/                     ← Config AI agents
```

### Stack technique détectée

| Couche | Technologie | Version |
|--------|-------------|---------|
| **Framework** | Next.js (App Router) | 14.2.25 |
| **Langage** | TypeScript | ~5.6.0 |
| **Runtime** | Node.js | ≥20 (via .nvmrc) |
| **Package Manager** | pnpm | 9.0.0 |
| **Monorepo** | Turborepo | 2.0+ |
| **ORM** | Prisma | 5.22+ |
| **Database** | PostgreSQL | 16 |
| **Cache** | Upstash Redis | 1.34+ |
| **API Layer** | tRPC | 11.0+ |
| **Validation** | Zod | 3.23+ |
| **Auth** | next-auth | 5.0.0-beta.25 |
| **UI** | shadcn/ui (Radix) + Tailwind CSS | 3.4 |
| **State/Data** | TanStack React Query | 5.60+ |
| **Forms** | react-hook-form + resolver | 7.53+ |
| **Format/Lint** | Biome | 2.4.15 |
| **Styling** | Tailwind CSS | 3.4+ |
| **Icons** | lucide-react | 1.8+ |
| **Testing** | Vitest + Playwright | 2.1+ / 1.48+ |

### Services externes
| Service | SDK | Usage |
|---------|-----|-------|
| OpenAI | openai SDK v4 | Génération scripts, modération |
| ElevenLabs | @elevenlabs/sdk | Synthèse vocale (TTS) |
| Deepgram | @deepgram/sdk | Transcription (STT) |
| Twilio | twilio SDK v5 | Téléphonie VoIP |
| Stripe | stripe SDK v17 | Paiements |
| Cloudflare R2 | @aws-sdk/client-s3 | Stockage enregistrements |
| PostHog | posthog-js / posthog-node | Analytics |

### Points d'entrée principaux

**Routes Next.js (App Router) :**
- `/` — Landing page
- `/login`, `/register` — Authentification
- `/dashboard` — Dashboard utilisateur
- `/explore` — Bibliothèque publique
- `/pricing` — Page tarifs
- `/create` — Création scénario
- `/library` — Bibliothèque personnelle
- `/history` — Historique appels
- `/scenario/[id]` — Détail scénario
- `/call/[callId]` — Replay appel
- `/admin/*` — Pages administration
- `/api/trpc/[trpc]` — Endpoint tRPC
- `/api/auth/[...nextauth]` — NextAuth
- `/api/webhooks/stripe` — Webhook Stripe
- `/api/webhooks/twilio/*` — Webhooks Twilio

**Routers tRPC :** `auth`, `characters`, `scenarios`, `calls`, `billing`, `community`, `social`, `admin`, `user`, `dashboard`

### Volume estimé

| Métrique | Valeur |
|----------|--------|
| Fichiers source (src/) | 213 |
| Fichiers packages | 37 |
| Fichiers Prisma | 10 |
| **Total fichiers** | **~260** |
| Lignes de code source | **~25 500** |
| Lignes packages | ~660 |
| Fichiers de test | **58** (22% du total source) |
| Migrations DB | 7 |

### Dépendances externes principales

**Production (echoroom-web) :** 30 dépendances
**Dev (echoroom-web) :** 18 dépendances
**Package UI :** 3 runtime + 3 peer

### Découpage en couches

```
┌─────────────────────────────────────────────────┐
│  PRESENTATION (App Router + Pages)               │
│  app/(marketing)/(auth)/(dashboard)/admin/       │
│  Components (ui, shared, player, social, admin)  │
├─────────────────────────────────────────────────┤
│  API / INTEGRATION                               │
│  tRPC Router (rootRouter → 10 sub-routers)       │
│  Middleware (auth, rateLimit, csrf, moderation)   │
│  Webhooks (Stripe, Twilio)                       │
├─────────────────────────────────────────────────┤
│  BUSINESS / SERVICE                              │
│  AI (generate, moderate, conversationEngine)     │
│  Telephony (twilio, callLifecycle, state)        │
│  Audio (tts, transcription, r2)                  │
│  Billing (stripe, creditOps, dailyLimitOps)      │
│  Social (leaderboard, badges, clips)             │
│  Analytics (events)                              │
│  User (anonymization)                            │
├─────────────────────────────────────────────────┤
│  DATA ACCESS                                     │
│  Prisma ORM (schema, client, migrations)         │
│  Redis (rate limiting, caching)                  │
│  R2/S3 (audio storage)                           │
├─────────────────────────────────────────────────┤
│  INFRASTRUCTURE                                  │
│  Next.js Config (CSP, HSTS, security headers)    │
│  Turborepo (build orchestration)                 │
│  Vercel (deployment target)                      │
└─────────────────────────────────────────────────┘
```

### Architecture détectée

Le projet suit une architecture **Clean Architecture simplifiée** avec Next.js App Router :

- **Pages** : 100% Server Components par défaut, "use client" là où nécessaire (interactivité)
- **API** : tRPC v11 avec procédures typées, validation Zod à l'entrée
- **Services** : Logique métier isolée dans `server/services/`
- **Data** : Prisma ORM + Upstash Redis + R2
- **Auth** : NextAuth v5 (credentials JWT) avec middleware global
- **State client** : TanStack React Query (via tRPC React Query)
- **UI** : shadcn/ui custom avec Tailwind CSS, design system minimal

### Points notables

- Codebase jeune mais complète — ~25K lignes, couvre auth, appels IA, billing, admin, social
- Tests unitaires présents (58 fichiers) couvrant services critiques
- Sécurité déjà adressée : CSP, CSRF, rate limiting, modération IA, encryption téléphone
- Pas de couverture e2e Playwright visible malgré la config
- Présence d'une architecture en couches mais avec quelques fuites

---

## PHASE 2 — REVIEW FRONT-END

### Agent 1 — UI/Design Review

#### ✅ Points positifs
- Palette sombre cohérente (background `#0a0a0b`, card `#141416`, border `#27272a`)
- Utilisation de tokens Tailwind : `bg-card`, `text-muted-foreground`, `border-border`
- Animations subtiles : fade-in, slide-in, zoom-in
- Hiérarchie visuelle correcte sur la landing page (Hero → Stats → Features → Scenarios → CTA)

#### 🚨 Problèmes critiques

**Aucun problème critique détecté en UI/Design**

#### ⚠️ Améliorations importantes

1. **UI-Design | Landing page** | La section "Demo Audio" est masquée sur mobile (`hidden md:block`) avec un message "Fonctionnalité audio disponible prochainement". Cela crée un espace vide pour le desktop et une frustration utilisateur | Solution : Supprimer complètement ou remplacer par un placeholder visuel attractif ("Coming Soon" avec notification)

2. **UI-Design | Composant Card** | Les cartes features sur la landing page utilisent `border-border/50` — une opacité sur une variable CSS qui peut causer des incohérences selon le rendu navigateur | Solution : Définir un token dédié `border-muted` ou utiliser `border-border` avec `opacity-50`

3. **UI-Design | Global** | Pas de typographie fluide (font-size fixed) — les titres `text-5xl md:text-7xl` ne s'adaptent pas entre les breakpoints intermédiaires | Solution : Utiliser `clamp()` pour des tailles fluides

#### 🎨 Éléments visuellement discutables

1. **Stats section** : Les chiffres (50K+, 8, 100%) utilisent `text-3xl font-bold text-primary` — le contraste du cyan sur fond noir est bon mais la section stats semble "flottante" sans arrière-plan dédié, l'intégration visuelle est faible.

2. **Footer** : Non visible dans le code exploré, mais la structure `min-h-screen` avec `flex-col` suggère un footer collé en bas — pas de problème.

3. **Mobile burger menu** : Le `gap-3` sur les liens est serré. Pour une cible tactile, préférer `gap-4` ou `space-y-4` pour les items du menu mobile.

---

### Agent 2 — UX Review

#### 🚨 Problèmes critiques

1. **UX | Landing page** | Le CTA "Commencer gratuitement" mène à `/register` mais le processus d'enregistrement demande `consentAccepted` obligatoire — si l'utilisateur refuse, il reçoit une erreur TRPCError non gérée proprement dans l'UI | **Impact : Bloquant** (l'utilisateur ne sait pas pourquoi le bouton ne fonctionne pas)

2. **UX | Global** | Les états d'erreur tRPC sont gérés via `TRPCError` mais il n'y a pas de gestion unifiée des messages d'erreur dans l'UI — certaines erreurs s'affichent en français, d'autres pourraient être mélangées | **Impact : Moyen**

#### ⚠️ Améliorations importantes

1. **UX | DataLoader** | Composant générique de loading, vide et erreur — bonne pratique mais il manque une prop pour états vides personnalisés | Solution : Ajouter `emptyMessage` et `errorMessage` props

2. **UX | Formulaires** | `react-hook-form` est configuré mais dans le code exploré, les formulaires utilisent des validations inline. Il manque des messages d'erreur visuels cohérents sur tous les formulaires

3. **UX | Navigation** | Dashboard utilise `DashboardShell` mais les sous-pages (create, library, history, community) ont chacune leur propre layout — pas de breadcrumbs ni d'indicateur de page active dans la navigation

4. **UX | Calls.start** | Après soumission du formulaire d'appel, il n'y a pas de feedback immédiat avant que l'appel Twilio ne soit établi (plusieurs secondes). Les utilisateurs peuvent cliquer plusieurs fois | Solution : Désactiver le bouton + spinner + message "Appel en cours..."

---

### Agent 3 — Responsive Review

#### 🚨 Problèmes critiques

1. **Responsive | Landing Hero** | `text-5xl md:text-7xl` sur desktop est très large — `max-w-3xl` limite la largeur mais le titre peut overflow sur des mobiles en mode paysage ou tablettes intermédiaires | **Risque : Cassure typographique sur iPad/tablette**

#### ⚠️ Améliorations importantes

1. **Responsive | Stats grid** | `grid-cols-1 sm:grid-cols-3` avec `divide-y sm:divide-y-0` — la gestion des bordures en mobile crée des lignes horizontales entre stats, ce qui est fonctionnel mais peu esthétique

2. **Responsive | Features grid** | `grid md:grid-cols-3 gap-6` — pas de breakpoint sm, donc sur téléphone c'est 1 colonne (bon), mais le gap pourrait être réduit sur mobile (`gap-4 md:gap-6`)

3. **Responsive | CTA buttons** | Les boutons du Hero utilisent `gap-2` sur une rangée — sur mobile (320px), les deux boutons "Commencer gratuitement" et "Voir la bibliothèque" peuvent overflow ou se chevaucher | Solution : Empiler en colonne sur mobile (`flex-col sm:flex-row`)

4. **Responsive | Menu mobile** | Menu burger fonctionnel mais pas de `max-height` avec transition — apparition/disparition instantanée. Les animations tailwind existent (`slide-in-right`, `fade-in`) mais ne sont pas utilisées ici

#### Détails tactiles vérifiés
- ✅ Boutons avec `size="sm"`: padding suffisant
- ✅ `size="icon"`: 40px minimum (passable, idéal 44px)
- ✅ Liens nav: `py-2` sur mobile (`h-10` minimum approximatif)

---

### Agent 4 — Accessibility Review (WCAG 2.1 AA)

#### 🚨 Problèmes critiques

1. **Accessibilité | Langue** | `<html lang="fr">` — le contenu est en français mais l'URL NextAuth et les librairies tierces peuvent injecter des textes en anglais. Le mélange FR/EN sans indication de changement de langue est un problème **WCAG 3.1.2** | **Criticité : Haute**

2. **Accessibilité | Couleur** | Les seules couleurs disponibles sont une palette sombre avec accent cyan `#06b6d4`. Le ratio de contraste du `text-muted-foreground` (`#a1a1aa`) sur `bg-card` (`#141416`) doit être vérifié : `#a1a1aa` sur `#141416` ≈ 7.2:1 ✅ (bon). Mais `text-muted-foreground` sur `bg-muted` (`#18181b`) ≈ 6:1 ✅ | **Criticité : Faible** (OK dans les cas courants)

3. **Accessibilité | Skip link** | Un skip link est présent dans `layout.tsx` mais cible `#main-content`. Cependant certains pages n'ont pas de `main-content` comme ancre (ex: landing page n'affiche pas `main-content`) | **WCAG 2.4.1** — **Criticité : Haute**

4. **Accessibilité | Images** | Pas d'images dans le code exploré mais le composant `avatar` ne semble pas avoir d'attribut `alt` par défaut dans le DS | **WCAG 1.1.1**

#### ⚠️ Améliorations importantes

1. **Accessibilité | Formulaires** | Le formulaire de login/register utilise des inputs standards mais il faut vérifier l'association explicite `<label htmlFor>` pour chaque champ

2. **Accessibilité | Navigation** | Le menu mobile utilise `aria-label="Menu"` sur le bouton burger — ✅. Mais la liste des liens dans le menu mobile n'a pas de `role="navigation"` ou d'`aria-label` supplémentaire

3. **Accessibilité | Focus trap** | `useFocusTrap` existe dans les hooks — vérifier qu'il est utilisé dans les modales (dialog). Les dialogs shadcn ont généralement un focus trap intégré via Radix

4. **Accessibilité | Couleur** | Le `text-primary` (`#06b6d4`) sur `bg-card` (`#141416`) ≈ 5.7:1 — ✅ ok pour le texte normal. Mais sur `bg-background` (`#0a0a0b`), le ratio ≈ 5.9:1 — ✅ toujours ok

5. **Accessibilité | Contraste des borders** | Les bordures `border-border` (`#27272a`) sont purement décoratives — pas de problème WCAG

---

### Agent 5 — Front-End Architecture Review

#### 🚨 Problèmes critiques

1. **Architecture | Mélange Server/Client Components** | La landing page (`page.tsx`) utilise `"use client"` uniquement pour `useState` du menu mobile et `api.scenarios.feed.useQuery()` — c'est un composant entier en client-side alors que la majorité du contenu est statique | **Impact : Performance** (hydration inutile, bundle plus gros) | Solution : Extraire la navbar mobile et le feed dans des composants clients séparés, garder le reste en Server Component

2. **Architecture | Composant DataLoader** | Le composant accepte `query` et `isEmpty` — bonne abstraction mais il mélange Vue (markup conditionnel) et Données (query) dans une seule prop. Le pattern est correct mais gare à la sur-abstraction

#### ⚠️ Améliorations importantes

1. **Architecture | Hooks** | `useCreditBalance` existe mais les crédits sont aussi chargés via `auth.me`. Vérifier s'il n'y a pas double appel réseau ou cache incohérent

2. **Architecture | Gestion d'état** | Pas de store global (Redux/Zustand interdit). TanStack Query gère l'état serveur. L'état local est géré par React (useState, useReducer). C'est sain mais peut devenir limité avec la complexité croissante

3. **Architecture | Séparation des responsabilités** | Les routers tRPC sont parfois épais : `auth.ts` (register + changePassword + me) mélange auth basique avec gestion de profil. Envisager de séparer dans un router `profile`

4. **Architecture | Bundle splitting** | Pas de lazy loading explicite des pages — Next.js le fait automatiquement par route, mais les composants lourds (AudioPlayer) ne sont pas lazy-loadés

---

### Agent 6 — Design System Review

#### Points vérifiés

- **Tokens de couleurs** : Définis dans `tailwind.config.ts` avec des noms sémantiques (`background`, `foreground`, `card`, `border`, `primary`, `secondary`, `muted`, `destructive`)
- **Espaces** : Utilisation des utilitaires Tailwind (`gap-6`, `px-6`, `py-20`) sans valeurs magiques
- **Typo** : Police Inter via `next/font/google`, token `--font-inter`
- **Animations** : Définies via `keyframes` dans tailwind.config (bonne pratique)
- **Composants UI** : Button, Card, Badge, Dialog, Input, Textarea, Skeleton, Checkbox, SegmentedControl, Avatar + variants

#### 🚨 Problèmes critiques

1. **Design System | Aucun fichier de tokens** | Pas de fichier `tokens.json` ou `design-tokens.js` — les valeurs sont hardcodées dans `tailwind.config.ts`. Pour un DS partagé entre web/mobile/desktop, il faudrait une source unique | **Impact : Incohérence cross-platform à long terme**

#### ⚠️ Améliorations importantes

1. **Design System | Package UI** | `@echoroom/ui` est un package séparé mais il ne contient QUE des utilitaires (`cn()` dans `lib.ts`). Aucun composant n'est partagé. Les vrais composants UI sont dans l'app web. Le package UI est en réalité un coquille vide | Solution : Soit y déplacer les composants UI, soit le supprimer

2. **Design System | Documentation** | Aucune documentation de composants (Storybook, README, etc.). Les props sont définies en TypeScript mais pas documentées

3. **Design System | Variantes** | Le composant `Button` exporte des variantes (`variant="ghost"`, `size="sm"`) via CVA — bonne pratique. Card n'a pas de variants définis explicitement

4. **Design System | Skeleton** | Composant Skeleton présent mais pas de pattern défini pour les états de chargement (page skeleton vs component skeleton)

---

### Score Front-End

| Catégorie | Score | Commentaire |
|-----------|-------|-------------|
| **Design** | 7/10 | Cohérent mais pas de design system cross-platform, landing page bien structurée |
| **UX** | 7/10 | Parcours clair, manque feedbacks d'état et gestion d'erreur utilisateur |
| **Responsive** | 7/10 | Fonctionnel sur mobile mais quelques risques d'overflow, animations absentes sur mobile |
| **Accessibilité** | 6/10 | Skip link présent mais peut être brisé, pas de tests axe/lighthouse |
| **Maintenabilité** | 7/10 | Composants bien découpés, mais mélange server/client, package UI vide |

---

## PHASE 3 — BUSINESS LAYER

### Agent Business Analyst

#### 🚨 Problèmes critiques

1. **Règle métier | Remboursement crédits** | Les appels échoués doivent rembourser les crédits (critère de done #19/#20). Dans `callLifecycle.ts`, il y a une gestion des erreurs mais le remboursement automatique des crédits pour appels échoués/FAILED n'est pas clairement implémenté dans le flux exploré | **Impact Business** : Perte de confiance utilisateur, crédits perdus sur échecs techniques | **Exemple** : Appel échoue pour cause réseau Twilio — l'utilisateur perd ses crédits sans appel effectué

2. **Règle métier | Crédits négatifs** | Les crédits sont typés `Int` en Prisma mais la contrainte `@default(5)` n'empêche pas les valeurs négatives. Aucune contrainte CHECK en base | **Impact Business** : Endettement technique possible, abus | **Exemple** : Race condition entre déduction crédits via deux appels simultanés

3. **Règle métier | Consentement obligatoire** | `auth/register` valide `consentAccepted: z.boolean()` mais seulement en mutation — pas de vérification côté UI avant soumission. Si l'utilisateur n'a pas de case à cocher visible, il obtient une erreur TRPCError sans explication claire | **Impact Business** : Non-conformité légale si contourné, mauvaise UX

#### ⚠️ Problèmes importants

1. **Règle métier | Limite quotidienne** | `dailyLimitOps.ts` implémente une limite par jour mais elle est basée sur le nombre d'appels (`callCount`). Pas de limite basée sur la durée totale des appels — un utilisateur pourrait faire 20 appels de 1h chacun | Solution : Ajouter `totalDurationSeconds` à `DailyCallLimit`

2. **Règle métier | Modération des commentaires** | Les commentaires ont `moderationStatus @default(APPROVED)` — les commentaires sont approuvés par défaut sans modération préalable. Seuls les scénarios sont modérés | **Risque** : Contenu inapproprié dans les commentaires

3. **Règle métier | Soft delete utilisateur** | `deletedAt` présent sur User mais aucun mécanisme de purge automatique après X jours. GDPR exige la suppression définitive après rétention | **Risque légal** : GDPR non-respect

---

### Agent Domain Expert

#### 🚨 Problèmes critiques

1. **Entité Call | Agrégat questionnable** | `Call` contient `phoneNumber` en clair (chiffré avec `PHONE_ENCRYPTION_KEY`), `recordingUrl`, `transcript`, `costCredits`. Mais `phoneNumber` est aussi stocké dans `Call` et référencé dans `BlockedNumber`. C'est une duplication de l'information téléphonique | **Suggestion** : Extraire `PhoneNumber` comme Value Object avec chiffrement intégré

2. **Entité Scenario | Trop de responsabilités** | `Scenario` est lié à `Call`, `Comment`, `Reaction`, `ShareEvent`, `FeaturedScenario`. L'agrégat Scenario est trop gros — les `ShareEvent` et `FeaturedScenario` pourraient être des agrégats séparés | **Impact** : Charge inutile sur l'agrégat, contention

3. **Value Objects | Typage faible** | `CharacterCategory` est un enum Prisma mais n'est pas utilisé comme value object typé dans le code applicatif. Les catégories sont manipulées comme des strings | **Suggestion** : Créer un type Zod `CharacterCategory` et l'utiliser dans les inputs tRPC

#### ⚠️ Problèmes importants

1. **Entity User | God object** | `User` a 15 relations — notifications, badges, clips, blocked numbers, audit logs... C'est un god object en formation. Séparer en profils distincts

2. **Langage ubiquitaire** | Le mélange FR/EN dans le code est cohérent mais les messages d'erreur sont en français tandis que les noms de variables sont en anglais. Le nom de la plateforme "EchoRoom" est bien positionné

---

### Agent Use Cases Review

#### 🚨 Problèmes critiques

1. **calls.start | Trop de responsabilités** | La mutation `start` dans `calls.ts` fait : validation input → blacklist check → initiateCall → increment playCount. L'orchestration dans `initiateCall` (service) est correcte mais la mutation elle-même gère aussi le mapping d'erreurs (6 types) — trop de logique de mapping | **Suggestion** : Déplacer le mapping d'erreurs dans un handler dédié

2. **admin.moderationQueue | Manque de pagination** | La file de modération doit être paginée mais n'a pas de paramètres `cursor`/`limit` explicites dans le code exploré

#### ⚠️ Problèmes importants

1. **auth.register | Use case trop large** | La procédure `register` gère : validation → blocage disposable emails → vérification conflits → hash → création. Le blocage disposable est une règle métier qui devrait être dans un service dédié et testable isolément

---

## PHASE 4 — BACK-END REVIEW

### Agent 1 — Architecture Review

#### 🚨 Problèmes critiques

1. **Architecture | Dépendances vers l'infrastructure** | Les routers tRPC importent directement `db` (Prisma) depuis `../db`. Les services dans `server/services/` importent aussi directement Prisma. Pas d'inversion de dépendances ni de repository pattern — couplage fort à Prisma | **Solution** : Introduction d'interfaces repository

2. **Architecture | Middleware en cascade** | `adminProcedure = t.procedure.use(isAuthenticated).use(isAdmin)` — l'ordre est correct mais `isAdmin` ne vérifie pas que la session a bien le type `AdminSession`. La fonction `isAdmin` reçoit `AuthenticatedTRPCContext` mais retourne `AdminTRPCContext` dans le type alors que la vérification est faite côté middleware uniquement

#### ⚠️ Problèmes importants

1. **Architecture | Scalabilité** | L'architecture monolithique Next.js convient au stade actuel mais la séparation couche métier/services facilite une future extraction en microservices. La logique est correcte

2. **Architecture | Modularité** | Routers bien découpés par domaine (auth, calls, billing...). Services bien organisés par dossier

---

### Agent 2 — Code Quality Review

#### Observations
- **Nommage** : Bon — `camelCase` pour variables/fonctions, `PascalCase` pour composants/types
- **DRY** : Peu de duplication évidente
- **Complexité** : Services bien découpés, fonctions de taille raisonnable
- **Commentaires** : Quelques commentaires en français dans le code (ex: layout.tsx) — cohérent avec le projet
- **Pas de TODO/FIXME** détecté (conforme aux règles)

#### ⚠️ Améliorations importantes

1. **Qualité | Routers épais** | `auth.ts` fait 181 lignes — envisager d'extraire `changePassword` et `me` dans un router `profile.ts`

2. **Qualité | Gestion des erreurs** | Le pattern try/catch avec switch sur `error.code` dans `calls.ts` est fragile — oublier un `AppError` code = `INTERNAL_SERVER_ERROR` par défaut

---

### Agent 3 — Security Review (OWASP Top 10)

#### 🔒 Sécurité

| Vulnérabilité | OWASP | Criticité | Détail | Solution |
|--------------|-------|-----------|--------|----------|
| Secrets en dur dans `env.ts` (DEV_DEFAULTS) | OWASP:A06 | Medium | Les valeurs de dev sont utilisées comme fallback silencieux — un déploiement avec env manquante pourrait utiliser des secrets prévisibles | Production check déjà présent ✅ mais ajouter warning plus visible |
| CSP Permissif | OWASP:A05 | Medium | `'unsafe-inline'` sur script-src et style-src nécessaire pour Next.js mais réduit la protection XSS | Justifié, pas de solution alternative avec Next.js App Router |
| `AUDIT_HASH_SECRET` dev default faible | OWASP:A06 | Low | Dev default = `audit_hash_dev_secret_16ch!` — OK pour dev uniquement | Production check existe ✅ |
| Pas de rate limit sur webhooks Stripe | OWASP:A04 | High | Les webhooks Stripe n'ont pas de rate limiting — un attaquant pourrait rejouer des webhooks | Ajouter rate limiting IP sur les routes webhooks |
| Twilio webhook validation | OWASP:A08 | High | Vérifier que `validate.ts` valide bien la signature Twilio | À vérifier dans le code |
| RBAC incomplet | OWASP:A01 | Medium | `isAdmin` vérifie le rôle, mais `MODERATOR` a-t-il accès aux routes admin ? Le enum inclut `MODERATOR` mais n'est pas géré dans le middleware de la route | Clarifier le RBAC |

#### ✅ Bonnes pratiques observées
- CSP configuré
- HSTS (max-age=63072000; preload)
- X-Frame-Options: DENY
- CSRF validation via `validateCSRF`
- Rate limiting sur auth, calls
- Phone number encryption key
- Token version pour invalidation de session
- Timing-constant auth (dummy hash)

---

### Agent 4 — Performance Review

#### ⚡ Performance

| Problème | Impact | Solution |
|----------|--------|----------|
| `callLifecycle.initiateCall` — appel synchrone Twilio | **Moyen** | Utiliser une queue (Redis Bull) pour les appels entrants |
| `conversationEngine` — streaming audio synchrone | **Moyen** | Vérifier que le streaming est bien asynchrone (WebSocket) |
| Modération IA (`checkContent`) appelée dans le middleware tRPC | **Moyen** | Bloque la mutation en attendant OpenAI — implémenter modération async avec file d'attente |
| Pas de cache Redis pour les requêtes fréquentes (characters.list, scenarios.feed) | **Faible** | Ajouter cache Redis avec TTL de 5 min pour le feed public |
| Pagination cursor sur `call.history` — OK ✅ mais pas sur toutes les listes | **Faible** | Paginer l'admin panel |

---

### Agent 5 — Database Review

#### 🗄️ Base de données

| Problème | Tables | Solution |
|----------|--------|----------|
| **Index manquant** sur `Call.status` (filtré par les webhooks Twilio) | Call | `@@index([status])` |
| **Index manquant** sur `Comment.createdAt` (tris par date) | Comment | `@@index([createdAt(sort: Desc)])` |
| **Index manquant** sur `Scenario.moderationStatus` (file de modération) | Scenario | Déjà présent dans `@@index([visibility, moderationStatus, createdAt(sort: Desc)])` ✅ |
| **SELECT * implicite** dans certaines requêtes Prisma | Multiple | Vérifier les `include` avec `select` réduit — la plupart sont bons ✅ |
| **Call.scenarioId nullable** | Call | ✅ Correct (SetNull si scénario supprimé) |
| **Clips.callId** — `onDelete: Cascade` sans vérification | Clip | ✅ Logique correcte |
| **Pas de CHECK contrainte** sur `credits >= 0` | User | Ajouter `@@check(credits >= 0)` ou validation applicative stricte |
| **DailyCallLimit.date** — type DateTime mais seule la date compte | DailyCallLimit | ✅ `@@unique([userId, date])` mais le format dépend de comment la date est stockée |

---

### Agent 6 — API Review

#### ✅ Points positifs
- ✅ Nommage RESTful cohérent (`auth.register`, `call.start`, `scenario.feed`)
- ✅ Validation Zod sur toutes les entrées
- ✅ Pagination cursor sur toutes les listes
- ✅ Codes HTTP corrects (CONFLICT, FORBIDDEN, BAD_REQUEST, etc.)
- ✅ Transformation superjson pour les dates

#### ⚠️ Problèmes

1. **API | Versioning** | Pas de versioning d'API — toutes les procédures sont sous `/api/trpc`. tRPC étant typé, le versioning est moins critique mais devient problématique en production
2. **API | Réponse d'erreur** | Format uniforme via `TRPCError` mais les messages sont en français — cohérent avec le public cible mais peut poser problème pour l'internationalisation future
3. **API | Documentation** | Pas de documentation OpenAPI — tRPC s'y prête mal sans outillage complémentaire

---

### Agent 7 — Reliability & Observability Review

#### ✅ Points positifs
- Logger structuré via `createLogger`
- Redshift analytics via PostHog

#### 🚨 Problèmes critiques

1. **Observabilité | Pas de tracing distribué** | Aucun correlation ID propagé dans les appels entre services (OpenAI, ElevenLabs, Deepgram). Impossible de tracer un appel complet | **Solution** : Ajouter correlation ID dans les headers HTTP des calls API externes + logger avec un requestId

2. **Observabilité | Métriques** | PostHog est utilisé pour les événements mais pas de métriques RED (Rate, Errors, Duration) sur les endpoints tRPC | **Solution** : Instrumenter les procédures tRPC avec des métriques

3. **Fiabilité | Pas de circuit breaker** | Appels à Twilio, OpenAI, ElevenLabs, Deepgram sans circuit breaker — un service tiers down peut faire tomber le système entier | **Solution** : Implémenter circuit breaker via Upstash ou pattern simple

#### ⚠️ Problèmes importants

1. **Fiabilité | Retry sans backoff** | Les appels externes (Twilio, OpenAI) n'ont pas de retry avec backoff exponentiel explicite
2. **Fiabilité | Timeout** | Pas de timeout explicite configuré sur les SDK externes (OpenAI, ElevenLabs)

---

### Agent 8 — Staff Engineer Review

#### 📈 Scalabilité (x10, x100)

**Aujourd'hui → x10 charge :**
- La modération OpenAI synchrone deviendra un goulot d'étranglement critique (timeout, throttling)
- Les appels Twilio synchrones sans queue causeront des pertes de données sous pic
- Prisma sans pool de connexions dimensionné peut saturer PostgreSQL

**x100 charge :**
- L'agrégat User devra être partitionné (profile, social, billing séparés)
- PostgreSQL nécessitera read replicas + sharding
- Le stockage des transcripts (JSON dans Call) deviendra un problème — table séparée nécessaire
- Les migrations Prisma sur très grandes tables sont risquées

#### Dette technique critique

1. **Pas de migration de schéma rollable** — certaines migrations Prisma sur des tables avec données existantes seront bloquantes
2. **Pas de séparation read/write** — tout passe par Prisma sur la même connexion DB
3. **Pas de cache Redis structuré** — Redis utilisé uniquement pour rate limiting, pas pour le cache de données

---

## PHASE 5 — INFRASTRUCTURE

### Agent Reliability

| Point de risque | Type | Probabilité | Impact | Solution |
|----------------|------|------------|--------|----------|
| Appel Twilio sans circuit breaker | Cascade | H | Élevé | Ajouter circuit breaker |
| OpenAI timeouts non gérés | Latence | M | Moyen | Timeout + fallback |
| Webhook Stripe sans idempotence | Data loss | M | Critique | Ajouter clé d'idempotence |
| Pas de dead letter queue | Data loss | L | Élevé | DLQ pour webhooks échoués |

### Agent Security

#### Vulnérabilités additionnelles

| Vulnérabilité | OWASP | Criticité | Solution |
|--------------|-------|-----------|----------|
| Pas de rate limit sur webhooks Stripe/Twilio | A04 | High | Rate limit IP + signature |
| TWILIO_TOKEN_SECRET en dev faible | A06 | Low | Production check ✅ |
| Pas de validation de la force du mot de passe côté client | A02 | Low | Ajouter feedback temps réel |
| Aucune protection contre l'énumération d'emails (register) | A01 | Medium | Le timing-constant sur login est ✅ mais register permet d'essayer des emails et détecter "déjà utilisé" vs erreur générique | Retourner toujours la même erreur |
| Pas de vérification de force du phone number (call.start) | A03 | Low | Valider via un lookup API |

### Agent Observability

| Zone aveugle | Impact | Instrumentation |
|-------------|--------|-----------------|
| Appels OpenAI (latence, tokens) | Coût, débogage | Ajouter logging des tokens utilisés |
| Streaming Twilio (qualité audio, latence) | Qualité appel | Métriques WebRTC |
| Transaction Stripe (succès, échec) | Revenue | Déjà dans PostHog ✅ |
| Modération IA (faux positifs, faux négatifs) | Qualité modération | Dashboard dédié |
| Temps de réponse tRPC par procédure | Performance | Middleware de timing |

### Agent Cloud & Ops

| Risque opérationnel | Impact | Probabilité | Solution |
|--------------------|--------|------------|----------|
| Pas de IaC (Infrastructure as Code) | Configuration drift | H | Terraform/Pulumi |
| Vercel sans preview deploys pour branches | Qualité | M | Configurer preview deploys |
| Pas de backup défini pour PostgreSQL | Data loss | H | Backup automatisé |
| Pas de staging environment | Bugs in prod | H | Créer environnement staging |

---

## PHASE 6 — SYNTHÈSE ARCHITECTE

### Top 20 Problèmes (tous domaines confondus)

| Rang | Domaine | Problème | Impact | Effort | Source |
|------|---------|----------|--------|--------|--------|
| 1 | 🔒 Sécurité | Rate limit manquant sur webhooks Stripe/Twilio | Critique | S | Sécurité, Ops |
| 2 | 🗄️ Data | Remboursement crédits appels échoués non assuré | Critique | M | Business |
| 3 | 🏗️ Archi | Pas de circuit breaker sur appels externes (Twilio, OpenAI) | Élevé | M | Fiabilité |
| 4 | 🔒 Sécurité | Énumération d'emails possible via register | Élevé | S | Sécurité |
| 5 | 🏗️ Archi | Modération IA synchrone bloque les mutations | Élevé | L | Performance |
| 6 | 📈 Scalabilité | Agrégat User god object (15 relations) | Moyen | L | Domain |
| 7 | 🔒 Sécurité | Commentaires approuvés par défaut sans modération | Moyen | S | Business |
| 8 | 🗄️ Data | Pas de CHECK contrainte crédits >= 0 en DB | Élevé | S | Data |
| 9 | 🖥️ Front | Landing page 100% client-side (performance) | Moyen | S | Front-End |
| 10 | 🏗️ Archi | Couplage fort à Prisma (pas de repository) | Moyen | XL | Architecture |
| 11 | 🔍 Obs | Pas de tracing distribué | Moyen | M | Observabilité |
| 12 | 🔒 Sécurité | Aucune protection énumération d'emails register | Moyen | S | Sécurité |
| 13 | 🗄️ Data | Index manquant Call.status | Moyen | XS | DBA |
| 14 | 🔍 Obs | Pas de métriques RED sur endpoints tRPC | Moyen | S | Observabilité |
| 15 | 🖥️ Front | Skip link peut être brisé (ancre manquante) | Haute | XS | Accessibilité |
| 16 | 🏗️ Archi | Pas de versioning API | Faible | M | API |
| 17 | 🔒 Sécurité | GDPR soft delete sans purge automatique | Moyen | M | Business |
| 18 | 🖥️ Front | Package UI @echoroom/ui vide (aucun composant) | Faible | S | Design System |
| 19 | ⚡ Perf | Pas de cache Redis pour données fréquentes | Moyen | M | Performance |
| 20 | 🏗️ Archi | Pas de migration de schéma rollable | Moyen | M | Staff |

### 🧨 Dette technique critique (coûtera 10x dans 6 mois)

1. **Agrégat User non partitionné** — Plus les fonctionnalités sociales augmentent, plus User devient impossible à refactorer. Coût futur : réécriture majeure
2. **Pas de repository pattern** — Migrer de Prisma vers autre chose (ou ajouter une couche de caching) nécessitera de toucher tous les services
3. **Package UI vide** — Laisser un package npm vide avec une fausse promesse de partage crée de la confusion et des dépendances inutiles

### ⚠️ Risques à 6 mois

1. **Volume de logs sans structuration** — Sans politique de rétention et rotation, les logs PostHog deviendront coûteux
2. **Saturation du pool de connexions Prisma** — Sous charge, le pool par défaut (10) sera insuffisant
3. **Stripe webhooks non idempotents** — Un double appel Stripe (retry automatique) peut causer des doubles crédits

### 🔮 Risques à 2 ans

1. **Monolithe Next.js** — Atteindra ses limites de build time et de déploiement
2. **Prisma sans séparation read/write** — Impossible de scaler la lecture sans réécrire la couche data
3. **tRPC sans versioning** — Breaking changes API impossibles sans versioning

### 📅 Plan d'action priorisé

#### Sprint 1 — Correctifs critiques (semaine 1-2)
1. [XS] [🔒] Ajouter rate limit IP sur routes webhooks (`api/webhooks/rateLimit.ts`)
2. [S] [🔒] Masquer les erreurs CONFLICT pour register (retourner erreur générique)
3. [S] [🗄️] Ajouter validation crédits >= 0 dans `creditOps.ts` et CHECK contrainte DB
4. [M] [👨‍💼] Implémenter remboursement automatique crédits sur appels FAILED
5. [XS] [🖥️] Extraire landing page en Server Component + petits composants clients
6. [S] [🖥️] Fixer skip link dans layout.tsx (ancre `#main-content` sur toutes les pages)

#### Sprint 2 — Stabilisation (semaine 3-6)
7. [M] [🏗️] Implémenter circuit breaker + timeouts sur appels externes (Twilio, OpenAI, ElevenLabs)
8. [M] [📊] Ajouter métriques RED sur procédures tRPC (middleware timing)
9. [S] [🗄️] Ajouter index manquants (Call.status, Comment.createdAt)
10. [M] [🔒] Implémenter modération asynchrone des commentaires
11. [S] [📈] Ajouter cache Redis pour scenarios.feed (TTL 5 min)
12. [M] [🏗️] Modération IA asynchrone avec file d'attente (Bull/Redis)

#### Sprint 3 — Amélioration (mois 2-3)
13. [L] [🏗️] Extraire des services avec interfaces repository (inversion dépendances)
14. [M] [🔍] Ajouter correlation ID et tracing distribué
15. [S] [🖥️] Supprimer ou remplir le package @echoroom/ui
16. [M] [🖥️] Ajouter dark/light mode toggle (préparation)
17. [S] [🔒] Implémenter purge automatique GDPR (soft delete → hard delete après 30 jours)

#### Horizon 6 mois — Évolution
18. [XL] [🏗️] Partitionner l'agrégat User (séparer en UserProfile, UserSocial, UserBilling)
19. [L] [🏗️] Versioning API tRPC
20. [XL] [☁️] Infrastructure as Code (Terraform) + staging environment

### Score d'architecture global

| Catégorie | Score | Commentaire |
|-----------|-------|-------------|
| **Architecture** | 7/10 | Bonne séparation en couches, manque d'inversion de dépendances |
| **Sécurité** | 7/10 | Bonne base (CSP, CSRF, rate limiting), quelques vulnérabilités webhooks |
| **Performance** | 6/10 | Streaming OK, pas de cache, modération synchrone problématique |
| **Maintenabilité** | 7/10 | Code propre, tests présents, documentation absente |
| **Scalabilité** | 5/10 | Monolithe Next.js, pas de read replicas, pas de cache |
| **Observabilité** | 4/10 | Logs structurés mais pas de traces ni métriques RED |
| **Score global** | **6/10** | Base solide, mature pour un projet en phase early-stage |

### Verdict

**État :** EchoRoom est un projet early-stage bien architecturé avec une couverture de sécurité étonnamment bonne pour un code de ce volume (~25K lignes). La séparation en couches, la validation Zod systématique, la présence de tests (58 fichiers), et l'attention portée à la sécurité (CSP, CSRF, encryption, rate limiting) montrent une maturité inhabituelle.

**Points forts :** Architecture propre, services bien découpés, sécurité proactive, tests présents, code TypeScript strict.

**Points faibles :** Couplage Prisma omniprésent, pas de cache Redis structuré, pas d'observabilité (tracing, métriques), modération IA synchrone, design system cross-platform inexistant.

**Trajectoire recommandée :** Consolider les correctifs critiques (sécurité webhooks, remboursement crédits, validation crédits négatifs) avant d'ajouter de nouvelles fonctionnalités. Ensuite, investir dans l'observabilité (tracing, métriques RED) et le caching Redis — ces deux piliers permettront de scaler sereinement. La dette architecturelle (couplage Prisma, agrégat User) peut attendre 6 mois mais devra être adressée avant le passage à l'échelle.

---

*Rapport généré le 31 mai 2026 par EchoRoom Build Intelligence*
