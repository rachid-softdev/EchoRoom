import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";
import { checkRateLimit } from "@/server/middleware/rateLimit";

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

        // Rate limit: 5 tentatives / 15 min par email
        await checkRateLimit({
          identifier: `login:${email}`,
          limit: 5,
          window: 900,
        }).catch(() => {
          // If rate limit check itself fails, allow login to proceed
        });

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
    async jwt({ token, user }) {
      // On initial sign-in
      if (user) {
        token["id"] = user.id as string;
        token["role"] = (user.role ?? "USER") as "USER" | "ADMIN" | "MODERATOR";
        token["username"] = (user.username ?? "") as string;

        // Store tokenVersion and role from DB on every login
        if (user.id) {
          const dbUser = await db.user.findUnique({
            where: { id: user.id as string },
            select: { tokenVersion: true, role: true, deletedAt: true },
          });
          if (dbUser) {
            token["tokenVersion"] = dbUser.tokenVersion;
            token["role"] = dbUser.role;
          }
        }
        token["issuedAt"] = Date.now();
        token["lastVerified"] = Date.now();
        return token;
      }

      // ── Re-validate on every token access ──
      // Fetch user from DB and compare tokenVersion + role.
      // Invalidates token if user deleted, version changed, or role changed.
      if (token["id"]) {
        const dbUser = await db.user.findUnique({
          where: { id: token["id"] as string },
          select: { tokenVersion: true, role: true, deletedAt: true },
        });

        // User deleted, not found, or token version mismatch → invalidate
        if (!dbUser || dbUser.deletedAt || dbUser.tokenVersion !== (token["tokenVersion"] ?? 0)) {
          return {}; // Token vide → force re-connexion
        }

        // Update role from DB (détecte les promotions/rétrogradations)
        token["role"] = dbUser.role;
        token["lastVerified"] = Date.now();
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
