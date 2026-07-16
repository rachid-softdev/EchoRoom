# Catalogue de Scénarios — Scénarios, Personnages & Modération (Supplément TE-2)

> Source : `scenarios.ts`, `characters.ts`, `admin.ts`, `social.ts`, `moderation*`,
> `generateScript.ts`, `scenarioService.ts`, `prisma/schema.prisma`, `middleware.ts`, `config/privacy.ts`.
> Complète `TEST_SCENARIOS.md` §9–10, `SCENARIOS_MANQUANTS.md`, `SCENARIOS_OBSCURS.md`, `ROUND2_AGENT1_TRPC.md`.

## Bloc A — Scénarios : création, lecture, modération (détail par UX et cas limite)

### A1. Création de scénario (`scenarios.create`)
- **sc.create.title-boundary** — Perte : titre vide/300+ chars → refus 400. (Success : 1–299 chars ok.)
- **sc.create.duplicate-slug** — Limite : 2 scénarios même titre → slug dupes → collision URL/DB. **P1**
- **sc.create.illegal-xss** — Sécu : titre/description/placeholder contenant `<script>` → stocké et re-rendu. **P0**
- **sc.create.tier-gate-free** — Limite : aucune garde de tier → FREE peut créer. **P1**
- **sc.create.preview-mismatch** — Divergence : `preview` ≠ payload soumis → modérateur valide X, publie Y. **P1**
- **sc.create.draft-then-publish** — Succès : draft → `scenarios.update` status PUBLISHED.
- **sc.create.race-double-submit** — Limite : double clic → 2 lignes ; pas d'idempotence prix. **P2**
- **sc.create.anonymous-blocked** — Succès : non-auth → dévié login.
- **sc.create.rate-limit-burst** — Limite : burst > limite → 429 + Retry-After.

### A2. Lecture / recherche / filtres
- **sc.list.all-filters-combo** — Succès : category+premium+search+sort combinés.
- **sc.list.search-empty-and-special** — Succès : recherche « zzqx » → vide ; caractères spéciaux → pas de 500.
- **sc.list.pagination-mid-deletion** — Limite : suppression pendant pagination → saut/duplicata.
- **sc.list.cache-invalidation** — Perte : création/approbation ne purge pas le cache → contenu fantôme. **P1**
- **sc.list.premium-mislabeled** — Limite : `premium` calculé côté client ; rabat non fiable. **P2**

### A3. Modération admin (`admin.approveScenario` / `rejectScenario`)
- **mod.approve.success** — Succès : PENDING → APPROVED+PUBLISHED, slug unique.
- **mod.approve.cache-no-invalidate** — Perte : approbation ne purge pas le cache → invisible. **P1**
- **mod.reject.reason-required** — Perte : rejet sans raison → 400.
- **mod.approve.race-async-reject** — Limite : approbation puis rejet async → état incohérent (review EDGE 5). **P0**
- **mod.approve.non-admin** — Sécu : USER tente `approveScenario` → 403.
- **mod.list.pending-empty** — Succès : file vide → `[]`.
- **mod.bulk.none-selected** — Limite : bulk sans sélection → no-op 400.
- **mod.audit.logged** — Succès : chaque action écrit `ModerationLog`.

## Bloc B — Génération de script IA (`generateScript`)
- **gen.idempotent-same-prompt** — Succès : même prompt → ids différents (pas d'idempotence). **P2**
- **gen.fail-open** — Sécu/Limite : échec IA/DB → scenario créé à vide (fail-open). **P1**
- **gen.rate-limit-exhaust** — Limite : > quota → 429.
- **gen.timeout-long** — Limite : timeout IA → 504 propre.
- **gen.cost-cap** — Limite : pas de plafond coût → abuse financier. **P1**
- **gen.deterministic-seed** — Edge : seed non contrôlée → contenu variable.
- **gen.prompt-injection** — Sécu : prompt utilisateur essayant de « jailbreak » le générateur. **P1**

## Bloc C — Personnages (`characters.ts` / `characters.list`)
- **char.list.free-cap-8** — Limite : aucun cap des 8 pour FREE. **P1** (contredit PRODUCT.md)
- **char.list.pagination-cursor** — Succès : pagination curseur sans saut.
- **char.get.missing-id** — Perte : id inconnu → 404.
- **char.get.unpublished-access** — Limite : personnage DRAFT accessible par URL directe ? **P1**
- **char.search.near-match** — Succès : recherche partielle.
- **char.create.tier-gate** — Limite : FREE peut créer des personnages (à confirmer).
- **char.avatar-upload-size** — Limite : avatar > limite → 413.

## Bloc D — Cross-cutting modération
- **report.scenario.success** — Succès : signalement crée `AbuseReport`+log.
- **report.duplicate** — Limite : signalements multiples → dédoublonnage.
- **mod.appeal.flow** — Gap : pas de flux d'appel pour créateur banni. **P2**
- **content.hate-speech-auto** — Gap : pas de filtre pré-publication. **P1**
- **privacy.visibility-toggle** — Succès : PRIVATE cache aux non-auteurs.

## Bloc E — Édition / suppression / versioning (gaps importants)
- **sc.update.reslug-on-title** — Gap : changer le titre ne régénère pas le slug → désync. **P1**
- **sc.delete.soft-vs-hard** — Gap : comportement suppression ambigu (scenarios orphelins). **P2**
- **sc.version.history** — Gap : pas d'historique des versions d'un scénario. **P3**
- **sc.fork.duplicate** — Gap : « fork » d'un scénario public non testé. **P3**

## Résumé des lacunes critiques (P0/P1)
- **P0** : XSS scenario, race approbation/rejet async.
- **P1** : slug duplicata, tier-gate FREE sur create, cache non invalidé, generateScript fail-open,
  pas de cost-cap, char.list cap FREE=8 absent, personnage DRAFT exposé, pas de filtre haine pré-pub.

## Recommandations
1. Garde de tier sur `scenarios.create` (FREE refusé).
2. Génération de slug unique + index unique en DB.
3. Invalider le cache sur approbation/rejet/création.
4. `generateScript` fail-closed (pas de scenario vide).
5. Cap FREE (8 personnages) + garde expose DRAFT uniquement à l'auteur.
6. Plafond coût + rate-limit sur la génération IA.
