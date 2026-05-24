import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";
import {
  router,
  publicProcedure,
  protectedProcedure,
  withRateLimit,
} from "../trpc";
import { db } from "../db";

export const authRouter = router({
  register: publicProcedure
    .use(withRateLimit({ limit: 3, window: 3600 }))
    .input(
      z.object({
        email: z.string().email(),
        username: z.string().min(3).max(20),
        password: z.string().min(8),
        consentAccepted: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      if (!input.consentAccepted) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Vous devez accepter les conditions d'utilisation",
        });
      }

      const existingEmail = await db.user.findUnique({
        where: { email: input.email },
      });
      if (existingEmail) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Cet email est déjà utilisé",
        });
      }

      const existingUsername = await db.user.findUnique({
        where: { username: input.username },
      });
      if (existingUsername) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Ce nom d'utilisateur est déjà pris",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 12);

      const user = await db.user.create({
        data: {
          email: input.email,
          username: input.username,
          passwordHash,
          consentAcceptedAt: new Date(),
        },
      });

      return { userId: user.id };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        credits: true,
        image: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Utilisateur introuvable",
      });
    }

    return user;
  }),
});
