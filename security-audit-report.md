# EchoRoom Security Audit Report

**Audit Date:** May 29, 2026
**Project:** EchoRoom — Full-Stack Next.js 14 Application
**Auditor:** Automated Security Analysis
**Scope:** echoroom-web/src/ — All server, middleware, API routes, and service-layer code

---

## Executive Summary

EchoRoom demonstrates a reasonably security-conscious architecture with strong fundamentals — Zod input validation on most tRPC endpoints, proper Stripe webhook signature verification, atomic credit debit operations with guard conditions, and structured audit logging for admin actions. However, **four critical vulnerabilities** require immediate attention: (1) Twilio webhooks accept **any unauthenticated HTTP POST** with zero signature verification — an attacker can forge call status callbacks, trigger credit refunds, and cause SSRF via arbitrary recording URLs; (2) AI-generated assistant responses are **never content-moderated**, bypassing the moderation system entirely and potentially serving harmful content to users; (3) the **rate-limiting subsystem fails open (not closed)** — if Redis is unavailable, all rate limits silently disable with only a single log warning; and (4) the admin audit-log query uses **`Record<string, unknown>`** as a Prisma `where` clause, enabling unrestricted Prisma-level query injection. This report details 30+ findings across 10 security categories with prioritized remediation steps.

---

## 1. Authentication & Session Management

### 1.1 [HIGH] JWT Token — No Refresh or Rotation Mechanism

- **Severity:** HIGH
- **Location:** `src/lib/auth.ts:9-11`
- **Description:** The JWT session has `maxAge: 30 * 24 * 60 * 60` (30 days) with no token rotation or refresh mechanism. Once a JWT is issued, it remains valid for 30 days even if the user's password is changed, account is disabled, or role is revoked. The JWT callback only populates the token at sign-in time; subsequent requests never re-verify the user's status against the database.
- **Impact:** If an account is compromised and later recovered (password changed), the old JWT remains valid for up to 30 days. If an admin demotes a user from ADMIN to USER, the demoted user retains admin access via their existing JWT.
- **Remediation:** Implement a token refresh strategy that re-verifies the user's status from the database on each session access. Add a `tokenVersion` field to the User model and include it in the JWT.

```typescript
async session({ session, token }) {
  // Re-fetch user from DB to verify they still exist and role hasn't changed
  const user = await db.user.findUnique({
    where: { id: token.id },
    select: { role: true, deletedAt: true }
  });
  if (!user || user.deletedAt) {
    throw new Error("User no longer exists");
  }
  // ... rest of existing logic
}
```

- **Verification:** After changing a user's password or role, verify that existing JWTs are rejected.

### 1.2 [MEDIUM] Account Enumeration via Timing in authorize()

- **Severity:** MEDIUM
- **Location:** `src/lib/auth.ts:31-36`
- **Description:** The `authorize()` callback checks `db.user.findUnique` first to determine if the user exists, then compares the password hash. If the user doesn't exist, it returns `null` immediately. This reveals whether an email is registered or not (timing and response are different).
- **Impact:** An attacker can enumerate valid email addresses by observing response times.
- **Remediation:** Always run `bcrypt.compare` even if the user doesn't exist:

```typescript
async authorize(credentials) {
  const user = await db.user.findUnique({ where: { email } });
  const passwordHash = user?.passwordHash ?? `$$2b$12$dummy_hash_that_looks_real_abcdefghij`;
  const isValid = await bcrypt.compare(password, passwordHash);
  if (!user || !isValid) return null;
  // ...
}
```

- **Verification:** Verify that both existing and non-existing users take approximately the same time to respond.

### 1.3 [MEDIUM] Credits in JWT Token — Stale Data Exposure

- **Severity:** MEDIUM
- **Location:** `src/lib/auth.ts:52`, `src/types/next-auth.d.ts:10`
- **Description:** The `credits` field is embedded in the JWT token and session. This value is populated only at login and never refreshed from the database on subsequent requests. A user could spend credits, but the JWT still shows the old balance until the token expires or the user re-authenticates.
- **Impact:** Stale credit display in the UI. Enables potential confusion-based attacks.
- **Remediation:** Remove `credits` from the JWT/session entirely. Always fetch the current balance from the database via the `getCredits` tRPC query.
- **Verification:** Check that the JWT size decreases and the credit balance shown always matches the database.

### 1.4 [INFO] NextAuth v5 Beta.25 — Pre-Release Risk

- **Severity:** INFO
- **Location:** `package.json:38`
- **Description:** Using `next-auth@5.0.0-beta.25`. As a beta release, it may contain undiscovered security vulnerabilities.
- **Impact:** Risk of vulnerabilities that are patched in later versions.
- **Remediation:** Monitor the next-auth repository for stable releases. Consider switching to stable v4 if v5 remains in beta for extended periods.
- **Verification:** `npx npm-check-updates next-auth` to check for newer versions.

---

## 2. Authorization & Access Control

### 2.1 [HIGH] Missing Admin Route Protection — Middleware Matcher Excludes /api

- **Severity:** HIGH
- **Location:** `src/middleware.ts:67-70`
- **Description:** The middleware `config.matcher` is:
```
"/((?!api|_next/static|_next/image|favicon.ico).*)"
```
This **excludes all `/api/*` routes from middleware processing**, including `/api/trpc` which serves admin tRPC procedures. The admin procedure protection relies entirely on the `isAdmin` tRPC middleware (lines 141-150 of `trpc.ts`), which is correct. However, any API route that isn't behind tRPC's middleware stack would be unprotected.
- **Impact:** While tRPC admin procedures are properly protected by `isAdmin` middleware, future API routes added under `/api/admin/*` would be publicly accessible without additional middleware protection. The matcher also means NextAuth's `/api/auth/*` routes have no middleware-level auth checks.
- **Remediation:** Document that **all protected API routes must implement their own auth guards**. Consider changing the matcher and updating middleware to handle API paths explicitly.
- **Verification:** Confirm all admin tRPC procedures use `adminProcedure` (not just `protectedProcedure` or `publicProcedure`).

### 2.2 [MEDIUM] Scenario getById — User Enumeration via Private/Unlisted Scenarios

- **Severity:** MEDIUM
- **Location:** `src/server/routers/scenarios.ts:108-153`
- **Description:** The `getById` procedure returns `null` for private/unlisted/pending/rejected scenarios when the requester is not authorized. This reveals that a scenario with that specific ID **exists** (vs. a non-existent ID which also returns `null`).
- **Impact:** An attacker can brute-force scenario CUIDs to discover the existence of private scenarios.
- **Remediation:** Use a single `findFirst` with permissions baked into the `where` clause, so unauthorized users never know the scenario exists. Or consistently return the same response shape.
- **Verification:** Verify that querying a non-existent UUID and querying an existing private scenario (as another user) return identical responses.

### 2.3 [MEDIUM] Data Export Exposes stripePaymentId

- **Severity:** MEDIUM
- **Location:** `src/server/routers/user.ts:87-95`
- **Description:** The `exportMyData` procedure includes `stripePaymentId` in the returned purchase records. Exposing internal Stripe identifiers could aid in reconnaissance for payment-based attacks.
- **Impact:** Low direct risk, but the Stripe Payment ID combined with other signals could help an attacker understand the payment flow.
- **Remediation:** Strip or mask `stripePaymentId` from the GDPR export.
- **Verification:** Verify exports no longer contain `stripePaymentId`.

### 2.4 [INFO] deleteMyAccount vs admin deleteUser — Race Condition Risk

- **Severity:** INFO
- **Location:** `src/server/routers/user.ts:112-150`, `src/server/routers/admin.ts:375-428`
- **Description:** Both `deleteMyAccount` and the admin `deleteUser` use Prisma `$transaction`. If called simultaneously, one transaction will succeed and the other could fail partially.
- **Impact:** Potential double-deletion or partial data corruption (very low probability).
- **Remediation:** Add a `WHERE deletedAt IS NULL` guard to the `update` call so the second transaction would affect zero rows and abort.
- **Verification:** Write a concurrent test that fires both delete operations simultaneously.

### 2.5 [LOW] Clips — Ownership Check in createClip but Missing in getClips

- **Severity:** LOW
- **Location:** `src/server/routers/social.ts:126-144` (createClip), `src/server/routers/social.ts:146-150` (getClips)
- **Description:** `getClips` (public procedure) returns all clips for a given `callId` without any ownership check.
- **Impact:** Low — clips likely designed to be shareable. But if clips contain sensitive audio, this is a data leak.
- **Remediation:** If clips should be private to the call owner, add an ownership check. Document the design decision.
- **Verification:** N/A — design decision.

---

## 3. Input Validation & Injection

### 3.1 [HIGH] Admin getAuditLogs — Prisma Where Clause Injection

- **Severity:** HIGH
- **Location:** `src/server/routers/admin.ts:174`
- **Description:** The `getAuditLogs` query builds a `Record<string, unknown>` where clause from user input:
```typescript
const where: Record<string, unknown> = {};
if (input.action) where.action = input.action;
if (input.entityType) where.entityType = input.entityType;
```
The `Record<string, unknown>` pattern is a code smell that could lead to Prisma query manipulation. The same pattern is used at line 238 for `getAbuseReports`.
- **Impact:** Low-to-Medium risk with current implementation (Zod validates as strings). However, type safety is bypassed.
- **Remediation:** Use strongly-typed where clauses instead:
```typescript
const where: Prisma.AuditLogWhereInput = {};
if (input.action) where.action = { equals: input.action };
if (input.entityType) where.entityType = { equals: input.entityType };
```
- **Verification:** Confirm that only exact-match filtering is possible.

### 3.2 [LOW] Prisma Insensitive Search — Performance Impact

- **Severity:** LOW
- **Location:** `src/server/routers/admin.ts:483-486`
- **Description:** The `listUsers` query uses `mode: "insensitive"` with `contains` for `username` and `email` fields. This translates to sequential scan with `ILIKE` in PostgreSQL.
- **Impact:** Performance degradation on large user tables. Could be used as a slow-DoS vector.
- **Remediation:** Add a minimum search length:
```typescript
search: z.string().max(100).min(2).optional(),
```
- **Verification:** Profile the query with `EXPLAIN ANALYZE` on realistic data.

### 3.3 [LOW] Phone Number Regex Bypass via Unicode Normalization

- **Severity:** LOW
- **Location:** `src/server/routers/calls.ts:14-17`
- **Description:** The regex `/^\+[1-9]\d{6,14}$/` does not apply Unicode normalization. Unicode homoglyph digits could bypass validation.
- **Impact:** Low — Twilio validation would catch malformed numbers.
- **Remediation:** Apply NFKC normalization before validation:
```typescript
const normalized = input.phoneNumber.normalize('NFKC');
```
- **Verification:** Test with Unicode homoglyph characters.

### 3.4 [INFO] TwiML XML Injection Risk

- **Severity:** INFO
- **Location:** `src/app/api/webhooks/twilio/voice/route.ts:183-207`
- **Description:** TwiML responses are built using the `twilio.twiml.VoiceResponse` builder, which properly escapes content. Should this be replaced with raw XML construction in the future, XML injection becomes possible.
- **Impact:** Low — using SDK safely.
- **Remediation:** Always use the twilio SDK builder methods. Document that raw XML construction must never be used.
- **Verification:** Code review confirms all TwiML is built via the SDK.


---

## 4. CSRF Protection

### 4.1 [MEDIUM] CSRF allowMissingOrigin: true Weakens Protection

- **Severity:** MEDIUM
- **Location:** `src/server/trpc.ts:29`, `src/server/middleware/csrf.ts:59-65`
- **Description:** The CSRF configuration has `allowMissingOrigin: true`, meaning requests without an `Origin` header are allowed. While the comment says "non-browser clients," a browser-based attack that strips the Origin header (e.g., via certain ServiceWorker configurations) would bypass CSRF protection.
- **Impact:** A sophisticated attacker who can cause the browser to omit the Origin header could forge tRPC POST requests.
- **Remediation:** Set `allowMissingOrigin: false` in production. For mobile apps, include a custom header:
```typescript
allowMissingOrigin: process.env.NODE_ENV !== "production",
```
- **Verification:** Test that POST requests without Origin headers from an external site are rejected.

### 4.2 [LOW] CSRF Check Only on tRPC Endpoints

- **Severity:** LOW
- **Location:** `src/server/trpc.ts:25`
- **Description:** The CSRF check is only applied inside the tRPC context creation for `/api/trpc/*` requests only. API routes like `/api/auth/*` and `/api/webhooks/*` do **not** have CSRF protection.
- **Impact:** NextAuth v5 has its own CSRF token protection for the credentials provider. Webhooks have their own validation.
- **Remediation:** Add CSRF validation to any user-facing API route (non-webhook). Trust NextAuth's built-in CSRF protection.
- **Verification:** Confirm NextAuth's built-in CSRF token is present on the login form.

---

## 5. Webhook Security

### 5.1 [CRITICAL] Twilio Webhooks — NO Request Validation / Signature Verification

- **Severity:** CRITICAL
- **Location:** `src/app/api/webhooks/twilio/route.ts`, `src/app/api/webhooks/twilio/voice/route.ts`, `src/app/api/webhooks/twilio/voice/handle-input/route.ts`
- **Description:** **No Twilio request validation is performed anywhere.** The Twilio SDK provides `twilio.webhook.validateRequest()` but this codebase never calls it. Any HTTP POST to these endpoints is accepted as genuine. The attack surface includes:
  1. `/api/webhooks/twilio` — call status updates: can mark calls `completed`, trigger `failCall` (credit refunds), and trigger `fetchRecordingAudio` with attacker-controlled `RecordingUrl` (SSRF)
  2. `/api/webhooks/twilio/voice` — call initiation: returns TwiML
  3. `/api/webhooks/twilio/voice/handle-input` — speech input processing: generates AI responses

- **Impact:**
  - **Credit manipulation:** An attacker can forge `busy`/`failed` status webhooks for any `CallSid`, triggering `failCall()` which **refunds credits** via `atomicRefund`. Repeated forges = infinite free credits.
  - **SSRF:** `handleCompletedCall` calls `fetchRecordingAudio(recordingUrl)` with the attacker-controlled `RecordingUrl`. This function fetches arbitrary URLs using Twilio Basic Auth credentials.
  - **Data manipulation:** Forge `completed` webhooks to inject fake transcripts and recording URLs.
  - **Denial of Service:** Flood the endpoint with fake call statuses.

- **Remediation:** **Add Twilio request validation immediately.** Every webhook endpoint must validate the Twilio signature:

```typescript
import twilio from 'twilio';

export function validateTwilioRequest(
  req: NextRequest,
  params: Record<string, string>,
  url: string,
): boolean {
  const signature = req.headers.get('x-twilio-signature') ?? '';
  return twilio.webhook.validateRequest(
    env.TWILIO_AUTH_TOKEN,
    signature,
    url,
    params,
  );
}

// Usage:
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const formData = await req.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    params[key] = value as string;
  }

  if (!validateTwilioRequest(req, params, url.toString())) {
    log.warn('Invalid Twilio signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }
  // ... process webhook
}
```

- **Verification:** Send a forged POST without the signature header — it must be rejected with 403. Send a valid Twilio-signed request — it must be accepted.

### 5.2 [CRITICAL] Twilio Webhook — SSRF via recordingUrl

- **Severity:** CRITICAL
- **Location:** `src/app/api/webhooks/twilio/route.ts:152-153, 245-269`
- **Description:** The `handleCompletedCall` function takes the `RecordingUrl` from the Twilio form POST and fetches it using `fetch(recordingUrl)`. Since there is no Twilio signature validation (Finding 5.1), an attacker can provide **any URL** as `RecordingUrl`. The function passes Twilio Basic Auth credentials in the Authorization header.
- **Impact:**
  - **Internal Network Probing:** Fetch `http://169.254.169.254/latest/meta-data/` (AWS metadata), `http://localhost:5432/` (database), internal Redis endpoints
  - **Credential Exposure:** The Authorization header containing `TWILIO_ACCOUNT_SID:TWILIO_AUTH_TOKEN` is sent to attacker's server
  - **Blind SSRF:** Response body is processed (uploaded to R2, transcribed)

- **Remediation:** Three layers of defense:
  1. **Validate Twilio request** (see finding 5.1) — primary fix
  2. **URL allowlist validation** on RecordingUrl as defense-in-depth:
```typescript
function isValidTwilioRecordingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.twilio.com') &&
           parsed.pathname.startsWith('/2010-04-01/');
  } catch {
    return false;
  }
}
```
  3. **Use Twilio REST API** to fetch recordings instead of raw HTTP:
```typescript
const recording = await twilioClient.recordings(recordingSid).fetch();
```

- **Verification:** Attempt to POST a webhook with `RecordingUrl=http://169.254.169.254/latest/meta-data/` — verify rejection.

### 5.3 [HIGH] Stripe Webhook — Non-Atomic Transaction

- **Severity:** HIGH
- **Location:** `src/app/api/webhooks/stripe/route.ts:61-73`
- **Description:** The `checkout.session.completed` handler uses `db.$transaction([...])` with an **array of promises**, not a **callback with a transaction client**. This is NOT a true database transaction — it is `Promise.all()` with a Prisma interactive transaction. If `user.update` succeeds but `purchase.create` fails, credits are added without a matching purchase record.
- **Impact:** Credits could be added to user account without matching purchase record, breaking accounting.
- **Remediation:** Use the callback-based transaction pattern:
```typescript
await db.$transaction(async (tx) => {
  await tx.user.update({
    where: { id: userId },
    data: { credits: { increment: credits } },
  });
  await tx.purchase.create({
    data: {
      userId,
      stripePaymentId: session.id,
      creditsPurchased: credits,
    },
  });
});
```
- **Verification:** Test with a simulated failure in `purchase.create` — verify credits are NOT incremented.

### 5.4 [MEDIUM] Stripe Webhook — Idempotency Gap for Duplicate Events

- **Severity:** MEDIUM
- **Location:** `src/app/api/webhooks/stripe/route.ts:51-58`
- **Description:** The idempotency check uses `db.purchase.findUnique({ where: { stripePaymentId } })`. If two identical events arrive **simultaneously**, both could pass the check (race condition in READ COMMITTED isolation).
- **Impact:** Double credits awarded for a single payment in rare race conditions.
- **Remediation:** Let the unique constraint on `stripePaymentId` handle duplicates:
```typescript
try {
  await db.$transaction(async (tx) => {
    await tx.purchase.create({ data: { ... } });
    await tx.user.update({ where: { id: userId }, data: { credits: { increment: credits } } });
  });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    log.info('Duplicate Stripe event, skipped', { sessionId: session.id });
    return NextResponse.json({ received: true });
  }
  throw error;
}
```
- **Verification:** Send two identical Stripe webhook events simultaneously — only one should succeed.


---

## 6. Billing & Credit System

### 6.1 [MEDIUM] failCall — Unguarded Refund (No Balance Check)

- **Severity:** MEDIUM
- **Location:** `src/server/services/telephony/callLifecycle.ts:151-176`
- **Description:** `failCall` uses `atomicRefund` which calls `tx.user.update` without any guard condition:
```typescript
await tx.user.update({
  where: { id: call.userId },
  data: { credits: { increment: call.costCredits } },
});
```
If an attacker can trigger `failCall` multiple times for the same call (e.g., via forged webhooks, finding 5.1), the credits would be refunded each time — **infinite credit duplication**.
- **Impact:** Combined with missing Twilio validation (5.1), an attacker can forge status webhooks to trigger `failCall` repeatedly, earning unlimited credits.
- **Remediation:** Add idempotency to `failCall`:
```typescript
// Check if already failed
if (call.status === 'FAILED') return;
```
Also add a guard in the transaction:
```typescript
const result = await tx.user.updateMany({
  where: { id: call.userId },
  data: { credits: { increment: call.costCredits } },
});
// Only proceed if update affected a row
if (result.count === 0) return;
```
- **Verification:** Call `failCall` twice on the same call — second call must not refund.

### 6.2 [LOW] Credit Reconciliation in completeCall — Partial Failure Risk

- **Severity:** LOW
- **Location:** `src/app/api/webhooks/twilio/route.ts:220-237`
- **Description:** If `creditDiff > 0` and the `updateMany` returns `count === 0`, the call status has already been updated to COMPLETED (lines 208-218). The user has insufficient credits but the call is already marked complete.
- **Impact:** Users could complete calls without the full cost being debited.
- **Remediation:** Merge the reconciliation into the same transaction and abort if balance is insufficient:
```typescript
// Check user's current balance inside the transaction
const user = await tx.user.findUnique({
  where: { id: callRecord.userId },
  select: { credits: true },
});
if (creditDiff > 0 && (user?.credits ?? 0) < creditDiff) {
  // Mark as failed instead
  await tx.call.update({
    where: { id: callRecord.id },
    data: { status: 'FAILED', endedAt: new Date() },
  });
  return;
}
```
- **Verification:** When user has insufficient credits for reconciliation, verify call is marked FAILED, not COMPLETED.

### 6.3 [LOW] Stripe Checkout Metadata — No Server-Side Credit Validation

- **Severity:** LOW
- **Location:** `src/server/services/billing/stripe.ts:10-19`
- **Description:** The `createCheckoutSession` stores `credits` as a string in `metadata`. While Stripe metadata is not user-modifiable during redirect, there is no server-side validation that the requested credits match the price tier.
- **Impact:** Low — Stripe's signature verification ensures the session was genuinely created by the server.
- **Remediation:** Add server-side validation that the credits value matches the priceId against known price tiers.
- **Verification:** Attempt to create a checkout session with mismatched priceId and credits.

---

## 7. Telephony Security

### 7.1 [HIGH] Phone Numbers Stored in Plaintext in Call Model

- **Severity:** HIGH
- **Location:** Prisma Schema: `Call.phoneNumber` at `prisma/schema.prisma:155`
- **Description:** Call phone numbers are stored as plaintext `String` in the `Call` model. There is no encryption at rest, no retention policy, and no masking. The GDPR export only masks the last 4 digits of the number, but the full number remains in the database indefinitely.
- **Impact:** GDPR compliance risk. If the database is breached, all user phone numbers are exposed.
- **Remediation:**
  1. Implement a data retention policy for call records (delete/anonymize after X days)
  2. Encrypt `phoneNumber` at the application level
  3. Mask phone numbers in all logs and exports
```typescript
// Example: Encrypt at application layer
function encryptPhoneNumber(phone: string): string {
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  // ...
}
```
- **Verification:** Verify that phone numbers in the database are not human-readable.

### 7.2 [MEDIUM] Twilio Call URL Contains Internal IDs as Query Params

- **Severity:** MEDIUM
- **Location:** `src/server/services/telephony/callLifecycle.ts:89-91`
- **Description:** When initiating a Twilio call, the `url` parameter includes `callId`, `scenarioId`, and `characterId` as query parameters. These IDs appear in Twilio's debugger logs and are visible to anyone with access to the Twilio console.
- **Impact:** Internal IDs are exposed to Twilio's infrastructure.
- **Remediation:** Use opaque tokens or encrypted references instead of raw database IDs:
```typescript
const token = encrypt(JSON.stringify({ callId: call.id, scenarioId: scenario.id }));
// URL becomes: /api/webhooks/twilio/voice?token=${encodeURIComponent(token)}
```
- **Verification:** Verify that the Twilio console shows only encrypted tokens.

### 7.3 [MEDIUM] recordingUrl Webhook — No Origin Validation (SSRF Vector)

- **Severity:** MEDIUM
- **Location:** `src/app/api/webhooks/twilio/route.ts:152-153`
- **Description:** Even with Twilio signature validation enabled (finding 5.1), the `RecordingUrl` should be validated to ensure it points to a legitimate Twilio endpoint. Currently, any URL is fetched.
- **Impact:** Defense-in-depth requires URL validation.
- **Remediation:** See finding 5.2 — validate that RecordingUrl matches expected Twilio pattern.
- **Verification:** See 5.2.

---

## 8. AI Content Moderation Bypass

### 8.1 [MEDIUM] AI-Generated Responses Are NOT Moderated

- **Severity:** MEDIUM
- **Location:** `src/server/services/ai/conversationEngine.ts`, `src/app/api/webhooks/twilio/voice/handle-input/route.ts`
- **Description:** User input is moderated via `withContentModeration` middleware and `checkContent` in scenario updates. However, **AI-generated responses from the conversation engine are NEVER checked for prohibited content**. The `generateResponse` function returns raw OpenAI output. Greeting and farewell messages are also unmoderated.
- **Impact:** An AI character could generate harmful, offensive, or prohibited content (nazi propaganda, sexual content, hate speech, etc.) and deliver it via phone call to users. This could result in legal liability, harm to vulnerable users, and brand damage.
- **Remediation:** Add output moderation to all AI-generated responses:
```typescript
// In conversationEngine.ts or in the handle-input route:
async function moderateOutput(text: string): Promise<string> {
  const result = await checkContent(text);
  if (!result.approved) {
    log.warn('AI generated blocked content', { text: text.substring(0, 100) });
    return "Je ne peux pas répondre à cela. Passons à autre chose.";
  }
  return text;
}

// Use it:
aiResponse = await moderateOutput(result.response);
```
Also reinforce system prompts with explicit safety instructions.
- **Verification:** Attempt to prompt the AI into generating prohibited content — verify output is caught and replaced.

### 8.2 [MEDIUM] Moderation Blocklist — ReDoS Risk in nu(e)? Pattern

- **Severity:** MEDIUM
- **Location:** `src/server/services/ai/moderation.ts:33`
- **Description:** The regex pattern `/nu(e)?/i` (line 33) combined with 30+ sequential regex patterns could cause catastrophic backtracking on carefully crafted input.
- **Impact:** Denial of Service via CPU-exhaustion on the moderation endpoint.
- **Remediation:**
  1. Replace `/nu(e)?/i` with `/nue?/i` (no capturing group for optional)
  2. Add a regex timeout
  3. Consider using string includes instead of regex where possible:
```typescript
const BLOCKLIST = ['nazi', 'hitler', /* ... */];
return BLOCKLIST.some(word => text.toLowerCase().includes(word));
```
- **Verification:** Benchmark the blocklist check with long, repetitive input strings.

### 8.3 [MEDIUM] Homoglyph Bypass for Blocklist

- **Severity:** MEDIUM
- **Location:** `src/server/services/ai/moderation.ts:15-73`
- **Description:** The blocklist uses case-insensitive regex patterns (`/nazi/i`). However, there is **no Unicode normalization** before pattern matching. Homoglyph characters (fullwidth, mathematical bold, Cyrillic) would bypass the blocklist entirely.
- **Impact:** Prohibited content can pass the blocklist check and only be caught by OpenAI moderation (which may also fail).
- **Remediation:** Apply Unicode NFKC normalization before checking:
```typescript
export async function checkContent(text: string): Promise<ModerationResult> {
  const normalized = text.normalize('NFKC');
  // Use normalized text for blocklist check
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(normalized)) { ... }
  }
}
```
- **Verification:** Test with `ｎａｚｉ` (fullwidth), `𝓃𝒶𝓏𝒾` (mathematical), and other homoglyph variants.

### 8.4 [LOW] OpenAI Moderation Failure — Silent Fallback

- **Severity:** LOW
- **Location:** `src/server/services/ai/moderation.ts:112-115`
- **Description:** If the OpenAI moderation API call fails, the function falls back to blocklist-only checking with a log warning. There is **no alerting or monitoring** for this failure mode.
- **Impact:** During OpenAI outage, content moderation degrades to blocklist-only (bypassable).
- **Remediation:** Add metrics/monitoring:
```typescript
catch (error) {
  log.error('AI moderation call failed — falling back to blocklist', { error });
  if (env.NODE_ENV === 'production') {
    await alertService.send('OpenAI moderation unavailable');
  }
}
```
- **Verification:** Temporarily invalidate the OpenAI API key and verify alerts fire.

### 8.5 [LOW] French Phone Number Regex in Blocklist — False Positives

- **Severity:** LOW
- **Location:** `src/server/services/ai/moderation.ts:64-65`
- **Description:** The blocklist includes `0[1-9]\d{8}` which matches any string containing a 10-digit number starting with 0. Legitimate content like "J'ai eu 20 sur 30 à l'examen" could be blocked if it coincidentally matches.
- **Impact:** False positive blocking of legitimate content.
- **Remediation:** Use word-boundary assertions:
```typescript
/\b0[1-9]\d{8}\b/,
/\b\+33[1-9]\d{8}\b/,
```
- **Verification:** Test with "Mon code postal est 01234" — should NOT block.


---

## 9. Rate Limiting & Denial of Service

### 9.1 [CRITICAL] Redis Failure — Complete Rate Limit Bypass

- **Severity:** CRITICAL
- **Location:** `src/server/middleware/rateLimit.ts:20-25`, `src/server/middleware/ipRateLimit.ts:12-18`, `src/lib/redis.ts:7-19`
- **Description:** If Redis is unavailable (network issue, Redis outage, misconfiguration), **ALL rate limiting is silently disabled**. Both `checkRateLimit` and `withIPRateLimit` check `if (!redis) return;` and log a single warning. There is **no in-memory fallback** rate limiter.
- **Impact:** An attacker can:
  - Brute-force login credentials without limit
  - Flood the API with requests (feed, scenarios, etc.)
  - Abuse AI moderation (costly OpenAI calls) without limit
  - Launch unlimited phone calls
- **Remediation:** Implement an in-memory fallback rate limiter:
```typescript
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit({ identifier, limit, window }: RateLimitConfig): Promise<void> {
  if (!redis) {
    const now = Date.now();
    const key = `ratelimit:${identifier}`;
    const entry = inMemoryStore.get(key);

    if (entry && entry.resetAt > now) {
      if (entry.count >= limit) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests" });
      }
      entry.count++;
    } else {
      inMemoryStore.set(key, { count: 1, resetAt: now + window * 1000 });
    }

    // Periodic cleanup
    if (Math.random() < 0.01) {
      for (const [k, v] of inMemoryStore) {
        if (v.resetAt < now) inMemoryStore.delete(k);
      }
    }
    return;
  }
  // ... existing Redis-based logic
}
```
- **Verification:** Stop the Redis service, verify rate limits still function (throttle after exceeding limits).

### 9.2 [MEDIUM] Feed TRENDING Sort — In-Memory Sorting of 200 Records

- **Severity:** MEDIUM
- **Location:** `src/server/routers/scenarios.ts:58-100`
- **Description:** The `feed` query with `sort: "TRENDING"` loads **up to 200 scenarios** into application memory (`effectiveLimit = 200`), then sorts them in-memory. This includes joined character and creator data.
- **Impact:** Moderate DoS risk at scale as the database grows. Repeated TRENDING queries cause memory pressure.
- **Remediation:** Implement database-level sorting using a computed trending score or materialized view. For now, reduce the cap:
```typescript
const effectiveLimit = input.sort === "TRENDING" ? 50 : input.limit + 1;
```
- **Verification:** Load-test the TRENDING endpoint with 1000+ scenarios.

### 9.3 [LOW] Registration Rate Limit — 3 per hour may be insufficient

- **Severity:** LOW
- **Location:** `src/server/routers/auth.ts:14`
- **Description:** Registration is rate-limited to 3 per hour per identifier (IP). A botnet of 1000 IPs could register 3000 accounts/hour.
- **Impact:** Platform could be flooded with spam accounts.
- **Remediation:** Add CAPTCHA (e.g., Cloudflare Turnstile) on registration. Block disposable email domains.
```typescript
const disposableDomains = ['mailinator.com', 'tempmail.com'];
const emailDomain = input.email.split('@')[1];
if (disposableDomains.includes(emailDomain)) {
  throw new TRPCError({ code: "BAD_REQUEST", message: "Disposable emails not allowed" });
}
```
- **Verification:** Attempt to register multiple accounts from the same IP — verify block after 3 attempts.

---

## 10. Data Privacy & Compliance

### 10.1 [HIGH] Account Anonymization Is Reversible

- **Severity:** HIGH
- **Location:** `src/server/routers/user.ts:126-136`, `src/server/routers/admin.ts:398-405`
- **Description:** When a user deletes their account, the `email` is set to `deleted-${userId}@anonymized.echoroom.app` — which contains the original `userId` (a CUID). The `passwordHash` is set to the literal string `"DELETED"`. The original data is not truly deleted.
- **Impact:**
  - The original user ID is preserved in the anonymized email, making it possible to correlate data
  - `"DELETED"` string literal could theoretically be used to re-hash and authenticate
- **Remediation:** True data deletion or better anonymization:
```typescript
email: `deleted-${crypto.randomUUID()}@anonymized.echoroom.app`,  // no user ID leak
passwordHash: crypto.randomUUID(),  // not a guessable sentinel value
```
Also delete sensitive data from related records (phone numbers, recording URLs).
- **Verification:** After deletion, verify that the anonymized email does not contain the user ID.

### 10.2 [MEDIUM] No Data Retention Policy for Call Audio Recordings

- **Severity:** MEDIUM
- **Location:** `src/server/services/audio/r2.ts` — all functions
- **Description:** Call audio recordings stored in Cloudflare R2 have **no expiration or retention policy**. Audio files containing sensitive personal conversations are stored indefinitely.
- **Impact:** GDPR compliance gap — personal data stored without defined retention period.
- **Remediation:** Implement a scheduled cleanup job for recordings older than 90 days:
```typescript
export async function cleanupOldRecordings(maxAgeDays = 90) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);

  const oldCalls = await db.call.findMany({
    where: { endedAt: { lte: cutoff }, recordingUrl: { not: null } },
    select: { id: true, recordingUrl: true },
  });

  for (const call of oldCalls) {
    if (call.recordingUrl) {
      await deleteAudioFile(call.recordingUrl);
      await db.call.update({ where: { id: call.id }, data: { recordingUrl: null } });
    }
  }
}
```
- **Verification:** Verify that recordings older than the retention period are deleted.

### 10.3 [MEDIUM] Audit Logs Retained Indefinitely

- **Severity:** MEDIUM
- **Location:** Prisma Schema: `AuditLog` model at `prisma/schema.prisma:320-336`
- **Description:** Audit logs have no retention limit. The table will grow unbounded.
- **Impact:** Performance degradation, compliance risk.
- **Remediation:** Implement a retention job to purge logs older than 1 year:
```typescript
await db.auditLog.deleteMany({
  where: { createdAt: { lte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
});
```
- **Verification:** Verify old audit logs are purged.

### 10.4 [MEDIUM] Consent Withdrawal Mechanism Missing

- **Severity:** MEDIUM
- **Location:** Prisma Schema: `User.consentAcceptedAt` at line 63
- **Description:** While `consentAcceptedAt` tracks when consent was given, there is **no mechanism for users to withdraw consent** and have their data deleted (beyond full account deletion). GDPR Article 7 gives users the right to withdraw consent at any time.
- **Impact:** GDPR non-compliance risk.
- **Remediation:** Add a "withdraw consent" flow that triggers data anonymization. Ensure users can withdraw consent without fully deleting their account.
- **Verification:** Test the consent withdrawal UX — verify data is anonymized.

### 10.5 [LOW] GDPR Export — Lacks Machine-Readable File Download

- **Severity:** LOW
- **Location:** `src/server/routers/user.ts:102-109`
- **Description:** The GDPR export returns JSON via tRPC. While JSON is machine-readable, GDPR Article 20 requires data portability in a "structured, commonly used and machine-readable format."
- **Impact:** Minor compliance gap.
- **Remediation:** Offer a downloadable file (CSV or JSON) via a dedicated API route with `Content-Disposition: attachment`.
- **Verification:** Verify the export can be downloaded as a file and opened in common tools.

---

## Summary of Severity Distribution

| Severity | Count | Key Issues |
|----------|-------|------------|
| CRITICAL | 3 | Twilio webhook validation missing; Rate-limiting fail-open; SSRF via recordingUrl |
| HIGH | 5 | No token refresh; Admin where clause injection; Phone in plaintext; Non-atomic Stripe transaction; Account anonymization reversible |
| MEDIUM | 14 | Account enumeration; Credits in JWT; CSRF gap; failCall idempotency; AI output unmoderated; ReDoS; Homoglyph bypass; No retention policy; Audit logs indefinite; Consent withdrawal missing; etc. |
| LOW | 8 | stripePaymentId in export; Prisma search performance; Unicode number bypass; Credit reconciliation edge case; Registration rate; False positives; GDPR portability; Twilio URL IDs |
| INFO | 3 | NextAuth beta; TwiML SDK safety; Race condition (minor) |

## Immediate Action Items (Priority Order)

1. **[CRITICAL]** Add Twilio request signature validation to ALL Twilio webhook endpoints (`/api/webhooks/twilio/*`)
2. **[CRITICAL]** Validate/restrict `RecordingUrl` origin to prevent SSRF (`src/app/api/webhooks/twilio/route.ts:152`)
3. **[CRITICAL]** Implement in-memory fallback rate limiter when Redis is unavailable (`src/server/middleware/rateLimit.ts`)
4. **[HIGH]** Add JWT token refresh/rotation with DB re-validation on session callback (`src/lib/auth.ts:67`)
5. **[HIGH]** Fix Stripe webhook to use callback-based `$transaction` (`src/app/api/webhooks/stripe/route.ts:61`)
6. **[HIGH]** Add `failCall` idempotency guard (`src/server/services/telephony/callLifecycle.ts:151`)
7. **[HIGH]** Add AI output content moderation for assistant responses (`src/server/services/ai/conversationEngine.ts`)
8. **[HIGH]** Encrypt phone numbers at rest or implement data retention policy (`prisma/schema.prisma:155`)
9. **[MEDIUM]** Fix admin `getAuditLogs` where clause typing (`src/server/routers/admin.ts:174`)
10. **[MEDIUM]** Apply NFKC normalization to content moderation input (`src/server/services/ai/moderation.ts`)

---

*End of Report — 30 findings across 10 security categories*
