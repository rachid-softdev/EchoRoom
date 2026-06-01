import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { charactersRouter } from "./routers/characters";
import { scenariosRouter } from "./routers/scenarios";
import { callsRouter } from "./routers/calls";
import { billingRouter } from "./routers/billing";
import { communityRouter } from "./routers/community";
import { adminRouter } from "./routers/admin";
import { socialRouter } from "./routers/social";
import { clipsRouter } from "./routers/clips";
import { profileRouter } from "./routers/profile";
import { userRouter } from "./routers/user";
import { dashboardRouter } from "./routers/dashboard";
import { scenariosV1Router } from "./routers/v1";

/**
 * Versioned API namespace — frozen v1 contracts for backward compatibility.
 *
 * Clients can migrate to versioned endpoints by prefixing their tRPC calls
 * with "v1." (e.g. `api.v1.scenarios.feed.useQuery(...)`).
 *
 * Version negotiation:
 * - Unversioned routes (e.g. `api.scenarios.feed`) continue to work and receive
 *   the latest stable shape.
 * - Versioned routes (e.g. `api.v1.scenarios.feed`) are frozen snapshots
 *   that will never break.
 * - New versions (v2+) can be added alongside without disrupting existing clients.
 */
export const appRouter = router({
  auth: authRouter,
  characters: charactersRouter,
  scenarios: scenariosRouter,
  calls: callsRouter,
  billing: billingRouter,
  community: communityRouter,
  admin: adminRouter,
  social: socialRouter,
  clips: clipsRouter,
  profile: profileRouter,
  user: userRouter,
  dashboard: dashboardRouter,

  // Versioned API namespace
  v1: router({
    scenarios: scenariosV1Router,
  }),
});

export type AppRouter = typeof appRouter;
