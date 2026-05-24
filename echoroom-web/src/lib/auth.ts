import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";

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

        if (!user) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.username,
          username: user.username,
          image: user.image,
          role: user.role,
          credits: user.credits,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user.role ?? "USER") as "USER" | "ADMIN" | "MODERATOR";
        token.credits = (user.credits ?? 5) as number;
        token.username = (user.username ?? "") as string;
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as unknown as {
        id: string;
        role: "USER" | "ADMIN" | "MODERATOR";
        credits: number;
        username: string;
      };
      session.user.id = t.id;
      session.user.role = t.role;
      session.user.credits = t.credits;
      session.user.username = t.username;
      return session;
    },
  },
});
