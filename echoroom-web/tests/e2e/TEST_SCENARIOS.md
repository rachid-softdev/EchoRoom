# EchoRoom — Scénarios de Test E2E

> **Statut :** Plan de couverture E2E — chaque scénario listé doit être codé dans un fichier `.spec.ts`.
> ✅ = déjà codé, ⬜ = à coder  
> **Mise à jour : 24 juin 2026 — +16 nouveaux fichiers, ~280 nouveaux scénarios identifiés**

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

### `/admin/reports`
#### ⬜ À coder
- [ ] Filtre tabs (Tous, En attente, Traité, Ignoré)
- [ ] Cartes signalement avec type, statut, reporter, raison
- [ ] Action Dismiss pour PENDING
- [ ] Dismiss désactivé pendant mutation
- [ ] Indicateur "revu par"
- [ ] Raison tronquée à 100 caractères
- [ ] État vide par filtre

### `/admin/blocked-numbers`
#### ⬜ À coder
- [ ] Formulaire (téléphone + raison)
- [ ] Submit bloqué si vide ou pending
- [ ] Mutation → reset formulaire + refetch liste
- [ ] Bouton débloquer
- [ ] Liste (téléphone, raison, bloqueur, date)
- [ ] État vide "Aucun numéro bloqué"

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

### `/admin/analytics`
#### ⬜ À coder
- [ ] Grille stats (4 cards)
- [ ] Carte roadmap
- [ ] Liens vers autres pages admin

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

---

## 20. Sécurité

### ✅ Existant (`security-headers.test.ts` dans `__tests__/`)
- [x] Headers de sécurité (CSP, HSTS, X-Frame-Options, etc.)

### ⬜ À coder (E2E)
- [ ] Redirection HTTP → HTTPS
- [ ] Cookie session secure (HTTP-only, SameSite)
- [ ] Rate limiting IP sur routes publiques
- [ ] Délai constant sur auth (timing attack protection)

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

## Résumé

| Section | ✅ Existants | ⬜ Planifiés | Total |
|---------|:-----------:|:------------:|:-----:|
| Landing | 11 | 9 | 20 |
| Auth Login | 10 | 7 | 17 |
| Auth Register | 0 | 12 | 12 |
| Auth Forgot Password | 0 | 6 | 6 |
| Auth Reset Password | 0 | 7 | 7 |
| Navigation | 10 | 3 | 13 |
| Explore | 10 | 10 | 20 |
| Scenario Detail | 10 | 24 | 34 |
| Dashboard | 15 | 9 | 24 |
| Create Scenario | 8 | 16 | 24 |
| Library | 9 | 10 | 19 |
| History | 7 | 9 | 16 |
| Profile | 4 | 10 | 14 |
| Settings | 17 | 14 | 31 |
| Community | 7 | 12 | 19 |
| Leaderboard | 7 | 11 | 18 |
| Billing | 8 | 7 | 15 |
| Pricing | 0 | 4 | 4 |
| Call Replay | 5 | 18 | 23 |
| Admin | 6 | 42 | 48 |
| Legal | 12 | 3 | 15 |
| Help Page | 0 | 6 | 6 |
| Characters | 0 | 5 | 5 |
| Audio System | 0 | 6 | 6 |
| Webhook Idempotency | 0 | 3 | 3 |
| CSRF Protection | 0 | 3 | 3 |
| OpenGraph | 0 | 4 | 4 |
| Admin Feature Mgmt | 0 | 5 | 5 |
| Share Tracking | 0 | 4 | 4 |
| API Versioning | 0 | 6 | 6 |
| IP Rate Limiting | 0 | 5 | 5 |
| Twilio Webhook Validation | 0 | 6 | 6 |
| Browser Navigation & Deep Linking | 0 | 12 | 12 |
| Auth Session | 0 | 6 | 6 |
| Pagination Edge Cases | 0 | 5 | 5 |
| Password Change | 0 | 7 | 7 |
| Toast / Notification System | 0 | 6 | 6 |
| Concurrent Operations | 0 | 5 | 5 |
| Optimistic Updates & UI Rollback | 0 | 6 | 6 |
| Form Draft Persistence | 0 | 5 | 5 |
| API/Webhooks | 18 | 7 | 25 |
| Sécurité | 1 | 4 | 5 |
| Responsive | 0 | 5 | 5 |
| Accessibilité | 0 | 5 | 5 |
| GDPR & Data Privacy | 6 | 8 | 14 |
| Badges & Gamification | 0 | 5 | 5 |
| Audio Clips | 0 | 5 | 5 |
| Cron Jobs | 0 | 5 | 5 |
| Loading/Empty/Error | 0 | 12 | 12 |
| Stripe Checkout | 0 | 10 | 10 |
| Async AI Moderation | 0 | 4 | 4 |
| Spam Detection | 0 | 5 | 5 |
| Theme Toggle | 2 | 4 | 6 |
| Error Boundary | 7 | 2 | 9 |
| Shared Components (DataLoader, AudioPlayer, etc.) | 0 | 75 | 75 |
| Cross-Cutting Responsive | 0 | 5 | 5 |
| Cross-Cutting Accessibilité | 0 | 11 | 11 |
| **Total** | **190** | **534** | **724** |
