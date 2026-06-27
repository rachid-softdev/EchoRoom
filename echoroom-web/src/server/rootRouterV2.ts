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
import { router } from "./trpc";

export const appRouterV2 = router({
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
});

export type AppRouterV2 = typeof appRouterV2;
