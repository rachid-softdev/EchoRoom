# Analyse des scénarios E2E manquants — Aspects transversaux

## Résumé exécutif

| Thème | Scénarios existants | Scénarios manquants |
|-------|---------------------|---------------------|
| Concurrence (double soumission) | Partiel (clics boutons, reactions) | 8 |
| Offline / réseau | 0 | 6 |
| Sécurité / XSS | 0 | 5 |
| i18n / français | 0 | 7 |
| Performance / Suspense | 0 | 5 |
| Session multi-onglet | 0 | 4 |
| Optimistic updates / rollbacks | Partiel (Refetchs) | 5 |
| localStorage / stockage | Partiel (draft create) | 5 |
| Cache / invalidation | 0 | 3 |
| Accessibilité / focus | 0 | 4 |
| **Total** | **~15** | **52** |

---

## 1. Concurrence et double soumission

### ⬜ Nouveaux scénarios

- **[CONC-01]** **Double-clic sur "Créer le scénario"** : L'utilisateur clique deux fois très rapidement sur le bouton submit de la page `/create`. Vérifier que `createScenario.isPending` empêche la seconde soumission, qu'une seule requête part, et qu'on n'obtient pas deux scénarios identiques côté API.

- **[CONC-02]** **Double-clic sur "Envoyer" d'un commentaire** : Dans `CommentsSection`, cliquer deux fois rapidement sur le bouton Send ou appuyer deux fois sur Entrée. Vérifier que `commentMutation.isPending` bloque la seconde soumission et que le commentaire n'est pas dupliqué dans la liste.

- **[CONC-03]** **Double-clic sur "Signaler"** : Dans `ReportButton`, cliquer deux fois rapidement sur le bouton Signaler du Dialog. Vérifier que `reportMutation.isPending` empêche l'envoi de deux signalements.

- **[CONC-04]** **Double-clic sur "Créer le clip"** : Dans `ClipCreator` (scenario detail), cliquer deux fois rapidement. Vérifier que `createClipMutation.isPending` bloque la seconde création.

- **[CONC-05]** **Double-clic sur "Bloquer un numéro"** : Dans `BlockedNumbersPageClient`, soumettre le formulaire deux fois rapidement. Vérifier qu'une seule requête `blockMutation` est envoyée.

- **[CONC-06]** **Toggle de réaction rapide** : Dans `ReactionBar`, cliquer très rapidement sur deux émojis différents. Vérifier que `toggleMutation.isPending` désactive bien tous les boutons pendant la mutation, et que la seconde réaction attend la fin de la première.

- **[CONC-07]** **Double-soumission du formulaire de connexion** : Dans `LoginPage`, cliquer deux fois sur "Se connecter" rapidement. Vérifier que `loading` reste `true` et que `signIn` n'est appelé qu'une seule fois.

- **[CONC-08]** **Double-soumission du formulaire d'inscription** : Dans `RegisterPage`, cliquer deux fois sur "Créer mon compte". Vérifier que `loading` bloque le second appel et empêche la création de deux comptes.

---

## 2. Comportement hors-ligne (Offline)

### ⬜ Nouveaux scénarios

- **[OFF-01]** **Perte de connexion pendant le chargement du dashboard** : Couper le réseau avant la navigation vers `/dashboard`. Vérifier que `DataLoader` affiche l'état d'erreur avec le message "Impossible de charger les données" et que le bouton "Réessayer" est présent pour `query.refetch()`.

- **[OFF-02]** **Perte de connexion pendant l'envoi d'un commentaire** : Saisir un commentaire, couper le réseau, cliquer sur Envoyer. Vérifier que le toast d'erreur "Erreur lors de l'ajout du commentaire" s'affiche et que le texte saisi est **préservé** dans l'input (permet de réessayer).

- **[OFF-03]** **Perte de connexion pendant le like d'une réaction** : Cliquer sur une réaction dans `ReactionBar`, couper le réseau. Vérifier que le toast "Impossible de réagir" s'affiche et que le compteur de réactions n'a pas été modifié (rollback côté UI).

- **[OFF-04]** **Perte de connexion sur la page d'exploration** : Naviguer vers `/explore`, couper le réseau, interagir avec les filtres (catégorie, tri). Vérifier que l'UI ne se casse pas, que les filtres restent interactifs localement, et que le message d'erreur du `DataLoader` s'affiche si une refetch est déclenchée.

- **[OFF-05]** **Reconnexion après panneau offline** : Naviguer vers `/scenario/[id]`, couper le réseau, attendre l'erreur, rétablir le réseau, cliquer sur "Réessayer". Vérifier que `scenarioQuery.refetch()` recharge correctement les données.

- **[OFF-06]** **Perte réseau pendant la lecture audio** : Sur `/call/[callId]`, lancer la lecture audio (`AudioPlayer`), couper le réseau, vérifier que l'audio continue de jouer (fichier déjà chargé), mais que le téléchargement échoue avec un toast "Échec de la copie" ou l'erreur appropriée.

---

## 3. Sécurité : XSS, CSRF, tokens

### ⬜ Nouveaux scénarios

- **[SEC-01]** **XSS via le titre d'un scénario** : Créer un scénario avec un titre contenant `<script>alert('XSS')</script>`. Naviguer vers la page de détail et vérifier que le script n'est pas exécuté (le titre est affiché via `{scenario.title}` en texte simple, pas via `dangerouslySetInnerHTML`).

- **[SEC-02]** **XSS via les instructions IA** : Soumettre des instructions IA contenant `<img onerror="alert(1)" src=x>`. Naviguer sur la page de détail et s'assurer que le code HTML n'est pas rendu.

- **[SEC-03]** **XSS via le contenu d'un commentaire** : Poster un commentaire avec `</textarea><script>alert('xss')</script>`. Vérifier que le contenu est affiché comme texte simple dans `CommentsSection` (`{comment.content}`) sans exécution.

- **[SEC-04]** **XSS via le champ "reason" du signalement** : Dans `ReportButton`, soumettre un signalement avec `<script>alert('xss')</script>` comme raison. Vérifier que le contenu n'est pas exécuté quand il est affiché dans la console d'administration.

- **[SEC-05]** **Protection CSRF des mutations tRPC** : Vérifier que les appels tRPC utilisent `credentials: "include"` (configuré dans `trpc-provider.tsx`). Tenter d'appeler une mutation depuis une origine différente (ex: via fetch depuis un autre domaine) et vérifier que la requête est rejetée (vérification du cookie de session SameSite).

- **[SEC-06]** **Validité des tokens de session expirés** : Attendre l'expiration de la session (simuler avec un cookie expiré), puis tenter de naviguer vers `/dashboard`. Vérifier que `middleware.ts` redirige vers `/login?callbackUrl=/dashboard`.

- **[SEC-07]** **Injection SQL / NoSQL via les filtres admin** : Dans `AuditPageClient`, injecter des caractères spéciaux dans les filtres (dates, actions, entités). Vérifier que l'API ne crash pas et retourne des résultats valides (ou une liste vide).

---

## 4. Internationalisation (i18n) et français

### ⬜ Nouveaux scénarios

- **[I18N-01]** **Format des dates en français** : Naviguer vers `/scenario/[id]` et vérifier que les dates des commentaires utilisent `toLocaleDateString("fr-FR", ...)` — format français : "24 juin 2026, 14:30". Vérifier sur les pages : `CommentsSection`, `BlockedNumbersPageClient`, `AuditPageClient`, `ReportsPageClient`, `history` page.

- **[I18N-02]** **Format des nombres en français** : Naviguer vers un scénario avec +1000 likes. Vérifier que `formatNumber()` dans `ScenarioDetailClient` utilise `toLocaleString("fr-FR")` et affiche "1,2k" (virgule pour séparateur décimal, espace pour milliers). Vérifier aussi le `LiveCounter` sur la landing page.

- **[I18N-03]** **Format des prix en français** : Naviguer vers `/pricing`. Vérifier que les prix utilisent la virgule comme séparateur décimal : "2,99 €" et non "2.99 €". Vérifier `creditPacks` dans `billing/page.tsx`.

- **[I18N-04]** **Recherche avec caractères spéciaux français** : Dans `/library` ou `/explore`, rechercher avec des accents (ex: "scénario", "déjà", "à la une"). Vérifier que `toLowerCase()` fonctionne correctement avec les caractères accentués et que les résultats de filtrage sont corrects.

- **[I18N-05]** **Textes tronqués dans les labels français** : Naviguer sur toutes les pages du dashboard et vérifier qu'aucun libellé français n'est tronqué (ex: "Bibliothèque", "Facturation", "Commentaires", "Paramètres", "Créer un scénario" — ces mots sont plus longs que leurs équivalents anglais et pourraient causer des soucis de layout).

- **[I18N-06]** **Message de consentement français** : Naviguer vers `/register`. Vérifier que le texte du consentement mentionne "13 ans" (âge légal français pour le traitement des données, conformément à la RGPD et à la loi française).

- **[I18N-07]** **Traduction complète du fil d'Ariane** : Naviguer dans toutes les sections du dashboard et vérifier que `LABEL_MAP` dans `Breadcrumbs` contient bien toutes les clés des segments d'URL en français : "Bibliothèque", "Historique", "Communauté", "Classement", "Facturation", "Paramètres", "Profil".

---

## 5. Performance : loading states, ErrorBoundary, Suspense

### ⬜ Nouveaux scénarios

- **[PERF-01]** **Skeleton loading sur la page d'exploration** : Naviguer vers `/explore` en limitant la bande passante (Slow 3G dans Playwright). Vérifier que le `DataLoader` affiche les skeleton cards pendant le chargement de `feedQuery`.

- **[PERF-02]** **Skeleton loading sur le dashboard** : Naviguer vers `/dashboard` en Slow 3G. Vérifier que les squelettes/pulsations s'affichent pour les crédits (via `CreditDisplay` avec `Skeleton`), les appels récents et les scénarios créés.

- **[PERF-03]** **Skeleton loading sur la bibliothèque** : Naviguer vers `/library` en Slow 3G. Vérifier que `PaginatedDataLoader` affiche le spinner ou les squelettes pendant le chargement initial.

- **[PERF-04]** **Loading state du transcript** : Naviguer vers `/call/[callId]` avec un réseau lent. Vérifier que `TranscriptView` affiche les 5 squelettes de messages (bulles alternées IA/User) pendant `isLoading=true`.

- **[PERF-05]** **StaleTime React Query évite les refetchs inutiles** : 
  1. Naviguer vers `/scenario/[id]`
  2. Naviguer vers `/community`
  3. Naviguer **immédiatement** (dans les 30 secondes) vers `/scenario/[id]` 
  Vérifier que React Query utilise le cache (pas de nouvelle requête réseau) grâce à `staleTime: 30 * 1000`.

- **[PERF-06]** **"Voir plus" de la pagination sans rechargement complet** : Dans `/library` ou `/history`, cliquer sur "Voir plus". Vérifier que seules les nouvelles données sont chargées (observable via le network tab), pas une refetch complète.

---

## 6. Session multi-onglet (Cross-tab)

### ⬜ Nouveaux scénarios

- **[MULTI-01]** **Déconnexion dans un onglet → déconnexion dans l'autre** : 
  1. Onglet A : connecté sur `/dashboard`
  2. Onglet B : cliquer sur "Se déconnecter"
  3. Retour sur l'onglet A : naviguer ou interagir
  Vérifier que l'onglet A est redirigé vers `/login` (la requête API échoue car le cookie de session a été supprimé).

- **[MULTI-02]** **Like dans deux onglets simultanément** : 
  1. Onglet A et Onglet B : tous deux sur `/scenario/[id]`
  2. Onglet A : cliquer sur une réaction ❤️
  3. Onglet B : cliquer immédiatement sur la même réaction
  Vérifier que le compteur final est correct (les deux refetch après mutation ne causent pas d'incohérence).

- **[MULTI-03]** **Suppression de compte dans un onglet → impact dans l'autre** : 
  1. Onglet A : sur `/settings`
  2. Onglet B : supprimer le compte
  3. Onglet A : tenter une action (modifier le profil)
  Vérifier que l'action échoue avec une erreur 401/403 et que l'utilisateur est redirigé.

- **[MULTI-04]** **Mise à jour du profil dans un onglet → l'autre onglet voit les changements** : 
  1. Onglet A : `/settings`, modifier le username
  2. Onglet B : sur n'importe quelle page, vérifier que le nouveau username s'affiche (après refetch).
  Note : ceci teste le comportement actuel (pas de sync temps réel via broadcast). Documenter que ce n'est pas supporté.

- **[MULTI-05]** **Achat de crédits dans un onglet → solde mis à jour dans l'autre** : 
  1. Onglet A : `/billing`, acheter des crédits
  2. Onglet B : sur `/dashboard`, vérifier que l'affichage des crédits reste sur l'ancienne valeur (pas de broadcast). Recharger la page → les nouveaux crédits s'affichent.
  Documenter la limite.

---

## 7. Optimistic updates et rollbacks

### ⬜ Nouveaux scénarios

- **[OPT-01]** **Rollback visuel d'une réaction en cas d'erreur** : 
  Simuler une erreur de l'API `toggleLike`. Vérifier que le compteur de réactions dans `ReactionBar` revient à sa valeur précédente (pas d'incrément permanent côté UI si l'API échoue).

- **[OPT-02]** **Rollback de la suppression d'un commentaire (admin)** : 
  Dans `CommentsSection`, un admin clique "Modérer" → confirm → erreur API. Vérifier que le commentaire reste affiché (pas de suppression côté UI).

- **[OPT-03]** **Rollback visuel de création de scénario** : 
  Soumettre le formulaire de création → erreur API. Vérifier que l'utilisateur reste sur la page `/create`, que les champs ne sont pas effacés, et que le toast d'erreur s'affiche.

- **[OPT-04]** **État de chargement (pending) désactive correctement les interactions** : 
  Vérifier pour chaque mutation que `isPending` désactive le bouton déclencheur :
  - `ReportButton` : bouton Signaler désactivé
  - `CommentsSection` : bouton Envoyer désactivé  
  - `SettingsPageClient` : bouton Enregistrer désactivé
  - `BlockedNumbersPageClient` : bouton Bloquer désactivé
  - `ModerationPageClient` : boutons Approuver/Rejeter désactivés

- **[OPT-05]** **Réaction bar — verrouillage optimiste** : 
  Cliquer sur un émoji dans `ReactionBar`. Immédiatement (sans attendre la réponse API), essayer de cliquer sur un autre émoji. Vérifier que `toggleMutation.isPending` empêche la seconde interaction.

---

## 8. localStorage et persistance

### ⬜ Nouveaux scénarios

- **[STO-01]** **localStorage indisponible (mode incognito strict)** : 
  Simuler `localStorage.setItem` qui throw (via `page.evaluate` pour le bloquer). Naviguer vers `/create` et cliquer "Annuler". Vérifier que le try/catch dans `handleCancel` empêche le crash et que la navigation se fait normalement.

- **[STO-02]** **localStorage bloqué pour le disclaimer d'appel** : 
  Simuler `localStorage` bloqué. Naviguer vers une page qui déclenche `CallDisclaimerDialog`. Vérifier que le try/catch empêche le crash et que l'appel peut toujours être démarré (le disclaimer sera affiché à chaque visite).

- **[STO-03]** **Thème persistant dans localStorage** : 
  1. Naviguer vers le site.
  2. Cliquer sur `ThemeToggle` pour passer en mode clair.
  3. Recharger la page.
  Vérifier que le thème clair est restauré (via `storageKey: "echoroom-theme"`).

- **[STO-04]** **Consent banner — statut lu depuis localStorage** : 
  Vérifier que le composant `ConsentBanner` se base sur une requête API (`getConsentStatus`) et non sur localStorage. Après retrait de consentement, recharger la page → le bandeau doit s'afficher.

- **[STO-05]** **Draft de création — effacement après soumission réussie** : 
  1. Remplir le formulaire `/create`.
  2. Vérifier que le draft est sauvegardé dans `localStorage` (`echoroom-create-draft`).
  3. Soumettre avec succès.
  4. Vérifier que le draft est effacé de localStorage.

- **[STO-06]** **Draft de création — effacement après annulation** : 
  Test existant mais doit être étendu pour vérifier la suppression même si localStorage contenait des données corrompues avant l'action.

---

## 9. Cache et invalidation

### ⬜ Nouveaux scénarios

- **[CACHE-01]** **Création d'un scénario → invalidation du feed communauté** : 
  1. Naviguer vers `/community` (feed chargé).
  2. Naviguer vers `/create`, créer un scénario.
  3. Naviguer vers `/community` — vérifier que le nouveau scénario apparaît dans le feed via `feedQuery.refetch()`.

- **[CACHE-02]** **Like sur un scénario → mise à jour du compteur sur les cards** : 
  1. Naviguer vers `/scenario/[id]`.
  2. Liker le scénario via `ReactionBar` (qui appelle `reactionsQuery.refetch()`).
  3. Naviguer vers `/community` — vérifier que le compteur de likes sur la `ScenarioCard` est mis à jour.

- **[CACHE-03]** **Modération d'un commentaire → invalidation de la file de modération** : 
  Dans `CommentModerationTab`, approuver/rejeter un commentaire. Vérifier que `utils.admin.moderationQueueComments.refetch()` est appelé et que la liste se met à jour sans rechargement de page.

- **[CACHE-04]** **Changement de mot de passe → invalidation de session** : 
  Changer le mot de passe dans `/settings`, vérifier que l'utilisateur est déconnecté (si c'est le comportement) ou que la session reste valide. Documenter le comportement actuel.

---

## 10. Gestion d'état et contextes

### ⬜ Nouveaux scénarios

- **[STATE-01]** **Erreur du `ToastProvider` inaccessible** : 
  Simuler un scénario où `useToast()` est appelé hors d'un `ToastProvider`. Vérifier que l'erreur "useToast must be used within <Toaster>" est bien levée, et que ce cas est géré dans tous les composants utilisant `toast()`.

- **[STATE-02]** **Changement de thème — persistance entre pages** : 
  1. Naviguer sur `/explore`.
  2. Changer le thème via `ThemeToggle`.
  3. Naviguer sur `/community`.
  Vérifier que le thème choisi est conservé (via le provider `next-themes` avec `storageKey: "echoroom-theme"`).

- **[STATE-03]** **État de session : authentification requise** : 
  Tenter d'accéder à `/dashboard` sans être connecté. Vérifier que `middleware.ts` redirige vers `/login?callbackUrl=/dashboard`. Test similaire pour `/admin/*`.

- **[STATE-04]** **Rôle insuffisant pour l'admin** : 
  Se connecter en tant qu'utilisateur USER, tenter d'accéder à `/admin`. Vérifier que `middleware.ts` redirige vers `/dashboard` (car `session?.user?.role !== "ADMIN"`).

---

## 11. Accessibilité et focus

### ⬜ Nouveaux scénarios

- **[A11Y-01]** **Focus trap dans les dialogues** : 
  Ouvrir le `ConfirmDialog` pour la suppression de compte. Appuyer sur Tab plusieurs fois. Vérifier que le focus reste piégé dans le dialogue (ne peut pas atteindre les éléments en arrière-plan). Vérifier la boucle Tab + Shift+Tab.

- **[A11Y-02]** **Focus retour après fermeture de dialogue** : 
  Ouvrir un `Dialog` (ex: `ReportButton`), le fermer. Vérifier que le focus retourne sur l'élément qui a déclenché l'ouverture, grâce à `previousFocusRef.current?.focus()` dans `useFocusTrap`.

- **[A11Y-03]** **Skip-to-content link** : 
  Naviguer vers n'importe quelle page. Appuyer sur Tab au chargement. Vérifier que le premier élément focusable est "Aller au contenu principal" (dans `layout.tsx`) et qu'il redirige vers `#main-content`.

- **[A11Y-04]** **aria-live pour les notifications** : 
  Déclencher un toast de succès. Vérifier que le `<div>` du `Toaster` est lu par les lecteurs d'écran. Déclencher une notification de badge (`BadgeNotification`) — vérifier `role="status"` et `aria-live="polite"`.

- **[A11Y-05]** **Labels ARIA sur les icônes seules** : 
  Vérifier que tous les boutons avec uniquement une icône ont un `aria-label` explicite :
  - `ThemeToggle` : "Changer le thème"
  - `ReportButton` : "Signaler"
  - `ShareButtons` : "Partager"
  - Bouton "Fermer" des dialogues
  - `EmojiPicker` boutons : "Réagir avec ❤️"

- **[A11Y-06]** **Contraste des status badges** : 
  Vérifier que les badges `destructive` (FAILED) et `success` ont un ratio de contraste suffisant sur fond dark/light. Vérifier les variantes dans `PasswordStrengthMeter` (vert, orange, rouge).

---

## 12. Gestion des erreurs et Error Boundaries

### ⬜ Nouveaux scénarios

- **[ERR-01]** **Error boundary globale (app/error.tsx)** : 
  Planter volontairement un composant (ex: en simulant une erreur de rendu côté client). Vérifier que l'Error page s'affiche avec le message "Une erreur est survenue", le code d'erreur `error.digest`, le bouton "Copier" et le bouton "Réessayer".

- **[ERR-02]** **Error page 404 personnalisée** : 
  Naviguer vers `/page-inexistante`. Vérifier que `NotFound` s'affiche avec le code 404, le message "Oops — cette page n'existe pas" et le bouton "Retour à l'accueil".

- **[ERR-03]** **Erreur de requête sur page de détail scénario** : 
  Simuler une erreur 500 sur `api.scenarios.getById`. Vérifier que `ScenarioDetailClient` affiche l'état d'erreur avec l'icône `AlertTriangle`, le message d'erreur et le bouton "Réessayer".

- **[ERR-04]** **Erreur 429 (rate limiting) sur le feed communautaire** : 
  Simuler une erreur 429 du serveur. Vérifier que `DataLoader` affiche l'état d'erreur sans crash. Vérifier que le message d'erreur est affiché.

- **[ERR-05]** **Erreur de chargement audio — URL invalide** : 
  Sur `/call/[callId]`, fournir une `recordingUrl` invalide. Vérifier que `AudioPlayer` passe en état `hasError` et affiche "Chargement impossible" avec "L'audio n'est pas accessible. Réessayez."

---

## 13. Cache React Query spécifique

### ⬜ Nouveaux scénarios

- **[RQ-01]** **RefetchOnWindowFocus désactivé** : 
  Vérifier que `refetchOnWindowFocus: false` est bien configuré dans `TRPCReactProvider` (ligne 22). Puis : charger `/dashboard`, basculer vers un autre onglet pendant 10s, revenir. Vérifier qu'aucune requête réseau n'est automatiquement relancée.

- **[RQ-02]** **Cache hit entre deux visites sur `/scenario/[id]`** : 
  1. Visiter `/scenario/abc`.
  2. Visiter `/community`.
  3. Dans les 30 secondes, revisiter `/scenario/abc`.
  Vérifier via le network tab que la requête `scenarios.getById` n'est pas renvoyée (staleTime de 30s).

- **[RQ-03]** **StaleTime dépassé → refetch silencieux** : 
  1. Visiter `/scenario/abc`.
  2. Attendre 35 secondes (dépassement de staleTime = 30s).
  3. Interagir avec la page (ex: cliquer sur un bouton).
  Vérifier qu'une refetch silencieuse (background refetch) a lieu sans afficher de skeleton/loader.

---

## 14. Gestion des mutations tRPC

### ⬜ Nouveaux scénarios

- **[TRPC-01]** **Mutation avec onSuccess → refetch et reset du formulaire** : 
  Vérifier pour chaque mutation le pattern : `onSuccess: () => { query.refetch(); setState(""); }` :
  - `CommentsSection.commentMutation` : refetch + reset commentInput
  - `ReactionBar.toggleMutation` : refetch reactionsQuery
  - `ReportButton.reportMutation` : close dialog + reset reason
  - `BlockedNumbersPageClient.blockMutation` : refetch + reset phoneNumber/reason
  - `ScenarioDetailClient.ClipCreator.createClipMutation` : reset form fields

- **[TRPC-02]** **Mutation avec onError → toast et préservation de l'état** : 
  Pour chaque mutation avec onError, vérifier que :
  - Le toast d'erreur s'affiche avec le message de l'API
  - L'état du formulaire n'est PAS réinitialisé (l'utilisateur peut corriger et réessayer)

- **[TRPC-03]** **useApiToast — wrapper de toast automatique** : 
  Vérifier que `useApiToast` (utilisé dans `RegisterPage`, `SettingsPageClient.createPage`) affiche correctement :
  - Toast "Compte créé avec succès !" sur succès
  - Toast avec `err.message` sur erreur

---

## 15. Divers / Cas limites

### ⬜ Nouveaux scénarios

- **[EDGE-01]** _URLSearchParams `get` appelé côté serveur (SSR)_ : 
  Dans `ExplorePage`, `readInitialParams()` utilise `typeof window !== "undefined"` avant d'appeler `URLSearchParams`. Vérifier que la page ne crash pas en SSR (premier rendu serveur).

- **[EDGE-02]** **Hydration mismatch du `LiveCounter`** : 
  La page d'accueil utilise `useState(() => Math.floor(1800 + Math.random() * 2400))` pour `LiveCounter`. Vérifier qu'il n'y a pas d'erreur d'hydratation car la valeur est générée côté client.

- **[EDGE-03]** **Hydration mismatch du `CallAudioVisualizer`** : 
  Même pattern avec `Math.random()` pour les hauteurs des barres. Vérifier qu'il n'y a pas d'erreur d'hydratation.

- **[EDGE-04]** **Date invalide dans `toLocaleDateString`** : 
  Simuler une date invalide dans les commentaires ou les logs d'audit. Vérifier que `new Date(invalidDate)` ne fait pas planter le rendu.

- **[EDGE-05]** **Caractères spéciaux dans les noms d'utilisateur** : 
  Créer un utilisateur avec un username contenant des espaces, des emojis, ou des caractères Unicode (ex: "👑 Admin", "Jean-Claude"). Vérifier l'affichage dans `CommentsSection`, `ScenarioCard`, `AdminSidebar`.

- **[EDGE-06]** **Très grand nombre de commentaires** : 
  Simuler 1000+ commentaires sur un scénario. Vérifier que la pagination fonctionne, que le compteur affiche "1,0k" (format français), et que le chargement est progressif.

- **[EDGE-07]** **Fermeture du navigateur pendant une mutation** : 
  Démarrer la création d'un scénario, fermer le navigateur immédiatement après. Vérifier que :
  - Côté client : pas de crash avant la fermeture
  - Côté serveur : la transaction Prisma rollback si non aboutie (via test unitaire existant `concurrency.test.ts`)

---

## Synthèse des manques critiques

| Priorité | Thème | Justification |
|----------|-------|---------------|
| 🔴 **P0** | Offline / Réseau | Aucun test E2E existant, impact UX majeur |
| 🔴 **P0** | Sécurité XSS | Aucun test, risque de sécurité élevé |
| 🔴 **P0** | Session multi-onglet | Comportement utilisateur réel non testé |
| 🟡 **P1** | Accessibilité | Tests focus trap et aria essentiels |
| 🟡 **P1** | i18n formatage | Risque de rupture silencieuse des formats |
| 🟡 **P1** | Concurrence avancée | Double-clic pas testé sur tous les formulaires |
| 🟢 **P2** | Cache invalidation | Optimisation, pas de bug bloquant |
| 🟢 **P2** | Optimistic updates étendus | Rollbacks partiellement testés |

---

*Document généré le 24/06/2026 — 52 nouveaux scénarios E2E identifiés pour les aspects transversaux.*
