import { db } from "@/server/db";
import { AppError } from "@/server/lib/errors";
import { createLogger } from "@/server/lib/logger";
import { clipRepository } from "@/server/repositories";
import { getPresignedUrl } from "@/server/services/audio/r2";
import { extractAndUploadClip } from "./clipExtractor";

const log = createLogger("clips");

interface CreateClipParams {
  callId: string;
  userId: string;
  title?: string;
  startTime: number;
  endTime: number;
  /** Pipeline version selector, controlled by the clipGenerationV2 flag ("v2" when enabled). */
  version?: "v1" | "v2";
  /** Traceability flag: true when the clip was produced by the v2 pipeline. */
  usedV2?: boolean;
}

/**
 * Schedule an async clip extraction in the background.
 * Uses queueMicrotask to defer the work without blocking the response.
 */
function scheduleClipExtraction(clipId: string): void {
  queueMicrotask(() => {
    extractAndUploadClip(clipId).catch((error) => {
      log.error("Échec de l'extraction en arrière-plan", { clipId, error });
    });
  });
}

export async function createClip(params: CreateClipParams) {
  const call = await db.call.findUnique({
    where: { id: params.callId },
    select: { userId: true },
  });

  if (!call) {
    throw new AppError("NOT_FOUND", "Appel introuvable");
  }

  if (call.userId !== params.userId) {
    throw new AppError("FORBIDDEN", "Cet appel ne vous appartient pas");
  }

  log.debug("clip creation requested", {
    version: params.version ?? "v1",
    usedV2: params.usedV2 ?? false,
  });

  // TODO(clipGenerationV2): when `params.version === "v2"`, route to the v2
  // extraction pipeline here. For now the existing pipeline is used and the
  // selected version is recorded on the Clip via `usedV2` for traceability.
  // NOTE: persisting `usedV2` on Clip is deferred until the `Clip.usedV2`
  // column lands in the schema; the version selector is plumbed through but
  // not yet written to the row.
  const clip = await clipRepository.create({
    callId: params.callId,
    userId: params.userId,
    ...(params.title !== undefined ? { title: params.title } : {}),
    startTime: params.startTime,
    endTime: params.endTime,
  });

  // Fire-and-forget: extract the audio segment and upload to R2
  scheduleClipExtraction(clip.id);

  return { clipId: clip.id };
}

export async function getClips(callId: string) {
  const clips = await clipRepository.findByCallId(callId);

  // Presign clip URLs for secure access
  return Promise.all(
    clips.map(async (clip) => ({
      ...clip,
      clipUrl: clip.clipUrl ? await getPresignedUrl(clip.clipUrl) : null,
    })),
  );
}

export async function deleteClip(clipId: string, userId: string) {
  const clip = await clipRepository.findById(clipId);

  if (!clip) {
    throw new AppError("NOT_FOUND", "Clip introuvable");
  }

  if (clip.userId !== userId) {
    throw new AppError("FORBIDDEN", "Ce clip ne vous appartient pas");
  }

  await clipRepository.delete(clipId);

  return { success: true };
}
