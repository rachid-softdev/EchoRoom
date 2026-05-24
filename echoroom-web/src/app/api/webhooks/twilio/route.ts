import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { db } from '@/server/db'
import { env } from '@/lib/env'
import { transcribeAudio } from '@/server/services/audio/transcription'
import {
  getConversationState,
  deleteConversationState,
  setConversationStatus,
} from '@/server/services/telephony/conversationState'
import { RECORDING_TURN_NUMBER } from '@/server/services/telephony/constants'
import { uploadAudioBuffer } from '@/server/services/audio/r2'
import { failCall } from '@/server/services/telephony/callLifecycle'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const callSid = formData.get('CallSid') as string | null
  const callStatus = formData.get('CallStatus') as string | null
  const callDuration = formData.get('CallDuration') as string | null
  const recordingUrl = formData.get('RecordingUrl') as string | null
  const recordingDuration = formData.get('RecordingDuration') as string | null
  const fromNumber = formData.get('From') as string | null

  // Log the status update
  console.log(
    `Twilio status webhook: CallSid=${callSid}, Status=${callStatus}, From=${fromNumber}, Duration=${callDuration}`,
  )

  if (!callSid) {
    return NextResponse.json({ status: 'ok' })
  }

  try {
    switch (callStatus) {
      case 'completed': {
        await handleCompletedCall(
          callSid,
          callDuration,
          recordingUrl,
          recordingDuration,
          fromNumber,
        )
        break
      }

      case 'busy':
      case 'no-answer':
      case 'failed':
      case 'canceled': {
        // Try to find the call record by twilioCallSid
        const callRecord = await db.call.findFirst({
          where: { twilioCallSid: callSid },
        })
        if (callRecord) {
          const duration = callDuration
            ? Number.parseInt(callDuration, 10)
            : 0
          await failCall(callRecord.id, duration)
        }
        await setConversationStatus(callSid, 'failed').catch(() => {})
        break
      }

      default: {
        // For 'ringing', 'in-progress', 'initiated' — update status
        let status:
          | 'PENDING'
          | 'RINGING'
          | 'ACTIVE'
          | 'COMPLETED'
          | 'FAILED'
          | 'BLOCKED' = 'PENDING'

        switch (callStatus) {
          case 'ringing':
            status = 'RINGING'
            break
          case 'in-progress':
            status = 'ACTIVE'
            break
        }

        if (status !== 'PENDING') {
          await db.call.updateMany({
            where: { twilioCallSid: callSid },
            data: { status },
          })
        }
        break
      }
    }
  } catch (error) {
    console.error('Error processing Twilio webhook:', error)
  }

  return NextResponse.json({ status: 'ok' })
}

async function handleCompletedCall(
  callSid: string,
  callDuration: string | null,
  recordingUrl: string | null,
  _recordingDuration: string | null,
  _fromNumber: string | null,
): Promise<void> {
  // Load conversation state from Redis
  const conversationState = await getConversationState(callSid)

  // Find the Call record in DB
  const callRecord = await db.call.findFirst({
    where: { twilioCallSid: callSid },
    include: {
      scenario: { select: { characterId: true } },
      user: { select: { id: true } },
    },
  })

  if (!callRecord) {
    console.warn(`No call record found for CallSid=${callSid}`)
    await setConversationStatus(callSid, 'completed').catch(() => {})
    await deleteConversationState(callSid).catch(() => {})
    return
  }

  // Build transcript from conversation state messages
  let transcript: Record<string, unknown> | null = null
  if (conversationState?.messages) {
    transcript = {
      messages: conversationState.messages
        .filter((m) => m.role !== 'system')
        .map((m, i) => ({
          id: i + 1,
          role: m.role,
          text: m.content,
        })),
      turnCount: conversationState.turnCount,
    }
  }

  // Fetch recording from Twilio if available and transcribe with Deepgram
  let deepgramTranscript: string | null = null
  let recordingR2Key: string | null = null

  if (recordingUrl) {
    try {
      const recordingResponse = await fetchRecordingAudio(recordingUrl)
      if (recordingResponse) {
        // Upload recording to R2 for long-term storage
        recordingR2Key = await uploadAudioBuffer(
          callSid,
          RECORDING_TURN_NUMBER,
          Buffer.from(recordingResponse),
          'audio/wav',
        )

        // Transcribe with Deepgram
        const transcriptionResult = await transcribeAudio(recordingResponse)
        if (transcriptionResult?.transcript) {
          deepgramTranscript = transcriptionResult.transcript
        }
      }
    } catch (error) {
      console.error('Failed to fetch/transcribe recording:', error)
    }
  }

  // Merge transcripts
  if (deepgramTranscript && transcript) {
    transcript.deepgramTranscript = deepgramTranscript
  } else if (deepgramTranscript) {
    transcript = { deepgramTranscript, messages: [] }
  }

  const duration = callDuration
    ? Number.parseInt(callDuration, 10)
    : conversationState?.messages
      ? Math.min(
          conversationState.messages.length * 30,
          600,
        )
      : 0

  // Update Call record
  await db.call.update({
    where: { id: callRecord.id },
    data: {
      status: 'COMPLETED',
      transcript: transcript as Prisma.InputJsonValue,
      recordingUrl: recordingR2Key,
      durationSeconds: duration,
      endedAt: new Date(),
    },
  })

  // Reconcile credits: charge per-minute rate based on actual duration
  const costCredits = Math.max(1, Math.ceil(duration / 60))
  const creditDiff = costCredits - callRecord.costCredits

  if (creditDiff > 0) {
    // Charge additional credits
    await db.user.update({
      where: { id: callRecord.userId },
      data: { credits: { decrement: creditDiff } },
    })
  } else if (creditDiff < 0) {
    // Refund unused credits
    await db.user.update({
      where: { id: callRecord.userId },
      data: { credits: { increment: Math.abs(creditDiff) } },
    })
  }

  // Update costCredits to reflect actual charge
  await db.call.update({
    where: { id: callRecord.id },
    data: { costCredits },
  })

  // Clean up conversation state from Redis
  await setConversationStatus(callSid, 'completed').catch(() => {})
  await deleteConversationState(callSid).catch(() => {})
}

async function fetchRecordingAudio(
  recordingUrl: string,
): Promise<ArrayBuffer | null> {
  try {
    // Twilio recording URLs require auth
    const auth = Buffer.from(
      `${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`,
    ).toString('base64')

    const response = await fetch(recordingUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    })

    if (!response.ok) {
      console.error(
        `Failed to fetch recording: ${response.status}`,
      )
      return null
    }

    return await response.arrayBuffer()
  } catch (error) {
    console.error('Error fetching recording:', error)
    return null
  }
}
