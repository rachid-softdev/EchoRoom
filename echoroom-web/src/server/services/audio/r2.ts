import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from '@/lib/r2'
import { createLogger } from '@/server/lib/logger'

const log = createLogger('r2')

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

export async function getAudioStream(
  r2KeyParam: string,
): Promise<ReadableStream | null> {
  try {
    const response = await r2Client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: r2KeyParam,
      }),
    )

    return (response.Body as ReadableStream) ?? null
  } catch (error) {
    log.error('R2 getAudioStream error', { error })
    return null
  }
}

export async function deleteAudioFile(r2KeyParam: string): Promise<void> {
  try {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: r2KeyParam,
      }),
    )
  } catch (error) {
    log.error('R2 deleteAudioFile error', { error })
  }
}
