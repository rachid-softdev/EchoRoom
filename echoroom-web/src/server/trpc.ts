import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "./db";
import { checkRateLimit } from "./middleware/rateLimit";
import { checkContent } from "./services/ai/moderation";
import { validateCSRF, CSRFFailure } from "./middleware/csrf";
import { createLogger } from "./lib/logger";
export { withIPRateLimit } from "./middleware/ipRateLimit";

const log = createLogger("trpc");

interface CreateContextOptions {
  req?: NextRequest;
  resHeaders?: Headers;
  info?: { remoteAddress?: string; connectionType?: string };
}

export async function createTRPCContext(opts?: CreateContextOptions) {
  const session = await auth();

  // CSRF check for POST mutations
  if (opts?.req && opts.req.method === "POST") {
    try {
      validateCSRF(opts.req, {
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        trustedOrigins: parseTrustedOrigins(process.env.TRUSTED_ORIGINS),
        allowMissingOrigin: true,
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
    headers: opts?.req?.headers ?? new Headers(),
    req: opts?.req,
  };
}

function parseTrustedOrigins(raw?: string): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
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
export const publicProcedure = t.procedure;

/** Session guaranteed to exist (after isAuthenticated guard) */
export interface AuthenticatedSession {
  user: {
    id: string;
    email: string;
    username: string;
    role: "USER" | "ADMIN" | "MODERATOR";
    credits: number;
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
    credits: number;
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

const isAuthenticated = middleware(({ ctx, next }) => {
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

const isAdmin = middleware(({ ctx, next }) => {
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

function extractTextFromInput(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const textParts = TEXT_FIELDS
    .map((field) => obj[field])
    .filter((v): v is string => typeof v === "string");
  return textParts.length > 0 ? textParts.join(" ") : null;
}

export const withContentModeration = middleware(async ({ next, input }) => {
  const text = extractTextFromInput(input);
  if (!text) return next();

  const result = await checkContent(text);
  if (!result.approved) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: result.reason ?? "Contenu refusé par la modération",
    });
  }

  return next();
});

export const protectedProcedure = t.procedure.use(isAuthenticated);
export const adminProcedure = t.procedure.use(isAuthenticated).use(isAdmin);
