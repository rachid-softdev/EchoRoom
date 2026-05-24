import type { DefaultSession, DefaultUser, DefaultJWT } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      username: string;
      role: "USER" | "ADMIN" | "MODERATOR";
      credits: number;
      image: string | null;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role?: "USER" | "ADMIN" | "MODERATOR";
    credits?: number;
    username?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    role: "USER" | "ADMIN" | "MODERATOR";
    credits: number;
    username: string;
  }
}
