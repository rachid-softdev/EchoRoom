import { db } from "@/server/db";
import { createLogger } from "@/server/lib/logger";
import { getPresignedUrl } from "@/server/services/audio/r2";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET, R2_PUBLIC_URL } from "@/lib/r2";

const log = createLogger("clip-extractor");

const EXTRACTION_TIMEOUT_MS = 30_000;

// μ-law audio at 8000 Hz sample rate = 8000 bytes per second.
// This is the standard codec used by Twilio and ElevenLabs for telephony audio.
const BYTES_PER_SECOND = 8_000;

/**
 * Extract an audio segment from a call recording and upload it to R2.
 *
 * 1. Fetches the clip and its parent call from the database.
 * 2. Generates a presigned URL for the full recording.
 * 3. Uses an HTTP Range request to stream only the target byte segment.
 * 4. Uploads the extracted bytes to R2 under a clip-specific key.
 * 5. Updates the clip record with the new URL and "READY" status.
 *
 * On any failure the clip status is set to "FAILED" and the error is logged.
 */
export async function extractAndUploadClip(clipId: string): Promise<void> {
  const clip = await db.clip.findUnique({
    where: { id: clipId },
    include: { call: { select: { recordingUrl: true } } },
  });

  if (!clip) {
    log.error("Clip introuvable pour l'extraction", { clipId });
    throw new Error(`Clip introuvable : ${clipId}`);
  }

  if (!clip.call.recordingUrl) {
    log.error("L'appel n'a pas d'enregistrement", {
      clipId,
      callId: clip.callId,
    });
    await db.clip.update({
      where: { id: clipId },
      data: { status: "FAILED" },
    });
    return;
  }

  // Transition to PROCESSING before starting the potentially slow work
  await db.clip.update({
    where: { id: clipId },
    data: { status: "PROCESSING" },
  });

  try {
    const signedUrl = await getPresignedUrl(clip.call.recordingUrl);
    if (!signedUrl) {
      throw new Error("Impossible de générer une URL présignée pour l'enregistrement");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);

    try {
      // Convert seconds to byte offsets (μ-law 8000 Hz audio: 1s = 8000 bytes)
      const startByte = clip.startTime * BYTES_PER_SECOND;
      const endByte = clip.endTime * BYTES_PER_SECOND;

      const response = await fetch(signedUrl, {
        headers: {
          Range: `bytes=${startByte}-${endByte}`,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Échec de la récupération du segment audio : ${response.status} ${response.statusText}`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const body = Buffer.from(arrayBuffer);

      // Derive a unique R2 key for this clip
      const key = `clips/${clipId}_${Date.now()}`;
      const contentType = response.headers.get("content-type") ?? "audio/mulaw";

      await r2Client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );

      // Build the clip URL — prefer public URL when configured
      const clipUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : key;

      await db.clip.update({
        where: { id: clipId },
        data: { clipUrl, status: "READY" },
      });

      log.info("Clip extrait et téléversé avec succès", { clipId, clipUrl });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    log.error("L'extraction du clip a échoué", { clipId, error });
    await db.clip.update({
      where: { id: clipId },
      data: { status: "FAILED" },
    });
  }
}
