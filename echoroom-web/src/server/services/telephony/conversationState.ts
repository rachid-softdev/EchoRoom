import { redis } from '@/lib/redis'
import { CONVERSATION_TTL_S } from './constants'

export interface ConversationMessage {
  role: 'system' | 'assistant' | 'user'
  content: string
}

export interface ConversationState {
  callSid: string
  scenarioId: string
  characterId: string
  callerNumber: string
  messages: ConversationMessage[]
  turnCount: number
  lastActiveAt: string
  status: 'active' | 'completed' | 'timed_out' | 'failed'
}

type InitData = Omit<ConversationState, 'turnCount' | 'lastActiveAt' | 'status'>

function redisKey(callSid: string): string {
  return `conversation:${callSid}`
}

export async function initConversationState(
  callSid: string,
  data: InitData,
): Promise<ConversationState | null> {
  if (!redis) return null

  const state: ConversationState = {
    ...data,
    turnCount: 0,
    lastActiveAt: new Date().toISOString(),
    status: 'active',
  }

  try {
    await redis.set(redisKey(callSid), JSON.stringify(state), {
      ex: CONVERSATION_TTL_S,
    })
    return state
  } catch (error) {
    console.error('Redis initConversationState error:', error)
    return null
  }
}

export async function getConversationState(
  callSid: string,
): Promise<ConversationState | null> {
  if (!redis) return null

  try {
    const raw = await redis.get<string>(redisKey(callSid))
    if (!raw) return null

    const state: ConversationState = JSON.parse(raw)

    // Refresh TTL on access
    await redis.expire(redisKey(callSid), CONVERSATION_TTL_S).catch(() => {})

    return state
  } catch (error) {
    console.error('Redis getConversationState error:', error)
    return null
  }
}

export async function appendMessage(
  callSid: string,
  message: ConversationMessage,
): Promise<ConversationState | null> {
  if (!redis) return null

  try {
    const state = await getConversationState(callSid)
    if (!state) return null

    state.messages.push(message)
    state.lastActiveAt = new Date().toISOString()

    await redis.set(redisKey(callSid), JSON.stringify(state), {
      ex: CONVERSATION_TTL_S,
    })

    return state
  } catch (error) {
    console.error('Redis appendMessage error:', error)
    return null
  }
}

export async function incrementTurn(
  callSid: string,
): Promise<ConversationState | null> {
  if (!redis) return null

  try {
    const state = await getConversationState(callSid)
    if (!state) return null

    state.turnCount += 1
    state.lastActiveAt = new Date().toISOString()

    await redis.set(redisKey(callSid), JSON.stringify(state), {
      ex: CONVERSATION_TTL_S,
    })

    return state
  } catch (error) {
    console.error('Redis incrementTurn error:', error)
    return null
  }
}

export async function setConversationStatus(
  callSid: string,
  status: ConversationState['status'],
): Promise<ConversationState | null> {
  if (!redis) return null

  try {
    const state = await getConversationState(callSid)
    if (!state) return null

    state.status = status
    state.lastActiveAt = new Date().toISOString()

    await redis.set(redisKey(callSid), JSON.stringify(state), {
      ex: CONVERSATION_TTL_S,
    })

    return state
  } catch (error) {
    console.error('Redis setConversationStatus error:', error)
    return null
  }
}

export async function deleteConversationState(
  callSid: string,
): Promise<void> {
  if (!redis) return

  try {
    await redis.del(redisKey(callSid))
  } catch (error) {
    console.error('Redis deleteConversationState error:', error)
  }
}
