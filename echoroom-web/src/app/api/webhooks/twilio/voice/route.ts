import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import twilio from "twilio";
import { db } from "@/server/db";
import { createLogger } from "@/server/lib/logger";
import { createTwilioToken, verifyTwilioToken } from "@/server/lib/twilioToken";
import { generateResponse } from "@/server/services/ai/conversationEngine";
import { uploadAudioBuffer } from "@/server/services/audio/r2";
import { ttsClient } from "@/server/services/audio/tts";
import { ELEVENLABS_MODEL } from "@/server/services/telephony/constants";
import { initConversationState } from "@/server/services/telephony/conversationState";
import { buildSystemPrompt } from "@/server/services/telephony/prompts";
import { checkWebhookRateLimit } from "../../rateLimit";
import { extractParams, validateTwilioRequest } from "../validate";

const log = createLogger("voice");

const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * GET handler — simple health check.
 * Always returns { active: false } regardless of any token.
 * This prevents conversation state leakage via stale/exposed HMAC tokens.
 * Full conversation status is only available via authenticated tRPC endpoints.
 */
export async function GET(_req: NextRequest) {
  return NextResponse.json({ active: false });
}

/**
 * POST handler — called by Twilio when a call is answered.
 * Returns TwiML with a greeting and speech gathering for the conversation.
 */
export async function POST(req: NextRequest) {
  // Enforce body size limit (50KB for Twilio webhooks)
  const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (contentLength > 50_000) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!(await checkWebhookRateLimit("twilio:voice:init", ip))) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const { searchParams } = new URL(req.url);
  const formData = await req.formData();
  const params = extractParams(formData);

  // Twilio webhook signature validation
  if (!validateTwilioRequest(req, params)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const callSid = (formData.get("CallSid") as string) ?? "";
  const fromNumber = (formData.get("From") as string) ?? "";

  // Resolve scenario and character — prefer opaque token over raw query params
  let scenarioId = "";
  let characterId = "";
  let callId: string | undefined;
  let resolvedScenario: {
    character: {
      name: string;
      description: string | null;
      promptSystem: string;
      elevenLabsVoiceId: string;
    };
    aiInstructions: string;
    description: string | null;
  } | null = null;
  const token = searchParams.get("token");

  if (token) {
    const payload = verifyTwilioToken(token);
    if (payload) {
      callId = payload.callId;
      scenarioId = payload.scenarioId;

      // Resolve characterId from the scenario
      try {
        const scenario = await db.scenario.findUnique({
          where: { id: scenarioId },
          include: { character: true },
        });
        if (scenario) {
          characterId = scenario.characterId;
          resolvedScenario = scenario;

          // Update call status to ACTIVE
          await db.call
            .update({
              where: { id: callId },
              data: { status: "ACTIVE" },
            })
            .catch(() => {});
        }
      } catch (error) {
        log.error("Failed to resolve scenario from token", { error });
      }
    } else {
      log.warn("Invalid or expired Twilio token");
    }
  } else {
    // Safer fallback: resolve from DB using only twilioCallSid (no raw query params)
    try {
      const callRecord = await db.call.findFirst({
        where: { twilioCallSid: callSid },
        include: { scenario: { include: { character: true } } },
      });

      if (callRecord) {
        callId = callRecord.id;
        scenarioId = callRecord.scenarioId;
        characterId = callRecord.scenario.characterId;
        resolvedScenario = callRecord.scenario;

        // Update call status to ACTIVE
        await db.call
          .update({
            where: { id: callRecord.id },
            data: { status: "ACTIVE" },
          })
          .catch(() => {});
      }
    } catch (error) {
      log.error("Failed to load call record from twilioCallSid", { error });
    }
  }

  // Load scenario + character from previously resolved data if available
  let characterName = "AI Character";
  let voiceId = "";
  let systemPrompt = "";

  if (resolvedScenario) {
    characterName = resolvedScenario.character.name;
    voiceId = resolvedScenario.character.elevenLabsVoiceId;
    systemPrompt = buildSystemPrompt(resolvedScenario);
  } else if (scenarioId) {
    try {
      const scenario = await db.scenario.findUnique({
        where: { id: scenarioId },
        include: { character: true },
      });

      if (scenario) {
        characterName = scenario.character.name;
        voiceId = scenario.character.elevenLabsVoiceId;
        systemPrompt = buildSystemPrompt(scenario);
      }
    } catch (error) {
      log.error("Failed to load scenario", { error });
      systemPrompt = "Tu es un assistant IA amical. Réponds en français de manière naturelle.";
    }
  } else {
    systemPrompt = "Tu es un assistant IA amical. Réponds en français de manière naturelle.";
  }

  // Generate greeting via conversation engine
  let greeting = `Bonjour, vous êtes en ligne avec ${characterName}.`;
  try {
    const result = await generateResponse({
      systemPrompt,
      messages: [],
      maxTokens: 150,
    });
    greeting = result.response;
  } catch (error) {
    log.error("Failed to generate greeting", { error });
  }

  // Initialize conversation state in Redis (system prompt stored separately)
  await initConversationState(callSid, {
    callSid,
    callId: callId ?? callSid, // DB UUID if available, fallback to Twilio SID
    scenarioId: scenarioId || "unknown",
    characterId: characterId || "unknown",
    callerNumber: fromNumber,
    systemPrompt, // Stored in dedicated field (not in messages[])
    messages: [{ role: "assistant", content: greeting }],
  });

  // Synthesize greeting with ElevenLabs and upload to R2
  let audioUrl = "";
  if (ttsClient && voiceId) {
    try {
      const audioStream = await ttsClient.textToSpeech.convert(voiceId, {
        text: greeting,
        model_id: ELEVENLABS_MODEL,
        output_format: "ulaw_8000",
      });

      const chunks: Uint8Array[] = [];
      for await (const chunk of audioStream) {
        chunks.push(chunk);
      }
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      audioUrl = await uploadAudioBuffer(callSid, 0, Buffer.from(combined), "audio/mulaw");
    } catch (error) {
      log.error("Failed to synthesize greeting", { error });
    }
  }

  // Build TwiML response
  const twiml = new VoiceResponse();

  if (audioUrl) {
    twiml.play({}, audioUrl);
  } else {
    twiml.say({ voice: "alice", language: "fr-FR" }, greeting);
  }

  const handleInputToken = createTwilioToken(
    callId ?? "unknown",
    scenarioId || "unknown",
    characterId || "unknown",
  );
  const actionUrl = `/api/webhooks/twilio/voice/handle-input?token=${encodeURIComponent(handleInputToken)}`;

  twiml.gather({
    input: ["speech"],
    speechTimeout: "auto",
    speechModel: "experimental_utterances",
    enhanced: true,
    action: actionUrl,
    method: "POST",
  });

  return new NextResponse(twiml.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
