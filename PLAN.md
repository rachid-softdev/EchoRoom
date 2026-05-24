# EchoRoom AI

## Contexte

EchoRoom AI est une plateforme de social entertainment basée sur des appels IA scénarisés.
Contrairement à [PrankCaller.fun](https://prankcaller.fun?utm_source=chatgpt.com), le produit ne se positionne pas comme un simple “prank call generator”, mais comme un moteur de “fake social scenarios” interactifs : appels absurdes, faux recruteurs, personnages IA, défis viraux, appels immersifs multijoueurs, scénarios TikTok-ready, jeux sociaux et conversations simulées.

Le produit cible :

* Gen Z / TikTok / Discord communities
* créateurs de contenu
* streamers
* groupes d’amis
* creators UGC
* communautés RP / gaming

Le produit doit être conçu comme un mélange entre :

* Character.ai
* prankcaller.fun
* Discord activities
* TikTok viral generators
* social party game

Le positionnement doit éviter :

* les célébrités réelles clonées (risque légal élevé)
* les deepfakes politiques
* les scams
* les appels harcelants

Le système doit imposer :

* humour absurde,
* entertainment-first,
* consent & abuse prevention,
* scénarios fictionnels.

Le produit doit être plus “fun platform” que “anonymous prank tool”. ([AI Prank Call][1])

---

# MASTER PROMPT

# EchoRoom AI

## Contexte

EchoRoom AI est une plateforme web de social entertainment permettant de générer des appels IA immersifs entre personnages fictifs et utilisateurs réels.

Le produit permet :

* de créer des scénarios d’appel personnalisés,
* d’utiliser des voix IA fictives,
* de lancer des conversations téléphoniques interactives,
* d’écouter les réactions,
* de partager des extraits viraux,
* de créer des “rooms” sociales multijoueurs autour d’appels absurdes.

Le produit ne doit PAS être un clone exact de prankcaller.fun.
Le positionnement doit être :

* plus social,
* plus communautaire,
* plus gamifié,
* moins “anonymous prank”.

## Périmètre de cette implémentation

### Inclus

* génération d’appels IA
* scénarios personnalisables
* bibliothèque de personnages fictifs
* appels Twilio
* streaming audio temps réel
* transcription
* replay des appels
* partage viral
* système de crédits
* auth utilisateur
* dashboard utilisateur
* modération
* reporting
* analytics admin
* feed communautaire
* reactions/comments
* système de templates
* génération IA de scripts
* support mobile responsive

### Exclus

* applications mobiles natives
* voice cloning utilisateur
* célébrités réelles
* deepfakes politiques
* marketplace publique de voix
* appels internationaux premium
* paiements crypto
* appels entrants
* vidéo
* WebRTC peer-to-peer

---

## Stack technique

* Framework : Next.js 14 App Router
* Langage : TypeScript strict
* Runtime : Node.js 20
* ORM : Prisma 5.x
* Database : PostgreSQL 16
* Cache : Redis (Upstash)
* API : tRPC v11
* Validation : Zod
* Auth : next-auth v5
* Paiement : Stripe
* Téléphonie : Twilio Voice API
* AI LLM : OpenAI Responses API
* TTS : ElevenLabs
* STT : Deepgram
* UI : shadcn/ui + Tailwind
* State : TanStack Query
* Forms : react-hook-form + zodResolver
* Storage : S3-compatible (Cloudflare R2)
* Analytics : PostHog
* Rate limiting : Upstash Redis
* Tests : Vitest + Playwright
* Deployment : Vercel

## INTERDIT

* Pages Router
* useEffect pour fetch principal
* any implicite ou explicite
* socket.io
* MongoDB
* Supabase Auth
* Firebase
* Zustand
* Redux
* TODO/FIXME dans le code final
* mocks/stubs non implémentés
* voix de célébrités réelles
* appels anonymes illimités
* upload audio libre sans modération
* dépendance non listée sans justification commentée

---

## Architecture

Pour le contexte générale faire comme D:\git-projects\PromptBearer,
pnpm, répertoire : -web, -mobile (vide juste json, .gitignore), desktop-electron(vide juste json, .gitignore)

-web :
```txt
src/
  app/
    (marketing)/
      page.tsx
      pricing/page.tsx
      explore/page.tsx
    (auth)/
      login/page.tsx
      register/page.tsx
    (dashboard)/
      dashboard/page.tsx
      create/page.tsx
      library/page.tsx
      history/page.tsx
      billing/page.tsx
      settings/page.tsx
      community/page.tsx
    admin/
      moderation/page.tsx
      analytics/page.tsx
      users/page.tsx
    api/
      trpc/[trpc]/route.ts
      webhooks/
        stripe/route.ts
        twilio/route.ts
  server/
    routers/
      auth.ts
      calls.ts
      characters.ts
      scenarios.ts
      billing.ts
      community.ts
      admin.ts
    services/
      ai/
        generateScript.ts
        moderation.ts
        conversationEngine.ts
      telephony/
        twilio.ts
        callLifecycle.ts
      audio/
        tts.ts
        transcription.ts
      billing/
        stripe.ts
      community/
        feed.ts
      analytics/
        events.ts
    middleware/
      auth.ts
      rateLimit.ts
      moderation.ts
    db.ts
    trpc.ts
  components/
    ui/
    call/
    dashboard/
    community/
    player/
    forms/
  lib/
    auth.ts
    stripe.ts
    redis.ts
    env.ts
    posthog.ts
  hooks/
  types/
  styles/
prisma/
  schema.prisma
public/
.env.example
```

---

## Schéma Prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  USER
  ADMIN
  MODERATOR
}

enum CallStatus {
  PENDING
  RINGING
  ACTIVE
  COMPLETED
  FAILED
  BLOCKED
}

enum Visibility {
  PRIVATE
  UNLISTED
  PUBLIC
}

enum CharacterCategory {
  ROMANTIC
  CHAOTIC
  CORPORATE
  NPC
  HORROR
  CRINGE
  GAMER
  WEIRD
}

enum ModerationStatus {
  PENDING
  APPROVED
  REJECTED
}

model User {
  id              String @id @default(cuid())
  email           String @unique
  username        String @unique
  passwordHash    String
  image           String?
  role            UserRole @default(USER)

  credits         Int @default(5)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  calls           Call[]
  scenarios       Scenario[]
  reactions       Reaction[]
  comments        Comment[]
  purchases       Purchase[]
}

model Character {
  id                String @id @default(cuid())
  name              String
  slug              String @unique
  description       String
  promptSystem      String
  previewAudioUrl   String
  avatarUrl         String
  category          CharacterCategory

  elevenLabsVoiceId String

  isFeatured        Boolean @default(false)

  createdAt         DateTime @default(now())

  scenarios         Scenario[]
}

model Scenario {
  id                String @id @default(cuid())

  creatorId         String
  creator           User @relation(fields: [creatorId], references: [id])

  characterId       String
  character         Character @relation(fields: [characterId], references: [id])

  title             String
  description       String
  openingMessage    String
  aiInstructions    String

  visibility        Visibility @default(PRIVATE)

  moderationStatus  ModerationStatus @default(PENDING)

  playCount         Int @default(0)
  likeCount         Int @default(0)

  createdAt         DateTime @default(now())

  calls             Call[]
  comments          Comment[]
  reactions         Reaction[]

  @@index([creatorId])
  @@index([characterId])
  @@index([visibility])
}

model Call {
  id                String @id @default(cuid())

  userId            String
  user              User @relation(fields: [userId], references: [id])

  scenarioId        String
  scenario          Scenario @relation(fields: [scenarioId], references: [id])

  phoneNumber       String

  status            CallStatus @default(PENDING)

  durationSeconds   Int @default(0)

  recordingUrl      String?
  transcript        Json?

  costCredits       Int

  createdAt         DateTime @default(now())
  endedAt           DateTime?

  @@index([userId])
  @@index([scenarioId])
}

model Reaction {
  id          String @id @default(cuid())

  userId      String
  scenarioId  String

  emoji       String

  user        User @relation(fields: [userId], references: [id])
  scenario    Scenario @relation(fields: [scenarioId], references: [id])

  createdAt   DateTime @default(now())

  @@unique([userId, scenarioId, emoji])
}

model Comment {
  id          String @id @default(cuid())

  userId      String
  scenarioId  String

  content     String

  user        User @relation(fields: [userId], references: [id])
  scenario    Scenario @relation(fields: [scenarioId], references: [id])

  createdAt   DateTime @default(now())
}

model Purchase {
  id                String @id @default(cuid())

  userId            String
  user              User @relation(fields: [userId], references: [id])

  stripePaymentId   String @unique

  creditsPurchased  Int

  createdAt         DateTime @default(now())
}
```

---

## API / Procedures tRPC

## auth.register

* Input :

```ts
{
  email: z.string().email(),
  username: z.string().min(3).max(20),
  password: z.string().min(8)
}
```

* Output :

```ts
{
  userId: string
}
```

* Erreurs :

  * CONFLICT si email existe
  * CONFLICT si username existe

---

## auth.login

* Géré uniquement via next-auth credentials provider

---

## character.list

* Public : oui

* Input :

```ts
{
  category?: z.nativeEnum(CharacterCategory)
}
```

* Output :

```ts
Character[]
```

---

## scenario.create

* Protégé : oui

* Input :

```ts
{
  characterId: z.string(),
  title: z.string().min(3).max(80),
  description: z.string().max(300),
  openingMessage: z.string().max(300),
  aiInstructions: z.string().max(3000),
  visibility: z.nativeEnum(Visibility)
}
```

* Output :

```ts
{
  scenarioId: string
}
```

* Effets :

  * passe dans pipeline de modération IA
  * refuse contenu NSFW, politique, harcèlement, scam

---

## scenario.feed

* Public : oui

* Pagination cursor obligatoire

* Input :

```ts
{
  cursor?: z.string(),
  limit: z.number().min(1).max(20).default(10)
}
```

* Output :

```ts
{
  items: Scenario[],
  nextCursor?: string
}
```

---

## call.start

* Protégé : oui

* Rate limit obligatoire

* Input :

```ts
{
  scenarioId: z.string(),
  phoneNumber: z.string(),
  maxDurationSeconds: z.number().min(30).max(300)
}
```

* Output :

```ts
{
  callId: string,
  estimatedCredits: number
}
```

* Effets :

  * décrémente crédits
  * crée call Twilio
  * initialise streaming STT/TTS
  * démarre orchestration conversation IA

* Erreurs :

  * FORBIDDEN si crédits insuffisants
  * TOO_MANY_REQUESTS si rate limit atteint
  * BAD_REQUEST si numéro invalide

---

## call.history

* Protégé : oui

* Pagination cursor

---

## call.replay

* Protégé : oui

* Retourne :

```ts
{
  recordingUrl: string,
  transcript: TranscriptChunk[]
}
```

---

## community.react

* Protégé : oui

* Toggle reaction

---

## billing.createCheckout

* Protégé : oui

* Stripe checkout session

---

## admin.moderationQueue

* ADMIN uniquement

---

## Phases d'implémentation

> RÈGLE ABSOLUE :
> Chaque phase doit compiler complètement avant la suivante.
> Exécuter :
>
> * npm run build
> * npm run typecheck
> * npm run lint
>
> à la fin de CHAQUE phase.

---

### Phase 1 — Fondations

* [ ] Initialiser Next.js App Router
* [ ] Configurer TypeScript strict
* [ ] Installer Tailwind + shadcn
* [ ] Configurer Prisma
* [ ] Créer schéma complet
* [ ] Générer migrations
* [ ] Configurer PostgreSQL
* [ ] Setup tRPC v11
* [ ] Setup next-auth v5
* [ ] Setup Redis Upstash
* [ ] Setup Stripe SDK
* [ ] Setup Twilio SDK
* [ ] Setup OpenAI SDK
* [ ] Setup ElevenLabs SDK
* [ ] Setup Deepgram SDK
* [ ] Configurer variables d’environnement
* [ ] Middleware auth
* [ ] Middleware rate limiting
* [ ] Middleware anti abuse

---

### Phase 2 — Core business logic

* [ ] CRUD scénarios
* [ ] Feed communautaire
* [ ] Réactions/comments
* [ ] Historique appels
* [ ] Décompte crédits
* [ ] Pipeline modération IA
* [ ] Validation Zod partout
* [ ] Gestion TRPCError complète
* [ ] Protection anti spam
* [ ] Détection prompts interdits
* [ ] Blocage contenu politique
* [ ] Blocage célébrités réelles

---

### Phase 3 — Téléphonie IA

* [ ] Intégration Twilio Voice
* [ ] Streaming audio temps réel
* [ ] Génération TTS
* [ ] Transcription STT
* [ ] Conversation state machine
* [ ] Timeout appels
* [ ] Retry stratégie Twilio
* [ ] Gestion raccrochage
* [ ] Sauvegarde replay
* [ ] Génération transcript
* [ ] Calcul coût réel appel
* [ ] Synchronisation crédits

---

### Phase 4 — UI

* [ ] Landing page virale
* [ ] Hero avec démo audio
* [ ] Explorer feed
* [ ] Dashboard utilisateur
* [ ] Créateur scénario
* [ ] Lecteur replay audio
* [ ] Community page
* [ ] Responsive mobile
* [ ] Loading skeletons
* [ ] Toasts erreurs/succès
* [ ] Empty states
* [ ] Modals confirmation
* [ ] Stripe checkout UI

---

### Phase 5 — Social loops & viralité

* [ ] Génération clips partageables
* [ ] OpenGraph dynamique
* [ ] Trending feed
* [ ] Top scenarios
* [ ] Like system
* [ ] Partage Discord/Twitter/TikTok
* [ ] Daily featured scenarios
* [ ] Badge système
* [ ] Leaderboard creators

---

### Phase 6 — Sécurité & conformité

* [ ] Consent disclaimer obligatoire
* [ ] Terms page
* [ ] Privacy page
* [ ] Signalement abus
* [ ] Blacklist numéros
* [ ] Limites appels quotidiennes
* [ ] Détection spam patterns
* [ ] Audit logs admin
* [ ] Suppression données utilisateur
* [ ] GDPR export endpoint

---

## Critères de done

Le projet est terminé UNIQUEMENT quand :

1. `npm run build` passe sans erreur
2. `npm run typecheck` passe sans erreur
3. `npm run lint` passe sans warning critique
4. Aucun TODO/FIXME/placeholder
5. Toutes les routes protégées fonctionnent
6. Toutes les variables sont documentées dans `.env.example`
7. Les appels IA fonctionnent réellement de bout en bout
8. Les crédits sont synchronisés correctement
9. Les webhooks Stripe fonctionnent
10. Les webhooks Twilio fonctionnent
11. Les transcripts sont persistés
12. Les replays audio sont accessibles
13. La modération bloque :

    * célébrités réelles
    * politique
    * NSFW
    * scam
    * harcèlement
14. Le feed communautaire est paginé
15. Les scénarios publics sont modérés avant publication
16. Le site est responsive mobile
17. Les appels sont rate limited
18. Les utilisateurs non authentifiés sont redirigés
19. Les crédits ne peuvent jamais devenir négatifs
20. Les appels échoués remboursent automatiquement les crédits

---

# Positionnement recommandé (IMPORTANT)

Ne PAS vendre le produit comme :

* “anonymous prank calls”
* “celebrity voice prank”
* “spoof calling”

Positionnement recommandé :

* “AI Social Chaos”
* “Interactive AI Characters”
* “Party AI”
* “Playable AI Conversations”
* “AI Phone Game”
* “Social Simulation Platform”

Le succès long terme viendra :

* du contenu communautaire,
* du partage viral,
* des templates,
* du feed social,
* des réactions utilisateurs,
* des clips replay,
* des scénarios récurrents. ([Reddit][2])

---

# Améliorations stratégiques par rapport à prankcaller.fun

## 1. Éviter le piège “one-time gimmick”

Le principal risque du modèle prankcaller.fun :

* usage ponctuel,
* faible rétention,
* fatigue rapide du gimmick. ([Reddit][2])

Ajouter :

* saisons de scénarios,
* events communautaires,
* défis hebdomadaires,
* trending calls,
* creator economy.

---

## 2. Supprimer les célébrités réelles

Risque légal énorme :

* voix clonées,
* DMCA,
* droit à l’image,
* réputation. ([Reddit][2])

Remplacer par :

* archétypes originaux,
* personnages absurdes,
* NPCs,
* personnages style sitcom.

---

## 3. Ajouter une boucle sociale

Le site concurrent manque :

* de communauté,
* d’identité,
* de viral loops. ([Reddit][2])

Ajouter :

* profils creators,
* playlists,
* clips,
* remixes,
* commentaires,
* réactions live.

---

## 4. Transformer les appels en “mini jeux”

Exemples :

* convaincre un NPC
* survive the awkward call
* fake recruiter simulator
* AI ex girlfriend chaos
* scammer vs scammer
* cursed customer support

---

## 5. Créer des modes viraux

* Twitch mode
* Discord room mode
* Multiplayer listening
* Vote en direct
* “Continue the call” collaborative mode

---

## Recommandation finale

Créer :

* une plateforme sociale de conversations IA,
  PAS
* un simple prank caller.

C’est ce qui permettra :

* rétention,
* UGC,
* viralité,
* contenu infini,
* différenciation durable.

[1]: https://prankcaller.fun/call?utm_source=chatgpt.com "AI Prank Calls | AI Prank Call"
[2]: https://www.reddit.com/r/buildinpublic/comments/1tlvevm/started_building_an_ai_prank_call_site_and_didnt/?utm_source=chatgpt.com "Started building an AI prank call site and didn’t expect people to actually keep using it"
