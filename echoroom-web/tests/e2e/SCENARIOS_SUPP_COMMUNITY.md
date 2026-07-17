# Catalogue de Scénarios — Community, Social, Admin (Supplément TE-4)

> Source : `community.ts`, `social.ts`, `admin.ts`, `notifications.ts`, `user.ts`,
> `prisma/schema.prisma`, `lib/cache.ts`. Complète `ROUND2_AGENT2_COMMUNITY.md`, `ROUND2_AGENT1_TRPC.md`.

## 1. Community (`community.ts`)
- **com.post.create.success** — Succès : post créé, notif aux followers, cache communauté invalidé.
- **com.post.empty-content** — Perte : contenu vide/whitespace → 400.
- **com.post.xss** — Sécu : `<script>` dans post stocké/re-rendu. **P0**
- **com.post.rate-limit** — Limite : burst → 429 + Retry-After.
- **com.post.edit.others** — Sécu : USER édite post d'un autre → 403.
- **com.post.delete.orphan-thread** — Limite : suppression post parent → thread orphelin.
- **com.reply.nested-depth** — Limite : profondeur de réponse illimitée → arbre explosif. **P2**
- **com.feed.pagination-mid-post** — Limite : nouveau post pendant pagination → doublon/saut. **P2**
- **com.feed.cache-stale** — Limite : cache non invalidé après post → invisible. **P1**
- **com.report.post.success / com.report.duplicate** — Succès / Limite.
- **com.mute.user** — Gap : pas de mute/block utilisateur documenté. **P2**

## 2. Social (`social.ts`)
- **soc.follow.success / soc.follow.self** — Succès / Perte (auto-follow refusé).
- **soc.follow.back-and-forth** — Limite : follow/unfollow rapide → état count.
- **soc.follow.rate-limit** — Limite : follow-spam → 429. **P1**
- **soc.like.scenario / soc.like.comment** — Succès : like → notif + badge `LIKE_RECEIVED`.
- **soc.like.toggle** — Limite : double like = unlike.
- **soc.share.track / soc.share.invalid-type** — Succès / Perte (type inconnu 400).
- **soc.badge.only-like-wired** — Gap P0 : `checkAndAwardBadges` appelé UNIQUEMENT sur `LIKE_RECEIVED` ;
  badges scénario/call jamais déclenchés. **P0**
- **soc.badge.duplicate-award** — Limite : multiple awards idempotents.
- **soc.notif.unread-count / soc.notif.mark-read / soc.notif.purge** — Succès/Edge.
- **soc.notif.no-leak** — Sécu : un user ne voit pas les notifs d'un autre.

## 3. Admin (`admin.ts`)
- **adm.stats.view-success / adm.stats.non-admin** — Succès / Sécu (403).
- **adm.user.ban.success / adm.user.ban.self / adm.user.ban-already** — Succès / Perte / Limite.
- **adm.user.ban.cascade-active-call** — Limite : ban pendant appel actif → à définir. **P1**
- **adm.user.unban.success** — Succès.
- **adm.approve.success / adm.approve.race-reject** — Succès / Limite (see TE-2 A3). **P0**
- **adm.reject.reason-required** — Perte.
- **adm.feature-toggle.missing** — Gap : pas de procédure admin pour les feature flags. **P1**
- **adm.role-change.missing** — Gap : pas de procédure changer role USER↔ADMIN. **P1**
- **adm.content.remove.success / adm.content.remove-restore** — Succès / Gap (restore absent). **P2**
- **adm.audit.log-present** — Succès : actions tracées.

## 4. Badges & Gamification (lacune transverse)
- **badge.award-call-scenario-unwired** — Gap P0 : badges pour calls/scénarios jamais décernés.
- **badge.definitions-vs-usage** — Gap : `BADGE_DEFINITIONS` vs seuls `LIKE_RECEIVED`/`CREATE_*` partiellement.
- **badge.display-in-profile** — Edge : `profile.get` expose-t-il les badges ? à vérifier.

## 5. Notifications (`notifications.ts`)
- **notif.push-vs-inapp** — Gap : pas de push externe testé (in-app seulement).
- **notif.preferences** — Gap : pas de préférences de notif par user. **P2**
- **notif.cleanup-old** — Limite : pas de purge des notifs lues anciennes. **P3**

## Résumé lacunes critiques
- **P0** : XSS community, badges call/scénario jamais wired.
- **P1** : cache communauté stale, follow-spam, ban pendant appel, pas de toggle flag admin, pas de role-change.

## Recommandations
1. Wire `checkAndAwardBadges` pour les événements call/scenario.
2. Invalider le cache communauté sur post/report.
3. Ajouter procédures admin : feature-flag override, role-change, content restore.
4. Sanitize le contenu communautaire (XSS).
5. Rate-limit follow + purge notifs anciennes.
