import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "./db";
import { checkRateLimit } from "./middleware/rateLimit";
import { checkContent } from "./services/ai/moderation";
export { withIPRateLimit } from "./middleware/ipRateLimit";

interface CreateContextOptions {
  req?: NextRequest;
  resHeaders?: Headers;
  info?: { remoteAddress?: string; connectionType?: string };
}

export async function createTRPCContext(opts?: CreateContextOptions) {
  const session = await auth();

  return {
    db,
    session,
    headers: opts?.req?.headers ?? new Headers(),
    req: opts?.req,
  };
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

const isAuthenticated = middleware(({ ctx, next }) => {
  if (!ctx.session?.user?.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Vous devez être connecté pour accéder à cette ressource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: {
        ...ctx.session,
        user: ctx.session.user as {
          id: string;
          email: string;
          username: string;
          role: "USER" | "ADMIN" | "MODERATOR";
          credits: number;
          image: string | null;
        },
      },
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

  return next({ ctx });
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

    return next({ ctx });
  });
}

function extractTextFromInput(input: unknown): string | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  if (typeof obj.title === "string" && typeof obj.description === "string") {
    return [obj.title, obj.description, obj.openingMessage, obj.aiInstructions]
      .filter((v): v is string => typeof v === "string")
      .join(" ");
  }
  if (typeof obj.content === "string") {
    return obj.content;
  }
  return null;
}

export const withContentModeration = middleware(async ({ ctx, next, input }) => {
  const text = extractTextFromInput(input);
  if (!text) return next({ ctx });

  const result = await checkContent(text);
  if (!result.approved) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: result.reason ?? "Contenu refusé par la modération",
    });
  }

  return next({ ctx });
});

export const protectedProcedure = t.procedure.use(isAuthenticated);
export const adminProcedure = t.procedure.use(isAuthenticated).use(isAdmin);
