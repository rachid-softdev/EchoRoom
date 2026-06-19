# EchoRoom — Scénarios de Test E2E

> **Statut :** Plan de couverture E2E — chaque scénario listé doit être codé dans un fichier `.spec.ts`.
> ✅ = déjà codé, ⬜ = à coder

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

### ✅ Existant (`scenario.spec.ts`)
- [x] 404 pour ID inexistant
- [x] 404 pour segment ID vide
- [x] Section commentaires visible
- [x] Reaction bar visible
- [x] Titre du scénario visible
- [x] Lien retour communauté

### ⬜ À coder
- [ ] Détails du scénario (description, opening message, character)
- [ ] Bouton d'appel visible (si auth + crédits suffisants)
- [ ] Redirection vers login si pas auth et clic sur appel
- [ ] Boutons de partage (Discord, Twitter, TikTok, Copy link)
- [ ] Section clips audio
- [ ] Likes — toggle reaction
- [ ] Commentaires — posting (si auth)
- [ ] Commentaires — liste paginée
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

### ⬜ À coder
- [ ] Redirection vers login si non auth
- [ ] Solde de crédits affiché
- [ ] Liste des appels récents
- [ ] Nombre d'appels aujourd'hui
- [ ] Liste des scénarios récents
- [ ] Lien vers création de scénario
- [ ] Lien vers historique
- [ ] Lien vers library
- [ ] Données chargées depuis dashboard.getData (agrégé)
- [ ] KPI visible (appels aujourd'hui, crédits restants, scénarios créés)
- [ ] Lien rapide vers la création de scénario
- [ ] Skeleton de chargement pendant le fetch
- [ ] Erreur API → message d'erreur sans bloquer la page

---

## 7. Create Scenario (`/create`)

### ⬜ À coder
- [ ] Redirection vers login si non auth
- [ ] Formulaire complet visible (character, title, description, opening, instructions, visibility)
- [ ] Sélection de personnage (dropdown/list)
- [ ] Validation title (min 3, max 80)
- [ ] Validation description (max 300)
- [ ] Validation openingMessage (max 300)
- [ ] Validation aiInstructions (max 3000)
- [ ] Création réussie → redirection vers le scénario
- [ ] Erreur modération (contenu bloqué)
- [ ] Génération de script IA (generateScript)
- [ ] Rate limiting (10 créations/heure)
- [ ] Spam detection
- [ ] Double soumission évitée (bouton désactivé après clic)
- [ ] Brouillon persisté localement si navigation accidentelle

---

## 8. Library (`/library`)

### ⬜ À coder
- [ ] Redirection vers login si non auth
- [ ] Liste des scénarios de l'utilisateur
- [ ] Pagination (cursor-based)
- [ ] État vide (aucun scénario)
- [ ] Modification d'un scénario
- [ ] Suppression d'un scénario
- [ ] Changement de visibilité
- [ ] Tri par date / popularité (si implémenté)

---

## 9. History (`/history`)

### ⬜ À coder
- [ ] Redirection vers login si non auth
- [ ] Liste des appels récents
- [ ] Pagination
- [ ] État vide
- [ ] Lien vers replay d'un appel
- [ ] Statut de l'appel visible
- [ ] Durée de l'appel affichée

---

## 10. Profile (`/profile/[username]`)

### ⬜ À coder
- [ ] Profil public d'un utilisateur
- [ ] Badges visibles (si le user a des badges)
- [ ] Liste des scénarios publics du créateur
- [ ] 404 pour username inexistant
- [ ] Modification du profil (si propriétaire)
- [ ] Changement de username

---

## 11. Settings (`/settings`)

### ✅ Partiellement existant (`consent.spec.ts`)
- [x] Redirection vers login si non auth
- [x] Section danger zone visible
- [x] Dialogue de consent visible
- [x] Validation confirmation "RETIRER"
- [x] Fermeture dialogue (Escape)

### ⬜ À coder
- [ ] Modification du profil (nom d'utilisateur)
- [ ] Changement de mot de passe
- [ ] Validation ancien mot de passe
- [ ] Export GDPR (profile.exportData)
- [ ] Suppression de compte (avec confirmation "SUPPRIMER")
- [ ] Retrait de consentement via RETIRER → logout + redirect home
- [ ] Réacceptation du consentement (reconsent)
- [ ] Affichage du statut de consentement
- [ ] Affichage du statut de suppression

---

## 12. Community (`/community`)

### ⬜ À coder
- [ ] Redirection vers login si non auth
- [ ] Fil d'actualité communautaire
- [ ] Interactions (likes, commentaires)
- [ ] Publication de commentaire
- [ ] Pagination
- [ ] Signalement d'abus depuis un post
- [ ] Réactions en temps réel (optimistic)

---

## 13. Leaderboard (`/leaderboard`)

### ⬜ À coder
- [ ] Top scénarios (période : ALL, WEEK, MONTH)
- [ ] Top créateurs (période : ALL, WEEK, MONTH)
- [ ] Changement de tri (LIKES, PLAYS / LIKES, CALLS)
- [ ] Affichage des badges

---

## 14. Billing (`/billing`)

### ⬜ À coder
- [ ] Redirection vers login si non auth
- [ ] Solde de crédits affiché
- [ ] Sélection de pack de crédits
- [ ] Lien vers Stripe Checkout (vérifier redirection)
- [ ] Historique des achats

---

## 15. Pricing (`/pricing`) — Marketing

### ⬜ À coder
- [ ] Cartes de prix visibles
- [ ] Plans affichés avec leurs features
- [ ] CTA "Commencer" / "S'inscrire" fonctionnel
- [ ] Comparaison des plans

---

## 16. Call Replay (`/call/[callId]`)

### ⬜ À coder
- [ ] Redirection vers login si non auth
- [ ] 404 pour callId inexistant
- [ ] FORBIDDEN si pas le propriétaire
- [ ] Lecteur audio visible (si enregistrement disponible)
- [ ] Transcription visible
- [ ] Création de clip depuis le replay
- [ ] Liste des clips d'un appel avec pagination
- [ ] Suppression d'un clip (si propriétaire)
- [ ] Partage d'un clip
- [ ] Boutons de partage

---

## 17. Admin Pages

### `/admin/moderation`

#### ⬜ À coder
- [ ] Redirection vers login si non auth
- [ ] FORBIDDEN pour rôle USER
- [ ] File d'attente de modération
- [ ] Approbation d'un scénario
- [ ] Rejet d'un scénario
- [ ] File d'attente des commentaires
- [ ] Approbation/Rejet de commentaire
- [ ] Pagination

### `/admin/users`
#### ⬜ À coder
- [ ] Liste des utilisateurs
- [ ] Recherche par username/email
- [ ] Pagination
- [ ] Détail utilisateur (admin.getUserDetail)
- [ ] Suppression utilisateur (admin.deleteUser)

### `/admin/reports`
#### ⬜ À coder
- [ ] Liste des signalements d'abus
- [ ] Filtre par statut
- [ ] Dismiss d'un rapport

### `/admin/blocked-numbers`
#### ⬜ À coder
- [ ] Liste des numéros bloqués
- [ ] Ajout d'un numéro bloqué
- [ ] Suppression d'un numéro bloqué

### `/admin/audit`
#### ⬜ À coder
- [ ] Logs d'audit paginés
- [ ] Filtres (action, entityType, adminId, date range)

### `/admin/analytics`
#### ⬜ À coder
- [ ] Page analytics admin
- [ ] Métriques clés visibles

### `/admin/dlq`
#### ⬜ À coder
- [ ] File d'attente des webhooks échoués (DLQ)
- [ ] Détail d'un élément DLQ (payload, headers, erreur)
- [ ] Retry d'un webhook depuis la DLQ
- [ ] Pagination de la DLQ

---

## 18. Legal Pages

### ⬜ À coder
- [ ] `/legal` — page légale
- [ ] `/privacy` — politique de confidentialité
- [ ] `/terms` — conditions d'utilisation
- [ ] `/help` — page d'aide
- [ ] Liens depuis le footer fonctionnels

---

## 19. API & Webhooks

### ✅ Existant (`rate-limiting.spec.ts` + `webhook-protection.spec.ts`)
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
- [ ] Healthcheck endpoint `/api/health` — retour 200
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
| Scenario Detail | 6 | 16 | 22 |
| Dashboard | 0 | 13 | 13 |
| Create Scenario | 0 | 12 | 12 |
| Library | 0 | 7 | 7 |
| History | 0 | 6 | 6 |
| Profile | 0 | 5 | 5 |
| Settings | 5 | 9 | 14 |
| Community | 0 | 7 | 7 |
| Leaderboard | 0 | 4 | 4 |
| Billing | 0 | 5 | 5 |
| Pricing | 0 | 4 | 4 |
| Call Replay | 0 | 10 | 10 |
| Admin | 0 | 25 | 25 |
| Legal | 0 | 5 | 5 |
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
| API/Webhooks | 13 | 7 | 20 |
| Sécurité | 1 | 4 | 5 |
| Responsive | 0 | 5 | 5 |
| Accessibilité | 0 | 5 | 5 |
| GDPR & Data Privacy | 0 | 6 | 6 |
| Badges & Gamification | 0 | 5 | 5 |
| Audio Clips | 0 | 5 | 5 |
| Cron Jobs | 0 | 5 | 5 |
| Loading/Empty/Error | 0 | 12 | 12 |
| Stripe Checkout | 0 | 10 | 10 |
| Async AI Moderation | 0 | 4 | 4 |
| Spam Detection | 0 | 5 | 5 |
| Responsive (compl.) | 0 | 15 | 15 |
| Accessibilité (compl.) | 0 | 10 | 10 |
| **Total** | **66** | **383** | **449** |
