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

export const appRouter = router({
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

export type AppRouter = typeof appRouter;
