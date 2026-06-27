import type { DefaultJWT, DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      username: string;
      role: "USER" | "ADMIN" | "MODERATOR";
      image: string | null;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role?: "USER" | "ADMIN" | "MODERATOR";
    username?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: "USER" | "ADMIN" | "MODERATOR";
    username: string;
    lastVerified?: number;
    tokenVersion?: number;
  }
}
