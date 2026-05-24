import { db } from "@/server/db";

interface FeedOptions {
  cursor?: string;
  limit: number;
}

export async function getPublicFeed({ cursor, limit }: FeedOptions) {
  const scenarios = await db.scenario.findMany({
    where: {
      visibility: "PUBLIC",
      moderationStatus: "APPROVED",
    },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { id: true, username: true, image: true } },
      character: {
        select: { id: true, name: true, slug: true, avatarUrl: true },
      },
      _count: { select: { reactions: true, comments: true } },
    },
  });

  const items = scenarios.slice(0, limit);
  const nextCursor = scenarios.length > limit ? scenarios[limit - 1]?.id : undefined;

  return { items, nextCursor };
}
