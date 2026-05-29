import { NextResponse } from "next/server";

/**
 * Twilio Media Streams endpoint — handles bidirectional audio streaming
 * between Twilio and the EchoRoom AI voice pipeline.
 *
 * == Current Behaviour (Phase 1 Stub) ==
 * Returns a static `<Hangup/>` TwiML response, which tells Twilio to
 * gracefully acknowledge the Media Streams connection request and end
 * the call. No real-time audio processing occurs at this stage.
 *
 * == Why This Is a Stub ==
 * Phase 1 establishes the voice-call infrastructure (call routing, state
 * management, greeting generation) via the parent `/api/webhooks/twilio/voice`
 * and `handle-input` routes. The Media Streams endpoint is reserved for
 * future bidirectional streaming and is intentionally inert until Phase 3.
 *
 * == Full Implementation — Phase 3 ==
 * The completed endpoint will negotiate a WebSocket upgrade with Twilio
 * Media Streams and orchestrate a real-time voice pipeline:
 *   1. WebSocket upgrade            – Connect to Twilio Media Streams
 *   2. Deepgram live transcription  – Convert inbound audio to text
 *   3. OpenAI conversation engine   – Generate character responses in real time
 *   4. ElevenLabs streaming TTS     – Stream synthesised speech back to the call
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
 * == Related Files ==
 * @see src/server/services/audio/transcription.ts       — Deepgram STT service
 * @see src/server/services/audio/tts.ts                 — ElevenLabs TTS service
 * @see src/server/services/ai/conversationEngine.ts     — OpenAI conversation engine
 *
 * @todo Phase-3 — Implement WebSocket upgrade, Deepgram transcription,
 *       OpenAI conversation engine, and ElevenLabs streaming TTS.
 */
export async function GET(_req: Request) {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup/>
</Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(req: Request) {
  return GET(req);
}
