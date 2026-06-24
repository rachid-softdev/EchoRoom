# 🎯 ROUND 2 — Agent 4 : Tests UI & Accessibilité Manquants

> **Analyse exhaustive des composants UI, Shared, Player, Social**  
> **Date :** 24 juin 2026  
> **Méthode :** Reverse-engineering de 50+ composants React (src/components/)  
> **Focus :** ARIA, clavier, animations, états (loading/empty/error), form validation, responsive, thème  
> **Objectif :** Identifier 100+ scénarios E2E manquants dans l'existant (TEST_SCENARIOS.md + SCENARIOS_MANQUANTS.md)

---

## Sommaire

1. [UI Components — Button](#1-ui-components--button)
2. [UI Components — Dialog](#2-ui-components--dialog)
3. [UI Components — Input](#3-ui-components--input)
4. [UI Components — Textarea](#4-ui-components--textarea)
5. [UI Components — Checkbox](#5-ui-components--checkbox)
6. [UI Components — Badge](#6-ui-components--badge)
7. [UI Components — Avatar](#7-ui-components--avatar)
8. [UI Components — Alert](#8-ui-components--alert)
9. [UI Components — Skeleton](#9-ui-components--skeleton)
10. [UI Components — ThemeToggle](#10-ui-components--themetoggle)
11. [UI Components — Card](#11-ui-components--card)
12. [UI Components — SegmentedControl](#12-ui-components--segmentedcontrol)
13. [UI Components — Toast System](#13-ui-components--toast-system)
14. [UI Components — Tooltip](#14-ui-components--tooltip)
15. [Shared — DataLoader](#15-shared--dataloader)
16. [Shared — PaginatedDataLoader](#16-shared--paginateddataloader)
17. [Shared — PaginatedGrid](#17-shared--paginatedgrid)
18. [Shared — ScenarioCard](#18-shared--scenariocard)
19. [Shared — ConfirmDialog](#19-shared--confirmdialog)
20. [Shared — ConsentBanner](#20-shared--consentbanner)
21. [Shared — CallDisclaimerDialog](#21-shared--calldisclaimerDialog)
22. [Shared — CreditDisplay](#22-shared--creditdisplay)
23. [Shared — EmptyState](#23-shared--emptystate)
24. [Shared — Breadcrumbs](#24-shared--breadcrumbs)
25. [Shared — Footer](#25-shared--footer)
26. [Shared — PasswordStrengthMeter](#26-shared--passwordstrengthmeter)
27. [Shared — CallHistoryRow](#27-shared--callhistoryrow)
28. [Shared — DashboardShell](#28-shared--dashboardshell)
29. [Social — ReactionBar](#29-social--reactionbar)
30. [Social — EmojiPicker](#30-social--emojipicker)
31. [Social — ShareButtons](#31-social--sharebuttons)
32. [Social — BadgeDisplay / BadgeGrid](#32-social--badgedisplay--badgegrid)
33. [Social — BadgeNotification](#33-social--badgenotification)
34. [Social — LeaderboardTable](#34-social--leaderboardtable)
35. [Social — FeaturedScenario](#35-social--featuredscenario)
36. [Social — ReportButton](#36-social--reportbutton)
37. [Social — ClipCreator](#37-social--clipcreator)
38. [Player — AudioPlayer](#38-player--audioplayer)
39. [Player — TranscriptView](#39-player--transcriptview)
40. [Player — ReplayHeader](#40-player--replayheader)
41. [Landing — MobileNav](#41-landing--mobilenav)
42. [Landing — DemoAudioForm](#42-landing--demoaudioform)
43. [Landing — LiveCounter](#43-landing--livecounter)
44. [Landing — CallAudioVisualizer](#44-landing--callaudiovisualizer)
45. [Landing — FeaturedScenariosSection](#45-landing--featuredscenariossection)
46. [Thème Dark/Light](#46-thème-darklight)
47. [Animations & prefers-reduced-motion](#47-animations--prefers-reduced-motion)
48. [Focus Management Transversal](#48-focus-management-transversal)
49. [Responsive Transversal](#49-responsive-transversal)
50. [Formulaires — Validation](#50-formulaires--validation)

---

## 1. UI Components — Button

### ⬜ Nouveaux scénarios

- [ ] **ARIA — focus-visible ring visible au clavier (Tab)** : Tab jusqu'au bouton → vérifier que la classe `focus-visible:ring-2` est appliquée visuellement (ou que le style `outline` est présent)
- [ ] **ARIA — type="button" par défaut** : Un `<Button>` sans `type` défini doit avoir `type="button"` pour ne pas submit le formulaire parent
- [ ] **ARIA — `asChild` avec un `<button>` existant** : `asChild` passé avec un `<button type="submit">` → vérifier que l'attribut `type="submit"` est préservé
- [ ] **Clavier — Enter et Espace** : Button au clavier → Enter et Space déclenchent `onClick`
- [ ] **Clavier — Tab avec disabled** : Button disabled → Tab doit passer outre (ne pas focuser)
- [ ] **État — disabled visuel** : `disabled={true}` → classe `disabled:opacity-50` et `disabled:pointer-events-none` présentes, curseur non cliquable
- [ ] **État — `aria-disabled` custom** : Si un composant parent passe `aria-disabled="true"` au lieu de `disabled` → le comportement attendu (pas nécessaire car `disabled` attr HTML déjà géré)
- [ ] **Variant — `link`** : `variant="link"` → texte avec `underline-offset-4` et `hover:underline`, pas de bg
- [ ] **Variant — `ghost`** : `variant="ghost"` → pas de bg initiale, `hover:bg-secondary`
- [ ] **Variant — `outline`** : `variant="outline"` → `border border-border`, bg transparente
- [ ] **Size — `icon`** : `size="icon"` → `h-10 w-10` (carré parfait), pas de padding horizontal
- [ ] **Size — `sm`** : `size="sm"` → `h-9 rounded-lg px-3`
- [ ] **Size — `lg`** : `size="lg"` → `h-11 rounded-xl px-8`
- [ ] **`asChild` avec élément non-texte** : `asChild` passé avec `<div>` au lieu de `<a>` ou `<button>` → ne doit pas crash (rend le div avec les classes)
- [ ] **`asChild` avec ref** : `asChild` + `ref` passé via `React.forwardRef` → la ref est bien transmise à l'enfant
- [ ] **Double-clic** : Double-clic rapide → l'`onClick` est appelé deux fois (comportement standard HTML). La prévention du double-submit doit être gérée par le parent.

---

## 2. UI Components — Dialog

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `aria-labelledby` pointe vers DialogTitle** : Quand DialogTitle est présent, le `role="dialog"` doit avoir `aria-labelledby` pointant vers l'ID du titre
- [ ] **ARIA — `aria-describedby` pointe vers DialogDescription** : Quand DialogDescription est présent, le dialog doit avoir `aria-describedby` pointant vers l'ID de la description
- [ ] **ARIA — Close button `aria-label="Fermer"`** : Vérifier que le bouton X a bien `aria-label="Fermer"`
- [ ] **ARIA — Overlay `aria-hidden="true"`** : Le backdrop semi-transparent doit avoir `aria-hidden="true"`
- [ ] **ARIA — `role="dialog"` + `aria-modal="true"`** : Le conteneur du contenu dialog doit avoir les deux attributs
- [ ] **Focus — Focus trap actif** : Quand le dialog est ouvert, Tab en cycle à l'intérieur : Tab depuis le dernier élément focusable → retour au premier élément
- [ ] **Focus — Shift+Tab reverse cycle** : Shift+Tab depuis le premier élément focusable → va au dernier élément du dialog
- [ ] **Focus — Focus restauré après fermeture** : Après fermeture (Escape, X, backdrop), le focus revient sur le `DialogTrigger`
- [ ] **Focus — Focus initial dans le dialog** : À l'ouverture, le focus est mis sur le premier élément focusable (ou le conteneur si pas d'élément interactif)
- [ ] **Focus — Nested dialogs impossible** : Ouvrir Dialog A → depuis A, tenter d'ouvrir Dialog B → B s'ouvre par-dessus A, mais fermer B doit rendre le focus à A
- [ ] **Body scroll lock** : Quand le dialog est ouvert, `document.body.style.overflow === "hidden"` ; à la fermeture, la valeur précédente est restaurée
- [ ] **Body scroll lock — restauration valeur originale** : Si body avait `overflow: scroll` avant ouverture, cette valeur doit être restaurée (pas juste `""`)
- [ ] **Escape ferme le dialog** : Escape keydown → `onOpenChange(false)` appelé
- [ ] **Click sur backdrop ferme** : Click sur l'overlay `bg-black/60` → dialog fermé
- [ ] **Click dans le contenu NE ferme PAS** : Click à l'intérieur du conteneur `role="dialog"` → dialog reste ouvert
- [ ] **Controlled open — ouverture programmatique** : `open={true}` conditionnel → dialog visible
- [ ] **Controlled open — fermeture programmatique** : `open` passe à `false` → dialog disparaît
- [ ] **Uncontrolled open — état initial fermé** : Sans prop `open`, le dialog est fermé par défaut
- [ ] **Animations — `animate-fade-in` et `animate-zoom-in`** : Vérifier les classes d'animation sur l'overlay et le contenu
- [ ] **No DialogTitle fourni** : Si pas de DialogTitle → `aria-labelledby` peut pointer sur un ID inexistant → vérifier qu'aucun attribut `aria-labelledby` orphelin n'est présent (ou que la génération d'ID handle ce cas)
- [ ] **Multiple DialogTrigger** : Plusieurs triggers pour le même dialog → tous ouvrent le dialog
- [ ] **Mobile — max-width responsive** : Sur <640px, `max-w-[calc(100vw-2rem)]` ; sur ≥640px, `max-w-lg`

---

## 3. UI Components — Input

### ⬜ Nouveaux scénarios

- [ ] **ARIA — placeholder couleur** : `placeholder:text-muted-foreground` dans les styles Tailwind → vérifier que la couleur du placeholder est appliquée
- [ ] **ARIA — `aria-invalid`** : Input avec `aria-invalid="true"` → le style `border-destructive` doit être appliqué (via composant parent, actuellement pas géré dans Input lui-même)
- [ ] **ARIA — `aria-describedby` avec message d'erreur** : Input + message d'erreur → `aria-describedby` relie l'input au message
- [ ] **Clavier — Tab navigation** : Input focusable via Tab, focus visible `focus-visible:ring-2 focus-visible:ring-primary`
- [ ] **État — disabled visuel** : `disabled` → `cursor-not-allowed` et `opacity-50` appliqués
- [ ] **État — readOnly** : `readOnly` → pas de changement visuel (pas de classe dédiée) mais input non modifiable
- [ ] **Type — `file`** : `<Input type="file" />` → rendu correct du bouton de parcours fichier, classe `file:` pour styler le bouton natif
- [ ] **Type — `file` avec accept** : `<Input type="file" accept=".mp3,.wav" />` → seuls les fichiers audio sont acceptés
- [ ] **Type — `number`** : `<Input type="number" />` → seuls les chiffres sont acceptés, step/min/max fonctionnent
- [ ] **Type — `password`** : `<Input type="password" />` → caractères masqués
- [ ] **Type — `email`** : `<Input type="email" />` → validation navigateur de format email
- [ ] **Label associé** : `<label htmlFor="my-input">` + `<Input id="my-input" />` → click sur label focus l'input
- [ ] **Ref forwarding** : `ref` passé à Input → ref.current est une instance HTMLInputElement
- [ ] **maxLength** : `maxLength={100}` → impossible de taper plus de 100 caractères (ou counter présent)
- [ ] **Auto-complétion** : `autoComplete` prop → attribut HTML `autocomplete` présent

---

## 4. UI Components — Textarea

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `aria-describedby` avec compteur** : Quand Textarea est utilisé dans ReportButton avec le compteur de caractères, `aria-describedby` relie le textarea au message "X caractères minimum requis"
- [ ] **Clavier — Tab** : Textarea focusable via Tab, `focus-visible:ring-2`
- [ ] **État — disabled** : `disabled` → `cursor-not-allowed` + `opacity-50`, textarea non modifiable
- [ ] **État — resize** : `resize-y` → l'utilisateur peut redimensionner verticalement uniquement
- [ ] **État — min-height** : `min-h-[80px]` → hauteur minimum 80px même vide
- [ ] **Placeholder** : `placeholder` → texte indicatif grisé
- [ ] **Ref forwarding** : ref → HTMLTextAreaElement
- [ ] **maxLength virtuel** : Aucun maxLength HTML, mais le composant parent peut limiter

---

## 5. UI Components — Checkbox

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `role="checkbox"` natif** : Le `<input type="checkbox">` a déjà le rôle implicite `checkbox`, et `aria-checked` implicite via `checked`
- [ ] **ARIA — `sr-only` input** : L'input natif est `sr-only` (visuellement caché mais accessible aux lecteurs d'écran)
- [ ] **ARIA — Checkmark `transition-opacity`** : L'icône Check passe de `opacity-0` à `opacity-100` selon `peer-checked`
- [ ] **Clavier — Space toggles** : Avec focus sur le checkbox, Space change l'état checked
- [ ] **Clavier — Enter** : Enter ne toggles PAS le checkbox (standard HTML : seul Space le fait)
- [ ] **État — checked** : `checked={true}` → le span custom a `peer-checked:bg-primary`, l'icône Check visible
- [ ] **État — unchecked** : `checked={false}` → fond normal, icône cachée
- [ ] **État — disabled** : `disabled` → `opacity-50` sur le span (via `peer-disabled`, actuellement pas géré)
- [ ] **État — hover** : `group-hover:border-primary/50` sur le span
- [ ] **Label click toggles** : Click sur le texte du label → le checkbox est togglé
- [ ] **Label rendu conditionnel** : `label` prop non fournie → pas de `<span>` label rendu
- [ ] **Ref forwarding** : ref → HTMLInputElement

---

## 6. UI Components — Badge

### ⬜ Nouveaux scénarios

- [ ] **ARIA — focus ring si interactif** : Badge avec `onClick` ou role `button` → `focus:ring-2 focus:ring-primary focus:ring-offset-2` doit être visible
- [ ] **Variant — `default`** : `bg-primary text-primary-foreground`
- [ ] **Variant — `secondary`** : `bg-secondary text-secondary-foreground`
- [ ] **Variant — `destructive`** : `bg-destructive text-destructive-foreground`
- [ ] **Variant — `outline`** : `border border-border text-foreground` (pas de bg)
- [ ] **Contenu mixte** : Badge avec icône + texte → rendu correct (flex inline)
- [ ] **Badge dans une Card** : Badge intégré dans Card (comme dans ScenarioCard, FeaturedScenario) → positionnement correct

---

## 7. UI Components — Avatar

### ⬜ Nouveaux scénarios

- [ ] **ARIA — Image `alt` obligatoire** : AvatarImage avec `alt=""` (vide par défaut) → présent, mais pour les avatars significatifs, `alt` devrait décrire la personne
- [ ] **ARIA — Container `role` implicite** : Aucun rôle explicite sur le conteneur (c'est une image décorative si alt="")
- [ ] **État — Image loading (hidden)** : Quand l'image est en chargement, elle a `className="hidden"` donc invisible
- [ ] **État — Image loaded (visible)** : `onLoad` → `setStatus("loaded")` → `className="block"`, image visible
- [ ] **État — Image error** : `onError` → `setStatus("error")` → image reste cachée, fallback visible (après délai)
- [ ] **État — Fallback avec délai (100ms par défaut)** : Fallback apparaît après 100ms (via `setTimeout`) pour laisser le temps à l'image de charger
- [ ] **État — Fallback delay=0** : `delay={0}` → fallback immédiat sans attendre
- [ ] **État — Fallback avec initiales** : `AvatarFallback` avec children → les initiales sont affichées
- [ ] **État — Fallback avec icône** : Fallback peut contenir une icône (ex: `<Medal />` dans BadgeDisplay)
- [ ] **Avatar sans image** : `<Avatar><AvatarFallback>JD</AvatarFallback></Avatar>` → fallback visible immédiatement (car pas d'AvatarImage pour bloquer)
- [ ] **Image URL cassée** : `src="https://invalid.url/image.jpg"` → `onError` → fallback s'affiche après le `fallbackDelay`
- [ ] **`fallbackDelay` via context** : Le `fallbackDelay` du parent `Avatar` est accessible dans `AvatarFallback` via contexte
- [ ] **Dimensions personnalisées** : `className="w-8 h-8"` → avatar plus petit appliqué

---

## 8. UI Components — Alert

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `role="alert"` présent** : Le conteneur Alert a `role="alert"` → immédiatement annoncé par les lecteurs d'écran
- [ ] **ARIA — `aria-live`** : Actuellement pas de `aria-live` sur Alert → pour des alertes dynamiques (toast-like), `aria-live="polite"` devrait être ajouté (gap fonctionnel)
- [ ] **Variant — `default`** : `bg-background text-foreground`
- [ ] **Variant — `warning`** : Classes yellow (light: `bg-yellow-50 border-yellow-200 text-yellow-800`, dark: `dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200`)
- [ ] **Variant — `destructive`** : `border-destructive/50 text-destructive`
- [ ] **Dark mode — warning** : Appliquer le thème dark → vérifier les classes dark: du variant warning
- [ ] **Icône positionnée absolute** : Le `[&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4` positionne correctement les icônes Lucide
- [ ] **AlertTitle + AlertDescription** : Rendu combiné de titre + description dans l'alert
- [ ] **Alert dans ConsentBanner** : Vérifier l'intégration avec le variant warning dans ConsentBanner

---

## 9. UI Components — Skeleton

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `aria-hidden`** : Le skeleton doit avoir `aria-hidden="true"` pour ne pas être annoncé (gap fonctionnel)
- [ ] **ARIA — `aria-busy`** : Le conteneur parent du skeleton devrait avoir `aria-busy="true"` (gap fonctionnel)
- [ ] **Animation — `animate-pulse`** : La classe `animate-pulse` est présente → vérifier que l'animation CSS pulse est appliquée
- [ ] **Animation — `prefers-reduced-motion`** : Quand `prefers-reduced-motion: reduce` est actif, l'animation pulse devrait être désactivée. Actuellement pas de media query (`motion-safe:animate-pulse` manquant — gap fonctionnel)
- [ ] **Forme — cercle** : `className="rounded-full"` + `Skeleton` → forme ronde (utilisé dans Avatar loading)
- [ ] **Forme — texte** : `Skeleton className="h-4 w-20"` → barre de texte
- [ ] **Forme — card** : `Skeleton` avec padding + enfants → skeleton card (DataLoader)
- [ ] **Couleur** : `bg-muted` → couleur de fond adaptée au thème
- [ ] **Multiples skeletons** : DataLoader avec `skeletonCount={3}` → 3 skeletons rendus avec clés uniques

---

## 10. UI Components — ThemeToggle

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `aria-label` dynamique** : Le bouton a `aria-label="Changer le thème"` (après hydration). Le placeholder a `aria-label="Charger le thème"`
- [ ] **Hydration — Pas de flash** : `mounted=false` (SSR) → bouton disabled avec div vide de `w-4 h-4` → pas d'icône visible, pas de flash du mauvais thème
- [ ] **Hydration — État mounted** : Après `useEffect`, `mounted=true` → le bouton devient interactif avec l'icône correcte (Sun ou Moon)
- [ ] **Thème — Click bascule** : Click → `setTheme(theme === "dark" ? "light" : "dark")` → le thème change
- [ ] **Thème — Icône change** : `theme === "dark"` → icône Sun visible ; `theme === "light"` → icône Moon visible
- [ ] **Thème — Persistance navigation SPA** : Changer le thème → naviguer vers une autre page → le thème est conservé
- [ ] **Thème — Persistance après reload** : Changer le thème → recharger la page → le thème est conservé (via next-themes + localStorage)
- [ ] **Thème — Synchronisation entre onglets** : Changer le thème dans l'onglet A → l'onglet B devrait refléter le changement (gap si `next-themes` ne sync pas)
- [ ] **État — Disabled pendant chargement** : Pendant `mounted=false`, le bouton a `disabled` → pas de mutation possible

---

## 11. UI Components — Card

### ⬜ Nouveaux scénarios

- [ ] **ARIA — Card interactive (liée)** : Card dans un `<Link>` (ScenarioCard) → le lien doit avoir `focus-visible:ring-2`
- [ ] **ARIA — CardTitle en `<h3>`** : `CardTitle` est un `h3` → hiérarchie de titres respectée
- [ ] **ARIA — CardDescription** : `CardDescription` en `<p>` avec `text-muted-foreground`
- [ ] **Structure** : Card → CardHeader (CardTitle + CardDescription) → CardContent → CardFooter
- [ ] **Hover — groupe** : Card dans un groupe hover (`group` sur le lien parent) → `group-hover:text-primary` sur le titre
- [ ] **Hover — bordure** : Card avec `hover:border-primary/30` → bordure change au survol
- [ ] **Shadow** : `shadow-sm` → ombre légère par défaut

---

## 12. UI Components — SegmentedControl

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `role="radiogroup"`** : Le conteneur a `role="radiogroup"` → correct pour un groupe de radio visuel
- [ ] **ARIA — `role="radio"`** : Chaque option a `role="radio"` → rôle radio explicite
- [ ] **ARIA — `aria-checked`** : L'option sélectionnée a `aria-checked="true"`, les autres `aria-checked="false"`
- [ ] **Clavier — Flèches ← et →** : Focus sur le groupe → les flèches gauche/droite changent la sélection (gap fonctionnel : pas de gestion clavier dans le composant actuel)
- [ ] **Clavier — Tab navigation** : Tab focus le groupe, les flèches naviguent entre les options (standard radiogroup ARIA)
- [ ] **État — Sélection visuelle** : Option sélectionnée → `bg-card text-foreground shadow-sm` ; non sélectionnée → `text-muted-foreground hover:text-foreground`
- [ ] **État — Click** : Click sur une option → `onChange` appelé avec la nouvelle valeur
- [ ] **Responsive** : `w-fit` → largeur ajustée au contenu

---

## 13. UI Components — Toast System

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `role="status"` ou `role="alert"`** : Actuellement pas de rôle explicite sur les toasts. Pour un toast destructif → `role="alert"` ; pour un toast informatif → `role="status"` avec `aria-live="polite"` (gap fonctionnel)
- [ ] **ARIA — `aria-live="polite"`** : Le conteneur Toaster devrait avoir `aria-live="polite"` pour annoncer les nouveaux toasts (gap fonctionnel)
- [ ] **ARIA — Close button `sr-only`** : Le bouton close a `<span className="sr-only">Fermer</span>` → accessible mais visuellement caché
- [ ] **Animation — `animate-slide-in-right`** : Chaque toast a la classe `animate-slide-in-right`
- [ ] **Animation — `prefers-reduced-motion`** : L'animation slide-in devrait être désactivée avec `prefers-reduced-motion` (gap fonctionnel)
- [ ] **Position — `fixed bottom-4 right-4 z-[100]`** : Toasts fixés en bas à droite
- [ ] **Auto-dismiss — 4s par défaut** : Toast avec `duration` non spécifié → disparaît après 4000ms
- [ ] **Auto-dismiss — Custom duration** : `toast("Message", "default", 2000)` → disparaît après 2000ms
- [ ] **Close button — dismiss immédiat** : Click sur X → toast retiré immédiatement (clearTimeout du timeout planifié)
- [ ] **Multiple toasts — empilement** : 3 toasts ajoutés rapidement → tous visibles, empilés verticalement avec `gap-2`
- [ ] **Multiple toasts — ordre** : Les toasts s'affichent dans l'ordre d'ajout (dernier en bas de la pile)
- [ ] **Variant — `success`** : `border-primary/30 bg-primary/10 text-primary` → style vert/primary
- [ ] **Variant — `destructive`** : `border-destructive bg-destructive text-destructive-foreground` → style rouge destructif
- [ ] **Variant — `default`** : `border-border bg-card text-card-foreground`
- [ ] **Global `toast()` function** : `toast()` dispatch un CustomEvent `echoroom-toast` → le provider écoute et ajoute le toast
- [ ] **Global toast avec options** : `toast({ title: "Titre", message: "Message", variant: "success" })` → titre ignoré actuellement (seul `message` est utilisé dans le Toast)
- [ ] **Cleanup — unmount** : Si le ToastProvider est démonté, tous les timeouts sont nettoyés
- [ ] **Cleanup — removeToast** : `removeToast` clear le timeout associé

---

## 14. UI Components — Tooltip

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `role="tooltip"`** : Le conteneur du tooltip a `role="tooltip"` → rôle explicite
- [ ] **ARIA — `aria-describedby`** : Le trigger (children) a `aria-describedby` pointant vers l'ID du tooltip
- [ ] **ARIA — `id` du tooltip** : Le tooltip a un ID unique (`tooltip-{useId()}`)
- [ ] **Hover — apparition** : `onMouseEnter` → `isVisible=true` → tooltip affiché
- [ ] **Hover — disparition** : `onMouseLeave` → `isVisible=false` → tooltip caché
- [ ] **Focus — trigger focus** : `onFocus` → tooltip visible (pour les utilisateurs clavier)
- [ ] **Focus — trigger blur** : `onBlur` → tooltip caché
- [ ] **Position — `side="top"`** : Classes `bottom-full left-1/2 -translate-x-1/2 mb-2`
- [ ] **Position — `side="bottom"`** : Classes `top-full left-1/2 -translate-x-1/2 mt-2`
- [ ] **Position — `side="left"`** : Classes `right-full top-1/2 -translate-y-1/2 mr-2`
- [ ] **Position — `side="right"`** : Classes `left-full top-1/2 -translate-y-1/2 ml-2`
- [ ] **Contenu long** : `max-w-[220px]` + `whitespace-nowrap` → le texte est sur une ligne et tronqué à 220px avec `text-center`
- [ ] **Pointer-events** : `pointer-events-none` sur le tooltip → les clics traversent le tooltip
- [ ] **Contenu HTML échappé** : Si `content` contient du HTML (`<b>test</b>`), il est affiché textuellement (pas interprété) car c'est une string React → safe par défaut
- [ ] **CreditDisplay tooltip** : Tooltip dans CreditDisplay avec `side="bottom"` → vérifier le contenu "Chaque appel consomme 1 crédit..."

---

## 15. Shared — DataLoader

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `aria-busy` pendant loading** : Le conteneur skeleton devrait avoir `aria-busy="true"` (gap fonctionnel)
- [ ] **État — Loading (3 skeletons par défaut)** : `query.isLoading` → rendering de 3 skeletons en grille md:grid-cols-3
- [ ] **État — Loading custom skeleton** : `skeleton` prop fournie → le custom skeleton remplace les defaults
- [ ] **État — Loading skeletonCount** : `skeletonCount={5}` → 5 skeletons
- [ ] **État — Error** : `query.isError` → icône AlertTriangle + message + bouton "Réessayer"
- [ ] **État — Error message custom** : `query.error.message` → affiché dans la description d'erreur
- [ ] **État — Error message fallback** : `query.error` sans `.message` → "Impossible de charger les données. Réessayez."
- [ ] **État — Error retry** : Click "Réessayer" → `query.refetch()` est appelé
- [ ] **État — Empty (data undefined)** : `!query.data` et `isEmpty` pas fourni → "Aucun résultat"
- [ ] **État — Empty custom** : `empty` prop fournie → le custom empty remplace le défaut
- [ ] **État — Empty via isEmpty callback** : `isEmpty={(data) => data.items.length === 0}` → si data existe mais items vides → empty state
- [ ] **État — Data loaded** : `query.data` existe + pas empty → `children(query.data)` rendu
- [ ] **Transition rapide loading→data** : Query se résout immédiatement → les skeletons ne clignotent pas (gap : vérifier que pas de flash)

---

## 16. Shared — PaginatedDataLoader

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `aria-busy` pendant loading** : Pendant `isLoading` → `aria-busy` devrait être présent (gap fonctionnel)
- [ ] **État — Error** : `isError` → icône AlertTriangle + message + bouton "Réessayer"
- [ ] **État — Error message** : `query.error?.message` affiché ou fallback "Impossible de charger les données"
- [ ] **État — Loading (spinner par défaut)** : `isLoading` + pas de `loadingSkeleton` → `Loader2` spinner animé
- [ ] **État — Loading custom** : `loadingSkeleton` prop → affiché à la place du spinner
- [ ] **État — Empty (items vide)** : `query.items` existe mais `length === 0` → empty prop rendu (ou rien si pas fourni)
- [ ] **État — Empty (items null)** : Si `query.items` est `null` ou `undefined` → empty state
- [ ] **État — Data loaded** : `items` non vide → `children(items)` rendu

---

## 17. Shared — PaginatedGrid

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `aria-label` manquant** : Le bouton "Voir plus" n'a pas d'`aria-label` explicite → devrait avoir `aria-label="Charger plus d'éléments"` (gap fonctionnel)
- [ ] **ARIA — `aria-busy`** : Pendant `isLoadingMore` → la grille pourrait signaler `aria-busy` (gap fonctionnel)
- [ ] **État — hasMore=true** : `hasMore={true}` → bouton "Voir plus" visible
- [ ] **État — hasMore=false** : `hasMore={false}` → bouton "Voir plus" caché
- [ ] **État — isLoadingMore** : `isLoadingMore={true}` → bouton disabled, icône `Loader2` animée
- [ ] **État — isLoadingMore=false** : `isLoadingMore={false}` → bouton actif, icône `ArrowDown`
- [ ] **Clavier — Tab au bouton** : Tab jusqu'au bouton "Voir plus" → Enter ou Space déclenche `onLoadMore`
- [ ] **Grille responsive** : `grid md:grid-cols-2 lg:grid-cols-3 gap-4` → 1 colonne sur mobile, 2 sur tablette, 3 sur desktop

---

## 18. Shared — ScenarioCard

### ⬜ Nouveaux scénarios

- [ ] **ARIA — Link focus ring** : Le `<Link>` parent a `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-xl`
- [ ] **ARIA — Card dans contexte de liste** : Quand plusieurs ScenarioCards sont dans une liste, chaque lien est un élément de navigation distinct
- [ ] **État — Badge catégorie** : `CATEGORY_LABELS[character.category]` affiché avec `Badge variant="secondary"`
- [ ] **État — Catégorie inconnue** : `character?.category` non trouvé dans CATEGORY_LABELS → fallback "Scénario"
- [ ] **État — Title complet** : `CardTitle` avec `title={scenario.title}` (attribut HTML title pour tooltip natif si tronqué)
- [ ] **État — Description absente** : `scenario.description` null → pas de CardDescription rendu
- [ ] **État — Description line-clamp** : `line-clamp-2` → max 2 lignes avec ellipsis
- [ ] **État — Play count** : `scenario.playCount !== undefined` → affiché avec icône Play. >1000 formaté en "1.2k"
- [ ] **État — Like count** : `scenario.likeCount` ou `_count.reactions` → affiché avec icône Heart
- [ ] **État — Comment count** : `_count.comments` → affiché avec icône MessageCircle
- [ ] **État — Creator** : `showCreator=true` + `scenario.creator` → "par {username}"
- [ ] **État — Aucun creator** : `showCreator=true` mais pas de creator → rien affiché
- [ ] **État — Share button** : `showShare=true` → bouton Share2 présent. Click → copie URL + toast
- [ ] **État — Share clipboard error** : `navigator.clipboard.writeText` échoue → catch silencieux (pas de crash)
- [ ] **Clavier — Click sur Share** : Tab au bouton Share → Enter/Space → copie URL (e.preventDefault() + e.stopPropagation() → pas de navigation)
- [ ] **Hover — Card** : `hover:border-primary/30 transition-colors` → changement de bordure

---

## 19. Shared — ConfirmDialog

### ⬜ Nouveaux scénarios

- [ ] **ARIA — Dialog focus trap** : Via `useFocusTrap(contentRef, open)` → Tab cycle dans le dialog (déjà testé dans Dialog)
- [ ] **ARIA — Bouton confirm destructif** : `variant="destructive"` → bouton a `variant="destructive"` (bg-destructive)
- [ ] **État — Loading spinner** : `loading={true}` → Loader2 animé sur le bouton confirm, les deux boutons disabled
- [ ] **État — Cancel disabled pendant loading** : `loading={true}` → le bouton Cancel aussi désactivé
- [ ] **État — Confirm désactivé** : `confirmDisabled={true}` → bouton confirm disabled
- [ ] **État — Variante destructive** : `variant="destructive"` → vérifier les classes CSS appliquées au bouton confirm
- [ ] **État — Labels personnalisés** : `confirmLabel="Supprimer"`, `cancelLabel="Retour"` → les textes des boutons changent
- [ ] **État — Description ReactNode** : `description` peut être un ReactNode (comme le texte avec bullet points)
- [ ] **Ouverture contrôlée** : `open={true}` → dialog visible ; `open={false}` → caché
- [ ] **Fermeture — Cancel** : Click "Annuler" → `onOpenChange(false)` appelé
- [ ] **Fermeture — Confirm** : Click confirm → `onConfirm` appelé (pas de fermeture automatique)

---

## 20. Shared — ConsentBanner

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `role="alert"` via Alert** : Le composant utilise `Alert` qui a `role="alert"` → annoncé immédiatement
- [ ] **État — Consent actif** : `consentStatus?.isConsentWithdrawn` est false → return null (rien affiché)
- [ ] **État — Consent retiré** : `isConsentWithdrawn=true` → Alert warning avec titre, description, bouton "Ré-accepter"
- [ ] **État — Reconsent pending** : Click "Ré-accepter" → `setIsReconsenting(true)`, bouton disabled avec "..."
- [ ] **État — Reconsent success** : `reconsent.mutate` réussit → `window.location.reload()` (redirection)
- [ ] **État — Reconsent error** : `reconsent.mutate` échoue → actuellement pas de gestion d'erreur (gap fonctionnel)
- [ ] **Clavier — Tab navigation** : Tab → focus sur le bouton "Ré-accepter" → Enter déclenche la mutation

---

## 21. Shared — CallDisclaimerDialog

### ⬜ Nouveaux scénarios

- [ ] **ARIA — Dialog focus trap** : Hérité du Dialog → focus trap actif
- [ ] **ARIA — Checkbox label associé** : `<Checkbox id="disclaimer-accept">` avec `label="Je comprends et j'accepte ces conditions"` → click sur le label toggles
- [ ] **Hydration — SSR-safe** : `mounted=false` (pendant SSR) → return null (pas de rendu côté serveur)
- [ ] **Hydration — Déjà accepté** : `hasAcceptedBefore=true` (localStorage) → return null (pas de dialog)
- [ ] **État — Checkbox non cochée** : `accepted=false` → bouton "Démarrer l'appel" disabled
- [ ] **État — Checkbox cochée** : `accepted=true` → bouton "Démarrer l'appel" enabled
- [ ] **État — isPending** : `isPending={true}` → bouton disabled avec Loader2 spinner + "Appel en cours..."
- [ ] **État — 4 bullet points** : Vérifier que les 4 points d'information sont affichés dans la liste
- [ ] **Fermeture — Annuler** : Click "Annuler" → `onOpenChange(false)`, dialog fermé
- [ ] **Fermeture — Escape** : Escape → dialog fermé
- [ ] **Accept — handleAccept** : Click "Démarrer l'appel" → `localStorage.setItem`, `onAccept()`, `onOpenChange(false)`
- [ ] **localStorage — persistance** : Après accept, ouvrir à nouveau → `hasAcceptedBefore=true` → plus de dialog
- [ ] **localStorage — indisponible** : `localStorage.setItem` throw → catch silencieux, accept quand même pour cette session

---

## 22. Shared — CreditDisplay

### ⬜ Nouveaux scénarios

- [ ] **ARIA — Tooltip `aria-describedby`** : Le badge a `aria-describedby` du tooltip (via Tooltip component)
- [ ] **ARIA — Badge avec icône** : `Badge variant="secondary"` avec icône Phone + nombre
- [ ] **État — Crédits undefined** : `credits === undefined` (pas de prop, session pas chargée) → Skeleton `h-5 w-20 rounded-lg`
- [ ] **État — Crédits depuis session** : Pas de prop `credits` → `session?.user?.credits` utilisé
- [ ] **État — Crédits depuis prop** : `credits={42}` → le nombre 42 est affiché
- [ ] **État — Crédits = 0** : `credits={0}` → "0 crédits" affiché
- [ ] **Tooltip — contenu** : "Chaque appel consomme 1 crédit. 5 gratuits à l'inscription."
- [ ] **Tooltip — side="bottom"** : Tooltip positionné en bas du badge

---

## 23. Shared — EmptyState

### ⬜ Nouveaux scénarios

- [ ] **ARIA — Icône décorative** : L'icône Lucide a `aria-hidden="true"` implicite (pas de rôle) → correct
- [ ] **ARIA — Titre en `<h3>`** : `h3` → hiérarchie de titre accessible
- [ ] **Rendu — Icône** : L'icône passée en `icon` est rendue avec `w-16 h-16 text-muted-foreground`
- [ ] **Rendu — Titre** : `title` rendu dans `h3` avec `text-lg font-semibold`
- [ ] **Rendu — Description** : `description` rendu dans `p` avec `text-muted-foreground max-w-sm mx-auto`
- [ ] **Rendu — Action** : `action` ReactNode rendu après la description (ex: bouton CTA)
- [ ] **Rendu — Pas d'action** : `action` non fourni → rien après description

---

## 24. Shared — Breadcrumbs

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `aria-label="Fil d'Ariane"`** : `<nav>` avec `aria-label="Fil d'Ariane"`
- [ ] **ARIA — `aria-current="page"`** : Le dernier segment (page courante) a `aria-current="page"` sur un `<span>`
- [ ] **ARIA — `aria-label="Accueil"`** : Le lien Home a `aria-label="Accueil"`
- [ ] **ARIA — Chevron `aria-hidden="true"`** : Les icônes ChevronRight ont `aria-hidden="true"`
- [ ] **Rendu — Route dashboard** : `pathname.startsWith('/dashboard')` → breadcrumbs visibles
- [ ] **Rendu — Route admin** : `pathname.startsWith('/admin')` → breadcrumbs visibles
- [ ] **Rendu — Route non dashboard/admin** : Ni /dashboard ni /admin → return null
- [ ] **Rendu — Label connu** : `LABEL_MAP['dashboard']` → "Dashboard" affiché
- [ ] **Rendu — Label inconnu** : Segment non trouvé dans LABEL_MAP → capitalisé (`first-letter uppercase + rest`)
- [ ] **Rendu — Un seul segment** : `crumbs.length <= 1` → return null (juste /dashboard ou /admin)
- [ ] **Rendu — Dernier segment sans lien** : Dernier crumb est un `<span>`, pas un `<Link>`
- [ ] **Rendu — Segments intermédiaires en liens** : Les crumbs non-finaux sont des `<Link>` cliquables
- [ ] **Navigation — Click sur lien intermédiaire** : Click sur un crumb non-final → navigation vers cette route

---

## 25. Shared — Footer

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `role="contentinfo"`** : `<footer>` a le rôle implicite `contentinfo` → correct
- [ ] **ARIA — Navigation ** : `<nav>` dans le footer avec liens de navigation
- [ ] **Rendu — Année dynamique** : `new Date().getFullYear()` → année courante (2026)
- [ ] **Rendu — Liens** : Aide → `/help`, Conditions → `/terms`, Confidentialité → `/privacy`
- [ ] **Rendu — Responsive** : `flex flex-col sm:flex-row` → empilé sur mobile, côte à côte sur desktop
- [ ] **Clavier — Tab navigation** : Tab entre les 3 liens → focus visible, hover change la couleur

---

## 26. Shared — PasswordStrengthMeter

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `aria-live="polite"` pour le score** : Quand le password change, le score devrait être annoncé (gap fonctionnel — pas de live region)
- [ ] **ARIA — Checkmarks `aria-hidden`** : Les symboles ✓ et ✗ devraient être cachés des lecteurs d'écran, avec le texte du check comme contenu accessible (gap fonctionnel)
- [ ] **État — Password vide** : `password=""` → return null (caché)
- [ ] **État — Score 0 (très faible)** : Password "a" → 0/5 barres → label "Force : Très faible"
- [ ] **État — Score 1 (faible)** : Password "abcdefgh" (8 chars, rien d'autre) → 1/5 barres → "Faible"
- [ ] **État — Score 2 (moyen)** : Password "abcdefgh1" (8 chars + chiffre) → 2/5 → "Moyen"
- [ ] **État — Score 3 (fort)** : Password "Abcdefgh1" (8 chars + maj + chiffre) → 3/5 → "Fort"
- [ ] **État — Score 4 (très fort)** : Password "Abcdefgh1!" (8 chars + maj + chiffre + spécial) → 4/5 → "Très fort"
- [ ] **État — Score 5 (très fort aussi)** : Password >= 12 chars + maj + chiffre + spécial → 5/5 → "Très fort"
- [ ] **Visuel — 5 barres segmentées** : 5 divs avec `h-1.5 flex-1 rounded-full`, couleur selon score
- [ ] **Visuel — Couleurs** : Score 0→ `bg-destructive`, 1→ `bg-orange-500`, 2→ `bg-yellow-500`, 3→ `bg-lime-500`, 4+→ `bg-green-500`
- [ ] **Visuel — Checks individuels** : 5 checks listés avec ✓ (vert) ou ✗ (rouge)
- [ ] **Memoïsation** : `useMemo(() => getScore(password), [password])` → recalcule seulement si password change
- [ ] **Re-render** : Taper dans l'input password → le meter se met à jour en temps réel

---

## 27. Shared — CallHistoryRow

### ⬜ Nouveaux scénarios

- [ ] **ARIA — Badge statut** : Badge avec `variant` selon `STATUS_VARIANTS[call.status]`
- [ ] **ARIA — Lien Replay visible seulement pour COMPLETED** : `call.status === 'COMPLETED'` → lien vers `/call/${call.id}` avec bouton Play + "Replay"
- [ ] **État — Statut non COMPLETED** : `status !== 'COMPLETED'` → pas de bouton Replay
- [ ] **État — Status inconnu** : `STATUS_LABELS[call.status]` non trouvé → affiche `call.status` tel quel
- [ ] **État — Titre fallback** : `call.scenario?.title` null → "'Appel'" affiché
- [ ] **État — Date** : `formatDate(call.createdAt)` → date formatée
- [ ] **État — Durée** : `formatDuration(call.durationSeconds)` → durée formatée (minutes/secondes)
- [ ] **État — Durée zéro** : `durationSeconds = 0` → doit afficher "0s" sans division par zéro
- [ ] **Hover — Bordure** : `hover:border-border transition-colors`
- [ ] **Click — Lien Replay** : Click sur le bouton Replay → navigation vers `/call/{id}` (seulement si COMPLETED)

---

## 28. Shared — DashboardShell

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `aria-current="page"` sur nav active** : Le lien de navigation actif a `aria-current="page"`
- [ ] **ARIA — Nav links avec icônes** : Chaque link a une icône Lucide + texte (lisible même si icône-only visuellement sur mobile)
- [ ] **ARIA — Settings link `aria-label="Paramètres"`** : Le bouton settings (icône) a `aria-label="Paramètres"`
- [ ] **Navigation — Tous les liens** : Vérifier que chaque navLink est présent (href exact) : /dashboard, /create, /library, /history, /community, /leaderboard, /billing
- [ ] **Navigation — Lien actif** : Sur `/dashboard`, le link Dashboard a `aria-current="page"` et style actif `bg-primary/10 text-primary`
- [ ] **Navigation — Sous-route active** : Sur `/dashboard/library`, le link Library doit être actif (startsWith)
- [ ] **Sticky nav** : `sticky top-0 z-40` → le nav reste en haut au scroll
- [ ] **Backdrop blur** : `bg-background/80 backdrop-blur-sm` → effet de flou
- [ ] **Responsive — Icons only mobile** : `<span className="hidden sm:inline">` → sur mobile (<640px), les labels sont cachés, seules les icônes restent
- [ ] **Responsive — Scroll horizontal** : `overflow-x-auto hide-scrollbar` → si trop de nav links, scroll horizontal
- [ ] **CreditDisplay dans nav** : CreditDisplay présent dans la barre de navigation
- [ ] **ThemeToggle dans nav** : ThemeToggle présent dans la barre
- [ ] **Titre + sous-titre section** : `<h1>` avec le `title` prop, `<p>` avec `subtitle`
- [ ] **Ambient glow** : Gradient décoratif `from-primary/[0.02] via-transparent to-transparent`

---

## 29. Social — ReactionBar

### ⬜ Nouveaux scénarios

- [ ] **ARIA — Boutons réaction `aria-label`** : Chaque bouton emoji devrait avoir `aria-label` descriptif (gap : actuellement pas d'aria-label sur les boutons d'emoji existants)
- [ ] **ARIA — Bouton "+" `aria-label="Ajouter une réaction"`** : Le bouton "+" a un aria-label
- [ ] **ARIA — `aria-pressed`** : Les boutons de réaction existants devraient avoir `aria-pressed` pour indiquer si l'utilisateur a déjà réagi (gap fonctionnel)
- [ ] **ARIA — EmojiPicker `role="grid"`** : Le picker utilise une grid CSS sans role grid explicite (gap fonctionnel)
- [ ] **État — Loading** : `reactionsQuery.isLoading` → pas d'UI loading spécifique (les boutons existants ne s'affichent pas)
- [ ] **État — Empty reactions** : `reactions.length === 0` → seul le bouton "+" est visible
- [ ] **État — Reactions existantes** : `reactions.map(...)` → un bouton par emoji avec count
- [ ] **État — Toggle mutation pending** : `toggleMutation.isPending` → tous les boutons disabled (`disabled={toggleMutation.isPending}`)
- [ ] **État — Toggle erreur** : `onError` → toast destructif avec `err.message`
- [ ] **État — Toggle success** : `onSuccess` → `reactionsQuery.refetch()` → les compteurs se mettent à jour
- [ ] **Optimistic update (gap fonctionnel)** : Actuellement pas d'optimistic update — le compteur se met à jour seulement après refetch. Devrait être une mise à jour immédiate avec rollback sur erreur.
- [ ] **Rapide toggle (5 clics)** : Click rapide sur le même emoji 5 fois → seul le dernier (ou 1er si isPending bloque) est traité
- [ ] **Ouverture/fermeture EmojiPicker** : Click "+" → picker visible. Click "+" à nouveau → picker fermé. Click emoji → picker fermé.
- [ ] **Focus — Retour au bouton "+" après fermeture** : Après sélection d'un emoji, le focus devrait revenir au bouton "+" (gap fonctionnel)

---

## 30. Social — EmojiPicker

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `aria-label` sur chaque bouton** : Chaque bouton emoji a `aria-label={`Réagir avec ${emoji}`}` → correct
- [ ] **ARIA — `role="grid"`** : La grille CSS (`grid grid-cols-4`) n'a pas de role="grid" explicite → gap fonctionnel
- [ ] **ARIA — `role="gridcell"`** : Chaque bouton devrait être dans un gridcell (gap fonctionnel)
- [ ] **Clavier — Tab navigation** : Tab entre les 8 emojis → focus visible (`focus-visible:ring-2`)
- [ ] **Clavier — Enter/Space sélectionne** : Focus sur un emoji → Enter ou Space → `onSelect(emoji)` + picker fermé
- [ ] **Clavier — Flèches navigation** : Les flèches directionnelles devraient naviguer dans la grille 2x4 (gap fonctionnel)
- [ ] **Clavier — Escape ferme** : Escape dans le picker → picker fermé (gap fonctionnel)
- [ ] **Click outside ferme** : Click en dehors du picker (sur le bouton "+" ou ailleurs) → picker fermé (via le toggle dans ReactionBar)
- [ ] **État — Disabled** : `disabled={true}` → tous les boutons désactivés avec `opacity-30 cursor-not-allowed`
- [ ] **État — Selected** : `selectedEmoji={emoji}` → le bouton a `bg-primary/20 ring-1 ring-primary scale-110`
- [ ] **Position — Absolute** : Le picker est en `absolute top-full left-0` → positionné sous le bouton "+"

---

## 31. Social — ShareButtons

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `aria-label` manquant** : Les boutons n'ont pas d'aria-label individuel explicite (seulement `sr-only` span). Ils devraient avoir `aria-label="Partager sur Twitter"` etc. (gap fonctionnel)
- [ ] **ARIA — `sr-only` responsive** : Les spans ont `sr-only sm:not-sr-only` → visible sur desktop, caché sur mobile (seulement icône)
- [ ] **État — Mutation pending** : `trackMutation.isPending` → tous les boutons disabled
- [ ] **Click — Twitter/X** : Click → `window.open` vers Twitter intent URL → focus sur le nouveau window/tab
- [ ] **Click — Discord** : Click → `copyLink("DISCORD")` → copie URL + toast "Lien copié !"
- [ ] **Click — TikTok** : Click → `copyLink("TIKTOK")` → copie URL
- [ ] **Click — Copy link** : Click → `copyLink("COPY_LINK")` → copie URL
- [ ] **Click — Web Share** : Click → `navigator.share({...})` si disponible, sinon `copyLink("WEB_SHARE")`
- [ ] **Clipboard — Succès** : `navigator.clipboard.writeText` réussit → toast "Lien copié !" + handleShare
- [ ] **Clipboard — Erreur** : `navigator.clipboard.writeText` échoue → toast destructif "Échec de la copie"
- [ ] **Web Share — Annulation** : `navigator.share` rejette → catch silencieux (pas d'erreur)
- [ ] **Track — Mutation** : Chaque partage appelle `trackMutation.mutate({ scenarioId, platform })`
- [ ] **Pop-up bloqué** : `window.open` retourne null (popup blocker) → pas de crash, gestion silencieuse

---

## 32. Social — BadgeDisplay / BadgeGrid

### ⬜ Nouveaux scénarios

- [ ] **ARIA — Grille de badges** : La grille CSS devrait avoir `role="list"` et chaque badge `role="listitem"` (gap fonctionnel)
- [ ] **ARIA — Image `alt=""`** : Si `badge.iconUrl` existe, l'image a `alt=""` (décorative) → correct
- [ ] **État — Loading skeleton (3 cards)** : `badgesQuery.isLoading` → 3 skeletons en grille avec cercle + 2 barres
- [ ] **État — Error** : `badgesQuery.isError` → icône AlertCircle + "Erreur lors du chargement des badges"
- [ ] **État — Empty** : `badges.length === 0` → EmptyState avec icône Medal, titre "Aucun badge pour le moment", description
- [ ] **État — Badge avec icône image** : `ub.badge.iconUrl` présent → `<img>` avec l'URL
- [ ] **État — Badge sans icône** : Pas d'iconUrl → icône Medal par défaut
- [ ] **État — Date formatée** : `formatDate(ub.awardedAt)` → "1 janvier 2026" (locale fr-FR)
- [ ] **État — Nom du badge** : `CardTitle` avec `ub.badge.name`
- [ ] **État — Description du badge** : `CardDescription` avec `ub.badge.description`
- [ ] **Responsive — Grille** : `grid grid-cols-2 md:grid-cols-3 gap-4` → 2 colonnes mobile, 3 desktop

---

## 33. Social — BadgeNotification

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `role="status"` et `aria-live="polite"`** : Le conteneur a `role="status"` et `aria-live="polite"` → annoncé par lecteurs d'écran
- [ ] **ARIA — Image badge sans alt** : L'image a `alt=""` (décorative) → correct
- [ ] **ARIA — Close button avec `aria-label="Fermer"`** : ✓ présent
- [ ] **Animation — Entrée** : `visible=true` → classes `translate-y-0 opacity-100` (via `transition-all duration-200`)
- [ ] **Animation — Sortie** : `visible=false` → classes `-translate-y-4 opacity-0`
- [ ] **Auto-dismiss — 5s** : `setTimeout` à 5000ms → `setVisible(false)` → puis 200ms après `setCurrentBadge(null)` + `onClose?.()`
- [ ] **Auto-dismiss — Reset** : Pendant les 5s, si un nouveau badge arrive → l'ancien timer est clear, nouveau cycle démarre
- [ ] **Fermeture manuelle** : Click X → `setVisible(false)` → 200ms → cleanup
- [ ] **État — badge null** : `badge === null` → return null (rien affiché)
- [ ] **État — Nouveau badge remplace l'ancien** : `badge` change → `setCurrentBadge` mis à jour, animation rédéclenchée
- [ ] **Focus management (gap)** : La notification n'attire pas le focus → le focus n'est pas volé (correct pour une notification passive)
- [ ] **Position** : `fixed top-4 right-4 z-50 max-w-sm w-full`
- [ ] **Icône badge** : `currentBadge.iconUrl` présent → img ; absent → icône Medal

---

## 34. Social — LeaderboardTable

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `role="list"` manquant** : La liste d'entrées n'a pas de role="list" explicite (gap fonctionnel)
- [ ] **ARIA — Avatar alt** : `AvatarImage` avec `alt={entry.name}` → correct
- [ ] **ARIA — Fallback initiales** : `AvatarFallback` avec la première lettre du nom → correct
- [ ] **État — Loading skeleton (5 rows)** : `isLoading` → 5 skeletons avec cercle + barres
- [ ] **État — Empty** : `entries.length === 0` → icône Trophy + "Aucune entrée dans le classement"
- [ ] **État — Top 1 (or)** : `rank === 1` → icône Trophy avec `text-yellow-400`, ligne highlight `border-primary/20 bg-primary/5`
- [ ] **État — Top 2 (argent)** : `rank === 2` → icône Trophy avec `text-gray-300`
- [ ] **État — Top 3 (bronze)** : `rank === 3` → icône Trophy avec `text-amber-600`
- [ ] **État — Rang 4+** : `rank > 3` → texte du numéro en `text-muted-foreground font-mono`
- [ ] **État — Format nombre** : `value >= 1000` → format "2.5k" ; sinon `toLocaleString("fr-FR")`
- [ ] **État — Extra text** : `entry.extra` présent → affiché en `text-xs text-muted-foreground truncate`
- [ ] **Avatar — Avec image** : `entry.image` présent → AvatarImage
- [ ] **Avatar — Sans image** : Pas d'image → seulement le Fallback avec initiale
- [ ] **Valeur label** : `{valueLabel}` affiché sous la valeur (ex: "points", "scénarios")

---

## 35. Social — FeaturedScenario

### ⬜ Nouveaux scénarios

- [ ] **ARIA — Badge "Scénario du jour"** : Badge `outline` avec étoile → correct mais pas d'aria-label spécifique
- [ ] **ARIA — Lien CTA** : Link vers `/create?scenario=${scenario.id}` → focus visible
- [ ] **État — Loading skeleton** : `featuredQuery.isLoading` → Card avec skeleton (avatar rond + texte)
- [ ] **État — Aucun scénario featured** : `featuredQuery.data` null/undefined → return null (caché)
- [ ] **État — Titre** : `scenario.title` dans `h3` avec `text-lg font-bold truncate`
- [ ] **État — Description absente** : `scenario.description` null → pas de description rendue
- [ ] **État — Description line-clamp** : `line-clamp-2` → max 2 lignes
- [ ] **État — Stats** : `likeCount`, `playCount` → formatés avec icônes Heart et Play
- [ ] **État — Creator** : `scenario.creator.username` → "par {username}"
- [ ] **État — Avatar personnage** : `scenario.character` présent → Avatar avec image ou fallback
- [ ] **État — Avatar fallback** : Pas d'image → `AvatarFallback` avec première lettre du nom, ou "?"
- [ ] **Click — CTA "Démarrer"** : Click → navigation vers `/create?scenario={id}`
- [ ] **Responsive** : `flex flex-col sm:flex-row` → empilé sur mobile

---

## 36. Social — ReportButton

### ⬜ Nouveaux scénarios

- [ ] **ARIA — Dialog focus trap** : Hérité du Dialog → focus trap actif
- [ ] **ARIA — Textarea label** : Le textarea n'a pas de label associé explicite (placeholder seulement) → devrait avoir `aria-label="Raison du signalement"` (gap fonctionnel)
- [ ] **ARIA — Compteur de caractères** : Le message d'info sous le textarea devrait être lié via `aria-describedby` (gap fonctionnel)
- [ ] **ARIA — `aria-describedby` sur le textarea** : Pas de liaison entre le textarea et le message "X caractères minimum requis" (gap fonctionnel)
- [ ] **ARIA — Bouton icon variant ** : `variant="icon"` → `aria-label="Signaler"` présent
- [ ] **ARIA — Bouton text variant** : `variant="text"` → texte "Signaler" visible, icône Flag
- [ ] **État — Dialog ouvert** : Click sur le bouton → dialog visible avec titre + description
- [ ] **État — Raison trop courte (< MIN_REPORT_REASON_LENGTH)** : `reason.trim().length < 10` → bouton submit disabled, message "N caractères minimum requis"
- [ ] **État — Raison suffisante (≥ 10)** : `reason.length >= 10` → "Signalement prêt à être envoyé", bouton enabled
- [ ] **État — Mutation pending** : `reportMutation.isPending` → "Envoi..." sur le bouton, deux boutons disabled
- [ ] **État — Succès** : `onSuccess` → toast "Signalement envoyé" (variant success), dialog fermé, reason reset
- [ ] **État — Erreur** : `onError` → toast destructif avec `err.message`
- [ ] **Fermeture — Annuler** : Click "Annuler" → dialog fermé, reason reset
- [ ] **Fermeture — Escape** : Escape → dialog fermé (hérité Dialog)
- [ ] **Variante — icon** : `variant="icon"` → juste un bouton icône Flag
- [ ] **Variante — text** : `variant="text"` → bouton avec icône + texte "Signaler"

---

## 37. Social — ClipCreator

### ⬜ Nouveaux scénarios

- [ ] **ARIA — Label "Titre (optionnel)" associé** : `<label htmlFor="clip-title">` → OK
- [ ] **ARIA — Label "Début (secondes)" associé** : `<label htmlFor="clip-start">` → OK
- [ ] **ARIA — Label "Fin (secondes)" associé** : `<label htmlFor="clip-end">` → OK
- [ ] **ARIA — Message d'erreur `aria-live="polite"`** : Le message de validation "La fin doit être après le début..." devrait être dans une live region (gap fonctionnel)
- [ ] **État — Formulaire valide** : `startTime >= 0 && endTime > startTime && endTime <= durationSeconds` → bouton enabled
- [ ] **État — Formulaire invalide** : `startTime === endTime` → bouton disabled, message d'erreur visible
- [ ] **État — EndTime > durationSeconds** : `endTime` clampé à `durationSeconds` dans onChange → `Math.min(durationSeconds, ...)`
- [ ] **État — StartTime < 0** : `startTime` clampé à `Math.max(0, ...)`
- [ ] **État — StartTime > EndTime** : startTime = 50, endTime = 10 → message d'erreur visible, bouton disabled
- [ ] **État — Mutation pending** : `createMutation.isPending` → "Création..." sur le bouton, disabled
- [ ] **État — Succès** : `onSuccess` → toast "Clip créé !", formulaire reset (title="" + startTime=0 + endTime=durationSeconds)
- [ ] **État — Erreur** : `onError` → toast destructif
- [ ] **État — Title maxLength=100** : Impossible de taper plus de 100 caractères
- [ ] **État — Title vide** : `title.trim()` est falsy → `undefined` passé à la mutation (optional)
- [ ] **Click — Submit** : Click "Créer le clip" → `createMutation.mutate({...})`
- [ ] **Responsive** : `grid grid-cols-2 gap-4` → deux colonnes pour start/end

---

## 38. Player — AudioPlayer

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `aria-label` sur le bouton play/pause** : Aucun aria-label sur le bouton play/pause. Devrait avoir `aria-label={isPlaying ? "Pause" : "Lecture"}` (gap fonctionnel)
- [ ] **ARIA — `role="slider"` manquant sur le seek** : L'input range n'a pas `role="slider"` explicite, ni `aria-valuemin`, `aria-valuemax`, `aria-valuenow` (gap fonctionnel)
- [ ] **ARIA — `aria-label="Rechercher"` sur l'input range** : Aucun aria-label sur le slider de progression (gap fonctionnel)
- [ ] **ARIA — `aria-label` sur les boutons de vitesse** : Les boutons de vitesse (0.5x, 0.75x, etc.) n'ont pas d'aria-label comme "Vitesse de lecture 1x" (gap fonctionnel)
- [ ] **ARIA — Durée `aria-hidden`** : Les spans de temps devraient être `aria-hidden` ou avoir un texte accessible (gap fonctionnel)
- [ ] **ARIA — Download link** : Le lien download a du texte "Télécharger" → correct
- [ ] **Clavier — Space pour play/pause** : Focus sur le bouton play → Space toggles play/pause
- [ ] **Clavier — Flèches pour seek** : Focus sur le slider → flèches gauche/droite ajustent la position (comportement natif de l'input range)
- [ ] **Clavier — Tab entre les contrôles** : Tab navigation : play/pause → slider → speed buttons → download
- [ ] **État — Empty (recordingUrl null)** : `!recordingUrl` → icône Clock + "Aucun enregistrement disponible"
- [ ] **État — Empty (recordingUrl undefined)** : `recordingUrl === undefined` → même état empty
- [ ] **État — Loading** : `!isLoaded && recordingUrl && !hasError` → icône Loader2 spinner + "Préparation de l'audio..."
- [ ] **État — Error** : `hasError === true` → icône AlertTriangle + "Chargement impossible" + "L'audio n'est pas accessible. Réessayez."
- [ ] **État — Play** : Click play → `isPlaying=true`, audio.play(), icône Pause
- [ ] **État — Pause** : Click pause → `isPlaying=false`, audio.pause(), icône Play
- [ ] **État — Fin de lecture** : `ended` event → `isPlaying=false`, `currentTime=0`
- [ ] **État — Seek** : Changer la valeur du slider → `audio.currentTime` mis à jour + `currentTime` state
- [ ] **État — Speed change** : Click sur 2x → `playbackRate=2`, `audio.playbackRate=2`, highlight sur le bouton 2x
- [ ] **État — Speed actif** : Le bouton avec `playbackRate === speed` a `bg-primary/10 text-primary`
- [ ] **État — Download** : Click "Télécharger" → lien `href=recordingUrl` avec `download` et `target="_blank"`
- [ ] **État — Titre optionnel** : `title` prop → affiché avant les contrôles en `text-sm text-muted-foreground`
- [ ] **Cleanup — unmount** : `useEffect` return → `audioRef.current.pause()`, `audioRef.current = null`
- [ ] **Reset — changement recordingUrl** : `useEffect([recordingUrl])` → reset `hasError` et `isLoaded`
- [ ] **Play sur nouvel audio** : `handleTogglePlay` avec `!audioRef.current && recordingUrl` → crée un nouvel Audio
- [ ] **Erreur réseau pendant play** : `audio.play().catch(...)` → `setIsPlaying(false)` (gère les autoplay blocks)
- [ ] **Audio metadata** : `loadedmetadata` → `setDuration(audio.duration)`, `setIsLoaded(true)`
- [ ] **Time update** : `timeupdate` → `setCurrentTime(audio.currentTime)` (pendant la lecture)
- [ ] **Audio error** : `error` event → `setIsLoaded(false)`, `setHasError(true)`

---

## 39. Player — TranscriptView

### ⬜ Nouveaux scénarios

- [ ] **ARIA — Bulles de chat** : Les bulles de chat devraient avoir des rôles ARIA pour indiquer le locuteur (gap fonctionnel)
- [ ] **ARIA — Avatars IA/User** : Les avatars sont des `div` avec texte → pas d'aria-label. Devraient avoir `aria-label="Assistant"` et `aria-label="Vous"` (gap fonctionnel)
- [ ] **ARIA — `aria-label` fallback** : Le titre du `scenarioName` pour l'IA → si null, "Personnage IA" est affiché
- [ ] **État — Loading skeleton (5 messages)** : `isLoading` → 5 messages skeleton alternés (pair=user/gauche, impair=ia/droite)
- [ ] **État — Loading skeleton alternance** : `i % 2 === 0` → skeleton à gauche ; `i % 2 === 1` → skeleton à droite
- [ ] **État — null transcript** : `transcript === null` → icône MessageSquare + "Transcript en cours de traitement…"
- [ ] **État — Empty array** : `transcript.length === 0` → "Aucune transcription disponible"
- [ ] **État — Message IA (gauche)** : `chunk.speaker === 'assistant'` → bulle à gauche, avatar IA (cercle bg-primary/20 + "IA")
- [ ] **État — Message User (droite)** : `chunk.speaker !== 'assistant'` → bulle à droite, avatar User (cercle bg-muted + "Moi")
- [ ] **État — Timestamp** : `chunk.timestamp` présent → formaté en `m:ss` et affiché après le nom
- [ ] **État — Pas de timestamp** : Pas de `timestamp` → rien affiché
- [ ] **État — Scenario name pour IA** : `scenarioName` présent → utilisé comme nom du personnage IA
- [ ] **État — speaker inconnu** : Ni 'assistant' ni autre valeur standard → traité comme user (bulle à droite)
- [ ] **État — Message très long** : Texte long → `max-w-[80%]` + wrapping normal
- [ ] **Message unique** : 1 seul chunk → rendu correct, pas de décalage

---

## 40. Player — ReplayHeader

### ⬜ Nouveaux scénarios

- [ ] **ARIA — Badge statut** : Badge avec variant selon statut + `STATUS_LABELS`
- [ ] **ARIA — Icônes décoratives** : Les icônes Phone, Clock, Calendar sont décoratives → `aria-hidden="true"` implicite
- [ ] **État — Tous les champs remplis** : `scenarioTitle`, `characterName`, `durationSeconds`, `status` → tous affichés
- [ ] **État — Titre null** : `scenarioTitle` undefined → "-" affiché
- [ ] **État — Personnage null** : `characterName` undefined → "-" affiché
- [ ] **État — Durée undefined** : `durationSeconds` undefined → "-" affiché
- [ ] **État — Statut undefined** : `status` undefined ou inconnu → "-"affiché via `STATUS_LABELS[status ?? ''] ?? status ?? '-'`
- [ ] **État — Statut COMPLETED** : `status === 'COMPLETED'` → Badge `variant="secondary"`
- [ ] **État — Autre statut** : Autre status → Badge `variant="outline"`
- [ ] **Responsive** : `grid grid-cols-2 md:grid-cols-4 gap-4` → 2 colonnes mobile, 4 colonnes desktop

---

## 41. Landing — MobileNav

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `aria-label="Menu"`** : Le bouton hamburger a `aria-label="Menu"` → correct
- [ ] **ARIA — `aria-expanded` manquant** : Le bouton devrait avoir `aria-expanded={mobileMenuOpen}` pour indiquer l'état d'expansion (gap fonctionnel)
- [ ] **ARIA — `aria-controls` manquant** : Le bouton devrait référencer l'ID du menu via `aria-controls` (gap fonctionnel)
- [ ] **ARIA — Menu `role="navigation"`** : Le menu déroulant est une `div` sans rôle navigation explicite (gap fonctionnel)
- [ ] **Clavier — Enter/Space toggle** : Focus sur le bouton hamburger → Enter ou Space ouvre/ferme le menu
- [ ] **Clavier — Escape ferme** : Menu ouvert → Escape devrait fermer le menu (gap fonctionnel)
- [ ] **Clavier — Tab navigation dans le menu** : Menu ouvert → Tab navigue entre les liens (Explorer, Tarifs, Connexion, S'inscrire)
- [ ] **Focus trap dans le menu (gap)** : Quand le menu est ouvert, Tab devrait cycler à l'intérieur du menu (gap fonctionnel)
- [ ] **Animation — Transition max-height** : `transition-all duration-300 ease-in-out` → menu glisse avec animation
- [ ] **Animation — `prefers-reduced-motion`** : L'animation devrait être désactivée avec `prefers-reduced-motion` (gap fonctionnel)
- [ ] **État — Ouvert** : `mobileMenuOpen=true` → `max-h-96 opacity-100`, contenu visible
- [ ] **État — Fermé** : `mobileMenuOpen=false` → `max-h-0 opacity-0`, contenu caché
- [ ] **État — Click lien ferme** : Click sur "Explorer" ou "Tarifs" → `setMobileMenuOpen(false)`, navigation
- [ ] **État — Bouton CTA** : Connexion → variant ghost, S'inscrire → variant default
- [ ] **Visibilité** : `md:hidden` → visible seulement sur mobile (<768px)

---

## 42. Landing — DemoAudioForm

### ⬜ Nouveaux scénarios

- [ ] **ARIA — Email input label** : L'input a `type="email"` et `placeholder="votre@email.com"` mais pas de label associé → devrait avoir `aria-label="Adresse email"` (gap fonctionnel)
- [ ] **ARIA — `required`** : L'input a `required` → validation navigateur
- [ ] **Validation — Email invalide** : Taper "test" et submit → validation navigateur "Veuillez saisir une adresse email valide"
- [ ] **Validation — Email vide** : Submit sans valeur → validation navigateur "Veuillez remplir ce champ"
- [ ] **Submit — Succès** : Email valide → submit → `alert("Merci ! ...")` (temporaire) → reset email
- [ ] **Submit — Espace** : Taper " test@example.com " → l'email est stocké tel quel (pas de trim)
- [ ] **Responsive** : `flex flex-col sm:flex-row` → empilé sur mobile
- [ ] **Clavier — Tab** : Tab dans l'input → Tab au bouton "Prévenir" → Enter submit

---

## 43. Landing — LiveCounter

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `aria-live="polite"` manquant** : Le compteur change à chaque nouvelle visite mais n'a pas de live region pour annoncer le changement (gap fonctionnel)
- [ ] **ARIA — Contenu statique** : Une fois monté, le nombre ne change pas → `aria-live` n'est pas critique
- [ ] **État — Valeur aléatoire** : `Math.floor(1800 + Math.random() * 2400)` → nombre entre 1800 et 4199
- [ ] **État — Format français** : `(1800).toLocaleString("fr-FR")` → "1 800"
- [ ] **Hydration — Stable** : `useState` avec initializer function → valeur unique, pas de mismatch SSR/client

---

## 44. Landing — CallAudioVisualizer

### ⬜ Nouveaux scénarios

- [ ] **ARIA — `aria-hidden="true"`** : Le conteneur a `aria-hidden="true"` → correct (élément décoratif)
- [ ] **Animation — Barres** : Chaque barre a `animation: audio-bar` avec durée et délai aléatoires
- [ ] **Animation — `prefers-reduced-motion`** : L'animation audio-bar devrait être désactivée avec `prefers-reduced-motion` (gap fonctionnel)
- [ ] **État — 20 barres** : `Array.from({ length: 20 })` → 20 barres avec hauteurs aléatoires (30-100%)
- [ ] **Hydration — Stable** : `useState` avec initializer → pas de mismatch SSR/client

---

## 45. Landing — FeaturedScenariosSection

### ⬜ Nouveaux scénarios

- [ ] **ARIA — Section sémantique** : `<section>` avec contenu → correct
- [ ] **ARIA — Badge "À la une"** : Badge positionné `absolute -top-2.5 -left-2.5` avec ombre
- [ ] **État — Loading via DataLoader** : DataLoader avec skeletonCount=3 par défaut
- [ ] **État — Empty custom** : `isEmpty={(data) => !data}` → empty ReactNode avec "Aucun scénario à la une aujourd'hui"
- [ ] **État — ScenarioCard affiché** : DataLoader → `children(scenario)` → ScenarioCard avec showShare
- [ ] **Animation — `animate-fade-in`** : Le conteneur du scenario a `animate-fade-in`
- [ ] **Navigation — "Voir tout"** : Click → lien vers `/explore`

---

## 46. Thème Dark/Light

### ⬜ Nouveaux scénarios

- [ ] **Thème — Persistance après navigation SPA** : Dashboard → dark theme → naviguer vers Settings → theme encore dark
- [ ] **Thème — Persistance après page reload** : Dashboard → dark theme → F5 → theme encore dark
- [ ] **Thème — Synchronisation composants** : ThemeToggle sur DashboardShell → dark → Card, Alert, Dialog, Badge, etc. utilisent les classes dark appropriées
- [ ] **Thème — Alert variant "warning" en dark** : Dark mode → Alert warning doit avoir `dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200`
- [ ] **Thème — Couleurs texte** : Dark mode → `text-foreground` = blanc/clair, `text-muted-foreground` = gris clair
- [ ] **Thème — Bordures** : Dark mode → `border-border` utilise des couleurs adaptées
- [ ] **Thème — Backdrop blur** : `bg-background/80 backdrop-blur-sm` s'adapte au thème
- [ ] **Thème — Aucun flash** : Au chargement, pas de flash du thème clair si dark est actif (vérifier la classe sur `<html>`) (gap potentiel si next-themes pas correctement configuré)

---

## 47. Animations & prefers-reduced-motion

### ⬜ Nouveaux scénarios

- [ ] **Skeleton — `prefers-reduced-motion`** : `@media (prefers-reduced-motion: reduce)` → `animation: none` sur `animate-pulse` (gap fonctionnel)
- [ ] **Dialog overlay — `animate-fade-in`** : `prefers-reduced-motion` → l'animation devrait être supprimée (gap fonctionnel)
- [ ] **Dialog content — `animate-zoom-in`** : `prefers-reduced-motion` → zoom-in désactivé (gap fonctionnel)
- [ ] **Toast — `animate-slide-in-right`** : `prefers-reduced-motion` → slide désactivé (gap fonctionnel)
- [ ] **MobileNav — transition** : `prefers-reduced-motion` → transition max-height désactivée (gap fonctionnel)
- [ ] **BadgeNotification — transition** : `prefers-reduced-motion` → animation entrée/sortie désactivée (gap fonctionnel)
- [ ] **Audio visualizer — animation** : `prefers-reduced-motion` → barres sans animation (gap fonctionnel)
- [ ] **DashboardShell — hover glow** : `group-hover:scale-110` → désactivé avec reduced motion (gap fonctionnel)
- [ ] **EmojiPicker — hover scale** : `hover:scale-110` → désactivé avec reduced motion (gap fonctionnel)

---

## 48. Focus Management Transversal

### ⬜ Nouveaux scénarios

- [ ] **Skip link** : Tab au chargement de la page → "Aller au contenu principal" visible → Enter → focus sur `#main-content`
- [ ] **Tab navigation — Landing page** : Tab navigue dans l'ordre logique : nav → hero → sections → footer
- [ ] **Tab navigation — Dashboard** : Tab : nav links → CreditDisplay → ThemeToggle → Settings → contenu principal
- [ ] **Focus visible — Tous les éléments interactifs** : Chaque bouton, lien, input a `focus-visible:ring-2` visible
- [ ] **Focus trap — ConfirmDialog** : Tab cycle à l'intérieur du dialog → impossible de focuser en dehors
- [ ] **Focus trap — CallDisclaimerDialog** : Tab cycle dans le dialog → focus piégé
- [ ] **Focus restoration — Dialog fermé par Escape** : Focus retourne sur le trigger
- [ ] **Focus restoration — Dialog fermé par backdrop** : Focus retourne sur le trigger
- [ ] **Focus restoration — ConfirmDialog fermé** : Focus retourne sur le bouton qui a ouvert le dialog
- [ ] **No focus steal — BadgeNotification** : La notification n'attire pas le focus (pas de `autoFocus`)
- [ ] **No focus steal — Toast** : Les toasts n'attirent pas le focus
- [ ] **Body scroll lock — Multiple dialogs** : Dialog A ouvert → Dialog B ouvert par-dessus → body toujours locked. Fermeture de B → body toujours locked (reste verrouillé par A)

---

## 49. Responsive Transversal

### ⬜ Nouveaux scénarios

- [ ] **Button — `size="icon"` sur mobile** : Toujours carré 40x40 sans texte, seulement icône
- [ ] **Button — `size="sm"`** : 36px de hauteur, padding réduit
- [ ] **Dialog — max-width mobile** : `<640px` : `max-w-[calc(100vw-2rem)]` → presque plein écran avec marge
- [ ] **Dialog — max-width desktop** : `≥640px` : `max-w-lg` → largeur fixe
- [ ] **DialogFooter — mobile** : `flex-col-reverse` → boutons empilés, Cancel en bas
- [ ] **DialogFooter — desktop** : `sm:flex-row sm:justify-end sm:space-x-2` → boutons côte à côte
- [ ] **Breadcrumbs — mobile** : Texte peut être tronqué si trop long
- [ ] **Footer — mobile** : `flex-col` → contenu empilé verticalement
- [ ] **Footer — desktop** : `sm:flex-row` → logo à gauche, liens à droite
- [ ] **DashboardShell — nav mobile** : `overflow-x-auto hide-scrollbar` → scroll horizontal si besoin
- [ ] **DashboardShell — titre responsive** : `text-3xl` → taille fixe, pourrait être plus petit sur mobile
- [ ] **ScenarioCard — grid responsive** : `md:grid-cols-2 lg:grid-cols-3` → adapté à l'écran
- [ ] **LeaderboardTable — responsive** : Pas de classes responsive spécifiques → peut déborder sur mobile
- [ ] **ConfirmDialog — mobile** : DialogFooter en `flex-col-reverse`
- [ ] **PasswordStrengthMeter — mobile** : Les barres sont `flex-1` → s'adaptent à la largeur

---

## 50. Formulaires — Validation

### ⬜ Nouveaux scénarios

- [ ] **ClipCreator — Start > Duration** : startTime = 9999 ( > durationSeconds ) → clampé à durationSeconds
- [ ] **ClipCreator — End < Start** : startTime = 50, endTime = 30 → message d'erreur visible, bouton disabled
- [ ] **ClipCreator — Valeurs négatives** : startTime = -5 → clampé à `Math.max(0, -5)` = 0
- [ ] **ClipCreator — Valeurs décimales** : startTime = 5.7 → `Math.round()` = 6
- [ ] **ClipCreator — Double submit** : Click rapide 2x sur "Créer le clip" → mutation appelée une seule fois (bouton désactivé par isPending)
- [ ] **DemoAudioForm — Email invalide** : Taper "pas-un-email" → validation HTML5 bloque le submit
- [ ] **DemoAudioForm — Input vide + required** : Submit sans valeur → validation HTML5 "Please fill out this field"
- [ ] **ReportButton — Raison minimale (10 chars)** : Taper "abc" → message "7 caractères minimum requis", bouton disabled
- [ ] **ReportButton — Raison valide (10+ chars)** : Taper "Contenu inapproprié" → "Signalement prêt à être envoyé", bouton enabled
- [ ] **ReportButton — Espaces seulement** : "      " (10 espaces) → `trim().length === 0` → < 10 → bouton disabled (correct)
- [ ] **ReportButton — Double submit** : Click "Signaler" → mutation pending → bouton disabled → pas de double envoi
- [ ] **CallDisclaimerDialog — Checkbox requise** : Checkbox non cochée → "Démarrer l'appel" disabled
- [ ] **CallDisclaimerDialog — Checkbox cochée** : Checkbox cochée → bouton enabled
- [ ] **CallDisclaimerDialog — Double submit** : Click "Démarrer" → isPending=true → bouton disabled

---

## Résumé Statistique

| Catégorie | Scénarios |
|-----------|:---------:|
| UI Components (Button, Dialog, Input, Textarea, Checkbox, Badge, Avatar, Alert, Skeleton, ThemeToggle, Card, SegmentedControl, Toast, Tooltip) | 98 |
| Shared Components (DataLoader, PaginatedDataLoader, PaginatedGrid, ScenarioCard, ConfirmDialog, ConsentBanner, CallDisclaimerDialog, CreditDisplay, EmptyState, Breadcrumbs, Footer, PasswordStrengthMeter, CallHistoryRow, DashboardShell) | 69 |
| Social Components (ReactionBar, EmojiPicker, ShareButtons, BadgeDisplay, BadgeNotification, LeaderboardTable, FeaturedScenario, ReportButton, ClipCreator) | 55 |
| Player Components (AudioPlayer, TranscriptView, ReplayHeader) | 37 |
| Landing Components (MobileNav, DemoAudioForm, LiveCounter, CallAudioVisualizer, FeaturedScenariosSection) | 17 |
| Thème Dark/Light | 8 |
| Animations & prefers-reduced-motion | 9 |
| Focus Management Transversal | 12 |
| Responsive Transversal | 15 |
| Formulaires — Validation | 15 |
| **Total** | **~335 scénarios** |

---

## Notes Techniques pour l'Implémentation

### Patterns de test recommandés (Playwright)

```typescript
// Test d'accessibilité ARIA
test("dialog has correct aria attributes", async ({ page }) => {
  await page.getByRole("button", { name: "Open" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAttribute("aria-modal", "true");
  await expect(dialog).toHaveAttribute("aria-labelledby");
  const titleId = await dialog.getAttribute("aria-labelledby");
  await expect(page.locator(`#${titleId}`)).toBeVisible();
});

// Test focus trap
test("focus cycles inside dialog", async ({ page }) => {
  await page.getByRole("button", { name: "Open" }).click();
  // Tab from last element should go back to first
  await page.locator('[aria-label="Fermer"]').focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Annuler" })).toBeFocused();
});

// Test prefers-reduced-motion
test("skeleton has no animation with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const skeleton = page.locator(".animate-pulse").first();
  const computedAnimation = await skeleton.evaluate(el =>
    window.getComputedStyle(el).animation
  );
  expect(computedAnimation).toBe("none");
});

// Test body scroll lock
test("body is scroll locked when dialog is open", async ({ page }) => {
  await page.getByRole("button", { name: "Open" }).click();
  const overflow = await page.evaluate(() => document.body.style.overflow);
  expect(overflow).toBe("hidden");
});
```

### Gaps fonctionnels critiques identifiés

| Gap | Composant | Sévérité |
|-----|-----------|:--------:|
| `prefers-reduced-motion` non supporté | Skeleton, Dialog, Toast, MobileNav, BadgeNotification | 🟠 HAUTE |
| `aria-live` absent sur toasts | Toast system | 🟠 HAUTE |
| `role="slider"` manquant sur seek bar | AudioPlayer | 🟠 HAUTE |
| `aria-label` manquant sur play/pause | AudioPlayer | 🟠 HAUTE |
| `aria-expanded` manquant sur menu toggle | MobileNav | 🟡 MOYENNE |
| `aria-controls` manquant sur menu toggle | MobileNav | 🟡 MOYENNE |
| Focus trap manquant dans menu mobile | MobileNav | 🟡 MOYENNE |
| Flèches clavier non gérées | SegmentedControl, EmojiPicker | 🟡 MOYENNE |
| `aria-describedby` non lié au textarea | ReportButton | 🟡 MOYENNE |
| Fermeture Escape non gérée | EmojiPicker, MobileNav | 🟡 MOYENNE |
| Optimistic update absent | ReactionBar | 🟡 MOYENNE |
| `aria-live` pour compteur caractères | ReportButton, ClipCreator | 🟢 FAIBLE |

---

*Document généré par analyse statique du code source — 24 juin 2026*
