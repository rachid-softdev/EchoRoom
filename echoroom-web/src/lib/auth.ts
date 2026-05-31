import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";

/**
 * Dummy bcrypt hash used for timing-constant authentication.
 * Prevents account enumeration by ensuring the same code path
 * is executed whether the user exists or not.
 *
 * Pre-computed hash constant to avoid blocking the event loop
 * on import (~250ms bcrypt.hashSync call per cold start).
 * Generated with: bcrypt.hashSync("dummy-timing-attack-prevention", 12)
 */
const DUMMY_HASH = "$2a$12$Cu8vgg8BQxK03D9Sf95z.O5wQsmxCzuzVT6wfuRxXRsGcOXCLF1Mq";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours (reduced from 30 days)
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await db.user.findUnique({
          where: { email },
        });

        // Timing-constant comparison: always run bcrypt.compare
        // even when user doesn't exist, to prevent account enumeration.
        const passwordHash = user?.passwordHash ?? DUMMY_HASH;
        const isValid = await bcrypt.compare(password, passwordHash);

        if (!user || !isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.username,
          username: user.username,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On initial sign-in: set issuedAt + fetch tokenVersion from DB
      if (user) {
        token.id = user.id as string;
        token.role = (user.role ?? "USER") as "USER" | "ADMIN" | "MODERATOR";
        token.username = (user.username ?? "") as string;
        token.issuedAt = Date.now();

        // Immediately fetch the real tokenVersion from DB.
        // This ensures the JWT matches the DB value and prevents
        // infinite session invalidation after admin tokenVersion increments.
        if (user.id) {
          const dbUser = await db.user.findUnique({
            where: { id: user.id as string },
            select: { tokenVersion: true },
          });
          token.tokenVersion = dbUser?.tokenVersion ?? 0;
        }
        token.lastVerified = Date.now();
        return token;
      }

      // ── Soft refresh: issue a new token if close to expiry ──
      // If the token is within 1 hour of its 24h maxAge, re-issue with
      // a fresh issuedAt to extend the session without forcing re-login.
      // Re-verify against DB to ensure the account is still valid.
      const issuedAt = token.issuedAt as number | undefined;
      const now = Date.now();
      const tokenAge = issuedAt ? now - issuedAt : 0;
      const maxAgeMs = 24 * 60 * 60 * 1000;
      const refreshWindowMs = 1 * 60 * 60 * 1000; // 1 hour before expiry

      if (issuedAt && tokenAge > maxAgeMs - refreshWindowMs && tokenAge < maxAgeMs) {
        // Verify account is still valid before extending
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, deletedAt: true, tokenVersion: true },
        });

        if (!dbUser || dbUser.deletedAt) return null;
        if (dbUser.tokenVersion !== (token.tokenVersion ?? 0)) return null;

        // Issue refreshed token
        token.role = dbUser.role;
        token.issuedAt = now;
        token.lastVerified = now;
        return token;
      }

      // ── Periodic re-validation ──
      // Avoids a DB query on EVERY request while still detecting
      // role changes, account deletion, and token invalidation.
      // - Admins/moderators: every 1 minute (fast role change detection)
      // - Regular users: every 15 minutes (reduce DB load)
      const userRole = token.role as string;
      const revalidationInterval = userRole === "ADMIN" || userRole === "MODERATOR"
        ? 60 * 1000       // 1 minute for staff
        : 15 * 60 * 1000; // 15 minutes for regular users

      const needsRevalidation =
        trigger === "update" ||
        !token.lastVerified ||
        now - (token.lastVerified as number) > revalidationInterval;

      if (needsRevalidation && token.id) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, deletedAt: true, tokenVersion: true },
        });

        // Account deleted or not found → invalidate token
        if (!dbUser || dbUser.deletedAt) {
          return null;
        }

        // Token version mismatch (password changed, session revoked) → invalidate
        if (dbUser.tokenVersion !== (token.tokenVersion ?? 0)) {
          return null;
        }

        // Update role from DB (in case of admin demotion/promotion)
        token.role = dbUser.role;
        token.lastVerified = now;
      }

      return token;
    },
    async session({ session, token }) {
      const t = token as unknown as {
        id: string;
        role: "USER" | "ADMIN" | "MODERATOR";
        username: string;
      };

      session.user.id = t.id;
      session.user.username = t.username;

      // Utiliser le rôle directement depuis le JWT.
      // La revalidation périodique (30s pour admins, 15 min pour users)
      // dans le callback jwt() garantit que le rôle est à jour.
      session.user.role = t.role;

      // Les crédits ne sont PAS stockés dans le JWT — toujours depuis la DB via getCredits
      return session;
    },
  },
});
