import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  userId?: string;
  source?: string; // "tRPC" | "webhook" | "cron"
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function getRequestId(): string {
  return asyncLocalStorage.getStore()?.requestId ?? "no-request-id";
}

export function runWithContext<T>(
  context: RequestContext,
  fn: () => Promise<T>,
): Promise<T> {
  return asyncLocalStorage.run(context, fn);
}
