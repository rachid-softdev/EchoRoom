# EchoRoom API Documentation

## 1. Overview

| Attribute          | Value                                                                      |
|--------------------|----------------------------------------------------------------------------|
| **Protocol**       | tRPC v11 (HTTP/JSON, transported over POST)                                |
| **Base URL**       | `https://echoroom.app/api/trpc` (production)                               |
| **Content-Type**   | `application/json`                                                         |
| **Transformer**    | [SuperJSON](https://github.com/blitz-js/superjson) (Date, Map, Set support) |
| **SDK**            | `@echoroom/web-api` or raw `@trpc/client`                                  |

### Authentication

EchoRoom uses **NextAuth.js v5** with session-based authentication. The session token is transmitted via HTTP-only cookies (`__Secure-authjs.session-token` in production, `authjs.session-token` in development). There is **no bearer token or API key** for external clients — all tRPC procedures require browser-based session cookies.

- **Public procedures** do not require authentication but receive `ctx.session` as `null` for unauthenticated users.
- **Protected procedures** require a valid session. They return `UNAUTHORIZED` (401) if no session exists.
- **Admin procedures** require a session with `role === "ADMIN"`. They return `FORBIDDEN` (403) for non-admin users.

### Content Moderation

Procedures marked with `withContentModeration` run a synchronous blocklist check on text input fields (`title`, `description`, `openingMessage`, `aiInstructions`, `content`, `reason`, `name`, `text`). If any of these fields match the blocklist, the procedure returns `BAD_REQUEST` with the moderation reason. Asynchronous AI moderation is scheduled as a fire-and-forget side effect.

---

## 2. tRPC Procedure Naming Convention

All procedures are called using the `routerName.procedureName` pattern via the tRPC client.

```
api.<router>.<procedure>.useQuery(...)    // queries (GET semantics)
api.<router>.<procedure>.useMutation(...)  // mutations (POST semantics)
```

### Routers

| Router       | Namespace       | Auth Required      | Description                                  |
|--------------|-----------------|--------------------|----------------------------------------------|
| `auth`       | `api.auth.*`    | mixed              | Registration, password change                |
| `profile`    | `api.profile.*` | authenticated      | User profile, GDPR data, account deletion    |
| `user`       | `api.user.*`    | authenticated      | Consent management, deletion status          |
| `characters` | `api.characters.*` | public          | Browse and fetch AI characters               |
| `scenarios`  | `api.scenarios.*` | mixed            | Create, read, update, delete scenarios       |
| `calls`      | `api.calls.*`   | authenticated      | Initiate calls, history, replay              |
| `billing`    | `api.billing.*` | authenticated      | Credits, Stripe checkout                     |
| `community`  | `api.community.*` | mixed            | Comments, abuse reporting                    |
| `social`     | `api.social.*`  | mixed              | Reactions, clips, leaderboards, badges, shares |
| `clips`      | `api.clips.*`   | authenticated      | List, create, delete call clips              |
| `dashboard`  | `api.dashboard.*` | authenticated    | Aggregated dashboard data                    |
| `admin`      | `api.admin.*`   | admin              | Moderation, user management, audit logs      |
| `v1`         | `api.v1.*`      | mixed              | Frozen v1 API namespace (see §5)             |

---

## 3. Rate Limits

Rate limiting uses a **sliding window** algorithm via Redis sorted sets, with an in-memory fallback when Redis is unavailable.

- **Authenticated rate limits**: Keyed by `{procedurePath}:{userId}`. Applied per user.
- **IP-based rate limits**: Keyed by `iplimit:{procedurePath}:{ip}`. Applied per IP address. The IP is resolved from `x-forwarded-for`, `x-real-ip`, or falls back to `"unknown"`.
- **Webhook rate limits**: Keyed by endpoint name (see §7.3).

When the limit is exceeded, the procedure returns `TOO_MANY_REQUESTS` (429).

### Per-Procedure Rate Limits

| Procedure                    | Type      | Limit        | Window    | Strategy      |
|------------------------------|-----------|-------------:|-----------|---------------|
| `auth.register`              | mutation  | 3            | 3600s     | authenticated |
| `auth.changePassword`        | mutation  | 3            | 3600s     | authenticated |
| `profile.me`                 | query     | 120          | 60s       | authenticated |
| `profile.updateProfile`      | mutation  | 10           | 3600s     | authenticated |
| `profile.exportData`         | mutation  | 2            | 3600s     | authenticated |
| `profile.deleteMyAccount`    | mutation  | 1            | 3600s     | authenticated |
| `user.withdrawConsent`       | mutation  | 2            | 3600s     | authenticated |
| `scenarios.create`           | mutation  | 10           | 3600s     | authenticated |
| `scenarios.generateScript`   | mutation  | 20           | 3600s     | authenticated |
| `scenarios.feed`             | query     | 60           | 60s       | IP           |
| `scenarios.getById`          | query     | 120          | 60s       | IP           |
| `scenarios.update`           | mutation  | 30           | 3600s     | authenticated |
| `scenarios.delete`           | mutation  | 10           | 3600s     | authenticated |
| `scenarios.myScenarios`      | query     | 60           | 60s       | IP           |
| `calls.start`                | mutation  | 20           | 3600s     | authenticated |
| `community.comment`          | mutation  | 30           | 3600s     | authenticated |
| `community.getComments`      | query     | 60           | 60s       | IP           |
| `community.reportAbuse`      | mutation  | 10           | 3600s     | authenticated |
| `social.toggleLike`          | mutation  | 60           | 3600s     | authenticated |
| `social.getReactions`        | query     | 60           | 60s       | IP           |
| `social.createClip`          | mutation  | 20           | 3600s     | authenticated |
| `social.getClips`            | query     | 60           | 60s       | IP           |
| `social.getLeaderboardScenarios` | query | 30          | 60s       | IP           |
| `social.getLeaderboardCreators`  | query | 30          | 60s       | IP           |
| `social.getBadges`           | query     | 60           | 60s       | IP           |
| `social.getUserBadges`       | query     | 60           | 60s       | IP           |
| `social.getFeatured`         | query     | 60           | 60s       | IP           |
| `social.trackShare`          | mutation  | 60 + 30      | 3600s + 60s | authenticated + IP |
| `clips.listByCall`           | query     | 60           | 60s       | IP           |
| `clips.listByUser`           | query     | 60           | 60s       | IP           |
| `clips.create`               | mutation  | 20           | 3600s     | authenticated |
| `clips.delete`               | mutation  | 10           | 3600s     | authenticated |

---

## 4. Error Codes

All tRPC errors follow the [standard tRPC error format](https://trpc.io/docs/error-formatting) with a custom `zodError` field for input validation failures.

```json
{
  "error": {
    "message": "Description in French",
    "code": "BAD_REQUEST",
    "data": {
      "code": "BAD_REQUEST",
      "httpStatus": 400,
      "path": "scenarios.create",
      "zodError": null
    }
  }
}
```

| tRPC Code              | HTTP Status | Description                                                    |
|------------------------|-------------|----------------------------------------------------------------|
| `UNAUTHORIZED`         | 401         | No valid session or user not found                             |
| `FORBIDDEN`            | 403         | Insufficient role (non-admin) or not the resource owner        |
| `NOT_FOUND`            | 404         | Resource does not exist                                        |
| `CONFLICT`             | 409         | Duplicate resource (email, username, report, blocked number)   |
| `BAD_REQUEST`          | 400         | Validation error, disposable email, blocklist match            |
| `PRECONDITION_FAILED`  | 412         | Insufficient credits, active call blocking consent withdrawal  |
| `TOO_MANY_REQUESTS`    | 429         | Rate limit exceeded or spam detection flagged                  |
| `INTERNAL_SERVER_ERROR`| 500         | Unexpected server error (Twilio failure, etc.)                 |

---

## 5. Versioning

### v1 Namespace

The `api.v1.*` namespace provides a **frozen, backward-compatible API contract**. Clients can migrate to versioned endpoints by prefixing their tRPC calls with `v1.`:

```typescript
// Versioned (will never break)
const feed = await api.v1.scenarios.feed.useQuery(...);

// Unversioned (receives latest stable shape)
const feed = await api.scenarios.feed.useQuery(...);
```

**Current v1 routers:**
- `api.v1.scenarios.*` — frozen snapshot of the scenarios router at versioning freeze time. Includes `create`, `feed`, and `getById`.

**V1 freeze guarantee:** The v1 shapes will never receive breaking changes. New versions (v2+) can be added alongside without disrupting existing clients.

### Version Negotiation

The `withVersioning` middleware reads the `X-API-Version` header (highest priority) and falls back to path-based version detection, setting `ctx.apiVersion` for procedure-level branching.

---

## 6. Routers and Procedures

### 6.1 `auth` — Authentication

#### `auth.register`
- **Auth:** Public
- **Rate limit:** 3 per 3600s
- **Description:** Register a new user. Disposable email domains are blocked with recursive subdomain matching. Requires consent acceptance.
- **Input:**
  ```typescript
  {
    email: string().email(),
    username: string().min(3).max(20),
    password: string().min(8).max(128)
      .regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
    consentAccepted: boolean(),
  }
  ```
- **Output:** `{ userId: string }`
- **Errors:**
  - `BAD_REQUEST` — disposable email, weak password, missing consent
  - `CONFLICT` — email or username already taken

#### `auth.changePassword`
- **Auth:** Authenticated
- **Rate limit:** 3 per 3600s
- **Description:** Change the current user's password. Increments `tokenVersion` to invalidate existing sessions.
- **Input:**
  ```typescript
  {
    currentPassword: string(),
    newPassword: string().min(8).max(128)
      .regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
  }
  ```
- **Output:** `{ success: true }`
- **Errors:**
  - `NOT_FOUND` — user not found
  - `BAD_REQUEST` — incorrect current password

---

### 6.2 `profile` — User Profile

#### `profile.me`
- **Auth:** Authenticated
- **Rate limit:** 120 per 60s
- **Description:** Get the current user's profile (email, username, role, image, credits via `UserBilling` aggregate with legacy fallback).
- **Input:** None
- **Output:**
  ```typescript
  {
    id: string,
    email: string,
    username: string,
    role: "USER" | "ADMIN" | "MODERATOR",
    image: string | null,
    credits: number,
  }
  ```
- **Errors:**
  - `NOT_FOUND` — user not found

#### `profile.updateProfile`
- **Auth:** Authenticated
- **Rate limit:** 10 per 3600s
- **Description:** Update username (synced to both `User` and `UserProfile` in a transaction).
- **Input:**
  ```typescript
  { username: string().min(3).max(30) }
  ```
- **Output:** `{ success: true }`

#### `profile.exportData`
- **Auth:** Authenticated
- **Rate limit:** 2 per 3600s
- **Description:** Export all user data (GDPR Article 20). Phone numbers are decrypted and masked (last 4 digits only). Sets `gdprDataExportedAt` timestamp.
- **Input:** None
- **Output:**
  ```typescript
  {
    exportedAt: string (ISO),
    user: { ... },
    scenarios: Array<{ ... }>,
    calls: Array<{ ... phoneNumber: string (masked) ... }>,
    comments: Array<{ ... }>,
    purchases: Array<{ ... }>,
  }
  ```
- **Errors:**
  - `NOT_FOUND` — user not found

#### `profile.deleteMyAccount`
- **Auth:** Authenticated
- **Rate limit:** 1 per 3600s
- **Description:** Permanently delete the current user's account (GDPR Article 17). Anonymizes personal data, clears session via `tokenVersion` increment. Requires confirmation string `"SUPPRIMER"`.
- **Input:**
  ```typescript
  { confirmation: z.literal("SUPPRIMER") }
  ```
- **Output:** `{ success: true }`

---

### 6.3 `user` — Consent Management

#### `user.myDeletionStatus`
- **Auth:** Authenticated
- **Rate limit:** None
- **Description:** Get the current user's GDPR deletion status.
- **Input:** None
- **Output:**
  ```typescript
  {
    deletedAt: Date | null,
    anonymizedAt: Date | null,
    gdprDataExportedAt: Date | null,
  }
  ```
- **Errors:**
  - `NOT_FOUND` — user not found

#### `user.withdrawConsent`
- **Auth:** Authenticated
- **Rate limit:** 2 per 3600s
- **Description:** Withdraw consent (GDPR Article 7). Anonymizes personal data inside a transaction with active-call guard and already-withdrawn guard. Increments `tokenVersion`.
- **Input:**
  ```typescript
  { confirmation: z.literal("RETIRER") }
  ```
- **Output:** `{ success: true }`
- **Errors:**
  - `PRECONDITION_FAILED` — active call in progress, or consent already withdrawn

#### `user.reconsent`
- **Auth:** Authenticated
- **Rate limit:** None
- **Description:** Restore consent after withdrawal.
- **Input:**
  ```typescript
  { consentAccepted: z.literal(true) }
  ```
- **Output:** `{ success: true }`
- **Errors:**
  - `PRECONDITION_FAILED` — consent was not previously withdrawn

#### `user.getConsentStatus`
- **Auth:** Authenticated
- **Rate limit:** None
- **Description:** Check whether the user has withdrawn consent.
- **Input:** None
- **Output:**
  ```typescript
  {
    consentWithdrawnAt: Date | null,
    consentAcceptedAt: Date | null,
    isConsentWithdrawn: boolean,
  }
  ```
- **Errors:**
  - `NOT_FOUND` — user not found

---

### 6.4 `characters` — AI Characters

#### `characters.list`
- **Auth:** Public
- **Rate limit:** None
- **Description:** List all AI characters, optionally filtered by category. Results are cached in Redis. Featured characters are sorted first.
- **Input:**
  ```typescript
  {
    category?: "ROMANTIC" | "CHAOTIC" | "CORPORATE" | "NPC" | "HORROR" | "CRINGE" | "GAMER" | "WEIRD",
  }
  ```
- **Output:**
  ```typescript
  Array<{
    id: string,
    name: string,
    slug: string,
    description: string,
    previewAudioUrl: string | null,
    avatarUrl: string | null,
    category: string,
    isFeatured: boolean,
  }>
  ```

#### `characters.getBySlug`
- **Auth:** Public
- **Rate limit:** None
- **Description:** Get a single character by its URL slug.
- **Input:**
  ```typescript
  { slug: string() }
  ```
- **Output:** Same shape as `characters.list` items, or `null` if not found.

---

### 6.5 `scenarios` — Scenarios

#### `scenarios.create`
- **Auth:** Authenticated
- **Rate limit:** 10 per 3600s
- **Content moderation:** Yes (blocklist check)
- **Description:** Create a new scenario. Runs spam detection before creation. Schedules async AI moderation. Invalidates the feed cache.
- **Input:**
  ```typescript
  {
    characterId: string(),
    title: string().min(3).max(80),
    description: string().max(300),
    openingMessage: string().max(300),
    aiInstructions: string().max(3000),
    visibility: "PRIVATE" | "UNLISTED" | "PUBLIC",
  }
  ```
- **Output:** `{ scenarioId: string }`
- **Errors:**
  - `TOO_MANY_REQUESTS` — spam detection flagged
  - `BAD_REQUEST` — content moderation rejected

#### `scenarios.generateScript`
- **Auth:** Authenticated
- **Rate limit:** 20 per 3600s
- **Description:** Generate an AI-written script for a scenario based on character data and user inputs.
- **Input:**
  ```typescript
  {
    characterId: string(),
    title: string().min(1).max(200),
    description: string().min(1).max(500),
    openingMessage: string().min(1).max(500),
  }
  ```
- **Output:** Result from `generateScenarioScript` service
- **Errors:**
  - `NOT_FOUND` — character not found

#### `scenarios.feed`
- **Auth:** Public
- **Rate limit:** 60 per 60s (IP-based)
- **Description:** Cursor-based paginated feed of public, approved scenarios. Supports `CHRONOLOGICAL`, `TRENDING`, and `TOP` sorting. First page is cached in Redis. TRENDING sort caps fetch at 50 items and computes an in-memory score.
- **Input:**
  ```typescript
  {
    cursor?: string(),
    limit: number().min(1).max(20).default(10),
    sort: "CHRONOLOGICAL" | "TRENDING" | "TOP".default("CHRONOLOGICAL"),
  }
  ```
- **Output:**
  ```typescript
  {
    items: Array<ScenarioFeedItem>,
    nextCursor: string | undefined,
  }
  ```

#### `scenarios.getById`
- **Auth:** Public (with permission-based filtering)
- **Rate limit:** 120 per 60s (IP-based)
- **Description:** Get a scenario by ID. Permission filtering is done in the query WHERE clause (not post-filter) to prevent timing-based enumeration:
  - PUBLIC + APPROVED → anyone
  - Creator → always visible
  - ADMIN/MODERATOR → all scenarios
- **Input:**
  ```typescript
  { id: string() }
  ```
- **Output:** Full scenario with creator, character, reactions, and counts, or `null` if not found/unauthorized.

#### `scenarios.update`
- **Auth:** Authenticated (creator only)
- **Rate limit:** 30 per 3600s
- **Content moderation:** Yes (on content fields)
- **Description:** Update a scenario. Only the creator can update. Requires at least one field. If content changes, sets `moderationStatus` to `PENDING` and schedules async re-moderation.
- **Input:**
  ```typescript
  {
    id: string(),
    title?: string().min(3).max(80),
    description?: string().max(300),
    openingMessage?: string().max(300),
    aiInstructions?: string().max(3000),
    visibility?: "PRIVATE" | "UNLISTED" | "PUBLIC",
  }
  // Must provide at least one optional field
  ```
- **Output:** `{ scenarioId: string }`
- **Errors:**
  - `NOT_FOUND` — scenario not found
  - `FORBIDDEN` — not the creator
  - `BAD_REQUEST` — content moderation rejected

#### `scenarios.delete`
- **Auth:** Authenticated (creator only)
- **Rate limit:** 10 per 3600s
- **Description:** Delete a scenario. Only the creator can delete. Invalidates feed cache.
- **Input:**
  ```typescript
  { id: string() }
  ```
- **Output:** `{ success: true }`
- **Errors:**
  - `NOT_FOUND` — scenario not found
  - `FORBIDDEN` — not the creator

#### `scenarios.myScenarios`
- **Auth:** Authenticated
- **Rate limit:** 60 per 60s (IP-based)
- **Description:** Cursor-based paginated list of the current user's scenarios (all visibility/moderation statuses).
- **Input:**
  ```typescript
  {
    cursor?: string(),
    limit: number().min(1).max(20).default(10),
  }
  ```
- **Output:**
  ```typescript
  {
    items: Array<Scenario>,
    nextCursor: string | undefined,
  }
  ```

---

### 6.6 `calls` — Voice Calls

#### `calls.start`
- **Auth:** Authenticated
- **Rate limit:** 20 per 3600s
- **Description:** Initiate a phone call using Twilio. Validates the phone number (E.164 format), checks blocked numbers and spam detection. Increments scenario play count. Invalidates history cache.
- **Input:**
  ```typescript
  {
    scenarioId: string(),
    phoneNumber: string() // E.164 format, e.g. "+33612345678"
      .transform(normalize NFKC)
      .pipe(regex /^\+[1-9]\d{6,14}$/),
    maxDurationSeconds: number().min(60).max(3600).default(300),
  }
  ```
- **Output:** Result from `initiateCall` service
- **Errors:**
  - `FORBIDDEN` — phone number is blocked
  - `TOO_MANY_REQUESTS` — spam detection flagged or daily limit exceeded
  - `NOT_FOUND` — scenario not found
  - `UNAUTHORIZED` — user not found
  - `PRECONDITION_FAILED` — insufficient credits
  - `INTERNAL_SERVER_ERROR` — Twilio failure

#### `calls.history`
- **Auth:** Authenticated
- **Description:** Cursor-based paginated call history for the current user. Results are cached in Redis for 30 seconds.
- **Input:**
  ```typescript
  {
    cursor?: string(),
    limit: number().min(1).max(20).default(10),
  }
  ```
- **Output:**
  ```typescript
  {
    items: Array<CallHistoryItem>,
    nextCursor: string | undefined,
  }
  ```

#### `calls.todayCount`
- **Auth:** Authenticated
- **Description:** Get the number of calls the current user has made today (UTC day range).
- **Input:** None
- **Output:** `{ count: number }`

#### `calls.listByScenario`
- **Auth:** Authenticated
- **Description:** Cursor-based paginated list of calls for a specific scenario (only calls with recordings).
- **Input:**
  ```typescript
  {
    scenarioId: string(),
    cursor?: string(),
    limit: number().int().min(1).max(20).default(10),
  }
  ```
- **Output:**
  ```typescript
  {
    items: Array<{ id, durationSeconds, createdAt, status }>,
    nextCursor: string | undefined,
  }
  ```

#### `calls.replay`
- **Auth:** Authenticated (call owner only)
- **Description:** Get the recording URL (pre-signed R2 URL) and transcript for a completed call.
- **Input:**
  ```typescript
  { callId: string() }
  ```
- **Output:**
  ```typescript
  {
    recordingUrl: string | null,
    transcript: Array<{ speaker: string, text: string, timestamp: number }> | null,
  }
  ```
- **Errors:**
  - `NOT_FOUND` — call not found
  - `FORBIDDEN` — not the call owner

---

### 6.7 `billing` — Credits and Payments

#### `billing.getCredits`
- **Auth:** Authenticated
- **Description:** Get the current user's credit balance from `UserBilling` sub-aggregate, falling back to legacy `User.credits`.
- **Input:** None
- **Output:** `{ credits: number }`

#### `billing.createCheckout`
- **Auth:** Authenticated
- **Description:** Create a Stripe Checkout session for purchasing credits.
- **Input:**
  ```typescript
  {
    priceId: string(),
    credits: number().min(1).max(10000),
  }
  ```
- **Output:** `{ url: string }` (Stripe Checkout URL)

---

### 6.8 `community` — Comments and Reporting

#### `community.comment`
- **Auth:** Authenticated
- **Rate limit:** 30 per 3600s
- **Content moderation:** Yes
- **Description:** Post a comment on a scenario. Runs spam detection. Schedules async AI moderation.
- **Input:**
  ```typescript
  {
    scenarioId: string(),
    content: string().min(1).max(500),
  }
  ```
- **Output:** Created comment with user info
- **Errors:**
  - `TOO_MANY_REQUESTS` — spam detection flagged

#### `community.getComments`
- **Auth:** Public
- **Rate limit:** 60 per 60s (IP-based)
- **Description:** Cursor-based paginated comments for a scenario (only APPROVED comments).
- **Input:**
  ```typescript
  {
    scenarioId: string(),
    cursor?: string(),
    limit: number().min(1).max(50).default(20),
  }
  ```
- **Output:**
  ```typescript
  {
    items: Array<CommentWithUser>,
    nextCursor: string | undefined,
  }
  ```

#### `community.reportAbuse`
- **Auth:** Authenticated
- **Rate limit:** 10 per 3600s
- **Description:** Report abusive content (scenario, comment, etc.). Prevents duplicate PENDING reports from the same user on the same target.
- **Input:**
  ```typescript
  {
    targetType: string().min(1).max(50),
    targetId: string(),
    reason: string().min(10).max(1000),
  }
  ```
- **Output:** `{ reportId: string }`
- **Errors:**
  - `CONFLICT` — already reported this content

---

### 6.9 `social` — Social Features

#### `social.toggleLike`
- **Auth:** Authenticated
- **Rate limit:** 60 per 3600s
- **Description:** Toggle a reaction (emoji) on a scenario. Uses a database transaction to update reaction + like count + `UserSocial` aggregate atomically. Awards badges if thresholds are met.
- **Input:**
  ```typescript
  {
    scenarioId: string(),
    emoji: string().min(1).max(10),
  }
  ```
- **Output:**
  ```typescript
  {
    reacted: boolean,
    emoji: string,
    newBadge: Badge | null,
  }
  ```
- **Errors:**
  - `NOT_FOUND` — scenario not found

#### `social.getReactions`
- **Auth:** Public
- **Rate limit:** 60 per 60s (IP-based)
- **Description:** Get grouped reaction counts for a scenario, including which emojis the current user has reacted with.
- **Input:**
  ```typescript
  { scenarioId: string() }
  ```
- **Output:**
  ```typescript
  {
    reactions: Array<{
      emoji: string,
      count: number,
      userReacted: boolean,
    }>,
  }
  ```

#### `social.createClip`
- **Auth:** Authenticated
- **Rate limit:** 20 per 3600s
- **Description:** Create an audio clip from a call recording.
- **Input:**
  ```typescript
  {
    callId: string(),
    title?: string().max(100),
    startTime: number().int().min(0),
    endTime: number().int().min(0),
  }
  ```
- **Output:** Created clip data
- **Errors:**
  - `NOT_FOUND` — call or clip not found
  - `FORBIDDEN` — not the call owner

#### `social.getClips`
- **Auth:** Authenticated
- **Rate limit:** 60 per 60s (IP-based)
- **Description:** Get all clips for a call owned by the user.
- **Input:**
  ```typescript
  { callId: string() }
  ```
- **Output:** Array of clips
- **Errors:**
  - `NOT_FOUND` — call not found
  - `FORBIDDEN` — not the call owner

#### `social.deleteClip`
- **Auth:** Authenticated
- **Description:** Delete a clip owned by the current user.
- **Input:**
  ```typescript
  { clipId: string() }
  ```
- **Output:** Deletion result
- **Errors:**
  - `NOT_FOUND` — clip not found
  - `FORBIDDEN` — not the clip owner

#### `social.getLeaderboardScenarios`
- **Auth:** Public
- **Rate limit:** 30 per 60s (IP-based)
- **Description:** Get the top scenarios leaderboard by period and sort.
- **Input:**
  ```typescript
  {
    period: "ALL" | "WEEK" | "MONTH".default("ALL"),
    sort: "LIKES" | "PLAYS".default("LIKES"),
  }
  ```
- **Output:** `{ items: Array<LeaderboardItem> }`

#### `social.getLeaderboardCreators`
- **Auth:** Public
- **Rate limit:** 30 per 60s (IP-based)
- **Description:** Get the top creators leaderboard by period and sort.
- **Input:**
  ```typescript
  {
    period: "ALL" | "WEEK" | "MONTH".default("ALL"),
    sort: "LIKES" | "CALLS".default("LIKES"),
  }
  ```
- **Output:** `{ items: Array<LeaderboardItem> }`

#### `social.getBadges`
- **Auth:** Public
- **Rate limit:** 60 per 60s (IP-based)
- **Description:** List all available badges.
- **Input:** None
- **Output:** `Array<Badge>`

#### `social.getUserBadges`
- **Auth:** Public
- **Rate limit:** 60 per 60s (IP-based)
- **Description:** Get badges awarded to a specific user.
- **Input:**
  ```typescript
  { userId: string() }
  ```
- **Output:**
  ```typescript
  Array<{ id: string, badge: Badge, awardedAt: Date }>
  ```

#### `social.getFeatured`
- **Auth:** Public
- **Rate limit:** 60 per 60s (IP-based)
- **Description:** Get the currently featured scenario. Returns `null` if no scenario is featured.
- **Input:** None
- **Output:** `ScenarioWithCharacter | null`

#### `social.trackShare`
- **Auth:** Authenticated
- **Rate limit:** 60 per 3600s + 30 per 60s (IP)
- **Description:** Track a share event for analytics.
- **Input:**
  ```typescript
  {
    scenarioId: string(),
    platform: "DISCORD" | "TWITTER" | "TIKTOK" | "COPY_LINK" | "WEB_SHARE",
  }
  ```
- **Output:** `{ success: true }`
- **Errors:**
  - `NOT_FOUND` — scenario not found

---

### 6.10 `clips` — Audio Clips

#### `clips.listByCall`
- **Auth:** Authenticated
- **Rate limit:** 60 per 60s (IP-based)
- **Description:** List all clips for a given call. The caller must own the call.
- **Input:**
  ```typescript
  { callId: string() }
  ```
- **Output:** Array of clips for the call
- **Errors:**
  - `NOT_FOUND` — call not found
  - `FORBIDDEN` — not the call owner

#### `clips.listByUser`
- **Auth:** Authenticated
- **Rate limit:** 60 per 60s (IP-based)
- **Description:** Cursor-based paginated list of the current user's clips.
- **Input:**
  ```typescript
  {
    cursor?: string(),
    limit: number().int().min(1).max(20).default(10),
  }
  ```
- **Output:**
  ```typescript
  {
    items: Array<ClipWithCallScenario>,
    nextCursor: string | undefined,
  }
  ```

#### `clips.create`
- **Auth:** Authenticated
- **Rate limit:** 20 per 3600s
- **Content moderation:** Yes
- **Description:** Create a new audio clip from a call recording (DB record + background extraction). `endTime` must be greater than `startTime`.
- **Input:**
  ```typescript
  {
    callId: string(),
    startTime: number().int().min(0).max(86400),
    endTime: number().int().min(0).max(86400),
    title?: string().min(1).max(100),
  }
  // endTime must be > startTime
  ```
- **Output:** Created clip data
- **Errors:**
  - `NOT_FOUND` — call not found
  - `FORBIDDEN` — not the call owner

#### `clips.delete`
- **Auth:** Authenticated
- **Rate limit:** 10 per 3600s
- **Description:** Delete a clip owned by the current user.
- **Input:**
  ```typescript
  { clipId: string() }
  ```
- **Output:** Deletion result
- **Errors:**
  - `NOT_FOUND` — clip not found
  - `FORBIDDEN` — not the clip owner

---

### 6.11 `dashboard` — Aggregated Dashboard

#### `dashboard.getData`
- **Auth:** Authenticated
- **Description:** Aggregated dashboard data replacing 4 separate queries (`billing.getCredits`, `calls.history`, `calls.todayCount`, `scenarios.myScenarios`) with a single server-side call. All DB queries run in parallel.
- **Input:**
  ```typescript
  {
    callsLimit: number().min(1).max(20).default(5),
    scenariosLimit: number().min(1).max(20).default(3),
  }
  ```
- **Output:**
  ```typescript
  {
    credits: number,
    calls: Array<CallHistoryItem>,
    todayCount: number,
    scenarios: Array<ScenarioSummary>,
  }
  ```

---

### 6.12 `admin` — Administration (Admin Role Only)

All admin procedures require `role === "ADMIN"`. Non-admin users receive `FORBIDDEN` (403).

#### `admin.featureScenario`
- **Input:** `{ scenarioId: string() }`
- **Description:** Set today's featured scenario. Upserts on `featuredDate`. Logs to audit trail.
- **Errors:** `NOT_FOUND`

#### `admin.removeFeatured`
- **Input:** `{ scenarioId: string() }`
- **Description:** Remove today's featured scenario.

#### `admin.getFeaturedScenario`
- **Description:** Get today's featured scenario with full details.

#### `admin.moderationQueue`
- **Input:**
  ```typescript
  {
    cursor?: string(),
    limit: number().min(1).max(50).default(20),
  }
  ```
- **Description:** Cursor-based paginated queue of scenarios pending moderation.

#### `admin.approveScenario`
- **Input:** `{ scenarioId: string() }`
- **Description:** Approve a scenario.
- **Errors:** `NOT_FOUND`

#### `admin.rejectScenario`
- **Input:** `{ scenarioId: string() }`
- **Description:** Reject a scenario.
- **Errors:** `NOT_FOUND`

#### `admin.moderationQueueComments`
- **Input:**
  ```typescript
  {
    cursor?: string(),
    limit: number().min(1).max(50).default(20),
    status: "PENDING" | "REJECTED".default("PENDING"),
  }
  ```
- **Description:** Cursor-based paginated queue of comments pending or rejected moderation.

#### `admin.moderateComment`
- **Input:** `{ commentId: string() }`
- **Description:** Reject a comment (set status to REJECTED).
- **Errors:** `NOT_FOUND`

#### `admin.approveComment`
- **Input:** `{ commentId: string() }`
- **Description:** Approve a comment.
- **Errors:** `NOT_FOUND`

#### `admin.rejectComment`
- **Input:** `{ id: string() }`
- **Description:** Reject a comment (alternate procedure).
- **Errors:** `NOT_FOUND`

#### `admin.getAuditLogs`
- **Input:**
  ```typescript
  {
    cursor?: string(),
    limit: number().min(1).max(50).default(20),
    action?: string(),
    entityType?: string(),
    adminId?: string(),
    startDate?: string (ISO datetime),
    endDate?: string (ISO datetime),
  }
  ```
- **Description:** Cursor-based paginated audit log with optional filters.

#### `admin.getAbuseReports`
- **Input:**
  ```typescript
  {
    cursor?: string(),
    limit: number().min(1).max(50).default(20),
    status?: string(),
  }
  ```
- **Description:** Cursor-based paginated list of abuse reports.

#### `admin.dismissAbuseReport`
- **Input:** `{ reportId: string() }`
- **Description:** Dismiss an abuse report.
- **Errors:** `NOT_FOUND`

#### `admin.getBlockedNumbers`
- **Description:** List all blocked phone numbers with blocker info.

#### `admin.blockNumber`
- **Input:**
  ```typescript
  {
    phoneNumber: string() // E.164 format
    reason?: string().max(500),
  }
  ```
- **Description:** Block a phone number. Phone number is HMAC-hashed in audit logs.
- **Errors:** `CONFLICT` — already blocked

#### `admin.unblockNumber`
- **Input:** `{ id: string() }`
- **Description:** Unblock a previously blocked number.
- **Errors:** `NOT_FOUND`

#### `admin.deleteUser`
- **Input:** `{ userId: string() }`
- **Description:** Admin-initiated account deletion (GDPR). Anonymizes personal data.
- **Errors:** `CONFLICT` — already deleted or not found

#### `admin.getUserDetail`
- **Input:** `{ userId: string() }`
- **Description:** Get detailed user information including sub-aggregates and counts.

#### `admin.listUsers`
- **Input:**
  ```typescript
  {
    cursor?: string(),
    limit: number().min(1).max(50).default(20),
    search?: string().min(2).max(100),
  }
  ```
- **Description:** Cursor-based paginated user list with optional search on username/email (case-insensitive).

#### `admin.purgeGDPR`
- **Input:**
  ```typescript
  {
    retentionDays: number().min(7).max(90).default(30),
  }
  ```
- **Description:** Permanently purge anonymized user records beyond the retention period.

---

### 6.13 `v1` — Versioned API (frozen)

Public at `api.v1.scenarios.*`. See §5 for versioning policy.

#### `v1.scenarios.create`
- **Identical to** `scenarios.create` (frozen shape, no spam detection in v1)

#### `v1.scenarios.feed`
- **Identical to** `scenarios.feed` (frozen shape)

#### `v1.scenarios.getById`
- **Identical to** `scenarios.getById` (frozen shape)

---

## 7. Webhooks

### 7.1 Stripe

**Endpoint:** `POST /api/webhooks/stripe`

| Attribute          | Value                                         |
|--------------------|-----------------------------------------------|
| Rate limit key     | `stripe:checkout` — 20 per 60s (global, not per IP) |
| Body size limit    | 100 KB                                        |
| Signature header   | `stripe-signature`                            |
| Verification       | `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)` |

**Idempotency:** Enforced by a unique constraint on `Purchase.stripePaymentId` (the Payment Intent ID `pi_xxx`). If a duplicate `checkout.session.completed` event arrives, the `P2002` Prisma error is caught and the event is skipped.

**Events handled:**

| Event                          | Action                                                                 |
|--------------------------------|------------------------------------------------------------------------|
| `checkout.session.completed`   | Add credits to user + record purchase. Uses `payment_intent` as key.  |
| `checkout.session.expired`     | Logged (no action).                                                    |
| `charge.refunded`              | Revoke credits atomically. `updateMany` with `refundedAt: null` guard.|
| `charge.dispute.created`       | Mark purchase as disputed.                                             |
| `charge.dispute.closed`        | If lost: revoke credits. If won: clear `disputedAt` flag.             |

**Response format:**
- `200`: `{ received: true }`
- `400`: `{ error: "..." }` (missing signature, missing metadata, invalid credits)
- `413`: `{ error: "Requête trop volumineuse" }`
- `429`: `{ error: "Trop de requêtes" }` with `Retry-After: 60`

### 7.2 Twilio

**Endpoint:** `POST /api/webhooks/twilio`

| Attribute          | Value                                         |
|--------------------|-----------------------------------------------|
| Rate limit key     | `twilio:status` — 60 per 60s (global)         |
| Body size limit    | 50 KB                                         |
| Signature header   | `x-twilio-signature`                          |
| Verification       | `twilio.validateRequest(TWILIO_AUTH_TOKEN, signature, url, params)` |
| Content type       | `application/x-www-form-urlencoded`           |

All Twilio webhooks pass through `wrapTwilioWebhook` middleware which: (1) enforces body size, (2) applies rate limiting, (3) parses form data, (4) validates Twilio signature, (5) extracts typed parameters.

**Status mapping:**

| Twilio `CallStatus`  | DB `Call.status`  |
|----------------------|-------------------|
| `ringing`            | `RINGING`         |
| `in-progress`        | `ACTIVE`          |
| `completed`          | `COMPLETED`       |
| `busy` / `no-answer` / `failed` / `canceled` | `FAILED` |

**Completed call handling** (`handleCompletedCall`):
1. Loads conversation state from Redis
2. Finds the `Call` DB record by `twilioCallSid`
3. Idempotency guard: skips if already `COMPLETED` or `FAILED`
4. Builds transcript from conversation messages
5. Fetches recording audio via Twilio signed SDK (not raw HTTP)
6. Uploads recording to R2 for long-term storage
7. Transcribes with Deepgram
8. Atomic transaction: credit reconciliation + status update
9. Cleans up Redis conversation state

**Additional Twilio endpoints:**

| Endpoint                                          | Rate limit key        | Limit        | Purpose                     |
|---------------------------------------------------|-----------------------|-------------:|-----------------------------|
| `POST /api/webhooks/twilio/voice`                 | `twilio:voice:init`   | 30 per 60s   | Voice call initialization   |
| `POST /api/webhooks/twilio/voice/handle-input`    | `twilio:voice:input`  | 60 per 60s   | Speech input handling       |
| `POST /api/webhooks/twilio/voice/stream`          | `twilio:voice:stream` | 30 per 60s   | Audio stream processing     |

### 7.3 Webhook Rate Limit Configuration

| Key                    | Limit  | Window | Per IP | Purpose                  |
|------------------------|-------:|--------|--------|--------------------------|
| `twilio:status`        | 60     | 60s    | No     | Call status updates      |
| `twilio:voice:init`    | 30     | 60s    | Yes    | Call initiation          |
| `twilio:voice:input`   | 60     | 60s    | Yes    | Speech input             |
| `twilio:voice:stream`  | 30     | 60s    | Yes    | Audio stream             |
| `stripe:checkout`      | 20     | 60s    | No     | Checkout events          |

---

## 8. CORS / CSRF

### CSRF Protection

CSRF validation is performed in `createTRPCContext()` for every **POST** mutation request (not GET-like queries).

**Validation logic:**
1. Read the `Origin` header (fall back to `Referer` if missing)
2. Compare against the application origin (`NEXT_PUBLIC_APP_URL`)
3. Also check against the `TRUSTED_ORIGINS` environment variable (comma-separated list)
4. Missing origin is allowed in development; rejected in production unless `NODE_ENV !== "production"`

**Configuration:**
```typescript
// .env
NEXT_PUBLIC_APP_URL=https://echoroom.app
TRUSTED_ORIGINS=https://app.echoroom.app,https://admin.echoroom.app
```

**CSRF rejection response:**
- Status: `FORBIDDEN` (403)
- Message: `"Requête rejetée — origine non autorisée"`

### CORS

EchoRoom does not expose a separate CORS configuration. Since tRPC is consumed by the Next.js frontend from the same origin, CORS headers are not required. For external clients (Stripe, Twilio), the webhook endpoints use signature validation instead of CORS.

---

## Appendix: Environment Variables

Key environment variables referenced by the API:

| Variable                     | Purpose                                    |
|------------------------------|--------------------------------------------|
| `NEXT_PUBLIC_APP_URL`        | Application origin for CSRF/redirects      |
| `TRUSTED_ORIGINS`            | Comma-separated additional origins         |
| `STRIPE_WEBHOOK_SECRET`      | Stripe webhook signing secret              |
| `TWILIO_AUTH_TOKEN`          | Twilio auth token (signature validation)   |
| `TWILIO_ACCOUNT_SID`         | Twilio account SID                         |
| `AUDIT_HASH_SECRET`          | HMAC secret for phone number audit hashing |
