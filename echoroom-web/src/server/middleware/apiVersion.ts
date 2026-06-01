import { TRPCError } from "@trpc/server";
import type { NextRequest } from "next/server";

/** Valid version identifiers that clients may request. */
const ALLOWED_VERSIONS = new Set(["v1", "v2", "latest"]);

export type ApiVersion = "v1" | "v2" | "latest";

/**
 * Resolves the API version from request headers.
 *
 * Resolution order (first match wins):
 * 1. `x-api-version` header
 * 2. `accept-version` header (legacy)
 * 3. Default: `"latest"`
 *
 * Validates the resolved version against the allowlist.
 * Returns `"latest"` if no valid version header is present.
 */
export function resolveApiVersion(req: NextRequest): ApiVersion {
  const headerVersion =
    req.headers.get("x-api-version")?.toLowerCase().trim() ??
    req.headers.get("accept-version")?.toLowerCase().trim() ??
    "";

  if (!headerVersion) return "latest";

  if (ALLOWED_VERSIONS.has(headerVersion)) {
    return headerVersion as ApiVersion;
  }

  // Unknown version header falls back to latest
  return "latest";
}

/**
 * Middleware-style validation that throws a tRPC error for invalid versions.
 */
export function validateApiVersionOrThrow(req: NextRequest): ApiVersion {
  const version = resolveApiVersion(req);

  if (version !== "latest" && !ALLOWED_VERSIONS.has(version)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Version d'API non supportée. Versions disponibles: ${[...ALLOWED_VERSIONS].join(", ")}`,
    });
  }

  return version;
}
