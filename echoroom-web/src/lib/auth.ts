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
 * Lazy-initialized to avoid blocking the module load with a ~250ms
 * synchronous bcrypt hash on every cold start (important for serverless).
 */
let DUMMY_HASH: string | null = null;

function getDummyHash(): string {
  if (!DUMMY_HASH) {
    DUMMY_HASH = bcrypt.hashSync("dummy-timing-attack-prevention", 12);
  }
  return DUMMY_HASH;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
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
        const passwordHash = user?.passwordHash ?? getDummyHash();
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
      // On initial sign-in
      if (user) {
        token.id = user.id as string;
        token.role = (user.role ?? "USER") as "USER" | "ADMIN" | "MODERATOR";
        token.username = (user.username ?? "") as string;

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
      }

      // Re-validate against DB periodically or on explicit update
      // This avoids a DB query on EVERY request while still detecting
      // role changes, account deletion, and token invalidation.
      const needsRevalidation =
        trigger === "update" ||
        !token.lastVerified ||
        Date.now() - (token.lastVerified as number) > 5 * 60 * 1000;

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
        token.lastVerified = Date.now();
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

      // Always fetch the role from the DB to ensure the session reflects
      // the current role even between JWT revalidation cycles (5 min max).
      // This prevents a demoted admin from retaining ADMIN access via
      // a stale cached role in the JWT token.
      if (t.id) {
        try {
          const dbUser = await db.user.findUnique({
            where: { id: t.id },
            select: { role: true, deletedAt: true },
          });
          if (!dbUser || dbUser.deletedAt) {
            // User was deleted — return minimal session
            session.user.role = "USER";
            return session;
          }
          session.user.role = dbUser.role;
        } catch {
          // Fallback to token role on DB error (degraded mode)
          session.user.role = t.role;
        }
      } else {
        session.user.role = t.role;
      }

      // Credits are NOT stored in JWT — always fetch from DB via getCredits query
      return session;
    },
  },
});
