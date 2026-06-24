# 🎯 Round 2 — Agent 5 : Scénarios Mobile (Expo), Desktop (Electron) & CI/CD

> **Analyse statique du code source** — 24 juin 2026  
> **Périmètre** : `echoroom-mobile/`, `echoroom-desktop-electron/`, `.github/workflows/`, `playwright.config.ts`, `infra/terraform/`, `turbo.json`  
> **Méthode** : Reverse-engineering exhaustif de la configuration et du code source  
> **Objectif** : Identifier 70+ scénarios manquants pour les plateformes mobile, desktop et l'intégration continue

---

## Résumé des Découvertes

| Section | Sous-section | Scénarios trouvés |
|---------|-------------|:-----------------:|
| 1. Mobile (Expo) | Navigation & Deep Links | 8 |
| 2. Mobile (Expo) | Permissions & Offline | 8 |
| 3. Mobile (Expo) | Synchronisation API & Storage | 10 |
| 4. Mobile (Expo) | Gestes & Interactions Tactiles | 8 |
| 5. Mobile (Expo) | Build & Déploiement | 5 |
| 6. Desktop (Electron) | Fenêtres, Menus & Tray | 10 |
| 7. Desktop (Electron) | Intégration OS | 8 |
| 8. Desktop (Electron) | Sécurité & Isolation | 6 |
| 9. Desktop (Electron) | Build & Distribution | 6 |
| 10. CI/CD — CI Workflow | Qualité & Testing | 10 |
| 11. CI/CD — CI Workflow | Build & Environnement | 8 |
| 12. CI/CD — Release | Changesets & Versioning | 5 |
| 13. CI/CD — Terraform | Infrastructure | 6 |
| 14. Playwright Config | Configuration E2E | 6 |
| 15. Build & Deploy (Turbo) | Monorepo Orchestration | 5 |
| **TOTAL** | | **~109 scénarios** |

---

## Légende

- ⬜ À coder (nouveau test E2E)
- 🔴 Bug potentiel détecté par analyse statique
- 🟠 Risque moyen
- 🟡 Faible risque / amélioration

---

# PARTIE 1 — Mobile Expo (`echoroom-mobile/`)

## 1.1 Navigation & Deep Links

Le projet mobile Expo utilise `@react-navigation/native-stack` avec un seul écran `HomeScreen`. L'URL scheme est `echoroom://`.

### ⬜ Nouveaux scénarios

- [ ] **1.1.1 — Deep link : ouverture depuis un lien `echoroom://`** — Tester qu'un clic sur `echoroom://scenario/abc123` ouvre l'application et navigue vers le bon écran. Actuellement, un seul écran existe → doit au minimum ouvrir l'app sans crash.
- [ ] **1.1.2 — Deep link : URL malformée `echoroom://///scenario`** — Tester que les deep links avec des slashes supplémentaires ne crashent pas l'application.
- [ ] **1.1.3 — Deep link : scheme inconnu `echorooms://scenario`** — Tester que l'app ignore les schemes non enregistrés (ne doit pas s'ouvrir).
- [ ] **1.1.4 — Navigation Stack : push d'un écran → retour arrière** — Tester que `navigation.navigate('ScenarioDetail', { id })` ajoute bien l'écran à la pile et que le bouton retour fonctionne (actuellement pas de second écran).
- [ ] **1.1.5 — Navigation : paramètres manquants dans `navigate`** — Tester `navigation.navigate('ScenarioDetail')` sans paramètre `id` → ne doit pas crash (Zod validation ou fallback).
- [ ] **1.1.6 — Deep link : paramètres de query dans l'URL** — Tester `echoroom://scenario?id=abc` vs `echoroom://scenario/abc` (les deux formats doivent être gérés ou documentés).
- [ ] **1.1.7 — Linking.getInitialURL() au démarrage** — Tester que l'app ouverte depuis un lien gère correctement `Linking.getInitialURL()` (cold start). Si l'app est fermée et qu'on ouvre via un lien, elle doit naviguer vers le bon écran.
- [ ] **1.1.8 — 🔴 Bug : un seul écran HomeScreen dans le Stack** — Le `Stack.Navigator` ne contient qu'un écran `Home`. Si on navigue vers `/scenario/[id]`, il n'y a pas d'écran enregistré → crash ou écran blanc. Tester que la navigation vers une route inexistante est gérée avec un fallback.

## 1.2 Permissions & États Offline

Le projet utilise `expo-status-bar` et nécessitera microphone pour les appels (Twilio). Aucune gestion de permissions n'est encore codée.

### ⬜ Nouveaux scénarios

- [ ] **1.2.1 — Permission microphone : refusée au premier appel** — Tester que l'app demande la permission microphone via `expo-av` ou `expo-permissions` avant de lancer un appel. Permission refusée → message explicite, pas de crash.
- [ ] **1.2.2 — Permission microphone : accordée après refus** — Tester `Permissions.askAsync(Permissions.MICROPHONE)` après avoir refusé → iOS demande à nouveau, Android 13+ nécessite réglage manuel → message approprié.
- [ ] **1.2.3 — Permission microphone : statut indéterminé** — Tester `Permissions.getAsync()` retourne `undetermined` → l'app doit montrer l'écran de bienvenue avec explication.
- [ ] **1.2.4 — Permission notifications push : refusée** — Tester que le refus des notifications n'empêche pas le fonctionnement normal de l'app (démarrage, navigation).
- [ ] **1.2.5 — 🔴 Offline : démarrage sans connexion réseau** — Tester que l'écran HomeScreen s'affiche sans crash quand il n'y a pas de connexion (le composant actuel est purement local, donc pas de problème — mais futur chargement API doit gérer offline).
- [ ] **1.2.6 — Offline → Online : reprise de connexion** — Tester que le retour à la connexion après un état offline rétablit les appels API sans double appel.
- [ ] **1.2.7 — Offline : timeout réseau lent (> 30s)** — Tester qu'une requête API avec timeout (30s Next.js) affiche un message d'erreur lisible et non pas un écran blanc figé.
- [ ] **1.2.8 — 🔴 Permission microphone : vérification persistée (AsyncStorage)** — Tester que le choix de permission est persisté dans AsyncStorage et que l'app ne redemande pas systématiquement au lancement.

## 1.3 Synchronisation API & Stockage Local

Le mobile doit synchroniser les données avec l'API backend via tRPC. Aucun code de synchronisation n'est encore présent.

### ⬜ Nouveaux scénarios

- [ ] **1.3.1 — Synchronisation : connexion API avec token JWT stocké** — Tester que le token d'authentification (session NextAuth) est stocké dans le SecureStore d'Expo et envoyé dans chaque requête API.
- [ ] **1.3.2 — Synchronisation : token expiré → refresh automatique** — Tester que lorsque l'API retourne 401, l'app tente un refresh token silencieux avant de rediriger vers login.
- [ ] **1.3.3 — Synchronisation : données mises en cache localement (AsyncStorage)** — Tester que les scénarios récents sont stockés localement et accessibles hors-ligne (lecture seule).
- [ ] **1.3.4 — Synchronisation : conflit de mise à jour (dernière écriture gagne)** — Tester que si le backend a des données plus récentes que le cache local, le cache est mis à jour silencieusement.
- [ ] **1.3.5 — Synchronisation : purge du cache si > 50 entrées** — Tester que le cache local n'explose pas — un mécanisme d'éviction (LRU) limite le stockage.
- [ ] **1.3.6 — Background fetch : rafraîchissement périodique** — Tester qu'en arrière-plan (ex: toutes les 15 min), l'app rafraîchit les données via `expo-background-fetch`.
- [ ] **1.3.7 — 🔴 App State : foreground → background → foreground** — Tester que le passage en arrière-plan (home button) puis le retour conserve l'état de l'écran (pas de re-render complet, pas de perte de formulaire).
- [ ] **1.3.8 — Synchronisation : upload audio en arrière-plan** — Tester que l'enregistrement audio (via `expo-av` recording) continue en arrière-plan sans être coupé par le système d'exploitation.
- [ ] **1.3.9 — Synchronisation : échec upload → file d'attente offline** — Tester que si l'upload audio échoue (réseau perdu), l'enregistrement est mis en file d'attente et retenté automatiquement au retour de connexion.
- [ ] **1.3.10 — Synchronisation : connexion interrompue pendant un appel API** — Tester que `fetch()` avec `AbortController` timeout proprement et que l'état UI revient à l'état précédent sans corruption.

## 1.4 Gestes & Interactions Tactiles

Le mobile React Native doit gérer les interactions spécifiques au tactile.

### ⬜ Nouveaux scénarios

- [ ] **1.4.1 — Swipe pour révéler les actions (swipe-to-delete)** — Tester que glisser un élément vers la gauche révèle le bouton "Supprimer" avec retour haptique.
- [ ] **1.4.2 — Pull-to-refresh sur la liste des scénarios** — Tester qu'un pull-to-refresh (RefreshControl) recharge les données avec un spinner natif.
- [ ] **1.4.3 — Long press pour copier le texte** — Tester qu'un appui long sur un texte de scénario ouvre le menu contextuel "Copier" (Clipboard API).
- [ ] **1.4.4 — Double tap pour "liker" un scénario** — Tester qu'un double tap rapide sur une carte scénario toggle le like (comme Instagram).
- [ ] **1.4.5 — Scroll infini (infinite scroll)** — Tester que le scroll en bas de page charge automatiquement la page suivante (pagination cursor-based).
- [ ] **1.4.6 — Pinch-to-zoom sur l'audio waveform** — Tester que pincer pour zoomer sur la forme d'onde audio fonctionne (si implémenté).
- [ ] **1.4.7 — Gestes : conflit scroll horizontal vs vertical** — Tester que les gestes horizontaux (carrousels) et verticaux (listes) ne se bloquent pas mutuellement.
- [ ] **1.4.8 — Keyboard avoidance : input caché par le clavier** — Tester que `KeyboardAvoidingView` remonte correctement les champs de formulaire lors de l'ouverture du clavier (mode `padding` sur iOS, `height` sur Android).

## 1.5 Build & Déploiement Mobile

Le `app.json` configure Expo avec le scheme `echoroom` et les plateformes iOS, Android, Web.

### ⬜ Nouveaux scénarios

- [ ] **1.5.1 — Build EAS : expo start --web fonctionne** — Tester que `pnpm --filter @echoroom/mobile dev` lance le bundler web sans erreur.
- [ ] **1.5.2 — Build : version dans app.json correspond à package.json** — Tester que la version 0.1.0 est cohérente entre `app.json` et `package.json` (généralement synchronisées par `expo-version`).
- [ ] **1.5.3 — 🔴 Android : orientation portrait forcée** — Tester que l'app ne se met pas en paysage malgré `"orientation": "portrait"` (vérifier que `AndroidManifest.xml` exporté contient `screenOrientation="portrait"`).
- [ ] **1.5.4 — Scheme URL : `echoroom://` enregistré sur iOS** — Tester que le `CFBundleURLSchemes` contient `echoroom` dans le `app.json` et que l'ouverture de lien fonctionne (Universal Links iOS).
- [ ] **1.5.5 — App icon & splash screen configurés** — Tester que les icônes et l'écran de splash définis dans `app.json` pointent vers des fichiers existants (pas de 404 asset).
- [ ] **1.5.6 — 🔴 Bug : pas de gestion des mise à jour OTA (EAS Update)** — Tester que le projet n'a pas configuré `expo-updates` (actuellement absent des dépendances). Si un bug critique est déployé, les utilisateurs doivent mettre à jour manuellement via l'App Store.

---

# PARTIE 2 — Desktop Electron (`echoroom-desktop-electron/`)

## 2.1 Fenêtres, Menus & Tray

L'application Electron charge `WEB_APP_URL` (défaut `https://echoroom.app`) dans une `BrowserWindow` de 1200x800 avec `contextIsolation: true`.

### ⬜ Nouveaux scénarios

- [ ] **2.1.1 — Fenêtre : création avec dimensions par défaut 1200x800** — Tester que `createWindow()` crée une fenêtre de 1200x800 pixels (vérifier via `getBounds()`).
- [ ] **2.1.2 — Fenêtre : titre "EchoRoom" défini** — Tester que le titre de la fenêtre est "EchoRoom" (pas vide, pas le titre de la page web).
- [ ] **2.1.3 — Fenêtre : taille minimum configurée** — Tester que la fenêtre ne peut pas être redimensionnée en dessous de 800x600 (minWidth/minHeight non défini → comportement par défaut).
- [ ] **2.1.4 — 🔴 Bug : pas de menu applicatif personnalisé** — Tester qu'aucun menu personnalisé n'est défini (Menu.setApplicationMenu). Actuellement, le menu par défaut d'Electron s'affiche avec "Fichier", "Édition", etc. Tester qu'il ne contient pas d'options sensibles non désirées.
- [ ] **2.1.5 — Tray icon : pas de systray configuré** — Tester que l'application ne met PAS d'icône dans la barre système (absence de `Tray`). Si l'utilisateur ferme la fenêtre, l'app se ferme complètement (pas de background).
- [ ] **2.1.6 — Fenêtre : `window-all-closed` → app.quit() sauf darwin** — Tester que sur Windows/Linux, la fermeture de toutes les fenêtres quitte l'application. Sur macOS, l'app reste active. Vérifier `process.platform !== "darwin"`.
- [ ] **2.1.7 — Fenêtre : `activate` recrée la fenêtre si aucune** — Tester que cliquer sur l'icône du dock macOS quand la fenêtre est fermée recrée une fenêtre (via l'événement `activate`).
- [ ] **2.1.8 — Fenêtre : `loadURL` avec URL invalide** — Tester que si `WEB_APP_URL` est une URL malformée (ex: `not-a-url`), `loadURL` throw une erreur. Vérifier la gestion (actuellement pas de try/catch).
- [ ] **2.1.9 — Fenêtre : `loadURL` avec connexion refusée (ERR_CONNECTION_REFUSED)** — Tester que si le serveur web est down, la fenêtre affiche une page d'erreur Electron par défaut (pas de crash de l'app).
- [ ] **2.1.10 — Fenêtre : `webPreferences.nodeIntegration: false` vérifié** — Tester que `require()` n'est pas accessible depuis la page web chargée (sécurité renforcée). `contextIsolation: true` ET `nodeIntegration: false` sont la bonne combinaison.

## 2.2 Intégration OS

L'application doit s'intégrer aux fonctionnalités natives du système d'exploitation.

### ⬜ Nouveaux scénarios

- [ ] **2.2.1 — Notifications OS : réception d'une notification système** — Tester qu'une notification (via `Notification` API) apparaît dans le centre de notifications de l'OS. L'app doit demander la permission via `Notification.requestPermission()`.
- [ ] **2.2.2 — Notifications OS : clic sur notification → focus fenêtre** — Tester que cliquer sur une notification système remet la fenêtre de l'application au premier plan (focus + show).
- [ ] **2.2.3 — 🔴 Dock (macOS) : badge avec le nombre de notifications** — Tester que `app.dock.setBadge()` est appelé pour afficher le nombre de notifications non lues sur l'icône du dock.
- [ ] **2.2.4 — Permissions microphone : demande au niveau OS** — Tester que l'app demande la permission d'accès au microphone via `systemPreferences.getMediaAccessStatus('microphone')` sur macOS et `navigator.mediaDevices.getUserMedia` sur Windows.
- [ ] **2.2.5 — Permissions microphone : refus persisté** — Tester que si l'utilisateur refuse la permission microphone dans les préférences système, l'app détecte le refus et affiche un message "Allez dans Préférences Système > Confidentialité > Microphone".
- [ ] **2.2.6 — Deep links : enregistrement du protocole `echoroom://` sur l'OS** — Tester que les liens `echoroom://` sont redirigés vers l'application de bureau (nécessite `app.setAsDefaultProtocolClient('echoroom')` — actuellement NON implémenté).
- [ ] **2.2.7 — Auto-launch au démarrage de l'OS** — Tester que l'option "Lancer au démarrage" (via `app.setLoginItemSettings({ openAtLogin: true })`) fonctionne (actuellement NON implémenté).
- [ ] **2.2.8 — Global shortcut : raccourci clavier global (ex: Ctrl+Shift+E) pour ouvrir l'app** — Tester que `globalShortcut.register('CommandOrControl+Shift+E', ...)` fonctionne pour ramener l'app au premier plan (actuellement NON implémenté).

## 2.3 Sécurité & Isolation

Electron nécessite une configuration de sécurité rigoureuse.

### ⬜ Nouveaux scénarios

- [ ] **2.3.1 — 🔴 Bug : pas de Content-Security-Policy en-tête via session** — Tester que `session.defaultSession.webRequest.onHeadersReceived` n'est pas configuré pour ajouter CSP. Les pages chargées via `loadURL` héritent uniquement des CSP du serveur web.
- [ ] **2.3.2 — Preload script : `contextBridge.exposeInMainWorld` expose `platform`** — Tester que `window.electronAPI.platform` est accessible depuis la page web et retourne `process.platform` (win32, darwin, linux).
- [ ] **2.3.3 — Preload script : pas d'exposition de `require` ou `process`** — Tester que `window.require`, `window.process`, `window.Buffer` sont `undefined` dans la page web (contextIsolation fonctionnelle).
- [ ] **2.3.4 — 🔴 Bug : pas de navigation limitée (`webPreferences.webSecurity`)** — Tester que l'app ne restreint pas la navigation à des domaines autorisés (pas de `will-navigate` filter). Un clic sur un lien externe navigue librement.
- [ ] **2.3.5 — 🔴 Bug : pas de `new-window` event handler** — Tester que l'événement `webContents.setWindowOpenHandler` n'est pas configuré. Les fenêtres pop-up (via `window.open`) s'ouvrent directement dans le navigateur par défaut.
- [ ] **2.3.6 — Session : pas de partition de session** — Tester que `partition: 'persist:echoroom'` n'est pas configuré. La session utilise la session par défaut d'Electron, ce qui signifie que les cookies sont isolés par fenêtre mais pas par profil utilisateur.

## 2.4 Build & Distribution

Le package.json utilise `electron-builder` (`pack` et `dist`).

### ⬜ Nouveaux scénarios

- [ ] **2.4.1 — Build : `pnpm build` compile TypeScript vers dist/** — Tester que `tsc` génère `dist/main.js` et `dist/preload.js` sans erreur.
- [ ] **2.4.2 — Build : sourceMap activé** — Tester que `tsconfig.json` a `sourceMap: true` et que les fichiers `.js.map` sont générés (déjà le cas d'après le dossier `dist/`).
- [ ] **2.4.3 — Distribution : `pnpm pack` (electron-builder) génère un dossier executable** — Tester que `electron-builder --dir` produit un dossier avec l'exécutable sans erreur.
- [ ] **2.4.4 — 🔴 Bug : pas de configuration electron-builder** — Tester que le fichier `package.json` ne contient PAS de section `"build"` (electron-builder config). Les scripts `pack` et `dist` utilisent les valeurs par défaut d'electron-builder (icône générique, nom par défaut, etc.).
- [ ] **2.4.5 — 🔴 Bug : pas de icône d'application** — Tester qu'aucun fichier `build/icon.*` n'existe. L'icône générique d'Electron est utilisée dans la barre des tâches, le dock, et le Finder.
- [ ] **2.4.6 — Distribution : EXE (Windows) et DMG (macOS) générés** — Tester que `pnpm dist` génère un `.exe` sur Windows et un `.dmg` sur macOS (vérifier la plateforme automatiquement détectée).

---

# PARTIE 3 — CI/CD GitHub Actions

## 3.1 CI Workflow (`.github/workflows/ci.yml`)

Le workflow CI actuel : `on: pull_request` et `push` vers `main`. Job unique `quality` : typecheck → lint → test → build. Timeout 15 min.

### ⬜ Nouveaux scénarios

- [ ] **3.1.1 — 🔴 Bug : Pas de parallelisation entre typecheck, lint, test** — Tester que les 4 étapes (typecheck, lint, test, build) sont SÉQUENTIELLES (même job). Si lint prend 3 min, typecheck doit attendre. Proposition : utiliser 3 jobs parallèles avec matrice.
- [ ] **3.1.2 — 🔴 Bug : Pas de test E2E (Playwright) dans la CI** — Tester que `pnpm test:e2e` (Playwright) n'est PAS exécuté dans le workflow CI. Seuls les tests unitaires (`vitest run`) tournent. Les tests E2E sont orphelins de la CI.
- [ ] **3.1.3 — 🔴 Bug : `NODE_OPTIONS: "--max-old-space-size=4096"` sans vérification mémoire** — Tester que si le runner a moins de 4GB de RAM (GitHub ubuntu-latest ≈ 7GB), la limite n'est pas trop restrictive. La variable est appliquée à typecheck ET test.
- [ ] **3.1.4 — Cache pnpm : utilise l'action setup-node intégrée** — Tester que `actions/setup-node@v4` avec `cache: pnpm` utilise le bon chemin de cache (pnpm-lock.yaml). Vérifier restore-keys pour hit ratio.
- [ ] **3.1.5 — 🔴 Turbo cache : clé basée uniquement sur `github.sha`** — Tester que la clé de cache Turbo est `${{ runner.os }}-turbo-${{ github.sha }}`. Cette clé est UNIQUE par commit → le cache n'est JAMAIS restauré pour un commit différent (même avec restore-keys). Le cache Turbo est inutile car jamais hit sur des commits différents.
- [ ] **3.1.6 — 🔴 Bug : `restore-keys` du cache Turbo: `${{ runner.os }}-turbo-`** — Tester que le restore-keys correspond à un préfixe trop générique. Le cache Turbo ne peut PAS être réutilisé entre runs car la clé exacte ne match jamais (sha différent). Impact : le build est toujours full, pas de cache.
- [ ] **3.1.7 — 🔴 Bug : `.env` créé avec des secrets en clair dans le job** — Tester que le fichier `.env` est créé via `cat > echoroom-web/.env << 'EOF'` avec des valeurs hardcodées comme `sk_test_ci`, `ci_key`, etc. Ces valeurs CI apparaissent dans les logs GitHub Actions (mais ce sont des valeurs CI factices, sans risque réel).
- [ ] **3.1.8 — Timeout : `timeout-minutes: 15` pour tout le job** — Tester que si typecheck + lint + tests + build prennent > 15 min, le job est annulé. Vérifier que le temps cumulé ne dépasse pas 15 min (risque si la suite de tests grandit).
- [ ] **3.1.9 — 🔴 Bug : Pas d'exécution de la génération Prisma dans l'étape de test** — Tester que `pnpm db:generate` (Prisma Client) est exécuté AVANT `pnpm typecheck` et `pnpm test`. Mais les tests unitaires utilisent-ils Prisma ? Si oui, le client doit être généré avant.
- [ ] **3.1.10 — 🔴 Bug : Pas de matrice OS (ubuntu/macos/windows)** — Tester que le workflow ne tourne QUE sur `ubuntu-latest`. Aucune vérification sur macOS (Electron) ou Windows (Desktop). L'app Electron pourrait casser sur Windows sans que la CI ne le détecte.

## 3.2 CI Workflow — Améliorations Build & Environnement

### ⬜ Nouveaux scénarios

- [ ] **3.2.1 — 🔴 Bug : `CI` env var non définie** — Tester que la variable d'environnement `CI` n'est pas explicitement définie dans le workflow. Playwright config vérifie `process.env['CI']` pour activer les retries (2) et workers (1). Si la variable n'est pas définie par GitHub Actions automatiquement (elle l'est : `CI=true`), le comportement est correct. Tester que Playwright utilise bien les retries en CI.
- [ ] **3.2.2 — 🔴 Bug : `PLAYWRIGHT_BASE_URL` non définie dans la CI** — Tester que `PLAYWRIGHT_BASE_URL` n'est pas défini dans les `env` du workflow. Playwright utilise donc `http://localhost:3000` par défaut (via la config). Vérifier que le webServer `pnpm dev` tourne bien sur le port 3000.
- [ ] **3.2.3 — Retry automatique des tests flaky** — Tester que Playwright retry 2 fois en CI (`retries: process.env['CI'] ? 2 : 0`). Vérifier que les traces sont capturées sur first-retry (`trace: "on-first-retry"`).
- [ ] **3.2.4 — Workers parallèles : limités à 1 en CI** — Tester que `workers: 1` est utilisé en CI (config actuelle). Avec 190+ tests existants et ~1000+ prévus, 1 worker ralentit considérablement. Proposer une matrice de sharding.
- [ ] **3.2.5 — Secret scanning : pas de détection de secret leak** — Tester qu'aucune action `secret-scanning` ou `gitleaks` n'est configurée. Si une clé CI est commitée accidentellement, elle n'est pas détectée.
- [ ] **3.2.6 — 🔴 Bug : Pas d'étape de migration DB (prisma migrate)** — Tester qu'aucune commande `pnpm db:migrate` ou `pnpm db:push` n'est exécutée dans la CI. Les tests unitaires qui utilisent Prisma ont besoin d'une base de données avec le bon schéma.
- [ ] **3.2.7 — GitHub Actions cache : pas de cache pour `node_modules`** — Tester que `pnpm install --frozen-lockfile` est exécuté à chaque run (environ 2-3 min). `actions/setup-node@v4` avec `cache: pnpm` met en cache le store pnpm mais pas le `node_modules` complet.
- [ ] **3.2.8 — 🔴 Bug : Pas de checkout `fetch-depth: 0` pour la CI** — Tester que l'étape checkout utilise `fetch-depth: 1` (par défaut). Le cache Turbo basé sur `github.sha` est correct mais les restore-keys ne servent à rien sans un historique de commits. `changesets` dans le release workflow utilise `fetch-depth: 0`.

## 3.3 Release Workflow (`.github/workflows/release.yml`)

### ⬜ Nouveaux scénarios

- [ ] **3.3.1 — Concurrency : `cancel-in-progress: false` pour release** — Tester que deux releases simultanées ne sont pas annulées. La concurrency group empêche les runs parallèles mais le second attend la fin du premier.
- [ ] **3.3.2 — 🔴 Bug : `node-version: 22` vs CI `node-version: 20`** — Tester que le release workflow utilise Node 22 alors que la CI utilise Node 20. Incohérence potentielle : le build de release pourrait utiliser des features Node 22 non disponibles en CI.
- [ ] **3.3.3 — Changesets : vérification des fichiers `.md` non-config** — Tester que `find .changeset -name '*.md' ! -name 'config.json'` trouve correctement les changesets. Si le répertoire `.changeset/` n'existe pas, le count est 0.
- [ ] **3.3.4 — 🔴 Bug : `git add -A` sans filtre** — Tester que `git add -A` dans le release workflow ajoute TOUS les fichiers modifiés. Si un fichier non désiré (ex: `.env`) est présent, il est commité. Le `.gitignore` devrait protéger, mais tester la robustesse.
- [ ] **3.3.5 — 🔴 Bug : GitHub Releases créé pour chaque tag non existant** — Tester que le script `git tag --sort=-creatordate` boucle sur TOUS les tags et crée une release pour chacun. Si un tag existe déjà, il est sauté (`gh release view`). Mais si plusieurs tags existent, plusieurs releases sont créées dans le même run.

## 3.4 Terraform Workflow (`.github/workflows/terraform.yml`)

### ⬜ Nouveaux scénarios

- [ ] **3.4.1 — Path filter : ne s'exécute que pour `infra/terraform/**`** — Tester que le workflow Terraform ne se déclenche PAS pour des changements dans `echoroom-web/`. Le paths filter `infra/terraform/**` et `.github/workflows/terraform.yml` garantit cela.
- [ ] **3.4.2 — Plan (dev) : commentaire PR avec le plan** — Tester que `actions/github-script@v7` poste un commentaire sur la PR avec `steps.plan.outputs.stdout`. Vérifier que le plan n'est pas post si vide.
- [ ] **3.4.3 — 🔴 Bug : Plan (staging) avec les mêmes secrets que dev** — Tester que les jobs `plan-dev` et `plan-staging` utilisent les MÊMES secrets R2 (`secrets.R2_ACCESS_KEY_ID`). Aucune distinction d'environnement pour le backend state.
- [ ] **3.4.4 — 🔴 Bug : Apply (dev) sans plan préalable** — Tester que le job `apply-dev` s'exécute sur `push` vers `main` sans avoir besoin du job `plan-dev` (needs: [validate] seulement). Si le plan a échoué sur la PR, l'apply s'exécute quand même (risque).
- [ ] **3.4.5 — 🔴 Bug : Plan (prod) sans apply automatique** — Tester que `plan-prod` ne fait QUE le plan (pas d'apply automatique). C'est intentionnel : l'apply prod nécessite une intervention manuelle (non implémenté dans ce workflow).
- [ ] **3.4.6 — 🔴 Bug : `skip_credentials_validation = true` pour le backend R2** — Tester que le backend R2 est configuré avec toutes les options "skip" ce qui signifie que Terraform ne valide PAS les credentials avant de les utiliser. Si les secrets R2 sont invalides, l'init réussit mais le plan/apply échoue plus tard.

---

# PARTIE 4 — Playwright Configuration (`playwright.config.ts`)

## 4.1 Configuration des Tests E2E

### ⬜ Nouveaux scénarios

- [ ] **4.1.1 — 🔴 Bug : Pas de configuration multi-navigateurs** — Tester que `projects` n'est pas défini dans la config Playwright. Les tests tournent uniquement sur Chromium (navigateur par défaut). Aucun test sur Firefox, Safari (WebKit) ou Mobile Safari.
- [ ] **4.1.2 — 🔴 Bug : Pas de test sur mobile (iPhone / Android)** — Tester que les viewports mobiles (iPhone 12, Pixel 5) ne sont pas configurés via `playwright.config.ts`. Les tests responsive existants utilisent `setViewportSize` manuellement.
- [ ] **4.1.3 — 🔴 Bug : `fullyParallel: true` sans workers limités en local** — Tester qu'en local (hors CI), TOUS les fichiers de test s'exécutent en parallèle. Avec 95+ fichiers .spec.ts, cela peut saturer la machine (CPU, mémoire). Default Playwright workers = 50% des CPU cores.
- [ ] **4.1.4 — 🔴 Bug : `webServer` avec `pnpm dev` — pas de vérification du port** — Tester que `webServer.command: "pnpm dev"` attend `http://localhost:3000` (url check). Si un autre serveur Next.js tourne déjà sur le port 3000, Playwright utilise le serveur existant (reuseExistingServer: true en local).
- [ ] **4.1.5 — Reporter HTML uniquement** — Tester que `reporter: "html"` est le seul reporter configuré. Pas de reporter `list`, `json`, ou `junit`. En CI, le rapport HTML est moins utile qu'un rapport lisible dans les logs (list).
- [ ] **4.1.6 — 🔴 Bug : Pas de timeout global configuré** — Tester que `timeout` (timeout par test) et `expect.timeout` ne sont pas définis dans la config. Playwright utilise les valeurs par défaut : 30s par test, 5s pour expect. Si un test dépasse 30s (ex: appel IA), il échoue avec timeout.

---

# PARTIE 5 — Build & Infrastructure (Turbo, Terraform)

## 5.1 Turbo Monorepo (`turbo.json`)

### ⬜ Nouveaux scénarios

- [ ] **5.1.1 — 🔴 Bug : `test` task sans `dependsOn`** — Tester que la tâche `test` a `dependsOn: []`. Les tests ne dépendent pas du build, donc peuvent s'exécuter en parallèle. Mais si les tests ont besoin de Prisma Client (généré par `db:generate`), ils doivent dépendre de cette tâche.
- [ ] **5.1.2 — 🔴 Bug : `build` cache activé, mais `test` aussi** — Tester que le cache Turbo est activé pour `build` (outputs: .next/**) et `test` (outputs: coverage/**). En CI, le cache n'est jamais hit (voir 3.1.5), donc le cache est inutile.
- [ ] **5.1.3 — 🔴 Bug : `lint` dépend de `^build`** — Tester que lint dépend de `^build`. Cela signifie que lint attend que TOUS les builds des dépendances soient terminés. Si `echoroom-web` dépend de packages internes, leur build doit passer avant lint.
- [ ] **5.1.4 — 🔴 Bug : Pas de tâche `e2e` dans turbo.json** — Tester que `test:e2e` n'est pas une tâche Turbo. Playwright n'est pas orchestré par Turbo. La commande `pnpm test:e2e` existe dans `echoroom-web/package.json` mais n'est pas dans la config Turbo.
- [ ] **5.1.5 — 🔴 Bug : Pas de tâche pour le build mobile ou desktop** — Tester que le monorepo ne contient pas de tâche pour builder l'application mobile (Expo) ou desktop (Electron). `turbo build` ne concerne que `echoroom-web`. Les packages `@echoroom/mobile` et `@echoroom/desktop-electron` n'ont pas de script `build` dans leur `package.json` (mobile a `start`, desktop a `build` / `tsc` mais pas de pipeline Turborepo dédiée).

---

# Synthèse des Bugs Détectés par Analyse Statique

| ID | Bug | Impact | Section |
|:--:|------|--------|:-------:|
| M1 | Un seul écran HomeScreen dans le Navigator → navigation vers /scenario crashe | 🔴 CRITIQUE | 1.1.8 |
| M2 | Aucune gestion des permissions microphone demandées par l'OS | 🟠 HAUTE | 1.2 |
| M3 | Aucun cache offline / synchronisation API implémenté | 🟠 HAUTE | 1.3 |
| D1 | Aucun menu applicatif personnalisé (menu par défaut Electron) | 🟡 MOYENNE | 2.1.4 |
| D2 | Aucun gestionnaire `will-navigate` → navigation libre vers n'importe quelle URL | 🟡 MOYENNE | 2.3.4 |
| D3 | Aucun gestionnaire `setWindowOpenHandler` → pop-ups libres | 🟡 MOYENNE | 2.3.5 |
| D4 | Pas de configuration electron-builder (icône, nom, GUID) | 🟡 MOYENNE | 2.4.4 |
| CI1 | Cache Turbo basé sur `github.sha` → jamais réutilisé entre commits | 🔴 CRITIQUE | 3.1.5 |
| CI2 | Pas de tests E2E Playwright dans la CI | 🔴 CRITIQUE | 3.1.2 |
| CI3 | Pas de parallélisation des étapes quality (séquentiel dans 1 job) | 🟠 HAUTE | 3.1.1 |
| CI4 | Pas de matrice OS (macOS/Windows) pour l'app Electron | 🟠 HAUTE | 3.1.10 |
| CI5 | Node 20 en CI vs Node 22 en release → incohérence | 🟡 MOYENNE | 3.3.2 |
| PW1 | Pas de configuration multi-navigateurs (Chromium uniquement) | 🟠 HAUTE | 4.1.1 |
| PW2 | Pas de viewports mobiles dans la configuration Playwright | 🟠 HAUTE | 4.1.2 |
| PW3 | Pas de timeout global/config de test | 🟡 MOYENNE | 4.1.6 |
| TR1 | Pas de tâche `e2e` dans la pipeline Turborepo | 🟡 MOYENNE | 5.1.4 |

---

# Métriques de Couverture

| Métrique | Valeur |
|----------|:------:|
| Tests E2E existants (web uniquement) | ~190 |
| Nouveaux scénarios Mobile (ce document) | ~39 |
| Nouveaux scénarios Desktop (ce document) | ~30 |
| Nouveaux scénarios CI/CD (ce document) | ~40 |
| **Total nouveaux scénarios Round 2 Agent 5** | **~109** |

---

# Recommandations Prioritaires

## 🔴 Priorité 0 — Bloquants (à corriger avant d'écrire les tests)

1. **Cache Turbo inutile** (CI1) : Changer la clé de cache pour inclure le hash du lockfile ou un hash des sources au lieu de `github.sha`. Suggéré : `${{ runner.os }}-turbo-${{ hashFiles('pnpm-lock.yaml') }}-${{ hashFiles('turbo.json') }}`.
2. **Tests E2E absents de la CI** (CI2) : Ajouter un job `e2e` avec Playwright, service containers PostgreSQL/Redis, et sharding sur 4 workers.
3. **Navigateur unique** (PW1) : Configurer `projects` avec `chromium`, `firefox`, `webkit` dans `playwright.config.ts`.
4. **Viewports mobiles** (PW2) : Ajouter des projets Playwright avec `viewport: { width: 375, height: 667 }` (iPhone SE) et `viewport: { width: 390, height: 844 }` (iPhone 14).

## 🟠 Priorité 1 — Haute

5. **Matrice OS** (CI4) : Ajouter `os: [ubuntu-latest, macos-latest, windows-latest]` avec `strategy.matrix` pour les tests Electron.
6. **Parallélisation CI** (CI3) : Diviser le job `quality` en 3 jobs parallèles : `typecheck`, `lint+test`, `build`.
7. **Gestion permissions mobile** (M2) : Ajouter un écran de demande de permission avec `expo-permissions` avant le premier appel.
8. **Multi-navigateurs Playwright** (PW1) : Ajouter `projects` pour chromium, firefox, webkit.

## 🟡 Priorité 2 — Moyenne

9. **Navigation Stack mobile** (M1) : Ajouter un écran `ScenarioDetail` et un écran `CallReplay` dans le Navigator.
10. **electron-builder config** (D4) : Ajouter une section `"build"` dans `package.json` avec icône, GUID Windows, et categories macOS.
11. **Node version cohérente** (CI5) : Aligner Node 20 entre CI et release workflow.
12. **Turbo e2e task** (TR1) : Ajouter `"test:e2e": { "dependsOn": ["^build"], "cache": false }` dans `turbo.json`.

---

# Annexes

## A. Fichiers analysés

| Fichier | Lignes | Rôle |
|---------|:------:|------|
| `echoroom-mobile/App.tsx` | 18 | Entry point Expo avec Navigation Stack |
| `echoroom-mobile/src/screens/HomeScreen.tsx` | 30 | Écran d'accueil statique |
| `echoroom-mobile/app.json` | 10 | Configuration Expo (scheme, orientation) |
| `echoroom-mobile/package.json` | 25 | Dépendances Expo/React Navigation |
| `echoroom-desktop-electron/src/main.ts` | 37 | Fenêtre Electron avec loadURL |
| `echoroom-desktop-electron/src/preload.ts` | 5 | Context bridge (platform) |
| `echoroom-desktop-electron/package.json` | 22 | Dépendances Electron + builder |
| `echoroom-web/playwright.config.ts` | 19 | Configuration Playwright |
| `.github/workflows/ci.yml` | 93 | CI quality checks (typecheck, lint, test, build) |
| `.github/workflows/release.yml` | 92 | Release avec changesets + GitHub Releases |
| `.github/workflows/terraform.yml` | 299 | Terraform plan/apply (dev, staging, prod) |
| `turbo.json` | 33 | Pipeline Turborepo monorepo |
| `infra/terraform/*.tf` | 74 | Infrastructure as Code (Aiven, Upstash, Cloudflare) |
| `pnpm-workspace.yaml` | 4 | Définition des workspaces |

## B. Dépendances externes identifiées pour les tests

| Technologie | Usage | Mock E2E nécessaire |
|-------------|-------|:-------------------:|
| Expo (~52.0.0) | Framework mobile React Native | Expo Go / EAS Build |
| React Navigation (7.x) | Navigation Stack mobile | Mock store |
| Electron (33.x) | Application desktop | Spectron / Playwright Electron |
| Stripe (17.x) | Paiement | Stripe mock API |
| Twilio (5.x) | Téléphonie | Twilio webhook mock |
| Deepgram | Transcription audio | Deepgram mock API |
| ElevenLabs | Synthèse vocale | ElevenLabs mock API |
| OpenAI | Génération IA | OpenAI mock API |
| Upstash Redis | Cache & rate limiting | Redis mock / testcontainers |
| Prisma (5.x) | ORM base de données | Testcontainers PostgreSQL |
| Aiven | PostgreSQL managé | Testcontainers |
| Cloudflare R2 | Stockage objets | MinIO mock |
| PostHog | Analytics | PostHog mock |

---

*Document généré le 24 juin 2026 — Analyse statique du code source d'EchoRoom v0.1.0*
