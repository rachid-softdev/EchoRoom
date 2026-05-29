import type { NextRequest } from "next/server";
import twilio from "twilio";
import { env } from "@/lib/env";
import { createLogger } from "@/server/lib/logger";

const log = createLogger("twilio-validate");

export function validateTwilioRequest(
  req: NextRequest,
  params: Record<string, string>,
  url?: string,
): boolean {
  const signature = req.headers.get("x-twilio-signature");
  if (!signature) {
    log.warn("Missing x-twilio-signature header");
    return false;
  }

  const requestUrl = url ?? req.url;

  const isValid = (twilio as any).validateRequest(
    env.TWILIO_AUTH_TOKEN,
    signature,
    requestUrl,
    params,
  );

  if (!isValid) {
    log.warn("Invalid Twilio signature", {
      url: requestUrl,
      signaturePreview: signature.substring(0, 10) + "...",
    });
  }

  return isValid;
}

export function extractParams(formData: FormData): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      params[key] = value;
    }
  }
  return params;
}
