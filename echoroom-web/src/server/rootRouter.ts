import { adminRouter } from "./routers/admin";
import { authRouter } from "./routers/auth";
import { billingRouter } from "./routers/billing";
import { callsRouter } from "./routers/calls";
import { charactersRouter } from "./routers/characters";
import { clipsRouter } from "./routers/clips";
import { communityRouter } from "./routers/community";
import { dashboardRouter } from "./routers/dashboard";
import { profileRouter } from "./routers/profile";
import { scenariosRouter } from "./routers/scenarios";
import { socialRouter } from "./routers/social";
import { userRouter } from "./routers/user";
import {
  adminV1Router,
  authV1Router,
  billingV1Router,
  callsV1Router,
  charactersV1Router,
  clipsV1Router,
  communityV1Router,
  dashboardV1Router,
  profileV1Router,
  scenariosV1Router,
  socialV1Router,
  userV1Router,
} from "./routers/v1";
import { router } from "./trpc";

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
    auth: authV1Router,
    characters: charactersV1Router,
    calls: callsV1Router,
    billing: billingV1Router,
    community: communityV1Router,
    admin: adminV1Router,
    social: socialV1Router,
    clips: clipsV1Router,
    profile: profileV1Router,
    user: userV1Router,
    dashboard: dashboardV1Router,
  }),
});

export type AppRouter = typeof appRouter;
