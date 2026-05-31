import twilio from "twilio";
import { env } from "@/lib/env";
import { createTwilioCircuitBreaker } from "@/server/lib/circuitBreaker";

export const twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, {
  timeout: 10000,
});
export const TWILIO_PHONE = env.TWILIO_PHONE_NUMBER;
export const twilioCircuitBreaker = createTwilioCircuitBreaker();
