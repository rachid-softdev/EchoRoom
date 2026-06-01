import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import { appRouter } from "@/server/rootRouter";
import { appRouterV2 } from "@/server/rootRouterV2";
import { createTRPCContext } from "@/server/trpc";
import { createLogger } from "@/server/lib/logger";
import { resolveApiVersion } from "@/server/middleware/apiVersion";

const log = createLogger("trpc-handler");

const handler = (req: NextRequest) => {
  // Resolve API version from request headers
  const apiVersion = resolveApiVersion(req);

  // Select the appropriate router based on version
  const router = apiVersion === "v2" ? appRouterV2 : appRouter;

  if (apiVersion !== "latest") {
    log.info("Versioned request", { version: apiVersion, path: req.nextUrl.pathname });
  }

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router,
    createContext: () =>
      createTRPCContext({ req, apiVersion }),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            log.error("tRPC failed", { path: path ?? "<no-path>", version: apiVersion, message: error.message });
          }
        : undefined,
  });
};

export { handler as GET, handler as POST };
