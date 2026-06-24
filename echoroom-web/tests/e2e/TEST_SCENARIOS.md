# EchoRoom — Scénarios de Test E2E

> **Statut :** Plan de couverture E2E — chaque scénario listé doit être codé dans un fichier `.spec.ts`.
> ✅ = déjà codé, ⬜ = à coder  
> **Mise à jour : 24 juin 2026 — +1060 scénarios Round 2 intégrés (analyse infrastructure, tRPC, UI, mobile, CI/CD, transversal)**  
> **Révision : 24 juin 2026 — +389 scénarios issus de SCENARIOS_MANQUANTS.md (analyse statique du code source)**  
> **Révision Round 2 : 24 juin 2026 — +1064 scénarios supplémentaires (ROUND2_AGENT1-5) — Total: 1250 scénarios (190 ✅ + 1060 ⬜)**

---

## 1. Landing Page (`/`)

### ✅ Existant (`landing.spec.ts` + `home.spec.ts`)
- [x] Chargement sans erreurs console JS
- [x] Section Hero visible avec h1
- [x] Boutons CTA (Commencer gratuitement, Voir la bibliothèque)
- [x] Section stats avec métriques (50K+ appels générés)
- [x] Section "Scénario à la une"
- [x] Section Tarifs avec cartes de prix
- [x] Footer visible avec liens légaux
- [x] Barre de navigation fonctionnelle
- [x] Responsive sur viewport mobile
- [x] Structure HTML valide (head, body, main)
- [x] Titre de page correct

### ⬜ À coder
- [ ] Section démo audio (DemoAudioForm) — lecture, pause
- [ ] Navigation vers `/pricing` depuis la landing
- [ ] Navigation vers `/explore` depuis la landing
- [ ] Lien "Accueil" dans le footer fonctionnel
- [ ] Dark mode toggle depuis la landing
- [ ] Meta tags OG (OpenGraph) présents
- [ ] Section démo audio — lecture audible
- [ ] Scroll fluide vers les sections (CTAs anchors)
- [ ] Section "Comment ça marche" visible
- [ ] LiveCounter animation avec variation aléatoire
- [ ] Animations fade-in au scroll (HeroFeatures, DemoAudioForm)
- [ ] Alternance automatique des HeroFeatures

---

## 2. Authentication

### `/login`

#### ✅ Existant (`auth.spec.ts`)
- [x] Chargement de la page login
- [x] Champ email visible
- [x] Champ mot de passe visible
- [x] Bouton submit visible
- [x] Lien "Mot de passe oublié ?"
- [x] Lien d'inscription
- [x] Navigation vers `/register`
- [x] Branding EchoRoom visible
- [x] Validation navigateur sur formulaire vide
- [x] Message d'erreur sur identifiants invalides

#### ⬜ À coder
- [ ] Connexion réussie avec credentials valides
- [ ] Redirection vers dashboard après login
- [ ] Session persistée après refresh
- [ ] Déconnexion (logout)
- [ ] Rate limiting sur tentative de connexion
- [ ] Masquage/affichage du mot de passe
- [ ] Accessibilité — focus order, aria labels
- [ ] **🔴 Bug B1** — Email case sensitivity : connexion avec `USER@Example.com` pour un compte créé avec `user@example.com` → doit réussir (normalisation Prisma case-sensitive)
- [ ] Leading/trailing whitespace dans l'email : `" user@example.com "` → doit être normalisé
- [ ] Double-clic sur le bouton Connexion → une seule tentative (prevent double submit)
- [ ] Timing attack protection : délai constant entre email existant et non existant
- [ ] Rate limiting login par email : 5 tentatives/15min → 6ème retourne 429

### `/register`

#### ⬜ À coder
- [ ] Chargement de la page register
- [ ] Tous les champs visibles (email, username, password, consent)
- [ ] Validation email (format invalide)
- [ ] Validation username (min 3, max 20, caractères autorisés)
- [ ] Validation mot de passe (min 8, majuscule, minuscule, chiffre)
- [ ] Case à cocher consent obligatoire
- [ ] Inscription réussie → redirection dashboard
- [ ] Email déjà existant → erreur CONFLICT
- [ ] Username déjà existant → erreur CONFLICT
- [ ] Email jetable bloqué
- [ ] Mot de passe trop faible visuellement (PasswordStrengthMeter)
- [ ] Lien vers la page login
- [ ] Unicode/emoji dans le username : `test👨‍💻user` → accepté ou rejeté proprement (pas de crash)
- [ ] Double-clic sur le bouton S'inscrire → une seule tentative
- [ ] **🟡 P9** — Rate limiting register : 3 inscriptions/heure → 4ème retourne 429
- [ ] Disposable email checker : 24 domaines jetables bloqués

### `/forgot-password`

#### ⬜ À coder
- [ ] Chargement de la page forgot-password
- [ ] Champ email visible
- [ ] Validation email (format invalide)
- [ ] Email non existant → erreur
- [ ] Email existant → confirmation "email envoyé"
- [ ] Lien retour vers login

### `/reset-password`

#### ⬜ À coder
- [ ] Chargement de la page avec token valide
- [ ] Token invalide → erreur
- [ ] Token expiré → erreur
- [ ] Token déjà utilisé (réutilisé) → erreur "token déjà consommé"
- [ ] Nouveau mot de passe valide (min 8, majuscule, minuscule, chiffre)
- [ ] Confirmation du mot de passe
- [ ] Mismatch confirmation → erreur
- [ ] Réinitialisation réussie → redirection login

---

## 3. Navigation

### ✅ Existant (`navigation.spec.ts`)
- [x] Barre de navigation visible sur home
- [x] Bouton Connexion pour utilisateur non auth
- [x] Bouton S'inscrire pour utilisateur non auth
- [x] Navigation vers /explore
- [x] Navigation vers /pricing
- [x] Navigation vers /login
- [x] Navigation vers /register
- [x] Retour à l'accueil via branding
- [x] Menu mobile sur petit viewport
- [x] Navigation depuis menu mobile

### ⬜ À coder
- [ ] Menu utilisateur connecté (Dashboard, Library, Settings, Logout)
- [ ] Header différent selon rôle (USER vs ADMIN)
- [ ] Protection 404 pour routes inexistantes
- [ ] **🟡 P13** — callbackUrl : navigation vers `/library` sans auth → login → redirection vers `/library`

---

## 4. Explore / Feed

### ✅ Existant (`explore.spec.ts`)
- [x] Titre de page visible
- [x] Champ de recherche visible
- [x] Recherche accepte du texte
- [x] Tous les filtres catégorie visibles
- [x] Activation d'une catégorie au clic
- [x] Boutons de tri visibles (Chronologique, Tendance, Top)
- [x] Changement de tri actif
- [x] Cartes scénario OU état vide
- [x] Lien retour Accueil
- [x] Bouton Connexion pour utilisateur non auth

### ⬜ À coder
- [ ] Pagination (load more / infinite scroll)
- [ ] Recherche par texte filtrée (si implémentée)
- [ ] Recherche sans résultat → message "Aucun résultat"
- [ ] Recherche avec caractères spéciaux (HTML, SQL) — pas de crash
- [ ] Recherche avec chaîne vide → résultats normaux
- [ ] Redirection vers `/scenario/[id]` au clic sur une carte
- [ ] Affichage des catégories depuis l'API
- [ ] Changement de tri recharge les résultats
- [ ] État loading (skeleton)
- [ ] État erreur API
- [ ] URL synchronisée avec les paramètres de recherche (query params)
- [ ] Debounce recherche 300ms côté client
- [ ] "Surprise-moi" mode chaos : sélection aléatoire d'un scénario

---

## 5. Scenario Detail (`/scenario/[id]`)

### ✅ Existant (`scenario.spec.ts` + `scenario-detail.spec.ts`)
- [x] 404 pour ID inexistant
- [x] 404 pour segment ID vide
- [x] Section commentaires visible
- [x] Reaction bar visible
- [x] Titre du scénario visible
- [x] Lien retour communauté
- [x] Route gérée pour scénario valide (status < 400)
- [x] Skeleton loading state (animate-pulse)
- [x] CTA section visible (Démarrer l'appel / Connectez-vous)
- [x] Section "Scénarios similaires" ou section associée visible

### ⬜ À coder
- [ ] Détails du scénario (description, opening message, character)
- [ ] Loading state avec skeleton (h6, h10, h4, h4, 3x h20)
- [ ] Error state avec AlertTriangle + "Réessayer"
- [ ] Null/not-found state avec lien communauté
- [ ] Avatar personnage avec image/fallback initiales
- [ ] Stats row (likes, plays, comments) avec formatNumber
- [ ] Bouton d'appel visible (si auth + crédits suffisants)
- [ ] Redirection vers login si pas auth et clic sur appel
- [ ] Boutons de partage (Discord, Twitter, TikTok, Copy link)
- [ ] ShareButtons — trackShare mutation
- [ ] ReportButton — dialog avec textarea raison
- [ ] ReportButton — min 10 char validation
- [ ] ReportButton — submit → reportAbuse mutation
- [ ] Section clips audio
- [ ] Likes — toggle reaction
- [ ] Commentaires — posting (si auth)
- [ ] Commentaires — non auth: "Connectez-vous" link
- [ ] Commentaires — Enter key soumet
- [ ] Commentaires — liste paginée
- [ ] Commentaires — admin moderate button
- [ ] ReactionBar — emoji list depuis API
- [ ] ReactionBar — click emoji toggle like
- [ ] ReactionBar — "+" button → EmojiPicker (8 emojis)
- [ ] Related scenarios (max 3 cards)
- [ ] ClipCreator — loading skeleton
- [ ] ClipCreator — "Aucun appel" empty state
- [ ] ClipCreator — selecteur appel, validation temps
- [ ] Signalement d'abus
- [ ] Meta tags OG dynamiques
- [ ] Badge du créateur visible
- [ ] Compteur de lectures / likes
- [ ] Information de crédit manquant si solde insuffisant
- [ ] Visibilité privée/unlisted masquée aux non-créateurs
- [ ] Scénario supprimé → 404
- [ ] Scénario en modération → message "en cours de validation"
- [ ] Visibilité PRIVATE : masqué aux utilisateurs non créateurs (même avec l'URL)
- [ ] ReactionBar — mise à jour optimiste (UI change immédiatement)
- [ ] ShareButtons — popup bloqué par le navigateur (fallback gestion)
- [ ] ShareButtons — trackShare mutation appelée

---

## 6. Dashboard (`/dashboard`)

### ✅ Existant (`dashboard.spec.ts` + `dashboard-guard.spec.ts` + `dashboard-content.spec.ts`)
- [x] Redirection vers login si non auth
- [x] Route `/dashboard` gérée (status < 400, pas 404)
- [x] Routes `/create`, `/library`, `/history`, `/settings`, `/billing`, `/community`, `/leaderboard` gérées
- [x] Route `/profile/[username]` gérée (status < 400, pas 404)
- [x] Statut HTTP 307/302 avec header Location vers `/login`
- [x] Solde de crédits affiché
- [x] Liste des appels récents
- [x] Nombre d'appels aujourd'hui
- [x] Liste des scénarios récents
- [x] Lien vers création de scénario
- [x] Lien vers historique
- [x] Lien vers library
- [x] KPI visible (appels aujourd'hui, crédits restants, scénarios créés)
- [x] Skeleton de chargement pendant le fetch
- [x] Erreur API → message d'erreur sans bloquer la page

### ⬜ À coder (nouveaux scénarios)
- [ ] FeaturedScenario s'affiche (loading → contenu ou null)
- [ ] Message motivationnel "En pleine forme !" si >5 appels aujourd'hui
- [ ] Message "Bien joué !" si >0 appels aujourd'hui
- [ ] Lien "Créer mon premier →" si 0 scénario créé
- [ ] Surprise Me navigue vers `/explore?sort=TRENDING`
- [ ] Actions rapides (4 cards) visibles et cliquables
- [ ] BadgeGrid se charge et affiche les badges
- [ ] BadgeGrid état vide "Aucun badge pour le moment"
- [ ] BadgeGrid état erreur
- [ ] **🔴 Bug B4** — Échec d'UN widget ne doit pas cacher les autres (Promise.all sur 4 KPIs)
- [ ] Refetch des données après création d'un scénario depuis le dashboard
- [ ] Session refresh : rafraîchissement de la page conserve l'état dashboard

---

## 7. Create Scenario (`/create`)

### ✅ Existant (`create.spec.ts`)
- [x] Redirection vers login si non auth
- [x] Grille de sélection de personnage visible
- [x] Tous les champs visibles (title, description, opening, instructions IA)
- [x] Attributs des champs (required, minlength, maxlength)
- [x] Toggle visibilité PUBLIC/PRIVÉ avec feedback visuel
- [x] Lien retour (flèche) vers `/dashboard`
- [x] Bouton Annuler vers `/dashboard`
- [x] Compteur de caractères instructions IA ({n}/3000)

### ⬜ À coder
- [ ] Création réussie → redirection vers le scénario
- [ ] Erreur modération (contenu bloqué)
- [ ] Génération de script IA (generateScript) — loading spinner
- [ ] Génération de script IA — succès → auto-remplissage
- [ ] Génération de script IA — erreur → toast erreur
- [ ] Bouton génération désactivé si aucun personnage sélectionné
- [ ] Bouton submit désactivé si aucun personnage sélectionné
- [ ] Bouton submit spinner pendant mutation
- [ ] Validation title (min 3, max 80)
- [ ] Validation description (max 300)
- [ ] Validation openingMessage (max 300)
- [ ] Rate limiting (10 créations/heure)
- [ ] Spam detection
- [ ] Double soumission évitée (bouton désactivé après clic)
- [ ] Brouillon persisté localement si navigation accidentelle
- [ ] Character list loading skeleton (4 skeletons)
- [ ] Character list empty state (aucun personnage disponible)
- [ ] **🟠 Bug B6** — Draft localStorage non effacé au clic "Annuler" → naviguer vers /create après annulation doit montrer un formulaire vide
- [ ] XSS dans les instructions IA : injection de `<script>` doit être échappée
- [ ] Draft localStorage corrompu (JSON invalide) → doit ignorer le draft, pas crasher
- [ ] Quota localStorage dépassé → gestion d'erreur silencieuse
- [ ] Génération IA timeout (30s) → toast d'erreur + réessayable

---

## 8. Library (`/library`)

### ✅ Existant (`library.spec.ts`)
- [x] Redirection vers login si non auth
- [x] Route gérée (status < 400, pas 404)
- [x] Titre "Bibliothèque" visible
- [x] Sous-titre "Vos scénarios sauvegardés et vos créations" visible
- [x] Bouton "Nouveau" avec href="/create"
- [x] Champ recherche avec placeholder
- [x] Recherche accepte du texte
- [x] Bouton effacer recherche (X) apparaît après avoir tapé
- [x] Bouton effacer réinitialise la recherche

### ⬜ À coder
- [ ] Liste des scénarios de l'utilisateur
- [ ] Pagination (cursor-based) — "Voir plus"
- [ ] "Voir plus" spinner pendant chargement
- [ ] État vide avec deux CTAs (Créer / Explorer)
- [ ] Recherche filtrée (côté client)
- [ ] État "Aucun résultat" pour recherche sans résultat
- [ ] ScenarioCard affiche badge, titre, créateur, compteurs
- [ ] Modification d'un scénario
- [ ] Suppression d'un scénario
- [ ] Changement de visibilité
- [ ] Recherche avec caractères spéciaux regex (ex: `.*+?`) → pas de crash, interprété comme texte littéral
- [ ] Pagination combinée avec recherche filtrée
- [ ] Suppression rollback (optimistic update) : scénario retiré immédiatement, restauré si erreur API

---

## 9. History (`/history`)

### ✅ Existant (`history.spec.ts`)
- [x] Redirection vers login si non auth
- [x] Route gérée (status < 400, pas 404)
- [x] Titre "Historique des appels" visible
- [x] Sous-titre visible
- [x] Champ recherche avec placeholder
- [x] Recherche accepte du texte
- [x] Bouton effacer recherche (X) apparaît après avoir tapé

### ⬜ À coder
- [ ] Liste des appels récents avec statuts, durée, date
- [ ] Pagination — "Voir plus"
- [ ] "Voir plus" spinner pendant chargement
- [ ] État vide avec CTA "Créer un appel"
- [ ] Lien replay visible seulement pour COMPLETED
- [ ] Statut affiché en français (Terminé, Échoué)
- [ ] Durée formatée
- [ ] Recherche filtrée côté client
- [ ] État "Aucun résultat" pour recherche sans résultat
- [ ] Statut BLOCKED visible dans la liste
- [ ] Durée nulle (0s) → affichée correctement sans division par zéro
- [ ] Durée extrême (>24h) → formatée correctement
- [ ] **🟡 Bug B12** — Filtrage par statut en français : chercher "Terminé" doit trouver les appels COMPLETED

---

## 10. Profile (`/profile/[username]`)

### ✅ Existant (`profile.spec.ts`)
- [x] Redirection vers login si non auth
- [x] Route `/profile/[username]` gérée (status < 400)
- [x] Username inexistant → 404 ou redirect géré
- [x] Pattern de route existe (pas 404 framework)

### ⬜ À coder
- [ ] Profil public d'un utilisateur (header, avatar, stats)
- [ ] Cartes stats (scénarios, appels)
- [ ] Fil d'activité (mix scénarios + appels)
- [ ] Activity item → lien vers détail scénario/call
- [ ] Badges visibles (si le user a des badges)
- [ ] État vide "Pas encore d'activité"
- [ ] Limite d'activité indiquée quand > 10 items
- [ ] 404 pour username inexistant (vérification navigateur)
- [ ] Modification du profil (si propriétaire)
- [ ] Changement de username
- [ ] Stats à zéro : "0 scénarios", "0 appels" affiché correctement
- [ ] Activité mixée (scénarios + appels) triée par date descendante
- [ ] formatRelativeDate edge cases : "il y a quelques secondes", "il y a 1 minute", dates futures

---

## 11. Settings (`/settings`)

### ✅ Partiellement existant (`consent.spec.ts` + `gdpr-settings.spec.ts`)
- [x] Redirection vers login si non auth
- [x] Route `/settings` gérée (status < 400)
- [x] Section Profil (heading, username input, email disabled)
- [x] Bouton "Enregistrer" visible (quand authentifié)
- [x] Section Apparence visible
- [x] Section Zone de danger visible
- [x] Export données visible ("Exporter mes données")
- [x] Suppression compte visible ("Supprimer mon compte")
- [x] Dialogue de suppression avec input "SUPPRIMER"
- [x] Bouton confirm désactivé initialement
- [x] Typage "SUPPRIMER" active le bouton
- [x] Texte erroné garde le bouton désactivé (NON, RETI, retirer)
- [x] Dialogue de consent visible
- [x] Validation confirmation "RETIRER"
- [x] Fermeture dialogue (Escape)

### ⬜ À coder
- [ ] Modification du profil (username) — mutation + toast succès/erreur
- [ ] Changement de mot de passe
- [ ] Validation ancien mot de passe
- [ ] Export GDPR (profile.exportData) — POST /api/user/export, téléchargement JSON
- [ ] Export — état chargement "Export..."
- [ ] Export — erreur → toast erreur
- [ ] Suppression de compte — succès → toast + signOut + redirect /
- [ ] Suppression de compte — erreur → toast erreur
- [ ] Bouton "Enregistrer" désactivé quand pas de changements
- [ ] Spinner sur bouton Enregistrer pendant mutation
- [ ] Retrait de consentement via RETIRER → logout + redirect home
- [ ] Réacceptation du consentement (reconsent)
- [ ] Affichage du statut de consentement
- [ ] Affichage du statut de suppression
- [ ] **🔴 Bug B3** — Bouton "Enregistrer" doit se désactiver quand l'username revient à sa valeur initiale
- [ ] **🟠 Bug P7** — deleteMyAccount doit vérifier les appels actifs avant suppression (actuellement pas de guard)
- [ ] **🟠 Bug P8** — Changement de mot de passe : documenté mais NON codé dans l'UI (SettingsPageClient.tsx)
- [ ] Username déjà pris (erreur P2002 Prisma) → toast "Ce nom d'utilisateur est déjà pris"
- [ ] Export données vide (aucun scénario/call) → JSON valide avec tableaux vides
- [ ] Export données massives (>10MB) → téléchargement réussi sans timeout
- [ ] Double clic "Supprimer mon compte" → une seule mutation (prevent double soumission)

---

## 12. Community (`/community`)

### ✅ Existant (`community.spec.ts`)
- [x] Redirection vers login si non auth
- [x] Route gérée (status < 400, pas 404)
- [x] Titre "Communauté" visible
- [x] Sous-titre visible
- [x] Feed chargé (cartes scénario OU "Aucun post pour le moment")
- [x] Input commentaire avec placeholder visible
- [x] Bouton envoi commentaire visible

### ⬜ À coder
- [ ] Fil d'actualité communautaire (feed)
- [ ] ReactionBar avec émoticônes chargées
- [ ] Commentaire — Enter key soumet
- [ ] Commentaire — envoi réussi → input vidé + toast
- [ ] Commentaire — erreur → input préservé + toast erreur
- [ ] Bouton envoi désactivé quand input vide
- [ ] Compteur commentaires lié au détail scénario (#comments)
- [ ] Pagination du feed
- [ ] Signalement d'abus depuis un post
- [ ] DataLoader loading skeleton
- [ ] DataLoader état erreur
- [ ] Réactions en temps réel (optimistic)
- [ ] Commentaire préservé dans l'input après une erreur d'envoi
- [ ] Enter key soumet le commentaire (Shift+Enter = nouvelle ligne)
- [ ] ReactionBar intégrée dans les posts du feed

---

## 13. Leaderboard (`/leaderboard`)

### ✅ Existant (`leaderboard.spec.ts`)
- [x] Redirection vers login si non auth
- [x] Route gérée (status < 400, pas 404)
- [x] Titre "Classement" visible
- [x] Sous-titre visible
- [x] Tabs "Scénarios" et "Créateurs" visibles
- [x] Filtres période "Tout", "Cette semaine", "Ce mois" visibles
- [x] Tab "Scénarios" actif par défaut

### ⬜ À coder
- [ ] Top scénarios (période : ALL, WEEK, MONTH)
- [ ] Top créateurs (période : ALL, WEEK, MONTH)
- [ ] Changement d'onglet → requête correspondante
- [ ] Changement période → refetch données
- [ ] LeaderboardTable loading skeleton (5 lignes)
- [ ] LeaderboardTable état vide
- [ ] Top 3 items highlightés (or, argent, bronze)
- [ ] Icônes trophée pour top 3
- [ ] Avatar avec initiales fallback
- [ ] "par {username}" pour scénarios
- [ ] "{count} scénario(s)" pour créateurs
- [ ] Changement d'onglet désactive l'autre query (pas de double chargement)
- [ ] Ranking fallback : ex-aequo gérés correctement (même rang)
- [ ] Top 3 highlightés avec couleurs (or, argent, bronze)

---

## 14. Billing (`/billing`)

### ✅ Existant (`billing.spec.ts`)
- [x] Redirection vers login si non auth
- [x] Route gérée (status < 400, pas 404)
- [x] Titre "Crédits & Facturation" visible
- [x] Section "Acheter des crédits" visible
- [x] Packs de crédits visibles (10, 50, 200, 500)
- [x] Prix des packs visibles
- [x] Badge "Populaire" sur le pack 50 crédits
- [x] Texte historique vide "Aucun achat pour le moment"

### ⬜ À coder
- [ ] Solde de crédits affiché (Badge)
- [ ] Bouton "Acheter" désactivé pendant mutation checkout
- [ ] Checkout mutation succès → window.location.href redirigé
- [ ] Historique des achats — scroll-to-packs button
- [ ] Crédits loading state (skeleton)
- [ ] Stripe webhook — checkout.session.completed
- [ ] Stripe webhook — signature invalide → 403
- [ ] Stripe webhook — body > 100KB → 413
- [ ] **🔴 Bug B2** — Historique d'achats : ne doit PAS toujours afficher "Aucun achat" (actuellement texte statique)
- [ ] Retour Stripe muet : paramètre `?success=` ignoré dans l'URL après redirection
- [ ] Cache non invalidé après achat : le solde de crédits doit se mettre à jour immédiatement

---

## 15. Pricing (`/pricing`) — Marketing

### ⬜ À coder
- [ ] Cartes de prix visibles
- [ ] Plans affichés avec leurs features
- [ ] CTA "Commencer" / "S'inscrire" fonctionnel
- [ ] Comparaison des plans

---

## 16. Call Replay (`/call/[callId]`)

### ✅ Existant (`call-replay.spec.ts` + `call-replay-content.spec.ts`)
- [x] Redirection vers login si non auth
- [x] Route gérée (status < 400, pas 404 pour tout callId)
- [x] Route gérée pour UUID format call ID
- [x] 404 pour callId inexistant
- [x] Page heading visible quand accessible

### ⬜ À coder
- [ ] FORBIDDEN si pas le propriétaire
- [ ] ReplayHeader affiche métadonnées (scenario, personnage, durée, statut)
- [ ] AudioPlayer — pas d'enregistrement → "Aucun enregistrement disponible"
- [ ] AudioPlayer — loading → spinner
- [ ] AudioPlayer — erreur → "Chargement impossible"
- [ ] AudioPlayer — play/pause toggle
- [ ] AudioPlayer — seek slider
- [ ] AudioPlayer — contrôles vitesse (0.5x, 0.75x, 1x, 1.5x, 2x)
- [ ] AudioPlayer — bouton download
- [ ] AudioPlayer — affichage temps (current / duration)
- [ ] TranscriptView — loading skeleton
- [ ] TranscriptView — null → "Transcript en cours de traitement..."
- [ ] TranscriptView — empty → "Aucune transcription disponible"
- [ ] TranscriptView — bulles chat (IA gauche, User droite)
- [ ] Création de clip depuis le replay
- [ ] Liste des clips d'un appel avec pagination
- [ ] Suppression d'un clip (si propriétaire)
- [ ] Partage d'un clip
- [ ] **🟠 Bug B5** — AudioPlayer : useEffect ne reset pas l'erreur au changement de recordingUrl (dépendance `[]` au lieu de `[recordingUrl]`)
- [ ] AudioPlayer — cleanup au démontage du composant (pas de fuite mémoire)
- [ ] AudioPlayer — gestion des erreurs réseau pendant le streaming
- [ ] TranscriptView — alternance IA (gauche) / User (droite) avec timestamps

---

## 17. Admin Pages

### ✅ Existant (`admin-guard.spec.ts` + `admin-pages.spec.ts`)
- [x] Redirection `/admin` → login si non auth
- [x] Redirection `/admin/*` → login si non auth
- [x] Toutes les routes admin gérées (status < 400, pas 404)
- [x] Route `/admin/dlq` retourne 404 (inexistante)
- [x] Route inexistante `/admin/xyz` → 404
- [x] Sidebar de navigation admin visible (quand authentifié)

### `/admin/moderation`
#### ⬜ À coder
- [ ] FORBIDDEN pour rôle USER
- [ ] Tabs (Scénarios / Commentaires)
- [ ] File d'attente de modération
- [ ] Approbation d'un scénario
- [ ] Rejet d'un scénario
- [ ] Boutons désactivés pendant mutation
- [ ] File d'attente vide "Tout est modéré"
- [ ] Filtre statut commentaires (PENDING / REJECTED)
- [ ] Approbation/Rejet de commentaire
- [ ] **🟡 P15** — Tab REJECTED manquante pour les scénarios (seulement PENDING filtré)
- [ ] **🟠 Bug B9** — Pagination absente : >50 items dans la file d'attente → items inaccessibles
- [ ] Rôle Moderator : accès à la modération mais pas aux autres pages admin
- [ ] Page non accessible USER → FORBIDDEN (pas juste redirect)

### `/admin/users`
#### ⬜ À coder
- [ ] Liste des utilisateurs
- [ ] Recherche par username/email (debounced 300ms)
- [ ] Bouton effacer recherche (X)
- [ ] Pagination
- [ ] Détail utilisateur (admin.getUserDetail)
- [ ] Carte infos (ID, crédits, appels, consentement)
- [ ] Carte statistiques (scénarios, commentaires, réactions)
- [ ] Utilisateur supprimé affiché barré
- [ ] Badges rôles (Admin, User, Moderator)
- [ ] Suppression utilisateur (admin.deleteUser)
- [ ] État vide / recherche sans résultat
- [ ] Recherche avec <2 caractères : pas de requête envoyée (évite trop de résultats)
- [ ] Suppression d'un utilisateur déjà supprimé → message approprié
- [ ] Pas de deep link vers le détail utilisateur (pas d'URL `/admin/users/[id]`)

### `/admin/reports`
#### ⬜ À coder
- [ ] Filtre tabs (Tous, En attente, Traité, Ignoré)
- [ ] Cartes signalement avec type, statut, reporter, raison
- [ ] Action Dismiss pour PENDING
- [ ] Dismiss désactivé pendant mutation
- [ ] Indicateur "revu par"
- [ ] Raison tronquée à 100 caractères
- [ ] État vide par filtre
- [ ] **🟠 Bug B10** — Pagination absente : >50 signalements → items inaccessibles
- [ ] Dismiss concurrent : 2 admins cliquent en même temps → un seul réussit
- [ ] Pas d'action "Traiter" (seulement Dismiss) → workflow incomplet

### `/admin/blocked-numbers`
#### ⬜ À coder
- [ ] Formulaire (téléphone + raison)
- [ ] Submit bloqué si vide ou pending
- [ ] Mutation → reset formulaire + refetch liste
- [ ] Bouton débloquer
- [ ] Liste (téléphone, raison, bloqueur, date)
- [ ] État vide "Aucun numéro bloqué"
- [ ] Validation téléphone : format invalide (pas de `+` ou trop court) → erreur
- [ ] Déblocage concurrent : 2 admins cliquent "Débloquer" en même temps → un seul mutation réussit
- [ ] Numéro déjà bloqué → message "Ce numéro est déjà dans la liste"

### `/admin/audit`
#### ⬜ À coder
- [ ] Filtre action (dropdown)
- [ ] Filtre entityType (dropdown)
- [ ] Filtre date range (from/to)
- [ ] Bouton reset filtres
- [ ] Tableau (Date, Admin, Action, Type, ID)
- [ ] Pagination curseur "Charger plus"
- [ ] Load more désactivé pendant fetch
- [ ] État vide pour filtres
- [ ] dateFrom > dateTo → validation : doit retourner une erreur
- [ ] Filtres non persistés entre les navigations (pas de query params dans l'URL)
- [ ] Incompatibilité pagination curseur + filtres : changer les filtres reset le curseur

### `/admin/analytics`
#### ⬜ À coder
- [ ] Grille stats (4 cards)
- [ ] Carte roadmap
- [ ] Liens vers autres pages admin
- [ ] Page entièrement statique (placeholder) — aucune donnée live à vérifier

---

## 18. Legal Pages

### ✅ Existant (`legal.spec.ts`)
- [x] `/legal` — page légale avec heading "Mentions légales"
- [x] `/legal` — sections Éditeur, Hébergement, Contact
- [x] `/privacy` — politique de confidentialité
- [x] `/privacy` — sections collecte données, droits, cookies
- [x] `/terms` — conditions d'utilisation
- [x] `/terms` — sections description service, crédits, PI
- [x] `/help` — page d'aide avec heading "Aide & FAQ"
- [x] `/help` — FAQ details/summary présents et cliquables
- [x] Footer liens visibles (Aide, Conditions, Confidentialité)
- [x] Navigation footer → `/help`, `/terms`, `/privacy`
- [x] Lien "Retour à l'accueil" visible
- [x] Branding EchoRoom visible

### ⬜ À coder
- [ ] /help — sections FAQ déroulantes
- [ ] /help — recherche dans l'aide
- [ ] /help — formulaire de contact

---

## 19. API & Webhooks

### ✅ Existant (`rate-limiting.spec.ts` + `webhook-protection.spec.ts` + `api-health.spec.ts`)
- [x] Healthcheck `/api/health` — retour 200
- [x] Healthcheck — JSON body valide (status, timestamp, uptime)
- [x] Session API `/api/auth/session` — null si non auth
- [x] Export API `/api/user/export` — 401 si non auth
- [x] Rate limiting — retour 429 après dépassement (webhook status)
- [x] Rate limiting — header Retry-After présent
- [x] Requête unique non limitée
- [x] Pas de leak d'erreurs internes dans 429
- [x] Reset du rate limit après expiration de fenêtre
- [x] Signature manquante → 403
- [x] Signature invalide → 403
- [x] Signature vide → 403
- [x] Payload > 50KB → 413
- [x] Voice webhook sans signature → 403
- [x] Voice input webhook sans signature → 403
- [x] Stream webhook sans signature → 403
- [x] Content-Type valide accepté

### ⬜ À coder
- [ ] Stripe webhook — signature validation
- [ ] Stripe webhook — idempotence (doublon)
- [ ] Stripe webhook — body size > 100KB → 413
- [ ] Healthcheck — DB connectée
- [ ] Healthcheck — Redis connecté
- [ ] CSRF — requête POST sans origin → 403 (en production)
- [ ] CSRF — origin non autorisée → 403
- [ ] **🟡 P12** — Stripe webhook : checkout.session.completed avec payment_intent null → 400
- [ ] Stripe webhook — idempotence Redis down → graceful degradation (permet le traitement, pas de crash)
- [ ] Stripe webhook — body size limite précisément à 100 000 bytes (100KB)
- [ ] Healthcheck — DB en panne → status 503 degraded
- [ ] Cron : CRON_SECRET absent → 401 (tous les endpoints cron)

---

## 20. Sécurité

### ✅ Existant (`security-headers.test.ts` dans `__tests__/`)
- [x] Headers de sécurité (CSP, HSTS, X-Frame-Options, etc.)

### ⬜ À coder (E2E)
- [ ] Redirection HTTP → HTTPS
- [ ] Cookie session secure (HTTP-only, SameSite)
- [ ] Rate limiting IP sur routes publiques
- [ ] Délai constant sur auth (timing attack protection)
- [ ] **🟡 P11** — CSRF en production : mutation TRPC sans Origin → 403 (allowMissingOrigin false en production)
- [ ] **🟠 Bug B11** — CSRF non protégé pour les requêtes PUT/DELETE/PATCH (Origin + Referer checks)
- [ ] Origin malformée (ex: `not-a-url`) → 400
- [ ] Referer fallback quand Origin est absent → check Referer header

---

## 21. Responsive / Mobile

### ⬜ À coder
- [ ] Toutes les pages s'affichent sur 375px
- [ ] Toutes les pages s'affichent sur 768px (tablette)
- [ ] Menu mobile fonctionne sur toutes les pages
- [ ] Pas de débordement horizontal
- [ ] Formulaires utilisables sur mobile

---

## 22. Accessibilité

### ⬜ À coder
- [ ] Skip link présent et fonctionnel
- [ ] Navigation au clavier (Tab) sur les pages principales
- [ ] Contrast ratio suffisant (vérification basique)
- [ ] Labels ARIA sur les éléments interactifs
- [ ] Messages d'erreur associés aux champs de formulaire

---

## 23. GDPR & Data Privacy

### ⬜ À coder
- [ ] Export de données (profile.exportData) — téléchargement JSON
- [ ] Suppression de compte (profile.deleteMyAccount) avec confirmation "SUPPRIMER"
- [ ] Réacceptation du consentement (user.reconsent)
- [ ] Statut de suppression affiché (user.myDeletionStatus)
- [ ] Accès refusé après retrait de consentement
- [ ] Données déjà anonymisées après purge
- [ ] Purge partielle : certains utilisateurs anonymisés sont purgés, d'autres non (batch cursor)
- [ ] Export après anonymisation : doit retourner une erreur (compte déjà supprimé)
- [ ] Données partiellement nettoyées : vérifier que tous les champs PII sont vidés (email, username, etc.)

---

## 24. Badges & Gamification

### ⬜ À coder
- [ ] Liste des badges disponibles (social.getBadges)
- [ ] Badges du créateur affichés sur le profil public
- [ ] Badges affichés sur la page scénario du créateur
- [ ] Obtention de badge après première action (call, like, commentaire)
- [ ] Badges affichés dans le leaderboard

---

## 25. Audio Clips

### ⬜ À coder
- [ ] Liste des clips d'un utilisateur (social.getClips / clips.listByUser)
- [ ] Suppression d'un clip par le propriétaire
- [ ] Tentative de suppression d'un clip par un autre utilisateur → FORBIDDEN
- [ ] Clip lié à un call dans l'historique
- [ ] Bouton de partage d'un clip

---

## 26. Cron Jobs / Background Jobs

### ⬜ À coder
- [ ] Appel manuel de `/api/cron/gdpr-purge` — vérification des utilisateurs anonymisés
- [ ] Appel manuel de `/api/cron/cleanup-recordings` — nettoyage des enregistrements expirés
- [ ] Appel manuel de `/api/cron/rotate-featured` — rotation du scénario à la une
- [ ] Authentification requise pour les endpoints cron (CRON_SECRET)
- [ ] Erreur 401 si CRON_SECRET manquant ou invalide
- [ ] Lock Redis concurrent : deux exécutions simultanées du même cron → une seule s'exécute
- [ ] Batch cursor : purge par lots de 100 utilisateurs (pas de mémoire insuffisante)
- [ ] Timeout 5 min pour cleanup-recordings (maxDuration = 300)
- [ ] Timeout 30s pour rotate-featured (AbortController)

---

## 27. Loading, Empty & Error States

### ⬜ À coder
- [ ] Squelette de chargement visible sur Dashboard (dashboard.getData)
- [ ] Squelette de chargement visible sur Explore (feed)
- [ ] Squelette de chargement visible sur Scenario Detail
- [ ] Squelette de chargement visible sur Library
- [ ] Squelette de chargement visible sur History
- [ ] État vide "Aucun scénario" dans Library
- [ ] État vide "Aucun appel" dans History
- [ ] État vide "Aucun résultat" dans Explore
- [ ] État vide "Aucun commentaire" sur Scenario Detail
- [ ] Erreur API — toast d'erreur affiché
- [ ] Error boundary — crash d'un composant n'affecte pas le reste de la page
- [ ] Réseau hors ligne — message d'erreur approprié
- [ ] Données vides mais loading terminé → état vide avec CTA
- [ ] Erreur 500 API → toast "Erreur serveur" + retry
- [ ] Cache non invalidé entre modules : dashboard met à jour après création dans /create

---

## 28. Stripe Checkout & Billing

### ⬜ À coder
- [ ] Sélection d'un pack de crédits sur `/billing`
- [ ] Redirection vers Stripe Checkout (createCheckout)
- [ ] Retour de Stripe — confirmation d'achat
- [ ] Solde de crédits mis à jour après achat réussi
- [ ] Stripe webhook — événement checkout.session.completed
- [ ] Stripe webhook — événement charge.refunded (remboursement)
- [ ] Stripe webhook — événement charge.dispute.created (litige)
- [ ] Stripe webhook — signature invalide → 403
- [ ] Stripe webhook — body size > 100KB → 413
- [ ] Historique des achats visible sur `/billing`

---

## 29. Async AI Moderation

### ⬜ À coder
- [ ] Scénario créé avec contenu bloqué → modération asynchrone déclenchée
- [ ] Commentaire posté avec contenu bloqué → modération asynchrone déclenchée
- [ ] Scénario approuvé par modération asynchrone visible dans l'explore
- [ ] Commentaire approuvé par modération asynchrone visible

---

## 30. Spam Detection

### ⬜ À coder
- [ ] Appel téléphonique depuis un numéro bloqué → rejeté
- [ ] Scénario avec contenu spammy → bloqué
- [ ] Commentaire avec contenu spammy → bloqué
- [ ] Ajout d'un numéro à la liste bloquée (admin.blockNumber)
- [ ] Suppression d'un numéro de la liste bloquée (admin.unblockNumber)

---

## 31. Responsive / Mobile (complément)

### ⬜ À coder
- [ ] Dashboard responsive sur 375px
- [ ] Create Scenario responsive sur 375px
- [ ] Library responsive sur 375px
- [ ] History responsive sur 375px
- [ ] Settings responsive sur 375px
- [ ] Community responsive sur 375px
- [ ] Leaderboard responsive sur 375px
- [ ] Billing responsive sur 375px
- [ ] Scenario Detail responsive sur 375px
- [ ] Call Replay responsive sur 375px
- [ ] Admin pages responsive sur 375px
- [ ] Profile responsive sur 375px
- [ ] Pas de débordement horizontal sur 375px pour toutes les pages
- [ ] Formulaires utilisables sur mobile pour toutes les pages avec formulaire
- [ ] Menu mobile fonctionne sur toutes les pages auth

---

## 32. Accessibilité (complément)

### ⬜ À coder
- [ ] Skip link présent et fonctionnel sur toutes les pages
- [ ] Navigation au clavier (Tab) sur les pages principales
- [ ] Focus trap dans les dialogues (ConfirmDialog, modals)
- [ ] Focus restauré après fermeture de dialogue
- [ ] Contrast ratio suffisant (vérification basique)
- [ ] Labels ARIA sur les éléments interactifs
- [ ] Messages d'erreur associés aux champs de formulaire (aria-describedby)
- [ ] Rôles ARIA corrects (bannière, navigation, main, complémentaire)
- [ ] Images avec attribut alt
- [ ] Annonces de chargement pour lecteurs d'écran (aria-live)

---

## 33. Help Page (`/help`)

### ⬜ À coder
- [ ] Chargement de la page help
- [ ] Sections FAQ visibles
- [ ] Liens vers les pages légales
- [ ] Formulaire de contact / support (si présent)
- [ ] Recherche dans l'aide (si implémentée)
- [ ] Responsive sur 375px

---

## 34. Personnages (`characters`)

### ⬜ À coder
- [ ] Liste des personnages chargée (characters.list)
- [ ] Sélection d'un personnage dans le formulaire de création
- [ ] Personnage par slug (characters.getBySlug)
- [ ] Image/picto du personnage visible
- [ ] État vide si aucun personnage disponible

---

## 35. Audio System / Media Streams

### ⬜ À coder
- [ ] Flux audio Twilio (Media Streams) — connexion WebSocket
- [ ] Lecture audio dans le replay
- [ ] Contrôles audio (play, pause, seek, volume)
- [ ] Création de clip audio depuis un replay
- [ ] État erreur si enregistrement non disponible
- [ ] Timeout si appel trop long (> 30 min)

---

## 36. Webhook Idempotency

### ⬜ À coder
- [ ] Stripe webhook — doublon rejeté (idempotency key)
- [ ] Twilio webhook — doublon rejeté
- [ ] Réponse 200 sans traitement pour doublon

---

## 37. CSRF Protection

### ⬜ À coder
- [ ] Requête POST sans origin → 403 (en production)
- [ ] Origin non autorisée → 403
- [ ] Origin autorisée → requête acceptée

---

## 38. OpenGraph Image (`/api/og`)

### ⬜ À coder
- [ ] Image OG générée pour un scénario valide (status 200, type image/png)
- [ ] Image OG pour ID inexistant → 404
- [ ] Cache-Control header présent
- [ ] Meta tags OG sur la page scénario pointant vers l'API

---

## 39. Admin Feature Management

### ⬜ À coder
- [ ] Feature un scénario (admin.featureScenario)
- [ ] Remove featured (admin.removeFeatured)
- [ ] Get featured scenario (admin.getFeaturedScenario)
- [ ] Scénario featured visible sur la landing page
- [ ] Changement de featured rotationné via cron

---

## 40. Share Tracking

### ⬜ À coder
- [ ] Partage via lien copié (social.trackShare)
- [ ] Partage Discord fonctionnel
- [ ] Partage Twitter/X fonctionnel
- [ ] Partage TikTok fonctionnel

---

## 41. API Versioning

### ⬜ À coder
- [ ] Endpoint /api/v1/* fonctionne et retourne des données
- [ ] Endpoint /api/v2/* fonctionne et retourne des données
- [ ] Version inconnue (ex: /api/v3/*) → 404 ou 400
- [ ] Version header manquant → version par défaut utilisée
- [ ] Réponse contient header X-API-Version
- [ ] v1 et unversioned retournent des structures compatibles

---

## 42. IP Rate Limiting

### ⬜ À coder
- [ ] Requêtes répétées sur route publique → 429 après seuil
- [ ] Header Retry-After présent sur 429
- [ ] IP différente non limitée
- [ ] Reset du compteur après expiration de la fenêtre
- [ ] Routes auth non impactées par le rate limiting public

---

## 43. Twilio Webhook Validation

### ⬜ À coder
- [ ] Webhook Twilio avec signature valide → 200
- [ ] Signature Twilio manquante → 403
- [ ] Signature Twilio invalide → 403
- [ ] Voice webhook — TwiML XML bien formé
- [ ] Handle-input webhook — SpeechResult traité
- [ ] Stream webhook — MediaStream connecté
- [ ] Race condition statuts : CallStatus "completed" avant le dernier MediaStream → cohérence assurée
- [ ] SSRF RecordingUrl : URL malveillante bloquée (vérification domaine autorisé)
- [ ] Crédits insuffisants pour démarrer un appel → rejet avant création de la call

---

## 44. Browser Navigation & Deep Linking

### ⬜ À coder
- [ ] Accès direct à `/dashboard` sans auth → redirection login
- [ ] Accès direct à `/settings` sans auth → redirection login
- [ ] Accès direct à `/create` sans auth → redirection login
- [ ] Accès direct à `/library` sans auth → redirection login
- [ ] Accès direct à `/billing` sans auth → redirection login
- [ ] Accès direct à `/history` sans auth → redirection login
- [ ] Accès direct à `/community` sans auth → redirection login
- [ ] Accès direct à `/admin/*` sans auth → redirection login
- [ ] Bouton retour navigateur → page précédente fonctionnelle
- [ ] Bouton avant navigateur → page suivante fonctionnelle
- [ ] URL mise à jour après navigation SPA
- [ ] Rechargement de page conserve l'URL

---

## 45. Auth Session

### ⬜ À coder
- [ ] Session persistée après refresh (cookie valide)
- [ ] Session expirée → redirection login au prochain appel API
- [ ] Session valide dans un second onglet
- [ ] Déconnexion dans un onglet → second onglet déconnecté au refresh
- [ ] GET /api/auth/session retourne l'utilisateur connecté
- [ ] GET /api/auth/session retourne null si non auth
- [ ] **🟡 P14** — Session multi-onglet : déconnexion onglet A → onglet B déconnecté au prochain clic (tokenVersion)
- [ ] Session expirée en cours de SPA : prochain appel API → redirection login + toast
- [ ] callbackUrl préservé après login

---

## 46. Pagination Edge Cases

### ⬜ À coder
- [ ] Dernière page atteinte — plus de bouton "Load more"
- [ ] Curseur nul/non valide → géré sans erreur
- [ ] Changement rapide de page (double clic) pas de doublon
- [ ] Pagination avec 0 résultats → état vide
- [ ] Pagination avec 1 résultat → fonctionne

---

## 47. Password Change

### ⬜ À coder
- [ ] Ancien mot de passe incorrect → erreur
- [ ] Nouveau mot de passe trop faible → erreur (min 8, majuscule, minuscule, chiffre)
- [ ] Confirmation mismatch → erreur
- [ ] Changement réussi → confirmation toast
- [ ] Session conservée après changement
- [ ] Nouveau mot de passe utilisable au login suivant
- [ ] Rate limiting sur les tentatives de changement

---

## 48. Toast / Notification System

### ⬜ À coder
- [ ] Erreur API → toast d'erreur affiché
- [ ] Succès (création, mise à jour) → toast de succès
- [ ] Toast disparaît après délai (auto-dismiss)
- [ ] Toast fermable manuellement
- [ ] Toasts multiples empilés correctement
- [ ] Pas de toast pour les erreurs silencieuses (background)

---

## 49. Concurrent Operations

### ⬜ À coder
- [ ] Double clic sur "Créer" → une seule création (prevent double submit)
- [ ] Double clic sur "Démarrer appel" → un seul appel
- [ ] Deux onglets — modification simultanée du même scénario → dernier gagne
- [ ] Like toggle rapide (5 clics) → état final correct
- [ ] Soumission formulaire pendant chargement → bloqué
- [ ] **🟡 P9** — Rate limiting register : 4ème inscription en 1 heure → 429
- [ ] **🟠 P10** — Rate limiting login par email : 6ème tentative en 15min → 429

---

## 50. Optimistic Updates & UI Rollback

### ⬜ À coder
- [ ] Like — UI se met à jour immédiatement (optimistic)
- [ ] Like — rollback si requête échoue
- [ ] Commentaire — apparaît immédiatement dans le fil
- [ ] Commentaire — retiré avec erreur si la requête échoue
- [ ] Suppression scénario — retiré de la liste immédiatement
- [ ] Suppression scénario — restauré si erreur API

---

## 51. Form Draft Persistence

### ⬜ À coder
- [ ] Formulaire de création partiellement rempli → données persistées (localStorage)
- [ ] Navigation hors `/create` → données conservées
- [ ] Rechargement navigateur → formulaire pré-rempli
- [ ] Soumission réussie → brouillon effacé
- [ ] Annulation manuelle → brouillon effacé

---

## 52. Theme Toggle

### ✅ Existant (`theme.spec.ts`)
- [x] ThemeToggle icône visible sur la landing page
- [x] Pas d'erreurs console liées au thème

### ⬜ À coder
- [ ] Click toggle dark/light theme
- [ ] Icône change (soleil↔lune) selon le thème
- [ ] Thème persisté après navigation
- [ ] Thème persisté après rechargement

---

## 53. Error Boundary

### ✅ Existant (`error-boundary.spec.ts`)
- [x] Page 404 — icône Frown visible
- [x] Page 404 — message "n'existe pas ou a été déplacée"
- [x] Page erreur — heading "Une erreur est survenue"
- [x] Page erreur — bouton "Réessayer"
- [x] Page erreur — bouton Copier digest
- [x] Skip link "Aller au contenu principal" présent
- [x] Structure HTML valide (lang="fr", title, main)

### ⬜ À coder
- [ ] Error boundary — crash composant n'affecte pas le reste
- [ ] Réseau hors ligne — message approprié

---

## 54. Shared Components — États non couverts

### DataLoader
- [ ] Loading skeleton (customizable)
- [ ] Error state avec AlertTriangle + "Réessayer"
- [ ] Empty state custom
- [ ] Callback isEmpty custom

### PaginatedDataLoader
- [ ] Loading spinner (default)
- [ ] Error state avec "Réessayer"
- [ ] Empty state custom

### PaginatedGrid
- [ ] "Voir plus" visible quand hasMore
- [ ] "Voir plus" caché quand hasMore=false
- [ ] Spinner quand isLoadingMore

### ScenarioCard
- [ ] Badge catégorie, titre, créateur, compteurs
- [ ] Share button (clipboard + toast)
- [ ] Card liée au détail scénario

### ConfirmDialog
- [ ] Cancel ferme le dialog
- [ ] Confirm trigger onConfirm
- [ ] Loading spinner désactive boutons
- [ ] ConfirmDisabled empêche confirm
- [ ] Variante destructive change couleur

### AudioPlayer
- [ ] Play/pause toggle
- [ ] Seek slider
- [ ] Speed controls (0.5x, 0.75x, 1x, 1.5x, 2x)
- [ ] Download button
- [ ] Time display (mm:ss)
- [ ] No recording → empty state
- [ ] Loading spinner
- [ ] Error state AlertTriangle

### TranscriptView
- [ ] Loading skeleton (5 messages alternés)
- [ ] null → "Transcript en cours de traitement..."
- [ ] Empty → "Aucune transcription disponible"
- [ ] Bulles chat (IA gauche, User droite)
- [ ] Timestamps par chunk

### BadgeDisplay / BadgeGrid
- [ ] Loading skeleton (3 cards)
- [ ] Error state "Erreur chargement badges"
- [ ] Empty state "Aucun badge pour le moment"
- [ ] Badge card (icône, nom, description, date)

### ConsentBanner
- [ ] Caché quand consent actif
- [ ] Visible quand consent retiré
- [ ] "Ré-accepter" → reconsent mutation
- [ ] Mutation → page reload

### CallDisclaimerDialog
- [ ] Dialog avec infos (4 bullet points)
- [ ] Checkbox requis pour activer bouton
- [ ] "Démarrer l'appel" → onAccept + close
- [ ] localStorage persistence
- [ ] SSR-safe (null until mounted)

### PasswordStrengthMeter
- [ ] Caché quand password vide
- [ ] 5 barres segmentées colorées
- [ ] Labels force (Très faible à Très fort)
- [ ] Checks individuels (✓/✗)
- [ ] Recalcul au changement

### Toast System
- [ ] Toast apparaît en bas à droite
- [ ] Auto-dismiss après 4s
- [ ] Close button dismiss immédiat
- [ ] Toasts multiples empilés
- [ ] Variante destructive/success

### DashboardShell Navigation
- [ ] Nav links avec active state
- [ ] CreditDisplay visible dans nav
- [ ] ThemeToggle visible dans nav
- [ ] Settings link (gear icon)
- [ ] Mobile: icons only
- [ ] Sticky nav + backdrop blur

### CreditDisplay
- [ ] Skeleton quand credits undefined
- [ ] Badge avec nombre de crédits
- [ ] Tooltip au hover

### EmptyState
- [ ] Icône, titre, description
- [ ] Action slot optionnel

### UI Components (détails supplémentaires)
- [ ] **Alert** — rôle `alert` et aria-live="polite" présent
- [ ] **Avatar** — fallback aux initiales du username si pas d'image
- [ ] **Button** — polymorphic `asChild` (rendu comme `a` ou `button` selon le contexte)
- [ ] **Dialog** — focus trap actif (Tab cyclique à l'intérieur)
- [ ] **Dialog** — scroll-lock du body pendant l'ouverture
- [ ] **Input** — type `file` : accept, multiple, taille limite
- [ ] **SegmentedControl** — navigation aux flèches clavier (← →)
- [ ] **Skeleton** — respecte `prefers-reduced-motion` (pas d'animation)
- [ ] **ThemeToggle** — hydration safe (pas de flash de mauvais thème)
- [ ] **Tooltip** — positions (top, bottom, left, right) avec espacement suffisant
- [ ] **Tooltip** — contenu Unicode/HTML échappé

### Shared Components (détails supplémentaires)
- [ ] **Breadcrumbs** — route inconnue : affiche le segment sans lien
- [ ] **CallDisclaimerDialog** — localStorage persistence : SSR-safe (null until mounted)
- [ ] **ConfirmDialog** — variante destructive : bouton rouge + icône warning
- [ ] **ConfirmDialog** — loading state : spinner + boutons désactivés
- [ ] **ConsentBanner** — reconsent après retrait : "Ré-accepter" → mutation + page reload
- [ ] **CreditDisplay** — tooltip au hover : "Crédits disponibles"
- [ ] **DataLoader** — retry cycle : nombre maximum de tentatives sans boucle infinie
- [ ] **PaginatedGrid** — dernière page : "Voir plus" caché quand hasMore=false
- [ ] **PasswordStrengthMeter** — tous les seuils : 0, 1, 2, 3, 4, 5 barres

### Social Components (détails supplémentaires)
- [ ] **BadgeDisplay** — loading skeleton (3 cards)
- [ ] **BadgeDisplay** — error state : "Erreur chargement badges" + réessayer
- [ ] **BadgeNotification** — auto-dismiss après délai
- [ ] **EmojiPicker** — fermeture au clic outside ou Escape
- [ ] **ReactionBar** — disabled state quand pas authentifié
- [ ] **ReportButton** — conflit : deux reports simultanés du même contenu

---

## 55. Cross-Cutting Responsive

### ⬜ À coder
- [ ] Toutes les pages dashboard sur 375px
- [ ] Admin sidebar collapses on mobile
- [ ] Dashboard nav scroll horizontal mobile
- [ ] Pas de débordement horizontal
- [ ] Formulaires utilisables sur mobile

---

## 56. Cross-Cutting Accessibilité

### ⬜ À coder
- [ ] Skip link focusable + fonctionnel
- [ ] Tab navigation sur nav links
- [ ] Focus trap dans dialogues
- [ ] Focus restauré après fermeture dialog
- [ ] Escape ferme dialogues
- [ ] aria-current="page" sur nav active
- [ ] aria-live="polite" sur contenu dynamique
- [ ] aria-label sur boutons icône-only
- [ ] form inputs avec labels associés
- [ ] Contrast ratio suffisant
- [ ] Images avec attribut alt

---

## 57. Bugs Identifiés par Analyse Statique (SCENARIOS_MANQUANTS.md)

Ces bugs ont été découverts par analyse statique du code source et doivent être corrigés avant ou pendant l'écriture des tests E2E.

| ID | Bug | Impact | Section | Statut |
|:--:|-----|--------|:-------:|:------:|
| B1 | Email case-sensitive dans Prisma (connexion bloque si casse différente) | 🔴 CRITIQUE | Auth Login | ✅ Corrigé |
| B2 | Historique achats toujours vide (placeholder statique, pas de query API) | 🔴 CRITIQUE | Billing | ✅ Corrigé |
| B3 | Bouton "Enregistrer" ne se désactive pas quand l'username revient à l'original | 🔴 CRITIQUE | Settings | ✅ Corrigé |
| B4 | Dashboard — échec d'un widget cascade sur tous (Promise.all) | 🔴 CRITIQUE | Dashboard | ✅ Corrigé |
| B5 | AudioPlayer — useEffect dépendance `[]` au lieu de `[recordingUrl]` | 🟠 HAUTE | Call Replay | ✅ Corrigé |
| B6 | Draft localStorage non effacé au clic "Annuler" | 🟠 HAUTE | Create | ✅ Corrigé |
| B7 | deleteMyAccount sans vérification appels actifs | 🟠 HAUTE | Settings/GDPR | ✅ Corrigé |
| B8 | Changement mot de passe documenté mais non codé dans SettingsPageClient | 🟠 HAUTE | Settings | ✅ Implémenté |
| B9 | ModerationQueue pagination absente (>50 items inaccessibles) | 🟠 HAUTE | Admin | ✅ Corrigé — usePaginatedQuery + PaginatedDataLoader |
| B10 | Reports pagination absente (>50 items inaccessibles) | 🟠 HAUTE | Admin | ✅ Corrigé — usePaginatedQuery + PaginatedDataLoader |
| B11 | CSRF non protégé pour PUT/DELETE/PATCH (Origin + Referer) | 🟠 HAUTE | Sécurité | 🟡 Accepté — tRPC n'utilise que POST pour mutations, API routes non-browser |
| B12 | History — recherche "Terminé" ne trouve rien (match sur "COMPLETED") | 🟡 MOYENNE | History | ✅ Corrigé — ajout traduction français→anglais statuts |
| B13 | Library — bouton "Annuler" restaure le draft (lié à B6) | 🟡 MOYENNE | Library/Create | ✅ Corrigé (via P6) |
| B14 | Billing — pas de feedback après retour Stripe (?success= ignoré) | 🟡 MOYENNE | Billing | ✅ Corrigé — gestion URL params + toast |
| B15 | Rate limit login contourné — `.catch(() => {})` avale TRPCError TOO_MANY_REQUESTS | 🔴 CRITIQUE | Auth | ⬜ À corriger |
| B16 | Curseur invalide dans feed/moderationQueue → Prisma P2023 non catché → 500 | 🔴 CRITIQUE | API | ⬜ À corriger |
| B17 | Open redirect via callbackUrl non validé dans middleware.ts | 🔴 CRITIQUE | Sécurité | ⬜ À corriger |
| B18 | isAdmin avec "admin" minuscules → FORBIDDEN (comparaison stricte "ADMIN") | 🔴 CRITIQUE | Admin | ⬜ À corriger |
| B19 | Aucun verrou Redis pour cleanup-recordings — double suppression R2 possible | 🔴 CRITIQUE | Cron | ⬜ À corriger |
| B20 | Circuit breaker telephony jamais reset — pas de mécanisme de reprise | 🟠 HAUTE | Telephony | ⬜ À corriger |
| B21 | withRetry + twilioClient.calls.create — perte réponse → DEUXIÈME appel créé | 🔴 CRITIQUE | Telephony | ⬜ À corriger |
| B22 | Double-dépense crédits en race condition — fenêtre entre webhook et initiateCall | 🔴 CRITIQUE | Billing | ⬜ À corriger |
| B23 | redisUnavailableLogged ne se reset JAMAIS — perte monitoring après 1er crash Redis | 🟠 HAUTE | Redis | ⬜ À corriger |
| B24 | MODERATION_FAIL_OPEN case-sensitive — "False" parsé comme true | 🟠 HAUTE | Config | ⬜ À corriger |
| B25 | validateProductionEnv incomplet — manque CRON_SECRET, TWILIO_TOKEN_SECRET | 🟠 HAUTE | Config | ⬜ À corriger |
| B26 | Pas de tests E2E Playwright dans CI — seulement quality checks | 🔴 CRITIQUE | CI/CD | ⬜ À corriger |
| B27 | Deep link mobile cassé — un seul écran HomeScreen dans le Navigator | 🔴 CRITIQUE | Mobile | ⬜ À corriger |

---

---

## 58. tRPC Core & Middleware Edge Cases

### ⬜ À coder (issus de ROUND2_AGENT1_TRPC.md)
- [ ] **[CRITIQUE] CSRF contourné** : createTRPCContext sans opts.req (contexte serveur direct) → CSRF bypassé car opts.req.method est undefined
- [ ] **[CRITIQUE] Rate limit login contourné** : `.catch(() => {})` dans auth.ts avale TRPCError("TOO_MANY_REQUESTS") — la limite n'est jamais appliquée
- [ ] **[CRITIQUE] Curseur invalide → 500** : feed, moderationQueue — Prisma P2023 non catché
- [ ] **[CRITIQUE] Race condition update → 500** : Entre findUnique et update, record supprimé → P2025 non catché
- [ ] **[CRITIQUE] Open redirect** : callbackUrl dans middleware.ts non validé → redirection site externe possible
- [ ] **[CRITIQUE] Session sans rôle** : user.role absent du JWT → undefined dans ctx, pas de crash mais comportement indéfini
- [ ] **[CRITIQUE] isAdmin avec "admin" minuscule** : comparaison stricte "ADMIN" → FORBIDDEN pour un admin légitime
- [ ] **[ELEVÉ] Origin vide ("") en production** : string non-null mais vide → new URL("") throw → FORBIDDEN
- [ ] **[ELEVÉ] Referer malformé** : new URL(referer) throw → sourceOrigin null → FORBIDDEN
- [ ] **[ELEVÉ] withContentModeration message anglais** : "Authentication required" dans app française
- [ ] **[MOYEN] sanitizeRequestId** : >64 caractères, emoji, Unicode, chaîne vide après sanitization
- [ ] **[MOYEN] parseTrustedOrigins** : vide, 1 origine, 50 origines, espaces autour virgules
- [ ] **[MOYEN] errorFormatter** : erreur Prisma P2002 (ne pas exposer message brut), objet non-Error, ZodError imbriqué
- [ ] **[MOYEN] Session expirée** : isAuthenticated ne vérifie PAS session.expires
- [ ] **[MOYEN] WithRateLimit** : clé vide, fenêtre 0, multiple rate limits simultanés sur même requête
- [ ] **[MOYEN] WithContentModeration** : contenu déjà modéré, contenu vide, modération race condition

## 59. Infrastructure — Prisma / Database Layer

### ⬜ À coder (issus de ROUND2_AGENT2_INFRA.md)
- [ ] **Transaction rollback implicite** : initiateCall() — si atomicDebit échoue, daily limit rollbacké ?
- [ ] **Transaction Stripe checkout** : purchase.create réussit mais userBilling.upsert échoue → rollback
- [ ] **updateMany count === 0 silencieux** : updateStatusWithGuard — appelant ne vérifie pas count
- [ ] **markAsFailedWithRefund race condition** : deux webhooks simultanés → deux refunds
- [ ] **Cursor pagination sans ORDER BY id unique** : findPendingQueue — doublons/sauts
- [ ] **findTopScenario N+1** : requête coûteuse sur des milliers de scénarios
- [ ] **upsert sans select** : retourne tous les champs inutilement
- [ ] **$disconnect manquant** : connexions PostgreSQL non fermées sur arrêt
- [ ] **datetime tronqué** : timezone boundary UTC vs serveur local
- [ ] **findUnique clé invalide** : null silencieux — vérifier qu'aucun crash
- [ ] **Direct URL PgBouncer** : transactions interactives non supportées sans DIRECT_URL

## 60. Infrastructure — Redis Layer

### ⬜ À coder (issus de ROUND2_AGENT2_INFRA.md)
- [ ] **[CRITIQUE] redisUnavailableLogged ne se reset jamais** : perte monitoring après premier crash Redis
- [ ] **[CRITIQUE] redis.keys() O(N)** dans calls.start au lieu de SCAN
- [ ] **[CRITIQUE] JSON.parse sans try/catch** sur données Redis corrompues (10+ endpoints)
- [ ] **[CRITIQUE] Aucun verrou Redis pour cleanup-recordings** : double suppression R2 possible
- [ ] **[ELEVÉ] Taux d'échec Redis** : if (!ok) continue silencieux dans conversationState.ts
- [ ] **[ELEVÉ] Idempotency lock sans TTL** : clé d'idempotence Stripe/RateLimit jamais expirée
- [ ] **[ELEVÉ] Conversation state TTL trop court** : appel > 30 min → state perdu pendant l'appel
- [ ] **[MOYEN] Reconnexion Redis** : retry strategy, exponential backoff, max retry
- [ ] **[MOYEN] Cache invalidation concurrente** : race condition purge + write
- [ ] **[MOYEN] Dead letter queue Redis corruption** : JSON.parse sur message DLQ invalide

## 61. Infrastructure — R2 / Cloudflare S3 (Object Storage)

### ⬜ À coder (issus de ROUND2_AGENT2_INFRA.md)
- [ ] **[CRITIQUE] cleanupRecordings : delete R2 + update DB non atomique** : R2 OK mais DB échoue → fichier perdu, DB pointe vers rien
- [ ] **[ELEVÉ] Upload concurrent même key** : dernier write gagne, pas de versioning
- [ ] **[ELEVÉ] Fichier > 100MB** : S3 multipart upload géré ? Timeout ?
- [ ] **[MOYEN] Fichier inexistant → 404** : GetObject sur clé absente → erreur gérée ?
- [ ] **[MOYEN] Présigned URL expirée** : generatePresignedUrl avec expiresIn=0 ou négatif
- [ ] **[MOYEN] Téléchargement interrompu** : réseau coupé pendant GetObject → retry/download resume ?
- [ ] **[ELEVÉ] Bucket policy restreinte** : R2 return AccessDenied → message d'erreur clair ?
- [ ] **[MOYEN] Upload nom fichier Unicode** : caractères accentués, espaces → percent-encoded ?

## 62. Infrastructure — ElevenLabs & Deepgram (Audio AI Services)

### ⬜ À coder (issus de ROUND2_AGENT2_INFRA.md)
- [ ] **[ELEVÉ] ElevenLabs API key invalide** : 401 → retry ? Fallback TTS ?
- [ ] **[ELEVÉ] Deepgram timeout longue transcription** : fichier audio > 1h → timeout 30s dépassé
- [ ] **[ELEVÉ] ElevenLabs rate limit** : 429 → exponential backoff ?
- [ ] **[MOYEN] Deepgram accent/langue** : français mal reconnu → transcription vide ou erronée
- [ ] **[MOYEN] ElevenLabs voix inexistante** : voiceId invalide → 400 → fallback voix par défaut
- [ ] **[MOYEN] Deepgram audio silencieux** : pas de parole → transcription vide gérée ?
- [ ] **[MOYEN] Concurrent ElevenLabs requests** : burst de 50 requêtes → queue ou throttle ?

## 63. Infrastructure — Circuit Breaker & Resilience

### ⬜ À coder (issus de ROUND2_AGENT2_INFRA.md)
- [ ] **[CRITIQUE] Circuit breaker telephony jamais reset** : pas de reset programmatique (admin, cron, monitoring)
- [ ] **[CRITIQUE] withRetry + twilioClient.calls.create** : perte réponse HTTP → DEUXIÈME appel créé
- [ ] **[CRITIQUE] withRetry sur mutation non idempotente** : createCall, initiateCall → double effet
- [ ] **[ELEVÉ] Circuit breaker half-open** : une seule requête test, pas de graduated recovery
- [ ] **[ELEVÉ] Circuit breaker sans fallback** : pas de mode dégradé (ex: cache)
- [ ] **[MOYEN] Concurrency limiter maxConcurrent** : dépassé → queue ou rejet ?

## 64. Cross-Cutting — Offline & Network Resilience

### ⬜ À coder (issus de ROUND2_AGENT3_TRANSVERSAL.md)
- [ ] **Perte connexion chargement dashboard** : DataLoader erreur + bouton "Réessayer"
- [ ] **Perte connexion envoi commentaire** : toast erreur + texte préservé
- [ ] **Perte connexion like reaction** : toast "Impossible de réagir" + compteur inchangé
- [ ] **Perte connexion page explore** : UI ne se casse pas, filtres restent interactifs
- [ ] **Reconnexion après offline** : refetch recharge les données
- [ ] **Perte réseau pendant lecture audio** : fichier déjà chargé continue, download échoue
- [ ] **Timeout réseau lent (>30s)** : message d'erreur lisible, pas d'écran blanc

## 65. Cross-Cutting — i18n & French Formatting

### ⬜ À coder (issus de ROUND2_AGENT3_TRANSVERSAL.md)
- [ ] **[ELEVÉ] B12 — Recherche "Terminé" dans history** : doit trouver COMPLETED (bug existant)
- [ ] **[ELEVÉ] Format dates en français** : `toLocaleDateString("fr-FR")` — vérifier jour/mois/année
- [ ] **[ELEVÉ] Format nombres français** : `1 234,56` au lieu de `1,234.56`
- [ ] **[ELEVÉ] Tri alphabétique français** : é, è, ê, ë traités correctement
- [ ] **[MOYEN] Pluriels français** : "0 scénario", "1 scénario", "2 scénarios"
- [ ] **[MOYEN] Mois abrégés français** : "janv.", "févr." au lieu de "Jan", "Feb"
- [ ] **[MOYEN] Fuseau horaire** : dates affichées en locale française (Paris)

## 66. Cross-Cutting — XSS & Injection Security

### ⬜ À coder (issus de ROUND2_AGENT3_TRANSVERSAL.md)
- [ ] **XSS titre scénario** : `<script>alert('XSS')</script>` → pas exécuté (React escape)
- [ ] **XSS instructions IA** : `<img onerror="alert(1)" src=x>` → pas exécuté
- [ ] **XSS commentaire** : `</textarea><script>alert('xss')</script>` → texte simple
- [ ] **XSS raison signalement** : `<script>alert('xss')</script>` → pas exécuté dans admin
- [ ] **CSRF mutations tRPC** : appel depuis origine différente → rejeté (SameSite cookie)
- [ ] **Injection SQL/NoSQL filtres admin** : caractères spéciaux → pas de crash
- [ ] **SSRF RecordingUrl** : URL malveillante bloquée (ALLOWED_HOST_PATTERNS bypass ?)

## 67. Desktop (Electron) Application

### ⬜ À coder (issus de ROUND2_AGENT5_MOBILE_CI.md)
- [ ] **[CRITIQUE] Deep link cassé** : navigation ScenarioDetail → crash (un seul écran HomeScreen)
- [ ] **[ELEVÉ] Fenêtre inaccessible** : mainWindow.loadURL() après destroy → crash
- [ ] **[ELEVÉ] ContextBridge sécurité** : preload.ts expose platform → injection possible
- [ ] **[ELEVÉ] Auto-updater** : mise à jour silencieuse ou notification
- [ ] **[MOYEN] Tray icon** : clic ouvre/ferme fenêtre
- [ ] **[MOYEN] Menu natif** : Fichier, Édition, Affichage, Aide
- [ ] **[MOYEN] Notifications système** : appel entrant, message reçu
- [ ] **[MOYEN] Permissions microphone** : demande au premier appel
- [ ] **[MOYEN] Fenêtre multi-écran** : position/dimensions préservées
- [ ] **[MOYEN] Scheme deep link** : echoroom:// ouvert dans l'app Electron

## 68. Mobile (Expo) Application

### ⬜ À coder (issus de ROUND2_AGENT5_MOBILE_CI.md)
- [ ] **[CRITIQUE] Deep link echoroom://** : navigation vers scénario → doit ouvrir sans crash
- [ ] **[ELEVÉ] URL malformée** : echoroom://///scenario → pas de crash
- [ ] **[ELEVÉ] Permission microphone refusée** : message explicite, pas de crash
- [ ] **[ELEVÉ] Offline démarrage** : écran s'affiche sans crash
- [ ] **[MOYEN] Permission notifications** : refus n'empêche pas navigation
- [ ] **[MOYEN] Synchronisation API token JWT** : SecureStore + requêtes
- [ ] **[MOYEN] Pull-to-refresh** : recharge les données
- [ ] **[MOYEN] Cache AsyncStorage** : offline → données en cache, online → sync API
- [ ] **[MOYEN] Gestes swipe** : retour arrière, fermeture modale
- [ ] **[MOYEN] Build Android/iOS** : EAS Build, environment variables
- [ ] **[MOYEN] Navigation paramètres manquants** : navigate sans paramètre id → fallback

## 69. CI/CD & Build Pipeline

### ⬜ À coder (issus de ROUND2_AGENT5_MOBILE_CI.md)
- [ ] **[CRITIQUE] Pas de tests E2E Playwright dans CI** : seulement quality checks (typecheck, lint, test, build)
- [ ] **[CRITIQUE] Cache Turbo basé sur github.sha** : jamais réutilisé entre commits → full build à chaque run
- [ ] **[ELEVÉ] Pas de matrice OS** : Linux uniquement, pas macOS/Windows
- [ ] **[ELEVÉ] Pas de viewports mobiles Playwright** : 375px non configuré
- [ ] **[ELEVÉ] Pas de multi-navigateurs** : Chromium uniquement
- [ ] **[MOYEN] Node version cohérente** : 20 entre CI et release workflow
- [ ] **[MOYEN] Turbo e2e task manquante** : `test:e2e` pas dans turbo.json
- [ ] **[MOYEN] Test artifacts** : HTML report, screenshots, traces uploadés ?
- [ ] **[MOYEN] Timeout jobs** : 15min pour quality → assez pour E2E ?
- [ ] **[MOYEN] Secrets CI** : variables d'env de test vs production

## 70. Infrastructure — Credit Operations & Telephony

### ⬜ À coder (issus de ROUND2_AGENT2_INFRA.md)
- [ ] **[CRITIQUE] Double-dépense crédits race condition** : transaction entre completed webhook et initiateCall
- [ ] **[ELEVÉ] Débit atomique avec daily limit** : si atomicDebit réussit mais atomicIncrementDailyLimit échoue → rollback ?
- [ ] **[ELEVÉ] Crédits négatifs** : débit > solde → doit être rejeté
- [ ] **[ELEVÉ] Appel simultané multi-utilisateur** : deux appels pour même user → daily limit check
- [ ] **[MOYEN] Refund crédits** : webhook refund → crédits remboursés correctement
- [ ] **[ELEVÉ] Conversation state call > 30min** : état Redis perdu → reprise impossible
- [ ] **[ELEVÉ] SSRF via fetchRecordingAudio** : requête authentifiée Twilio vers URL arbitraire
- [ ] **[ELEVÉ] validateRecordingUrl regex trop large** : *.twilio.com match evil-twilio.com
- [ ] **[MOYEN] CallStatus completed avant MediaStream** : cohérence d'état
- [ ] **[MOYEN] Crédits insuffisants** : rejet avant création call

## 71. Infrastructure — Configuration & Environment

### ⬜ À coder (issus de ROUND2_AGENT2_INFRA.md)
- [ ] **[CRITIQUE] MODERATION_FAIL_OPEN case-sensitive** : "False" !== "false" → parse comme true
- [ ] **[ELEVÉ] Dev defaults en production** : secret à valeur dev → Error au démarrage
- [ ] **[ELEVÉ] NEXTAUTH_SECRET aléatoire en dev** : redémarrage → toutes sessions invalidées
- [ ] **[ELEVÉ] NEXT_PUBLIC_APP_URL fallback localhost** : webhooks Twilio vers localhost en production
- [ ] **[ELEVÉ] validateProductionEnv incomplet** : manque CRON_SECRET, TWILIO_TOKEN_SECRET, etc.
- [ ] **[MOYEN] Variables requises manquantes** : message d'erreur clair au démarrage

## Résumé

| Section | ✅ Existants | ⬜ Planifiés | Total |
|---------|:-----------:|:------------:|:-----:|
| Landing | 11 | 12 | 23 |
| Auth Login | 10 | 12 | 22 |
| Auth Register | 0 | 16 | 16 |
| Auth Forgot Password | 0 | 6 | 6 |
| Auth Reset Password | 0 | 8 | 8 |
| Navigation | 10 | 4 | 14 |
| Explore | 10 | 13 | 23 |
| Scenario Detail | 10 | 28 | 38 |
| Dashboard | 15 | 12 | 27 |
| Create Scenario | 8 | 22 | 30 |
| Library | 9 | 13 | 22 |
| History | 7 | 13 | 20 |
| Profile | 4 | 13 | 17 |
| Settings | 17 | 22 | 39 |
| Community | 7 | 15 | 22 |
| Leaderboard | 7 | 14 | 21 |
| Billing | 8 | 10 | 18 |
| Pricing | 0 | 4 | 4 |
| Call Replay | 5 | 22 | 27 |
| Admin | 6 | 59 | 65 |
| Legal | 12 | 3 | 15 |
| Help Page | 0 | 6 | 6 |
| Characters | 0 | 5 | 5 |
| Audio System | 0 | 6 | 6 |
| Webhook Idempotency | 0 | 3 | 3 |
| CSRF Protection | 0 | 7 | 7 |
| OpenGraph | 0 | 4 | 4 |
| Admin Feature Mgmt | 0 | 5 | 5 |
| Share Tracking | 0 | 4 | 4 |
| API Versioning | 0 | 6 | 6 |
| IP Rate Limiting | 0 | 5 | 5 |
| Twilio Webhook Validation | 0 | 9 | 9 |
| Browser Navigation & Deep Linking | 0 | 12 | 12 |
| Auth Session | 0 | 9 | 9 |
| Pagination Edge Cases | 0 | 5 | 5 |
| Password Change | 0 | 7 | 7 |
| Toast / Notification System | 0 | 6 | 6 |
| Concurrent Operations | 0 | 7 | 7 |
| Optimistic Updates & UI Rollback | 0 | 6 | 6 |
| Form Draft Persistence | 0 | 5 | 5 |
| API/Webhooks | 18 | 12 | 30 |
| Sécurité | 1 | 8 | 9 |
| Responsive | 0 | 5 | 5 |
| Accessibilité | 0 | 5 | 5 |
| GDPR & Data Privacy | 6 | 11 | 17 |
| Badges & Gamification | 0 | 5 | 5 |
| Audio Clips | 0 | 5 | 5 |
| Cron Jobs | 0 | 9 | 9 |
| Loading/Empty/Error | 0 | 15 | 15 |
| Stripe Checkout | 0 | 10 | 10 |
| Async AI Moderation | 0 | 4 | 4 |
| Spam Detection | 0 | 5 | 5 |
| Theme Toggle | 2 | 4 | 6 |
| Error Boundary | 7 | 2 | 9 |
| Shared Components (DataLoader, AudioPlayer, etc.) | 0 | 92 | 92 |
| Cross-Cutting Responsive | 0 | 5 | 5 |
| Cross-Cutting Accessibilité | 0 | 11 | 11 |
| tRPC Core & Middleware Edge Cases | 0 | 16 | 16 |
| Infrastructure — Prisma / Database | 0 | 11 | 11 |
| Infrastructure — Redis | 0 | 10 | 10 |
| Infrastructure — R2 / S3 Storage | 0 | 8 | 8 |
| Infrastructure — ElevenLabs & Deepgram | 0 | 7 | 7 |
| Infrastructure — Circuit Breaker | 0 | 6 | 6 |
| Cross-Cutting — Offline & Network | 0 | 7 | 7 |
| Cross-Cutting — i18n & French | 0 | 7 | 7 |
| Cross-Cutting — XSS & Injection | 0 | 7 | 7 |
| Desktop (Electron) | 0 | 10 | 10 |
| Mobile (Expo) | 0 | 11 | 11 |
| CI/CD & Build Pipeline | 0 | 10 | 10 |
| Infrastructure — Credit Ops & Telephony | 0 | 10 | 10 |
| Infrastructure — Configuration & Env | 0 | 6 | 6 |
| **Total** | **190** | **1060** | **1250** |
