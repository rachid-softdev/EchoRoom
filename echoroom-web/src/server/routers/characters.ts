import type { Character, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../db";
import { publicProcedure, router } from "../procedures";
import {
  getCachedCharacters,
  setCachedCharacters,
  type CharacterCacheParams,
} from "../services/cache/characterCache";
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
    .query(async ({ input, ctx }) => {
      // The ICON category is gated behind the newCharacterCategory flag
      // (all tiers, progressive rollout). `list` is a public procedure so the
      // session is optional: authenticated users are bucketed per-user (stable
      // 25% rollout); anonymous visitors fall back to the "free" tier seed
      // (deterministic per-tier bucket). The flag applies to every tier, so a
      // tier-less evaluation would always be disabled — which is why we never
      // call isFeatureEnabled without a tier here.
      const iconEnabled = isFeatureEnabled("newCharacterCategory", {
        tier: "free",
        ...(ctx?.session?.user?.id ? { userId: ctx.session.user.id } : {}),
      });
      // Split the shared cache by flag state so a user whose bucket sees ICON
      // characters never receives the other bucket's cached list (and vice
      // versa).
      const cacheParams: CharacterCacheParams = {
        ...(input?.category ? { category: input.category } : {}),
        iconFlag: iconEnabled ? "on" : "off",
      };
      const cached = await getCachedCharacters<CachedCharacter[]>(cacheParams);
      if (cached) return cached;
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
