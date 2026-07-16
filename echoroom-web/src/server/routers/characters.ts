import type { Character, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { publicProcedure, router } from "../procedures";
import { getCachedCharacters, setCachedCharacters } from "../services/cache/characterCache";
import { isFeatureEnabled } from "@/config/featureFlags";

type CachedCharacter = Pick<
  Character,
  | "id"
  | "name"
  | "slug"
  | "description"
  | "previewAudioUrl"
  | "avatarUrl"
  | "category"
  | "isFeatured"
>;

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

      // The ICON category is gated behind the newCharacterCategory flag
      // (all tiers, progressive rollout). When disabled, hide it from results.
      // NOTE: `list` is a public procedure with no authenticated tier, so the
      // flag is evaluated without a tier context (effectively disabled for
      // anonymous callers). The per-user rollout is enforced where a tier is
      // available (e.g. character creation).
      const iconEnabled = isFeatureEnabled("newCharacterCategory", {});
      const base: Prisma.CharacterWhereInput = input?.category
        ? { category: input.category }
        : {};
      // The ICON category is gated behind the newCharacterCategory flag.
      // Hide it only on the general listing (no explicit category filter);
      // when a specific category is requested we honour it exactly.
      const where: Prisma.CharacterWhereInput = iconEnabled
        ? base
        : input?.category
          ? base
          : { NOT: { category: "ICON" } };

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

  getBySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
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
