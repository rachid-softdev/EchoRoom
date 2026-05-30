import { TRPCError } from "@trpc/server";
import { db } from "@/server/db";
import { getPresignedUrl } from "@/server/services/audio/r2";

interface CreateClipParams {
  callId: string;
  userId: string;
  title?: string;
  startTime: number;
  endTime: number;
}

export async function createClip(params: CreateClipParams) {
  const call = await db.call.findUnique({
    where: { id: params.callId },
    select: { userId: true },
  });

  if (!call) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Appel introuvable",
    });
  }

  if (call.userId !== params.userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cet appel ne vous appartient pas",
    });
  }

  const clip = await db.clip.create({
    data: {
      callId: params.callId,
      userId: params.userId,
      title: params.title ?? "Clip",
      startTime: params.startTime,
      endTime: params.endTime,
    },
  });

  return { clipId: clip.id };
}

export async function getClips(callId: string) {
  const clips = await db.clip.findMany({
    where: { callId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
      clipUrl: true,
      status: true,
      createdAt: true,
    },
  });

  // Presign clip URLs for secure access
  return Promise.all(
    clips.map(async (clip) => ({
      ...clip,
      clipUrl: clip.clipUrl ? await getPresignedUrl(clip.clipUrl) : null,
    })),
  );
}

export async function deleteClip(clipId: string, userId: string) {
  const clip = await db.clip.findUnique({
    where: { id: clipId },
    select: { userId: true },
  });

  if (!clip) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Clip introuvable",
    });
  }

  if (clip.userId !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Ce clip ne vous appartient pas",
    });
  }

  await db.clip.delete({ where: { id: clipId } });

  return { success: true };
}
