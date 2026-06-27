# EchoRoom — Scénarios de Test Complets (E2E Playwright)

> **Version :** 24 juin 2026  
> **Couverture :** 32 fichiers, 225 tests ✅, 534 planifiés ⬜  
> **Source :** Analyse exhaustive du code source + components + pages + API

---

## Table des matières

1. [AudioPlayer — 20 scénarios](#1-audioplayer)
2. [TranscriptView — 10 scénarios](#2-transcriptview)
3. [ClipCreator — 16 scénarios](#3-clipcreator)
4. [ShareButtons — 12 scénarios](#4-sharebuttons)
5. [ReportButton — 12 scénarios](#5-reportbutton)
6. [ReactionBar — 14 scénarios](#6-reactionbar)
7. [EmojiPicker — 8 scénarios](#7-emojipicker)
8. [DataLoader — 10 scénarios](#8-dataloader)
9. [PaginatedDataLoader — 8 scénarios](#9-paginateddataloader)
10. [ScenarioCard — 14 scénarios](#10-scenariocard)
11. [Admin Moderation (CRUD) — 18 scénarios](#11-admin-moderation)
12. [Admin Blocked Numbers (CRUD) — 14 scénarios](#12-admin-blocked-numbers)
13. [Dashboard Content — FeaturedScenario — 8 scénarios](#13-featuredscenario)
14. [Dashboard Content — BadgeGrid/BadgeDisplay — 10 scénarios](#14-badgegrid)
15. [Dashboard Content — Quick Actions — 6 scénarios](#15-quick-actions)
16. [CallDisclaimerDialog — 12 scénarios](#16-calldisclaimerdialog)
17. [PasswordStrengthMeter — 12 scénarios](#17-passwordstrengthmeter)
18. [Toast System — 8 scénarios](#18-toast-system)
19. [ConfirmDialog — 8 scénarios](#19-confirmdialog)
20. [DashboardShell — 8 scénarios](#20-dashboardshell)
21. [CreditDisplay — 6 scénarios](#21-creditdisplay)
22. [EmptyState — 4 scénarios](#22-emptystate)
23. [CallHistoryRow — 6 scénarios](#23-callhistoryrow)
24. [ReplayHeader — 4 scénarios](#24-replayheader)
25. [CommentModerationTab — 8 scénarios](#25-commentmoderationtab)
26. [Admin Users — 12 scénarios](#26-admin-users)
27. [Admin Reports — 8 scénarios](#27-admin-reports)
28. [Admin Audit — 8 scénarios](#28-admin-audit)
29. [Admin Analytics — 4 scénarios](#29-admin-analytics)
30. [AdminSidebar — 4 scénarios](#30-adminsidebar)

---

## 1. AudioPlayer

**Source :** `src/components/player/AudioPlayer.tsx`

Interfaces : `{ recordingUrl: string | null | undefined, title?: string }`

États : 3 états visuels distincts + 1 état chargé avec interactions complexes.

### Succès (Happy Path)
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Recording URL valide → composant rendu avec contrôles | Success | Bouton play/pause visible, slider seek visible, speed buttons, download |
| 2 | Play/Pause toggle — création Audio() | Interaction | `handleTogglePlay` crée Audio sur premier play, alterne pause/play |
| 3 | Seek slider — met à jour currentTime | Interaction | Slider type="range" avec min=0 max=duration, onChange change currentTime |
| 4 | Speed controls — 6 vitesses (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x) | Interaction | 6 boutons visibles, click change playbackRate et classe active |
| 5 | Speed actif highlighté — bg-primary/10 + text-primary | Visual | `playbackRate === speed` → classe spécifique |
| 6 | Download button — lien direct vers recordingUrl | Navigation | Tag `<a>` avec href=recordingUrl, download, target="_blank" |
| 7 | Titre optionnel affiché au-dessus des contrôles | Visual | `title && <p>{title}</p>` |
| 8 | Time display — format mm:ss | Visual | `formatTime()` → `${m}:${s.padStart(2,'0')}` |

### États vides / limites
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 9 | recordingUrl null → "Aucun enregistrement disponible" | Empty | Icône Clock + texte "Aucun enregistrement disponible" |
| 10 | recordingUrl undefined → "Aucun enregistrement disponible" | Empty | Même rendu que null |
| 11 | recordingUrl chaîne vide → traité comme falsy → empty | Edge | `if (!recordingUrl)` → empty state |

### États de chargement
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 12 | Audio en cours de chargement → spinner + "Préparation de l'audio..." | Loading | `!isLoaded && !hasError` → Loader2 spinner + texte |
| 13 | loadedmetadata → isLoaded=true, duration settée | Transition | Event listener `loadedmetadata` → setDuration + setIsLoaded |
| 14 | timeupdate → currentTime mis à jour | Transition | Event listener `timeupdate` → setCurrentTime |

### États d'erreur
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 15 | Erreur chargement audio → AlertTriangle + message erreur | Error | `hasError` → AlertTriangle + "Chargement impossible" + "L'audio n'est pas accessible" |
| 16 | audio.addEventListener('error') → hasError=true | Error | Event listener error → setHasError(true), setIsLoaded(false) |
| 17 | audio.play() reject → isPlaying=false | Error | `.catch(() => setIsPlaying(false))` |
| 18 | Erreur après rejeu → retour à l'état loaded | Recovery | reset states quand recordingUrl change |

### Edge cases
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 19 | Audio ended → reset à 0 + isPlaying=false | Edge | Event listener `ended` → setCurrentTime(0), setIsPlaying(false) |
| 20 | Cleanup — audio.pause() au démontage | Edge | `useEffect` return → `audioRef.current.pause()` |

---

## 2. TranscriptView

**Source :** `src/components/player/TranscriptView.tsx`

Interfaces : `{ transcript: TranscriptChunk[] | null | undefined, isLoading: boolean, scenarioName?: string }`

TranscriptChunk : `{ speaker: string, text: string, timestamp?: number }`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Transcript chargé → bulles de chat alternées | Success | IA messages à gauche (bg-muted), User messages à droite (bg-secondary) |
| 2 | Avatar IA vs Moi — pastilles distinctes | Visual | IA : bg-primary/20 "IA", User : bg-muted "Moi" |
| 3 | Nom du personnage IA — utilise scenarioName | Visual | `scenarioName ?? 'Personnage IA'` |
| 4 | Timestamp optionnel affiché | Visual | `chunk.timestamp && <span>{formatTimestamp}</span>` |
| 5 | Format timestamp mm:ss | Visual | `formatTimestamp()` → `${m}:${s.padStart(2,'0')}` |

### États de chargement
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 6 | isLoading=true → 5 squelettes alternés | Loading | `Array.from({length:5})` — alterne left/right avec Skeleton cercle + barres |
| 7 | Squelette IA à gauche avec cercle | Loading | `i % 2 === 0` → Skeleton w-8 h-8 rounded-full |
| 8 | Squelette User à droite sans cercle | Loading | `i % 2 === 1` → justify-end |

### États vides / nuls
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 9 | transcript=null → "Transcript en cours de traitement…" | Empty | Icône MessageSquare + texte |
| 10 | transcript=[] → "Aucune transcription disponible" | Empty | Icône MessageSquare + texte distinct |

---

## 3. ClipCreator

**Source :** `src/components/social/ClipCreator.tsx`

Interfaces : `{ callId: string, durationSeconds: number }`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Composant rendu avec titre "Créer un clip" | Success | Icône Scissors + span "Créer un clip" |
| 2 | Champ titre optionnel (maxLength=100) | Success | Input id="clip-title", placeholder="Clip", maxLength=100 |
| 3 | Champ début (nombre, min=0, max=durationSeconds) | Success | Input id="clip-start", type="number", step=1 |
| 4 | Champ fin (nombre, min=0, max=durationSeconds) | Success | Input id="clip-end", type="number", step=1 |
| 5 | Création réussie → toast "Clip créé !" + reset | Success | `onSuccess` → toast + setTitle(""), setStartTime(0), setEndTime(duration) |

### Validation
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 6 | isValid = startTime>=0 && endTime>startTime && endTime<=duration | Validation | Logique combinée condition |
| 7 | Bouton désactivé quand !isValid | Validation | `disabled={!isValid \|\| createMutation.isPending}` |
| 8 | Message d'erreur visible quand startTime>0 && !isValid | Validation | `<p className="text-xs text-destructive">` |
| 9 | Message d'erreur: "La fin doit être après le début" | Validation | Texte exact |
| 10 | Start time clampé à max 0 (Math.max) | Edge | `setStartTime(Math.max(0, ...))` |
| 11 | End time clampé entre 0 et durationSeconds | Edge | `setEndTime(Math.min(durationSeconds, Math.max(0, ...)))` |
| 12 | Titre vide → envoyé comme undefined | Edge | `title.trim() \|\| undefined` |

### États de chargement
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 13 | Mutation pending → bouton désactivé + "Création..." | Loading | `createMutation.isPending` → disabled + texte changé |

### États d'erreur
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 14 | Erreur création → toast destructif | Error | `onError` → toast titre = err.message |
| 15 | Erreur sans message → message fallback | Error | `err.message \|\| "Erreur lors de la création du clip"` |

### Edge cases
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 16 | endTime égal à durationSeconds valide | Edge | `endTime <= durationSeconds` — égalité OK |

---

## 4. ShareButtons

**Source :** `src/components/social/ShareButtons.tsx`

Interfaces : `{ scenarioId: string, title: string, description?: string }`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | 4 boutons visibles (Twitter, Discord, TikTok, Partager) | Success | 4 Button variant="outline" size="sm" |
| 2 | Twitter/X → window.open avec URL tweet | Interaction | `window.open(https://twitter.com/intent/tweet?...)` |
| 3 | Discord → copy link + toast "Lien copié !" | Interaction | `navigator.clipboard.writeText(url)` → toast |
| 4 | TikTok → copy link + trackShare("TIKTOK") | Interaction | copyLink + trackMutation |
| 5 | Partager → Web Share API ou copy fallback | Interaction | `navigator.share()` ou copyLink |
| 6 | trackShare mutation appelée pour chaque partage | Tracking | `handleShare(platform)` → `trackMutation.mutate({scenarioId, platform})` |
| 7 | Texte accessible "Twitter / X", "Discord", "TikTok", "Partager" | A11y | `sr-only sm:not-sr-only` spans |

### États de chargement
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 8 | trackMutation.isPending → tous les boutons disabled | Loading | `disabled={trackMutation.isPending}` sur chaque bouton |

### États d'erreur
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 9 | Clipboard writeText échoue → toast "Échec de la copie" | Error | `.catch(() => toast({title:"Échec de la copie", variant:"destructive"}))` |
| 10 | Web Share API annulé par user → silencieux | Error | `catch {}` — user cancelled |

### Edge cases
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 11 | description incluse dans le tweet si présente | Edge | `description ? encodeURIComponent(\`${title}\n\n${description}\`) : encodedTitle` |
| 12 | URL construite depuis window.location.origin | Edge | `getBaseUrl()` → `window.location.origin` |

---

## 5. ReportButton

**Source :** `src/components/social/ReportButton.tsx`

Interfaces : `{ targetType: "SCENARIO" | "COMMENT" | "USER", targetId: string, variant?: "icon" | "text" }`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Variante icône — Flag + aria-label "Signaler" | Success | Button variant="ghost" size="icon" |
| 2 | Variante texte — "Signaler" + Flag | Success | Button size="sm" avec texte "Signaler" |
| 3 | Dialogue s'ouvre au clic → titre "Signaler un contenu" | Interaction | Dialog → DialogTitle + DialogDescription |
| 4 | Textarea raison avec placeholder | Interaction | Textarea placeholder minimum 10 caractères |
| 5 | Envoi réussi → toast "Signalement envoyé" + fermeture | Success | `onSuccess` → toast + setOpen(false) + setReason("") |
| 6 | Compteur caractères — statut avant/après 10 | Visual | `< 10` → "X caractères minimum requis", `>= 10` → "Signalement prêt" |

### Validation
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 7 | Bouton Signaler désactivé si raison < MIN_REPORT_REASON_LENGTH | Validation | `disabled={reason.trim().length < MIN_REPORT_REASON_LENGTH \|\| isPending}` |
| 8 | handleSubmit retourne si raison < 10 | Validation | `if (reason.trim().length < MIN_REPORT_REASON_LENGTH) return` |
| 9 | Annuler → fermeture + reset raison | Validation | Dialog fermé, setReason("") |

### États de chargement
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 10 | Mutation pending → bouton "Envoi..." + disabled | Loading | `reportMutation.isPending` → disabled + texte "Envoi..." |

### États d'erreur
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 11 | Erreur envoi → toast destructif | Error | `onError` → toast err.message |
| 12 | Erreur sans message → fallback | Error | `err.message ?? "Erreur lors de l'envoi du signalement"` |

---

## 6. ReactionBar

**Source :** `src/components/social/ReactionBar.tsx`

Interfaces : `{ scenarioId: string }`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Réactions chargées depuis API → boutons emoji | Success | `reactionsQuery.data?.reactions` → boutons avec emoji + count |
| 2 | Click emoji → toggleLike mutation | Interaction | `handleToggle(emoji)` → `toggleMutation.mutate({scenarioId, emoji})` |
| 3 | Toggle succès → refetch réactions | Interaction | `onSuccess` → `reactionsQuery.refetch()` |
| 4 | Bouton "+" pour ajouter réaction | Interaction | `aria-label="Ajouter une réaction"` → toggle EmojiPicker |
| 5 | EmojiPicker s'ouvre au clic sur "+" | Interaction | `showPicker=true` → EmojiPicker rendu |
| 6 | Sélection emoji → toggle + fermeture picker | Interaction | `onSelect` → handleToggle + setShowPicker(false) |

### États de chargement / vides
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 7 | reactions=[] → seulement le bouton "+" | Empty | `reactions.length === 0` → juste le "+" |
| 8 | reactionsQuery loading → aucun rendu bloquant | Loading | Pas de loading state, les réactions apparaissent quand prêtes |

### États d'erreur
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 9 | toggleLike erreur → toast "Impossible de réagir" | Error | `onError` → toast err.message \|\| "Impossible de réagir" |

### Edge cases
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 10 | toggleMutation.isPending → tous disabled | Edge | `disabled={toggleMutation.isPending}` sur tous les boutons |
| 11 | Double clic rapide → pending bloque le second | Edge | isPending désactive pendant la mutation |
| 12 | EmojiPicker position absolute top-full | Visual | `.absolute.top-full.left-0` avec shadow-xl + z-10 |
| 13 | Bordure en pointillé sur bouton "+" | Visual | `border-dashed` |
| 14 | EmojiPicker disparaît au clic extérieur (si implémenté) | Interaction | setShowPicker(false) |

---

## 7. EmojiPicker

**Source :** `src/components/social/EmojiPicker.tsx`

Interfaces : `{ selectedEmoji?: string, onSelect: (emoji: string) => void, disabled?: boolean }`

EMOJIS = ["❤️", "😂", "😮", "🔥", "😭", "🤯", "💀", "👀"]

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Grille 4x2 avec 8 emojis | Success | `grid grid-cols-4 gap-1` avec 8 boutons |
| 2 | Click emoji → onSelect callback | Interaction | onClick → onSelect(emoji) |
| 3 | Emoji sélectionné → highlight (bg-primary/20 + ring) | Visual | `isSelected && "bg-primary/20 ring-1 ring-primary scale-110"` |

### États
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 4 | disabled=true → tous les boutons désactivés | State | `disabled={disabled}` + classe disabled:opacity-30 |
| 5 | Aucun selectedEmoji → pas de highlight | State | Tous les boutons en état normal |
| 6 | Hover → bg-primary/10 + scale-110 | Visual | `hover:bg-primary/10 hover:scale-110` |
| 7 | Focus-visible ring pour accessibilité | A11y | `focus-visible:ring-2 focus-visible:ring-primary` |

### Accessibilité
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 8 | aria-label "Réagir avec {emoji}" | A11y | Chaque bouton aria-label dynamique |

---

## 8. DataLoader

**Source :** `src/components/shared/DataLoader.tsx`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Data chargée → children render | Success | `query.data` non-null + `!isEmpty()` → children(data) |
| 2 | isEmpty callback personnalisé | Edge | `isEmpty?.(query.data)` → empty state |

### États de chargement
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 3 | isLoading=true → skeleton grid par défaut (3 cols, skeletonCount items) | Loading | `grid md:grid-cols-3 gap-4` avec skeletonCount skeletons |
| 4 | skeletonCount par défaut = 3 | Loading | `skeletonCount = 3` |
| 5 | skeleton personnalisé (override) | Loading | `skeleton ?? (...)` — rend le custom skeleton |

### États d'erreur
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 6 | isError=true → AlertTriangle + "Une erreur est survenue" | Error | AlertTriangle + titre + description |
| 7 | Message d'erreur custom depuis query | Error | `query.error?.message ?? 'Impossible de charger...'` |
| 8 | Bouton "Réessayer" → query.refetch() | Error | Button onClick → query.refetch() |

### États vides
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 9 | data=undefined → empty | Empty | `!query.data` → empty node |
| 10 | empty personnalisé (override) | Empty | `empty ?? (...)` — rend le custom empty |

---

## 9. PaginatedDataLoader

**Source :** `src/components/shared/PaginatedDataLoader.tsx`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Items chargés → children(items) | Success | `query.items` non-vide → children(items) |

### États de chargement
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 2 | isLoading=true → spinner Loader2 par défaut | Loading | `flex justify-center py-16` + Loader2 animate-spin |
| 3 | loadingSkeleton personnalisé (override) | Loading | `loadingSkeleton ?? (...)` |

### États d'erreur
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 4 | isError=true → AlertTriangle + "Une erreur est survenue" | Error | AlertTriangle + titre + description |
| 5 | Message erreur custom ou fallback | Error | `query.error?.message ?? "Impossible de charger les données"` |
| 6 | Bouton "Réessayer" → refetch() | Error | Button avec RefreshCw + onClick refetch |

### États vides
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 7 | items.length === 0 → empty node | Empty | `!query.items \|\| query.items.length === 0` |
| 8 | empty null/undefined → rien rendu | Edge | `<>{empty}</>` — peut être null |

---

## 10. ScenarioCard

**Source :** `src/components/shared/ScenarioCard.tsx`

Interfaces : `ScenarioCardData { id, title, description, character?, creator?, _count?, playCount?, likeCount?, visibility? }`
Props : `{ scenario, href?, showCreator?, showShare? }`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Carte rendue avec catégorie badge + titre | Success | Badge variant="secondary" + CardTitle |
| 2 | Description avec line-clamp-2 | Visual | `CardDescription.className = "line-clamp-2"` |
| 3 | "playCount" formaté (1k pour >1000) | Visual | `> 1000 ? \`${(n/1000).toFixed(1)}k\` : n` |
| 4 | Icône Play + compteur dans header | Visual | `Play w-3 h-3` + nombre |
| 5 | "par {creator.username}" affiché | Visual | `showCreator && scenario.creator` |
| 6 | Like count + comment count dans footer | Visual | Heart + MessageCircle icônes |
| 7 | Carte link vers /scenario/{id} | Navigation | `Link href={href}` |
| 8 | Share button (quand showShare=true) | Interaction | Button onClick → clipboard copy |
| 9 | Share succès → toast "Lien copié !" | Interaction | `toast({title:"Lien copié !", variant:"success"})` |

### États
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 10 | showCreator=false → pas de "par" | State | Conditionnel |
| 11 | Creator absent → pas de texte créateur | State | `scenario.creator && (...)` |
| 12 | description null → pas rendue | State | `scenario.description && (...)` |
| 13 | playCount undefined → pas de compteur | State | `scenario.playCount !== undefined && (...)` |

### Accessibilité
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 14 | Focus-visible ring sur le lien | A11y | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary` |

---

## 11. Admin Moderation

**Source :** `src/app/admin/moderation/ModerationPageClient.tsx`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Tabs Scénarios / Commentaires visibles et cliquables | Success | 2 Buttons avec variant default/outline selon activeTab |
| 2 | File d'attente modération chargée → DataLoader | Success | `api.admin.moderationQueue.useQuery({limit:50})` |
| 3 | Item modération avec titre, créateur, perso, date | Success | Card avec infos formatées |
| 4 | Badge "En attente" avec AlertTriangle | Visual | Badge + AlertTriangle w-3 h-3 |
| 5 | Bouton vert Approve (Check) | Interaction | Button variant ghost, texte green-500 |
| 6 | Bouton rouge Reject (X) | Interaction | Button variant ghost, text-destructive |
| 7 | Approve succès → toast "Scénario approuvé" + refetch | Success | `onSuccess` → toast + queueQuery.refetch() |
| 8 | Reject succès → toast "Scénario rejeté" + refetch | Success | `onSuccess` → toast + queueQuery.refetch() |
| 9 | Onglet Commentaires → CommentModerationTab | Interaction | `activeTab === "comments"` → rend CommentModerationTab |

### États de chargement
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 10 | DataLoader loading pendant chargement queue | Loading | Skeleton grid |
| 11 | Boutons Approve/Reject disabled pendant mutation | Loading | `disabled={approveMutation.isPending}` |

### États vides
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 12 | Queue vide → "Tout est modéré" avec Check icône | Empty | Check w-16 h-16 + "Tout est modéré" |

### États d'erreur
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 13 | DataLoader erreur → AlertTriangle | Error | DataLoader error state |
| 14 | Approve erreur → toast destructif | Error | `onError` → toast err.message |
| 15 | Reject erreur → toast destructif | Error | `onError` → toast err.message |
| 16 | Approve erreur sans message → fallback | Error | `err.message ?? "Erreur lors de l'approbation"` |

### Accessibilité
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 17 | Tabs aria-pressed ou aria-selected similaire | A11y | Boutons avec variant visuel |

### Edge cases
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 18 | Date formatée en français avec toLocaleDateString | Edge | `toLocaleDateString("fr-FR")` |

---

## 12. Admin Blocked Numbers

**Source :** `src/app/admin/blocked-numbers/BlockedNumbersPageClient.tsx`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Formulaire blocage : téléphone + motif optionnel | Success | Inputs + submit bouton "Bloquer" |
| 2 | Blocage succès → toast "Numéro bloqué" + reset + refetch | Success | `onSuccess` → toast + setPhoneNumber("") + setReason("") + refetch |
| 3 | Liste numéros bloqués → DataLoader | Success | `api.admin.getBlockedNumbers.useQuery()` |
| 4 | Entrée avec téléphone, raison, bloqueur, date | Success | Infos formatées, date en français |
| 5 | Bouton "Débloquer" (Unlock) | Interaction | Button → `unblockMutation.mutate({id: entry.id})` |
| 6 | Déblocage succès → toast "Numéro débloqué" + refetch | Success | `onSuccess` → toast + refetch |

### Validation
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 7 | Submit désactivé si téléphone vide | Validation | `disabled={!phoneNumber.trim() \|\| blockMutation.isPending}` |
| 8 | Raison optionnelle — envoyée comme undefined si vide | Validation | `reason.trim() \|\| undefined` |

### États de chargement
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 9 | DataLoader loading dans liste | Loading | Skeleton grid |
| 10 | Block mutation pending → bouton disabled | Loading | `blockMutation.isPending` |

### États vides
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 11 | Aucun numéro bloqué → PhoneOff + "Aucun numéro bloqué" | Empty | PhoneOff icône + texte |

### États d'erreur
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 12 | Blocage erreur → toast destructif | Error | `onError` → toast |
| 13 | Déblocage erreur → toast destructif | Error | `onError` → toast |
| 14 | DataLoader erreur → AlertTriangle | Error | DataLoader error state |

---

## 13. FeaturedScenario

**Source :** `src/components/social/FeaturedScenario.tsx`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Scénario featured chargé → carte complète | Success | Card border-primary/20 + bg-primary/5 |
| 2 | Badge "Scénario du jour" avec Star icon + border-primary/30 | Visual | Badge + Star w-3 h-3 + "Scénario du jour" |
| 3 | Avatar personnage circulaire avec ring primary/20 | Visual | Avatar w-16 h-16 + ring-2 ring-primary/20 |
| 4 | Avatar fallback initiale si pas d'image | Visual | AvatarFallback bg-primary/10 avec première lettre |
| 5 | Titre tronqué (truncate) | Visual | `className="truncate"` |
| 6 | Stats : Heart (likeCount) + Play (playCount) | Visual | Icônes avec compteurs |
| 7 | "par {creator.username}" si présent | Visual | Conditionnel |
| 8 | CTA "Démarrer" → /create?scenario={id} | Navigation | Link + Button avec Play icon |

### États de chargement
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 9 | isLoading=true → skeleton avec cercle + barres | Loading | Skeleton w-16 h-16 rounded-full + barres (h-4 w-32, h-6 w-48, h-4) |

### États null
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 10 | featuredQuery.data=null → rend null (caché) | Empty | `if (!scenario) return null` |

---

## 14. BadgeGrid / BadgeDisplay

**Source :** `src/components/social/BadgeGrid.tsx`, `src/components/social/BadgeDisplay.tsx`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | BadgeGrid délègue à BadgeDisplay | Success | `<BadgeDisplay userId={userId} />` |
| 2 | Badges chargés → grille de cartes | Success | Cartes avec icône, nom, description, date |
| 3 | Icône badge : image ou Medal fallback | Visual | `badge.imageUrl ? <img> : <Medal>` |

### États de chargement
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 4 | Loading → 3 skeletons cards | Loading | 3 Skeleton h-4 + h-6 + h-4 |

### États vides
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 5 | Aucun badge → "Aucun badge pour le moment" | Empty | Texte + Medal icon |

### États d'erreur
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 6 | Erreur chargement → "Erreur lors du chargement des badges" | Error | AlertTriangle + message |
| 7 | Bouton "Réessayer" → refetch | Error | Button onClick refetch |

---

## 15. Dashboard Quick Actions

**Source :** `src/app/(dashboard)/dashboard/page.tsx` (composant inline)

quickActions = [Nouvel appel→/create, Bibliothèque→/library, Historique→/history, Communauté→/community]

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | 4 cartes actions rapides visibles | Success | grid md:grid-cols-4 avec 4 cartes Link |
| 2 | Titre "Actions rapides" visible | Success | h2 "Actions rapides" |
| 3 | Chaque carte a icône + titre + description | Visual | Icon + CardTitle + CardDescription |
| 4 | Carte "Nouvel appel" → /create | Navigation | Link href |
| 5 | Carte "Bibliothèque" → /library | Navigation | Link href |
| 6 | Carte "Historique" → /history | Navigation | Link href |
| 7 | Carte "Communauté" → /community | Navigation | Link href |
| 8 | Hover effect sur cartes | Visual | `hover:border-primary/30 hover:-translate-y-0.5` |

---

## 16. CallDisclaimerDialog

**Source :** `src/components/shared/CallDisclaimerDialog.tsx`

Interfaces : `{ open, onOpenChange, onAccept, isPending? }`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Dialog ouvert → titre + description + 4 infos | Success | DialogHeader + Phone icon + 4 li items |
| 2 | 4 points d'information : modération, données sensibles, urgence, modération automatique | Success | `ul > li` × 4 avec textes spécifiques |
| 3 | Checkbox "Je comprends et j'accepte" | Success | Checkbox avec id="disclaimer-accept" |
| 4 | Checkbox coché → bouton "Démarrer l'appel" activé | Interaction | `disabled={!accepted \|\| isPending}` |
| 5 | Accept → localStorage.setItem + onAccept + close | Success | `handleAccept()` → localStorage.setItem + onAccept + onOpenChange(false) |
| 6 | "Annuler" → fermeture | Interaction | Button variant="outline" → onOpenChange(false) |

### États de chargement
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 7 | isPending=true → bouton "Appel en cours..." + Loader2 | Loading | `isPending ? Loader2 + "Appel en cours..."` |

### SSR / Hydratation
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 8 | SSR → rend null (pas de montage) | SSR | `!mounted` → return null |
| 9 | hasAcceptedBefore=true → rend null | State | localStorage.getItem(STORAGE_KEY) === "true" → return null |
| 10 | localStorage unavailable → catch silencieux + continue sans storage | Fallback | `try { localStorage... } catch {}` |

### Edge cases
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 11 | localStorage.setItem échoue → accept continue pour la session | Edge | `try { localStorage.setItem } catch {}` |
| 12 | hasAcceptedBefore set après accept → prochaine ouverture rend null | Edge | `setHasAcceptedBefore(true)` après accept |

---

## 17. PasswordStrengthMeter

**Source :** `src/components/shared/PasswordStrengthMeter.tsx`

Interfaces : `{ password: string }`
CHECKS = [8 chars, 12 chars, majuscule, chiffre, spécial]

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Password présent → 5 barres segmentées | Success | `CHECKS.map` → 5 divs h-1.5 rounded-full flex-1 |
| 2 | Barres colorées selon score (0-5) | Visual | `index < score ? COLORS[...] : 'bg-muted'` |
| 3 | Label force : "Très faible" à "Très fort" | Visual | `LABELS[Math.min(score, 4)]` |
| 4 | Liste des 5 checks individuels ✓/✗ | Visual | `CHECKS.map` → li avec ✓/✗ colorés |

### États
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 5 | Password vide → rend null (caché) | Empty | `if (!password) return null` |
| 6 | 0/5 → tout rouge, label "Très faible" | State | Tous bg-destructive ? non, CHECKS[index] colors |
| 7 | 5/5 → tout vert, label "Très fort" | State | COLORS = [destructive, orange, yellow, lime, green] |
| 8 | Recalcul au changement de password | State | `useMemo(() => getScore(password), [password])` |

### Détails des checks
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 9 | 8 caractères minimum — check.pass ✓ | Validation | `p.length >= 8` |
| 10 | 12 caractères minimum — check.pass ✓ | Validation | `p.length >= 12` |
| 11 | Une lettre majuscule — /[A-Z]/ | Validation | `/[A-Z]/.test(p)` |
| 12 | Un chiffre — /[0-9]/ | Validation | `/[0-9]/.test(p)` |
| 13 | Un caractère spécial — /[^A-Za-z0-9]/ | Validation | `/[^A-Za-z0-9]/.test(p)` |

---

## 18. Toast System

**Source :** `src/components/ui/toast.tsx`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Toast apparaît en bas à droite | Visual | Positionné bottom-right |
| 2 | Auto-dismiss après 4s (default) | State | Disparaît automatiquement |
| 3 | Close button → dismiss immédiat | Interaction | Bouton X → dismiss |
| 4 | Multiples toasts empilés verticalement | Visual | Stack vertical |

### Variantes
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 5 | Variante destructive → style différent | Visual | `variant: "destructive"` |
| 6 | Variante success → style différent | Visual | `variant: "success"` |
| 7 | Variante default → style normal | Visual | `variant: "default"` |
| 8 | Pas de toast pour les erreurs silencieuses | Edge | Background errors sans toast |

---

## 19. ConfirmDialog

**Source :** `src/components/shared/ConfirmDialog.tsx`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Dialog ouvert → titre + description | Success | Dialog avec title et description |
| 2 | Cancel button → fermeture | Interaction | `onOpenChange(false)` |
| 3 | Confirm button → onConfirm | Interaction | `onConfirm()` |
| 4 | Variante destructive → bouton rouge | Visual | `variant="destructive"` |

### États
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 5 | Loading → spinner + boutons disabled | Loading | `loading` prop → Loader2 |
| 6 | confirmDisabled → confirm button disabled | State | `confirmDisabled` prop |
| 7 | Escape → fermeture | A11y | `onOpenChange(false)` sur Escape |

---

## 20. DashboardShell

**Source :** `src/components/shared/DashboardShell.tsx`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Nav links avec active state | Navigation | Lien actif avec style distinct |
| 2 | CreditDisplay visible dans nav | UI | Badge crédits |
| 3 | ThemeToggle visible dans nav | UI | ThemeToggle icon |
| 4 | Settings link (gear icon) | Navigation | Lien vers /settings |

### Responsive
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 5 | Mobile : text caché, icons seulement | Responsive | `hidden md:inline` ou similaire |
| 6 | Horizontal scroll sur petit écran | Responsive | `overflow-x-auto` |
| 7 | Sticky nav on scroll | Visual | `sticky top-0` |
| 8 | Backdrop blur effect | Visual | `backdrop-blur` |

---

## 21. CreditDisplay

**Source :** `src/components/shared/CreditDisplay.tsx`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Credits chargés → Badge avec nombre | Success | Badge avec {credits} |
| 2 | Tooltip au hover | Interaction | Tooltip "1 crédit par appel" |

### États de chargement
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 3 | credits undefined → skeleton | Loading | Skeleton placeholder |

### Edge cases
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 4 | 0 crédit → Badge "0" | Edge | `credits` = 0 |
| 5 | Tooltip texte correct | Visual | "1 crédit par appel" |
| 6 | Desktop seulement (tooltip pas sur mobile) | Edge | Tooltip au hover |

---

## 22. EmptyState

**Source :** `src/components/shared/EmptyState.tsx`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Icône + titre + description rendus | Success | `icon`, `title`, `description` props |
| 2 | Action slot optionnel | Edge | `action && <div>{action}</div>` |
| 3 | Centered layout | Visual | `text-center` |
| 4 | Texte en muted-foreground | Visual | `text-muted-foreground` |

---

## 23. CallHistoryRow

**Source :** `src/components/shared/CallHistoryRow.tsx`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Statut affiché avec badge coloré | Success | Badge with status label |
| 2 | Durée formatée | Visual | `formatDuration(durationSeconds)` |
| 3 | Date formatée en français | Visual | `formatDate(createdAt)` |
| 4 | Lien replay pour COMPLETED → /call/{id} | Navigation | Link si COMPLETED |

### États
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 5 | Status FAILED → badge destructif | Visual | Badge variant destructive |
| 6 | Scenario absent → titre fallback "Appel" | Edge | `call.scenario?.title ?? "Appel"` |

---

## 24. ReplayHeader

**Source :** `src/components/player/ReplayHeader.tsx`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Métadonnées : titre scénario, perso, durée, statut | Success | Grid ou flex avec infos |
| 2 | Statut display avec badge | Visual | Badge status |
| 3 | Durée formatée | Visual | `formatDuration()` |
| 4 | Personnage display | Visual | Character name |

---

## 25. CommentModerationTab

**Source :** `src/components/admin/CommentModerationTab.tsx`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Filtre statut (PENDING / REJECTED) | Interaction | Tab buttons |
| 2 | Liste commentaires chargée | Success | DataLoader |
| 3 | Approve comment → toast + refetch | Success | Mutation |
| 4 | Reject comment → toast + refetch | Success | Mutation |

### États
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 5 | Loading → spinner/skeleton | Loading | DataLoader loading |
| 6 | Empty → message vide | Empty | DataLoader empty |
| 7 | Error → AlertTriangle | Error | DataLoader error |
| 8 | Mutation pending → disabled | Loading | `disabled={mutation.isPending}` |

---

## 26. Admin Users

**Source :** `src/app/admin/users/UsersPageClient.tsx`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Liste utilisateurs avec recherche debounced (300ms) | Success | Input recherche + DataLoader |
| 2 | Click user → détail avec bouton retour | Navigation | Détail card |
| 3 | Info card : ID, crédits, appels, likes, consentement, date | Success | Infos utilisateur formatées |
| 4 | Stats card : scénarios, commentaires, réactions | Success | Statistiques |
| 5 | Deleted user → strikethrough | Visual | Text decoration |
| 6 | Role badges (Admin=default, User=secondary, Moderator=outline) | Visual | Badge variant selon rôle |

### États
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 7 | Loading → skeleton | Loading | DataLoader |
| 8 | Empty → "Aucun utilisateur" | Empty | DataLoader empty |
| 9 | Search empty → "Aucun résultat" | Empty | Recherche sans résultat |
| 10 | Delete user → mutation + refetch | Success | `admin.deleteUser` |

---

## 27. Admin Reports

**Source :** `src/app/admin/reports/ReportsPageClient.tsx`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Filtre tabs (Tous, En attente, Traité, Ignoré) | Success | 4 tab buttons |
| 2 | Report card avec type, statut, reporter, raison | Success | Card avec infos |
| 3 | Dismiss → mutation + refetch | Success | `admin.dismissReport` |

### États
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 4 | Loading → skeleton | Loading | DataLoader |
| 5 | Empty per filter → message | Empty | DataLoader empty par filtre |
| 6 | Dismiss disabled pendant mutation | Loading | isPending |
| 7 | Reviewed-by indicator | Visual | Qui a traité |
| 8 | Reason truncated à 100 chars | Edge | `reason.length > 100 ? ...` |

---

## 28. Admin Audit

**Source :** `src/app/admin/audit/AuditPageClient.tsx`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Action filter dropdown (8 actions) | Success | Dropdown avec options |
| 2 | Entity type filter dropdown (5 types) | Success | Dropdown avec options |
| 3 | Date range filter (from/to) | Success | Input date |
| 4 | Audit table (Date, Admin, Action, Type, ID) | Success | 5 colonnes |
| 5 | Pagination curseur "Charger plus" | Pagination | Button load more |

### États
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 6 | Reset filters button | Interaction | Bouton reset |
| 7 | Load more disabled pendant fetch | Loading | isFetchingMore |
| 8 | Empty state pour filtres | Empty | Aucun résultat |

---

## 29. Admin Analytics

**Source :** `src/app/admin/analytics/page.tsx`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | Stats placeholder grid (4 cards) | Success | 4 cards métriques |
| 2 | Roadmap card | UI | Feature list |
| 3 | Links to users, moderation, reports | Navigation | Liens internes |
| 4 | Loading state | Loading | Skeleton |

---

## 30. AdminSidebar

**Source :** `src/components/admin/AdminSidebar.tsx`

### Succès
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 1 | 6 nav links (Modération, Signalements, Journal, Numéros, Utilisateurs, Analytiques) | Success | Liens de navigation |
| 2 | Active state sur lien courant | Navigation | Classe active |

### Responsive
| # | Scénario | Type | Assertions |
|---|----------|------|------------|
| 3 | Collapse sur mobile | Responsive | Menu hamburger ou caché |
| 4 | Expand sur desktop | Responsive | Sidebar visible |

---

## Résumé des priorités

| Priorité | Nb scénarios | Actions |
|----------|:------------:|---------|
| 🔴 Haute | ~120 | AudioPlayer, TranscriptView, ScenarioCard, DataLoader, Toast, ConfirmDialog |
| 🟡 Moyenne | ~90 | ClipCreator, ShareButtons, ReactionBar, EmojiPicker, ReportButton, CallDisclaimerDialog, Admin CRUD |
| 🟢 Basse | ~70 | PasswordStrengthMeter, FeaturedScenario, BadgeGrid, DashboardShell, CreditDisplay, EmptyState, etc. |

---

*Document généré le 24 juin 2026 — 30 sections, ~280 scénarios détaillés*
