import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      name: string;
      email: string;
      image?: string | null;
    };
  }
  interface User {
    role: Role;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.id as string;
      session.user.role = token.role as Role;
      return session;
    },
  },
});
