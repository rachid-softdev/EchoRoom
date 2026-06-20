import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2Client, R2_BUCKET, R2_PUBLIC_URL, getR2Key } from '@/lib/r2'
import { createLogger } from '@/server/lib/logger'

const log = createLogger('r2')

export interface PresignedUrlOptions {
  /** Time-to-live in seconds (default: 3600 — 1 hour) */
  ttlSeconds?: number
}

function r2Key(callSid: string, turnNumber: number): string {
  const timestamp = Date.now()
  return `audio/${callSid}/${turnNumber}_${timestamp}`
}

export async function uploadAudioBuffer(
  callSid: string,
  turnNumber: number,
  buffer: Buffer,
  contentType: string = 'audio/mulaw',
): Promise<string> {
  const key = r2Key(callSid, turnNumber)

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  )

  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${key}`
  }

  return key
}

/**
 * Generate a short-lived presigned URL for an R2 audio object.
 *
 * 1. Extracts the bare R2 key from the stored URL (handles both formats).
 * 2. Signs a GetObjectCommand with the specified TTL.
 * 3. Returns the presigned URL, or null if the input was absent/empty.
 *
 * Logs and returns null on signing failure (graceful degradation).
 */
export async function getPresignedUrl(
  storedUrl: string | null | undefined,
  options?: PresignedUrlOptions,
): Promise<string | null> {
  const key = getR2Key(storedUrl)
  if (!key) return null

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- type mismatch between @aws-sdk versions
    return await getSignedUrl(r2Client as any, command, {
      expiresIn: options?.ttlSeconds ?? 3600,
    })
  } catch (error) {
    log.error('R2 getPresignedUrl error', { error, key })
    return null
  }
}

export async function getAudioStream(
  storedUrl: string,
): Promise<ReadableStream | null> {
  try {
    const key = getR2Key(storedUrl)
    if (!key) return null

    const response = await r2Client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      }),
    )

    return (response.Body as ReadableStream) ?? null
  } catch (error) {
    log.error('R2 getAudioStream error', { error })
    return null
  }
}

export async function deleteAudioFile(storedUrl: string): Promise<void> {
  try {
    const key = getR2Key(storedUrl)
    if (!key) {
      log.warn('deleteAudioFile: could not extract key from stored URL', { storedUrl })
      return
    }

    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      }),
    )
  } catch (error) {
    log.error('R2 deleteAudioFile error', { error })
  }
}

// Startup privacy check (non-blocking, non-critical)
if (typeof window === "undefined" && process.env.NODE_ENV === "production") {
  import("./r2Check").then(({ ensureBucketPrivacy }) => {
    ensureBucketPrivacy();
  }).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    log.warn("R2 startup privacy check failed (non-critical)", { error: message });
  });
}
