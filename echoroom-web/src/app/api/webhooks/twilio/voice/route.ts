import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import twilio from 'twilio'
import { db } from '@/server/db'
import { generateResponse } from '@/server/services/ai/conversationEngine'
import { ttsClient } from '@/server/services/audio/tts'
import {
  initConversationState,
  getConversationState,
} from '@/server/services/telephony/conversationState'
import { ELEVENLABS_MODEL } from '@/server/services/telephony/constants'
import { uploadAudioBuffer } from '@/server/services/audio/r2'
import { createLogger } from '@/server/lib/logger'
import { validateTwilioRequest, extractParams } from '../validate'
import { verifyTwilioToken } from '@/server/lib/twilioToken'

const log = createLogger('voice')

const VoiceResponse = twilio.twiml.VoiceResponse

/**
 * GET handler — minimal health check.
 *
 * Without a valid token, returns only `{ active: boolean }` to prevent
 * leaking conversation details. If a valid HMAC token is provided via
 * the `token` query param (for future internal tools), returns richer
 * data including status and turnCount (but NEVER messages).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  // Authenticated requests via HMAC token get richer data
  if (token) {
    const payload = verifyTwilioToken(token)
    if (!payload) {
      return NextResponse.json({ active: false, reason: 'invalid_token' }, { status: 403 })
    }

    const state = await getConversationState(payload.callId)
    if (!state) {
      return NextResponse.json({ active: false, reason: 'not_found' })
    }

    return NextResponse.json({
      active: state.status === 'active',
      status: state.status,
      turnCount: state.turnCount,
    })
  }

  // Unauthenticated requests: minimal info only
  return NextResponse.json({ active: false })
}

/**
 * POST handler — called by Twilio when a call is answered.
 * Returns TwiML with a greeting and speech gathering for the conversation.
 */
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const formData = await req.formData()
  const params = extractParams(formData)

  // Twilio webhook signature validation
  if (!validateTwilioRequest(req, params)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
  }

  const callSid = (formData.get('CallSid') as string) ?? ''
  const fromNumber = (formData.get('From') as string) ?? ''

  // Resolve scenario and character — prefer opaque token over raw query params
  let scenarioId = ''
  let characterId = ''
  const token = searchParams.get('token')

  if (token) {
    const payload = verifyTwilioToken(token)
    if (payload) {
      const callId = payload.callId
      scenarioId = payload.scenarioId

      // Resolve characterId from the scenario
      try {
        const scenario = await db.scenario.findUnique({
          where: { id: scenarioId },
          include: { character: true },
        })
        if (scenario) {
          characterId = scenario.characterId

          // Update call status to ACTIVE
          await db.call
            .update({
              where: { id: callId },
              data: { status: 'ACTIVE' },
            })
            .catch(() => {})
        }
      } catch (error) {
        log.error('Failed to resolve scenario from token', { error })
      }
    } else {
      log.warn('Invalid or expired Twilio token')
    }
  } else {
    // Legacy fallback for already-initiated calls (during deployment transition)
    const callId = searchParams.get('callId')
    scenarioId = searchParams.get('scenarioId') ?? ''
    characterId = searchParams.get('characterId') ?? ''

    if (!scenarioId || !characterId) {
      // Look up from DB call record
      try {
        const callRecord = callId
          ? await db.call.findUnique({
              where: { id: callId },
              include: { scenario: { include: { character: true } } },
            })
          : await db.call.findFirst({
              where: { twilioCallSid: callSid },
              include: { scenario: { include: { character: true } } },
            })

        if (callRecord) {
          scenarioId = callRecord.scenarioId
          characterId = callRecord.scenario.characterId

          // Update call status to ACTIVE
          await db.call
            .update({
              where: { id: callRecord.id },
              data: { status: 'ACTIVE' },
            })
            .catch(() => {})
        }
      } catch (error) {
        log.error('Failed to load call record', { error })
      }
    }
  }

  // Load scenario + character
  let characterName = searchParams.get('characterName') ?? 'AI Character'
  let voiceId = ''
  let systemPrompt = ''

  if (scenarioId) {
    try {
      const scenario = await db.scenario.findUnique({
        where: { id: scenarioId },
        include: { character: true },
      })

      if (scenario) {
        characterName = scenario.character.name
        voiceId = scenario.character.elevenLabsVoiceId
        systemPrompt = [
          `Tu es ${scenario.character.name}. ${scenario.character.description || ''}`,
          scenario.character.promptSystem,
          scenario.aiInstructions,
          `Contexte du scénario: ${scenario.description || ''}`,
          'Réponds en français de manière naturelle et parlée, comme dans une conversation téléphonique.',
          'Garde tes réponses concises (2-3 phrases max) adaptées à un appel vocal.',
        ]
          .filter(Boolean)
          .join('\n')
      }
    } catch (error) {
      log.error('Failed to load scenario', { error })
      systemPrompt =
        'Tu es un assistant IA amical. Réponds en français de manière naturelle.'
    }
  } else {
    systemPrompt =
      'Tu es un assistant IA amical. Réponds en français de manière naturelle.'
  }

  // Generate greeting via conversation engine
  let greeting = `Bonjour, vous êtes en ligne avec ${characterName}.`
  try {
    const result = await generateResponse({
      systemPrompt,
      messages: [],
      maxTokens: 150,
    })
    greeting = result.response
  } catch (error) {
    log.error('Failed to generate greeting', { error })
  }

  // Initialize conversation state in Redis (include greeting for transcript)
  await initConversationState(callSid, {
    callSid,
    scenarioId: scenarioId || 'unknown',
    characterId: characterId || 'unknown',
    callerNumber: fromNumber,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'assistant', content: greeting },
    ],
  })

  // Synthesize greeting with ElevenLabs and upload to R2
  let audioUrl = ''
  if (ttsClient && voiceId) {
    try {
      const audioStream = await ttsClient.textToSpeech.convert(voiceId, {
        text: greeting,
        model_id: ELEVENLABS_MODEL,
        output_format: 'ulaw_8000',
      })

      const chunks: Uint8Array[] = []
      for await (const chunk of audioStream) {
        chunks.push(chunk)
      }
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
      const combined = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }

      audioUrl = await uploadAudioBuffer(
        callSid,
        0,
        Buffer.from(combined),
        'audio/mulaw',
      )
    } catch (error) {
      log.error('Failed to synthesize greeting', { error })
    }
  }

  // Build TwiML response
  const twiml = new VoiceResponse()

  if (audioUrl) {
    twiml.play({}, audioUrl)
  } else {
    twiml.say(
      { voice: 'alice', language: 'fr-FR' },
      greeting,
    )
  }

  const actionUrl = `/api/webhooks/twilio/voice/handle-input?scenarioId=${encodeURIComponent(scenarioId || 'unknown')}&characterId=${encodeURIComponent(characterId || 'unknown')}`

  twiml.gather({
    input: ['speech'],
    speechTimeout: 'auto',
    speechModel: 'experimental_utterances',
    enhanced: true,
    action: actionUrl,
    method: 'POST',
  })

  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  })
}
