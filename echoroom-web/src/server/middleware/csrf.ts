import type { NextRequest } from "next/server";

export interface CSRFConfig {
  appUrl: string;
  trustedOrigins?: string[];
  allowMissingOrigin?: boolean;
}

export class CSRFFailure extends Error {
  constructor(
    public readonly reason: string,
    public readonly origin: string | null,
  ) {
    super(`CSRF validation failed: ${reason}`);
    this.name = "CSRFFailure";
  }
}

export function isOriginAllowed(origin: string, config: CSRFConfig): boolean {
  try {
    const originUrl = new URL(origin);
    const appUrlObj = new URL(config.appUrl);

    // Allow same origin
    if (originUrl.origin === appUrlObj.origin) return true;

    // Allow trusted origins
    if (config.trustedOrigins) {
      for (const trusted of config.trustedOrigins) {
        try {
          const trustedUrl = new URL(trusted);
          if (originUrl.origin === trustedUrl.origin) return true;
        } catch {
          // Ignore invalid trusted origin URLs
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

export function validateCSRF(req: NextRequest, config: CSRFConfig): void {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  let sourceOrigin: string | null = origin;
  if (!sourceOrigin && referer) {
    try {
      sourceOrigin = new URL(referer).origin;
    } catch {
      // Malformed referer URL — treat as missing origin
      sourceOrigin = null;
    }
  }

  if (!sourceOrigin) {
    // No origin header — allow (non-browser clients: curl, mobile apps, SSR)
    // Log warning in production for observability
    if (!config.allowMissingOrigin) {
      throw new CSRFFailure("Missing origin header", null);
    }
    return;
  }

  if (!isOriginAllowed(sourceOrigin, config)) {
    throw new CSRFFailure(`Origin not allowed: ${sourceOrigin}`, sourceOrigin);
  }
}
