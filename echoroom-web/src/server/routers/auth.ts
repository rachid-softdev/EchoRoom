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
import { createLogger } from "@/server/lib/logger";

const log = createLogger("auth");

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "tempmail.com", "10minutemail.com",
  "guerrillamail.com", "throwaway.email", "yopmail.com",
  "temp-mail.org", "sharklasers.com", "trashmail.com",
  "burnermail.io", "maildrop.cc", "getairmail.com",
  "emailondeck.com", "fakeinbox.com", "tempinbox.com",
  "mailexpire.com", "spambox.us", "spamgourmet.com",
  "dispostable.com", "mailcatch.com",
]);

export const authRouter = router({
  register: publicProcedure
    .use(withRateLimit({ limit: 3, window: 3600 }))
    .input(
      z.object({
        email: z.string().email(),
        username: z.string().min(3).max(20),
        password: z.string()
          .min(8, "Minimum 8 caractères")
          .max(128, "Maximum 128 caractères")
          .regex(/[A-Z]/, "Doit contenir une majuscule")
          .regex(/[a-z]/, "Doit contenir une minuscule")
          .regex(/[0-9]/, "Doit contenir un chiffre"),
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

      // Block disposable email domains (with recursive subdomain check).
      // "user@mail.mailinator.com" would not match "mailinator.com" with a
      // simple set lookup, so we check all parent domains recursively.
      const emailDomain = input.email.split("@")[1]?.toLowerCase();
      if (emailDomain) {
        const parts = emailDomain.split(".");
        let isDisposable = false;
        for (let i = parts.length - 2; i >= 0; i--) {
          const parentDomain = parts.slice(i).join(".");
          if (DISPOSABLE_DOMAINS.has(parentDomain)) {
            isDisposable = true;
            log.warn("Disposable email blocked", { email: input.email, domain: parentDomain });
            break;
          }
        }
        if (isDisposable) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Les emails jetables ne sont pas autorisés",
          });
        }
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

  changePassword: protectedProcedure
    .use(withRateLimit({ limit: 3, window: 3600 }))
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string()
          .min(8, "Minimum 8 caractères")
          .max(128, "Maximum 128 caractères")
          .regex(/[A-Z]/, "Doit contenir une majuscule")
          .regex(/[a-z]/, "Doit contenir une minuscule")
          .regex(/[0-9]/, "Doit contenir un chiffre"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const user = await db.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Utilisateur introuvable",
        });
      }

      const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!isValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Mot de passe actuel incorrect",
        });
      }

      const newPasswordHash = await bcrypt.hash(input.newPassword, 12);

      await db.user.update({
        where: { id: userId },
        data: {
          passwordHash: newPasswordHash,
          tokenVersion: { increment: 1 },
        },
      });

      log.info("Password changed", { userId });

      return { success: true };
    }),

  me: protectedProcedure
    .use(withRateLimit({ limit: 120, window: 60 }))
    .query(async ({ ctx }) => {
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
