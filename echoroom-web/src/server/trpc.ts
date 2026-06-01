import { randomUUID } from "node:crypto";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "./db";
import { checkRateLimit } from "./middleware/rateLimit";
import { checkContentBlocklist } from "./services/ai/moderation";
import { validateCSRF, CSRFFailure } from "./middleware/csrf";
import { createLogger } from "./lib/logger";
import { runWithContext } from "./lib/requestContext";
export { withIPRateLimit } from "./middleware/ipRateLimit";

const log = createLogger("trpc");

interface CreateContextOptions {
  req?: NextRequest;
  resHeaders?: Headers;
  info?: { remoteAddress?: string; connectionType?: string };
  apiVersion?: string;
}

export async function createTRPCContext(opts?: CreateContextOptions) {
  const session = await auth();

  // CSRF check for POST mutations
  if (opts?.req && opts.req.method === "POST") {
    try {
      validateCSRF(opts.req, {
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        trustedOrigins: parseTrustedOrigins(process.env.TRUSTED_ORIGINS),
        // In production, require Origin header (strict CSRF).
        // In development, allow missing Origin for mobile apps and tools.
        allowMissingOrigin: process.env.NODE_ENV !== "production",
      });
    } catch (error) {
      if (error instanceof CSRFFailure) {
        log.warn("CSRF rejection", {
          message: error.message,
          path: opts.req.nextUrl?.pathname,
          method: opts.req.method,
          origin: opts.req.headers.get("origin"),
          referer: opts.req.headers.get("referer"),
        });
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Requête rejetée — origine non autorisée",
        });
      }
      throw error;
    }
  }

  return {
    db,
    session,
    requestId: sanitizeRequestId(opts?.req?.headers.get("x-request-id")) ?? randomUUID(),
    headers: opts?.req?.headers ?? new Headers(),
    req: opts?.req,
    apiVersion: opts?.apiVersion,
  };
}

function parseTrustedOrigins(raw?: string): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

/** Sanitize and truncate client-supplied request IDs to prevent log bloat */
function sanitizeRequestId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.replace(/[^a-zA-Z0-9._~-]/g, "").substring(0, 64) || null;
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

export const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const mergeRouters = t.mergeRouters;
export const middleware = t.middleware;

/** Session guaranteed to exist (after isAuthenticated guard) */
export interface AuthenticatedSession {
  user: {
    id: string;
    email: string;
    username: string;
    role: "USER" | "ADMIN" | "MODERATOR";
    image: string | null;
  };
  expires: string;
}

/** Session guaranteed to be ADMIN role */
export interface AdminSession {
  user: {
    id: string;
    email: string;
    username: string;
    role: "ADMIN";
    image: string | null;
  };
  expires: string;
}

/** Context after isAuthenticated — session is guaranteed non-null */
export interface AuthenticatedTRPCContext extends Omit<TRPCContext, "session"> {
  session: AuthenticatedSession;
}

/** Context after isAdmin — role is guaranteed ADMIN */
export interface AdminTRPCContext extends Omit<TRPCContext, "session"> {
  session: AdminSession;
}

export const isAuthenticated = middleware(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Vous devez être connecté pour accéder à cette ressource",
    });
  }

  // Construct a properly typed session — after the guard, session.user is guaranteed non-null
  const session: AuthenticatedSession = {
    ...ctx.session,
    user: ctx.session.user as AuthenticatedSession["user"],
  };

  return next({
    ctx: {
      ...ctx,
      session,
    },
  });
});

export const isAdmin = middleware(({ ctx, next }) => {
  if (ctx.session?.user?.role !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Accès réservé aux administrateurs",
    });
  }

  return next();
});

interface RateLimitConfig {
  limit: number;
  window: number; // seconds
}

export function withRateLimit(config: RateLimitConfig) {
  return middleware(async ({ ctx, next, path }) => {
    const identifier = ctx.session?.user?.id
      ?? ctx.headers?.get("x-forwarded-for")
      ?? ctx.headers?.get("x-real-ip")
      ?? "anonymous";

    await checkRateLimit({
      identifier: `${path}:${identifier}`,
      limit: config.limit,
      window: config.window,
    });

    return next();
  });
}

const withTracing = middleware(({ ctx, next }) => {
  const requestId = ctx.requestId;
  const userId = ctx.session?.user?.id;
  return runWithContext(
    { requestId, userId, source: "tRPC" },
    () => next({ ctx: { ...ctx, requestId } }),
  );
});

const TEXT_FIELDS = [
  "title",
  "description",
  "openingMessage",
  "aiInstructions",
  "content",
  "reason",
  "name",
  "text",
] as const;

/** Extract text content from known text fields for content moderation. Exported for testing. */
export function extractTextFromInput(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const textParts = TEXT_FIELDS
    .map((field) => obj[field])
    .filter((v): v is string => typeof v === "string");
  return textParts.length > 0 ? textParts.join(" ") : null;
}

export const withContentModeration = middleware(async ({ ctx, next, input }) => {
  // Auth guard: prevent unauthenticated DoS
  if (!ctx.session?.user?.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required for content moderation",
    });
  }

  const text = extractTextFromInput(input);
  if (!text) return next();

  // Synchronous blocklist-only check — the full AI moderation runs async
  const blocklistResult = checkContentBlocklist(text);
  if (!blocklistResult.approved) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: blocklistResult.reason ?? "Contenu refusé par la modération",
    });
  }

  return next();
});

/**
 * API version negotiation middleware.
 *
 * Reads the X-API-Version header and sets ctx.apiVersion for procedures
 * that need to branch behavior based on the requested API version.
 *
 * Version resolution (highest priority first):
 * 1. X-API-Version header explicit value
 * 2. Path-based version (e.g., 'v1.scenarios.feed' -> 'v1')
 * 3. Default: 'latest'
 *
 * Usage in a procedure:
 * ```typescript
 * myProc: publicProcedure
 *   .use(withVersioning)
 *   .query(({ ctx }) => {
 *     if (ctx.apiVersion === 'v1') { handleLegacyBehavior(); }
 *   })
 * ```
 */
export const withVersioning = middleware(({ ctx, next, path }) => {
  // Detect version from path (e.g. 'v1.scenarios.feed' -> 'v1')
  const pathVersion = path.startsWith("v1.") ? "v1" : null;

  // Allow header override for testing/compatibility
  const headerVersion = ctx.headers?.get("x-api-version")?.toLowerCase() ?? null;

  const apiVersion = headerVersion ?? pathVersion ?? "latest";

  return next({
    ctx: {
      ...ctx,
      apiVersion,
    },
  });
});

export const publicProcedure = t.procedure.use(withTracing);
// Order: withTracing BEFORE isAuthenticated so the return type of the last
// middleware (isAuthenticated/isAdmin) propagates to the procedure handler.
// tRPC v11 beta does not carry narrowed context types through subsequent .use() calls.
export const protectedProcedure = t.procedure.use(withTracing).use(isAuthenticated);
export const adminProcedure = t.procedure.use(withTracing).use(isAuthenticated).use(isAdmin);

export { withTracing };
