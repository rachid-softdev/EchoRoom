import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/server/rootRouter";

export const api = createTRPCReact<AppRouter>();
