/**
 * v2 Root Router — compatibility bridge for the v2 API contract.
 *
 * v2 routers are functionally identical to their unversioned counterparts
 * at the time of the v2 freeze. They serve as a snapshot that won't receive
 * breaking changes, allowing clients to migrate at their own pace.
 *
 * New features and improvements should be added to the unversioned routers
 * (which represent "latest") and optionally backported to future versions.
 */
import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { charactersRouter } from "./routers/characters";
import { scenariosRouter } from "./routers/scenarios";
import { callsRouter } from "./routers/calls";
import { billingRouter } from "./routers/billing";
import { communityRouter } from "./routers/community";
import { adminRouter } from "./routers/admin";
import { socialRouter } from "./routers/social";
import { userRouter } from "./routers/user";
import { dashboardRouter } from "./routers/dashboard";

export const appRouterV2 = router({
  auth: authRouter,
  characters: charactersRouter,
  scenarios: scenariosRouter,
  calls: callsRouter,
  billing: billingRouter,
  community: communityRouter,
  admin: adminRouter,
  social: socialRouter,
  user: userRouter,
  dashboard: dashboardRouter,
});

export type AppRouterV2 = typeof appRouterV2;
