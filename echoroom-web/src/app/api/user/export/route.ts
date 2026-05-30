import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/server/db'
import { decryptPhoneNumber, maskPhoneNumber } from '@/server/lib/encryption'
import { createLogger } from '@/server/lib/logger'

const log = createLogger('gdpr-export')

/**
 * POST /api/user/export — Download a JSON archive of the authenticated user's personal data.
 *
 * Returns a downloadable JSON file with the same structure as the `exportMyData` tRPC mutation,
 * plus additional data (Clips and AbuseReports) that were missing from the original implementation.
 *
 * Rate-limited: 1 request per hour (checked via gdprDataExportedAt timestamp).
 * Uses POST (not GET) because the operation has state-changing side effects
 * (audit log creation, gdprDataExportedAt update). The X-Requested-With header
 * check provides CSRF protection for older browsers without SameSite support.
 */
export async function POST(req: NextRequest) {
  // CSRF defense: require X-Requested-With header (not sent by cross-origin requests)
  const requestedWith = req.headers.get('x-requested-with')
  if (!requestedWith) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const userId = session.user.id

  // Atomic rate-limit: only proceed if last export was > 1 hour ago.
  // updateMany with WHERE acts as an optimistic lock under READ COMMITTED.
  const lockResult = await db.user.updateMany({
    where: {
      id: userId,
      OR: [
        { gdprDataExportedAt: null },
        { gdprDataExportedAt: { lte: new Date(Date.now() - 3600 * 1000) } },
      ],
    },
    data: { gdprDataExportedAt: new Date() },
  })

  if (lockResult.count === 0) {
    // Either user doesn't exist or rate-limited
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { gdprDataExportedAt: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }
    if (!user.gdprDataExportedAt) {
      return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
    }
    const hoursSinceLastExport = (Date.now() - user.gdprDataExportedAt.getTime()) / 1000 / 3600
    const retryAfter = Math.ceil(3600 - hoursSinceLastExport * 3600)
    return NextResponse.json(
      { error: 'Trop de requêtes. Vous pouvez exporter vos données une fois par heure.', retryAfterSeconds: retryAfter },
      { status: 429 },
    )
  }

  // Fetch user profile
  const userData = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      bio: true,
      image: true,
      role: true,
      credits: true,
      totalLikesReceived: true,
      totalCallsMade: true,
      consentAcceptedAt: true,
      gdprDataExportedAt: true,
      deletedAt: true,
      anonymizedAt: true,
      createdAt: true,
    },
  })

  if (!userData) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
  }

  // Fetch scenarios
  const scenarios = await db.scenario.findMany({
    where: { creatorId: userId },
    select: {
      id: true,
      title: true,
      description: true,
      visibility: true,
      moderationStatus: true,
      playCount: true,
      likeCount: true,
      createdAt: true,
      character: { select: { name: true } },
    },
  })

  // Fetch calls with masked phone numbers
  const calls = await db.call.findMany({
    where: { userId },
    select: {
      id: true,
      phoneNumber: true,
      status: true,
      durationSeconds: true,
      costCredits: true,
      createdAt: true,
      endedAt: true,
    },
  })

  const maskedCalls = calls.map((call) => {
    let masked = '****'
    try {
      const decrypted = decryptPhoneNumber(call.phoneNumber)
      masked = maskPhoneNumber(decrypted)
    } catch {
      if (call.phoneNumber.length >= 4) {
        masked = `xxxx${call.phoneNumber.slice(-4)}`
      }
    }
    return { ...call, phoneNumber: masked }
  })

  // Fetch comments
  const comments = await db.comment.findMany({
    where: { userId },
    select: {
      id: true,
      content: true,
      moderationStatus: true,
      createdAt: true,
      scenario: { select: { id: true, title: true } },
    },
  })

  // Fetch purchases
  const purchases = await db.purchase.findMany({
    where: { userId },
    select: {
      id: true,
      creditsPurchased: true,
      createdAt: true,
    },
  })

  // Fetch clips (missing from original exportMyData)
  const clips = await db.clip.findMany({
    where: { userId },
    select: {
      id: true,
      callId: true,
      title: true,
      startTime: true,
      endTime: true,
      clipUrl: true,
      status: true,
      createdAt: true,
    },
  })

  // Fetch abuse reports (missing from original exportMyData)
  const abuseReports = await db.abuseReport.findMany({
    where: { reporterId: userId },
    select: {
      id: true,
      targetType: true,
      targetId: true,
      reason: true,
      status: true,
      createdAt: true,
    },
  })

  const exportData = {
    exportedAt: new Date().toISOString(),
    user: userData,
    scenarios,
    calls: maskedCalls,
    comments,
    purchases,
    clips,
    abuseReports,
  }

  // Create audit log entry for GDPR compliance (Article 15 — data access logging)
  await db.auditLog.create({
    data: {
      action: 'GDPR_EXPORT',
      entityType: 'User',
      entityId: userId,
      adminId: userId, // Self-service export
    },
  }).catch((error) => {
    log.error('Failed to create audit log for GDPR export', { error, userId })
  })

  log.info('GDPR data exported', { userId })

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="echoroom-export-${userId.substring(0, 8)}.json"`,
    },
  })
}
