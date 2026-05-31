import type { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import twilio from "twilio";
import { env } from "@/lib/env";
import { db } from "@/server/db";
import { createLogger } from "@/server/lib/logger";
import { uploadAudioBuffer } from "@/server/services/audio/r2";
import { transcribeAudio } from "@/server/services/audio/transcription";
import { failCall } from "@/server/services/telephony/callLifecycle";
import { RECORDING_TURN_NUMBER } from "@/server/services/telephony/constants";
import {
  deleteConversationState,
  getConversationState,
  setConversationStatus,
} from "@/server/services/telephony/conversationState";
import { checkWebhookRateLimit } from "../rateLimit";
import { extractParams, validateTwilioRequest } from "./validate";

const log = createLogger("twilio-webhook");

const twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

/** Defense-in-depth: validate that RecordingUrl points to a legitimate Twilio endpoint. */
function isValidTwilioRecordingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "api.twilio.com" || parsed.hostname.endsWith(".twilio.com")) &&
      parsed.pathname.startsWith("/2010-04-01/Accounts/") &&
      parsed.pathname.includes("/Recordings/")
    );
  } catch {
    return false;
  }
}

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

  if (!(await checkWebhookRateLimit("twilio:status", ip))) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const formData = await req.formData();
  const params = extractParams(formData);

  // Twilio webhook signature validation
  if (!validateTwilioRequest(req, params)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }
  const callSid = formData.get("CallSid") as string | null;
  const callStatus = formData.get("CallStatus") as string | null;
  const callDuration = formData.get("CallDuration") as string | null;
  const recordingUrl = formData.get("RecordingUrl") as string | null;
  const recordingDuration = formData.get("RecordingDuration") as string | null;
  const fromNumber = formData.get("From") as string | null;

  // Log the status update
  log.info("Twilio status webhook", { callSid, callStatus, fromNumber, callDuration });

  if (!callSid) {
    return NextResponse.json({ status: "ok" });
  }

  try {
    switch (callStatus) {
      case "completed": {
        await handleCompletedCall(
          callSid,
          callDuration,
          recordingUrl,
          recordingDuration,
          fromNumber,
        );
        break;
      }

      case "busy":
      case "no-answer":
      case "failed":
      case "canceled": {
        // Try to find the call record by twilioCallSid
        const callRecord = await db.call.findUnique({
          where: { twilioCallSid: callSid },
        });
        if (callRecord) {
          const duration = callDuration ? Number.parseInt(callDuration, 10) : 0;
          await failCall(callRecord.id, duration);
        }
        await setConversationStatus(callSid, "failed").catch(() => {});
        break;
      }

      default: {
        // For 'ringing', 'in-progress', 'initiated' — update status
        let status: "PENDING" | "RINGING" | "ACTIVE" | "COMPLETED" | "FAILED" | "BLOCKED" =
          "PENDING";

        switch (callStatus) {
          case "ringing":
            status = "RINGING";
            break;
          case "in-progress":
            status = "ACTIVE";
            break;
        }

        if (status !== "PENDING") {
          await db.call.updateMany({
            where: { twilioCallSid: callSid },
            data: { status },
          });
        }
        break;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("Error processing Twilio webhook", { error: message });
    // Return 500 so Twilio retries on transient failures
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}

async function handleCompletedCall(
  callSid: string,
  callDuration: string | null,
  recordingUrl: string | null,
  _recordingDuration: string | null,
  _fromNumber: string | null,
): Promise<void> {
  // Load conversation state from Redis
  const conversationState = await getConversationState(callSid);

  // Find the Call record in DB
  const callRecord = await db.call.findUnique({
    where: { twilioCallSid: callSid },
    include: {
      scenario: { select: { characterId: true } },
      user: { select: { id: true } },
    },
  });

  if (!callRecord) {
    log.warn("No call record found for CallSid", { callSid });
    await setConversationStatus(callSid, "completed").catch(() => {});
    await deleteConversationState(callSid).catch(() => {});
    return;
  }

  // Idempotency: skip if call is already completed or failed.
  // This prevents a completed webhook from overwriting a FAILED status
  // that was set by failCall() (e.g., from a "busy" status webhook arriving
  // before the final "completed" status).
  if (callRecord && (callRecord.status === "COMPLETED" || callRecord.status === "FAILED")) {
    log.info("Call already completed/failed, skipping duplicate webhook", {
      callSid,
      status: callRecord.status,
    });
    return;
  }

  // Build transcript from conversation state messages
  let transcript: Record<string, unknown> | null = null;
  if (conversationState?.messages) {
    transcript = {
      messages: conversationState.messages
        .filter((m) => m.role !== "system")
        .map((m, i) => ({
          id: i + 1,
          role: m.role,
          text: m.content,
        })),
      turnCount: conversationState.turnCount,
    };
  }

  // Fetch recording from Twilio if available and transcribe with Deepgram
  let deepgramTranscript: string | null = null;
  let recordingR2Key: string | null = null;

  if (recordingUrl) {
    // Defense-in-depth: validate the recording URL origin
    if (!isValidTwilioRecordingUrl(recordingUrl)) {
      log.warn("Invalid RecordingUrl origin — skipping recording fetch", {
        recordingUrl,
      });
    } else {
      try {
        const recordingResponse = await fetchRecordingAudio(recordingUrl);
        if (recordingResponse) {
          // Upload recording to R2 for long-term storage
          recordingR2Key = await uploadAudioBuffer(
            callSid,
            RECORDING_TURN_NUMBER,
            Buffer.from(recordingResponse),
            "audio/wav",
          );

          // Transcribe with Deepgram
          const transcriptionResult = await transcribeAudio(recordingResponse);
          if (transcriptionResult?.transcript) {
            deepgramTranscript = transcriptionResult.transcript;
          }
        }
      } catch (error) {
        log.error("Failed to fetch/transcribe recording", { error });
      }
    }
  }

  // Merge transcripts
  if (deepgramTranscript && transcript) {
    transcript.deepgramTranscript = deepgramTranscript;
  } else if (deepgramTranscript) {
    transcript = { deepgramTranscript, messages: [] };
  }

  const duration = callDuration
    ? Number.parseInt(callDuration, 10)
    : conversationState?.messages
      ? Math.min(conversationState.messages.length * 30, 600)
      : 0;

  // Atomic update of call record + credit reconcile
  await db.$transaction(async (tx) => {
    // Double-check status within the transaction
    const currentCall = await tx.call.findUnique({
      where: { id: callRecord.id },
      select: { status: true, costCredits: true },
    });

    if (currentCall?.status === "COMPLETED" || currentCall?.status === "FAILED") {
      log.info("Call already completed/failed, detected in transaction, skipping", {
        callSid,
        status: currentCall.status,
      });
      return;
    }

    const costCredits = Math.max(1, Math.ceil(duration / 60));
    const creditDiff = costCredits - (currentCall?.costCredits ?? callRecord.costCredits);

    // Check credits BEFORE marking completed
    if (creditDiff > 0) {
      const result = await tx.user.updateMany({
        where: {
          id: callRecord.userId,
          credits: { gte: creditDiff },
        },
        data: { credits: { decrement: creditDiff } },
      });
      if (result.count === 0) {
        // Insufficient credits — fail the call instead of completing it
        await tx.call.update({
          where: { id: callRecord.id },
          data: {
            status: "FAILED",
            endedAt: new Date(),
          },
        });
        log.error("Insufficient credits to reconcile — call marked as FAILED", {
          userId: callRecord.userId,
          creditDiff,
        });
        return;
      }
    } else if (creditDiff < 0) {
      // Refund excess credits (use updateMany for consistency)
      await tx.user.updateMany({
        where: { id: callRecord.userId },
        data: { credits: { increment: Math.abs(creditDiff) } },
      });
    }

    // Only mark as COMPLETED after successful credit check/refund
    await tx.call.update({
      where: { id: callRecord.id },
      data: {
        status: "COMPLETED",
        transcript: transcript as Prisma.InputJsonValue,
        recordingUrl: recordingR2Key,
        durationSeconds: duration,
        endedAt: new Date(),
        costCredits,
      },
    });
  });

  // Clean up conversation state from Redis
  await setConversationStatus(callSid, "completed").catch(() => {});
  await deleteConversationState(callSid).catch(() => {});
}

async function fetchRecordingAudio(recordingUrl: string): Promise<ArrayBuffer | null> {
  try {
    // Use Twilio's built-in request client which signs requests automatically.
    // This avoids embedding credentials in HTTP headers (Basic Auth),
    // preventing credential leakage via redirects or log exposure.
    const response = await twilioClient.request({
      method: "get",
      uri: recordingUrl,
    });

    if (response.statusCode !== 200) {
      log.error("Failed to fetch recording via Twilio SDK", { status: response.statusCode });
      return null;
    }

    // response.body contains the audio data (Buffer)
    if (response.body instanceof Buffer) {
      return response.body.buffer.slice(
        response.body.byteOffset,
        response.body.byteOffset + response.body.byteLength,
      ) as ArrayBuffer;
    }
    if (response.body instanceof ArrayBuffer) {
      return response.body;
    }
    if (typeof response.body === "string") {
      return new TextEncoder().encode(response.body).buffer as ArrayBuffer;
    }
    log.warn("Unexpected Twilio SDK response body type", { type: typeof response.body });
    return null;
  } catch (error) {
    log.error("Error fetching recording via Twilio SDK", { error });
    return null;
  }
}
