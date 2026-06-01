import { t, withTracing, isAuthenticated, isAdmin } from "./trpc";
import { withREDMetrics } from "./middleware/metrics";

export * from "./trpc";

/**
 * tRPC procedures with RED (Rate/Errors/Duration) metrics middleware wired in.
 *
 * Order: withTracing BEFORE isAuthenticated so the return type of the last
 * middleware (isAuthenticated/isAdmin) propagates to the procedure handler.
 * tRPC v11 beta does not carry narrowed context types through subsequent .use() calls.
 */
export const publicProcedure = t.procedure.use(withTracing).use(withREDMetrics);
export const protectedProcedure = t.procedure.use(withTracing).use(withREDMetrics).use(isAuthenticated);
export const adminProcedure = t.procedure.use(withTracing).use(withREDMetrics).use(isAuthenticated).use(isAdmin);
