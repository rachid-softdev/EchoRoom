import { type NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { env } from "@/lib/env";
import { createLogger } from "@/server/lib/logger";

export interface TwilioWebhookParams {
  callSid: string;
  callStatus: string | null;
  callDuration: string | null;
  recordingUrl: string | null;
  recordingDuration: string | null;
  fromNumber: string | null;
  speechResult: string | null;
  raw: Record<string, string>;
}

type TwilioHandler = (req: NextRequest, params: TwilioWebhookParams) => Promise<NextResponse>;

export function wrapTwilioWebhook(
  rateLimitKey: string,
  handler: TwilioHandler,
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest): Promise<NextResponse> => {
    // 1. Body size enforcement (50KB)
    const contentLength = Number.parseInt(req.headers.get("content-length") ?? "0", 10);
    if (contentLength > 50_000) {
      return NextResponse.json({ error: "Requête trop volumineuse" }, { status: 413 });
    }

    // 2. IP extraction
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    // 3. Rate limiting
    try {
      const { checkWebhookRateLimit } = await import("@/app/api/webhooks/rateLimit");
      if (!(await checkWebhookRateLimit(rateLimitKey, ip))) {
        return NextResponse.json(
          { error: "Trop de requêtes" },
          { status: 429, headers: { "Retry-After": "60" } },
        );
      }
    } catch (error) {
      const log = createLogger("twilio-middleware");
      log.warn("Webhook rate limit check failed - allowing request through", { error });
    }

    // 4. Parse form data
    const formData = await req.formData();
    const rawParams: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") rawParams[key] = value;
    }

    // 5. Validate Twilio signature
    const signature = req.headers.get("x-twilio-signature");
    if (!signature) {
      return NextResponse.json({ error: "Signature manquante" }, { status: 403 });
    }

    const log = createLogger("twilio-middleware");
    const isValid = twilio.validateRequest(env.TWILIO_AUTH_TOKEN, signature, req.url, rawParams);
    if (!isValid) {
      log.warn("Signature Twilio invalide", {
        url: req.url,
        signaturePreview: `${signature.substring(0, 10)}...`,
      });
      return NextResponse.json({ error: "Signature invalide" }, { status: 403 });
    }

    // 6. Extract typed params
    const params: TwilioWebhookParams = {
      callSid: (formData.get("CallSid") as string) ?? "",
      callStatus: formData.get("CallStatus") as string | null,
      callDuration: formData.get("CallDuration") as string | null,
      recordingUrl: formData.get("RecordingUrl") as string | null,
      recordingDuration: formData.get("RecordingDuration") as string | null,
      fromNumber: formData.get("From") as string | null,
      speechResult: formData.get("SpeechResult") as string | null,
      raw: rawParams,
    };

    return handler(req, params);
  };
}
