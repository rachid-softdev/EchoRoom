import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import twilio from "twilio";
import { validateTwilioRequest, extractParams } from "../../validate";
import { checkWebhookRateLimit } from "../../../rateLimit";

const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * Twilio Media Streams endpoint — handles bidirectional audio streaming
 * between Twilio and the EchoRoom AI voice pipeline.
 *
 * == Current Behaviour (Phase 1 Stub) ==
 * Returns a static `<Hangup/>` TwiML response, which tells Twilio to
 * gracefully acknowledge the Media Streams connection request and end
 * the call. No real-time audio processing occurs at this stage.
 *
 * == Required Configuration ==
 * Environment variables needed for the full implementation:
 *   - DEEPGRAM_API_KEY             – Deepgram API key for live STT
 *   - OPENAI_API_KEY               – OpenAI API key for conversation engine
 *   - ELEVENLABS_API_KEY           – ElevenLabs API key for streaming TTS
 *   - ELEVENLABS_MODEL             – ElevenLabs model ID (e.g. "eleven_flash_v2_5")
 * Twilio side: Media Streams must be enabled on the TwiML Bin or Studio
 * Flow, pointing to this endpoint's URL.
 *
 * @todo Phase-3 — Implement WebSocket upgrade, Deepgram transcription,
 *       OpenAI conversation engine, and ElevenLabs streaming TTS.
 */
export async function GET(_req: Request) {
  const twiml = new VoiceResponse();
  twiml.hangup();
  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params = extractParams(formData);

  if (!validateTwilioRequest(req, params)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";

  if (!(await checkWebhookRateLimit("twilio:voice:stream", ip))) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  return GET(req);
}
