import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";

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
      const where = input?.category ? { category: input.category } : {};

      const characters = await db.character.findMany({
        where,
        orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
      });

      return characters;
    }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const character = await db.character.findUnique({
        where: { slug: input.slug },
      });

      if (!character) {
        return null;
      }

      return character;
    }),
});
