import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import twilio from 'twilio'
import { db } from '@/server/db'
import { generateResponse } from '@/server/services/ai/conversationEngine'
import { ttsClient } from '@/server/services/audio/tts'
import {
  getConversationState,
  appendMessage,
  incrementTurn,
  setConversationStatus,
} from '@/server/services/telephony/conversationState'
import { detectGoodbye } from '@/server/services/telephony/goodbyeDetector'
import {
  MAX_TURNS,
  ELEVENLABS_MODEL,
} from '@/server/services/telephony/constants'
import { uploadAudioBuffer } from '@/server/services/audio/r2'

const VoiceResponse = twilio.twiml.VoiceResponse

/**
 * POST handler — called by Twilio <Gather> when the user speaks.
 * Processes the speech input, runs the conversation engine, and returns
 * TwiML for the next turn or a hangup if the conversation is done.
 */
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const formData = await req.formData()

  const callSid = (formData.get('CallSid') as string) ?? ''
  const speechResult = (formData.get('SpeechResult') as string) ?? ''

  const scenarioId =
    searchParams.get('scenarioId') ?? 'unknown'
  const characterId =
    searchParams.get('characterId') ?? 'unknown'

  // Get conversation state from Redis
  const state = await getConversationState(callSid)

  if (!state) {
    // Conversation expired or not found — hang up
    const twiml = new VoiceResponse()
    twiml.say(
      { voice: 'alice', language: 'fr-FR' },
      'Désolé, la conversation a expiré. Veuillez rappeler pour continuer.',
    )
    twiml.hangup()
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  // Check if call exceeded limits
  if (
    state.turnCount >= MAX_TURNS ||
    state.status === 'completed' ||
    state.status === 'timed_out' ||
    state.status === 'failed'
  ) {
    const twiml = new VoiceResponse()
    twiml.hangup()
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  // Append user message to conversation state
  await appendMessage(callSid, { role: 'user', content: speechResult })

  // Detect goodbye intent
  const isGoodbye = detectGoodbye(speechResult)
  if (isGoodbye) {
    await setConversationStatus(callSid, 'completed')

    // Generate a farewell response
    let farewell = 'Merci pour cette conversation. Au revoir!'
    try {
      const systemMessage = state.messages.find(
        (m) => m.role === 'system',
      )
      const result = await generateResponse({
        systemPrompt:
          systemMessage?.content ??
          'Tu es un assistant amical.',
        messages: [
          ...state.messages.filter((m) => m.role !== 'system'),
          { role: 'user', content: speechResult },
          {
            role: 'system',
            content:
              "L'utilisateur a dit au revoir. Réponds par un message d'au revoir chaleureux et termine la conversation. Sois bref (1-2 phrases).",
          },
        ],
        maxTokens: 100,
      })
      farewell = result.response
    } catch (error) {
      console.error('Failed to generate farewell:', error)
    }

    // Synthesize farewell and upload
    let audioUrl = ''
    const voiceId = await resolveVoiceId(characterId)
    if (ttsClient && voiceId) {
      try {
        audioUrl = await synthesizeAndUpload(
          ttsClient,
          voiceId,
          farewell,
          callSid,
          state.turnCount + 1,
        )
      } catch (error) {
        console.error('Failed to synthesize farewell:', error)
      }
    }

    const twiml = new VoiceResponse()
    if (audioUrl) {
      twiml.play({}, audioUrl)
    } else {
      twiml.say(
        { voice: 'alice', language: 'fr-FR' },
        farewell,
      )
    }
    twiml.hangup()

    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    })
  }

  // Check if this is the last allowed turn
  const isLastTurn = state.turnCount + 1 >= MAX_TURNS

  // Run conversation engine with full history
  let aiResponse = 'Je n\'ai rien à dire...'
  try {
    const systemMessage = state.messages.find(
      (m) => m.role === 'system',
    )
    const result = await generateResponse({
      systemPrompt:
        systemMessage?.content ??
        'Tu es un assistant amical.',
      messages: [
        ...state.messages.filter((m) => m.role !== 'system'),
        { role: 'user', content: speechResult },
      ],
      maxTokens: 200,
    })
    aiResponse = result.response
  } catch (error) {
    console.error('Failed to generate response:', error)
  }

  // If it's the last turn, inform the user
  if (isLastTurn) {
    aiResponse = `${aiResponse} ${'Ce sera notre dernier échange. Merci d\'avoir appelé!'}`
  }

  // Append assistant response to history
  await appendMessage(callSid, {
    role: 'assistant',
    content: aiResponse,
  })
  await incrementTurn(callSid)

  // Synthesize response with ElevenLabs and upload to R2
  let audioUrl = ''
  const voiceId = await resolveVoiceId(characterId)
  if (ttsClient && voiceId) {
    try {
      audioUrl = await synthesizeAndUpload(
        ttsClient,
        voiceId,
        aiResponse,
        callSid,
        state.turnCount + 1,
      )
    } catch (error) {
      console.error('Failed to synthesize response:', error)
    }
  }

  const actionUrl = `/api/webhooks/twilio/voice/handle-input?scenarioId=${encodeURIComponent(scenarioId)}&characterId=${encodeURIComponent(characterId)}`

  const twiml = new VoiceResponse()

  if (audioUrl) {
    twiml.play({}, audioUrl)
  } else {
    twiml.say(
      { voice: 'alice', language: 'fr-FR' },
      aiResponse,
    )
  }

  if (isLastTurn) {
    // Set status to completed before hangup
    await setConversationStatus(callSid, 'completed')
    twiml.hangup()
  } else {
    twiml.gather({
      input: ['speech'],
      speechTimeout: 'auto',
      speechModel: 'experimental_utterances',
      enhanced: true,
      action: actionUrl,
      method: 'POST',
    })
  }

  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  })
}

// -- Helpers --

async function resolveVoiceId(
  characterId: string,
): Promise<string> {
  if (!characterId || characterId === 'unknown') return ''

  try {
    const character = await db.character.findUnique({
      where: { id: characterId },
      select: { elevenLabsVoiceId: true },
    })
    return character?.elevenLabsVoiceId ?? ''
  } catch {
    return ''
  }
}

async function synthesizeAndUpload(
  client: NonNullable<typeof ttsClient>,
  voiceId: string,
  text: string,
  callSid: string,
  turnNumber: number,
): Promise<string> {
  const audioStream = await client.textToSpeech.convert(voiceId, {
    text,
    model_id: ELEVENLABS_MODEL,
    output_format: 'ulaw_8000',
  })

  const chunks: Uint8Array[] = []
  for await (const chunk of audioStream) {
    chunks.push(chunk)
  }
  const totalLength = chunks.reduce(
    (acc, chunk) => acc + chunk.length,
    0,
  )
  const combined = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.length
  }

  return await uploadAudioBuffer(
    callSid,
    turnNumber,
    Buffer.from(combined),
    'audio/mulaw',
  )
}
