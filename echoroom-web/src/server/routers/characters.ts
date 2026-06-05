import { z } from "zod";
import { router, publicProcedure } from "../procedures";
import { db } from "../db";
import { getCachedCharacters, setCachedCharacters } from "../services/cache/characterCache";
import type { Character } from "@prisma/client";

type CachedCharacter = Pick<Character, "id" | "name" | "slug" | "description" | "previewAudioUrl" | "avatarUrl" | "category" | "isFeatured">;

export const charactersRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          category: z
            .enum(["ROMANTIC", "CHAOTIC", "CORPORATE", "NPC", "HORROR", "CRINGE", "GAMER", "WEIRD"])
            .optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const cacheParams = { ...(input?.category ? { category: input.category } : {}) };
      const cached = await getCachedCharacters<CachedCharacter[]>(cacheParams);
      if (cached) return cached;

      const where = input?.category ? { category: input.category } : {};

      const characters = await db.character.findMany({
        where,
        orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          previewAudioUrl: true,
          avatarUrl: true,
          category: true,
          isFeatured: true,
        },
      });

      await setCachedCharacters(characters, cacheParams);
      return characters;
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const character = await db.character.findUnique({
        where: { slug: input.slug },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          previewAudioUrl: true,
          avatarUrl: true,
          category: true,
          isFeatured: true,
        },
      });

      if (!character) {
        return null;
      }

      return character;
    }),
});
