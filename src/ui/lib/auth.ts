import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";

function parseAllowedEmails(): string[] {
  const raw = process.env["APP_LOGIN_ALLOWED_EMAILS"]?.trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isGoogleConfigured(): boolean {
  return Boolean(
    process.env["GOOGLE_CLIENT_ID"]?.trim() &&
      process.env["GOOGLE_CLIENT_SECRET"]?.trim()
  );
}

export const googleOAuthEnabled = isGoogleConfigured();

export const authOptions: NextAuthOptions = {
  secret: process.env["NEXTAUTH_SECRET"],
  session: {
    strategy: "jwt",
  },
  providers: [
    ...(googleOAuthEnabled
      ? [
          GoogleProvider({
            clientId: process.env["GOOGLE_CLIENT_ID"]!,
            clientSecret: process.env["GOOGLE_CLIENT_SECRET"]!,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password?.trim();

        if (!email || !password) {
          return null;
        }

        const allowedEmails = parseAllowedEmails();
        if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
          return null;
        }

        const expectedPassword = process.env["APP_LOGIN_PASSWORD"]?.trim();
        if (expectedPassword && password !== expectedPassword) {
          return null;
        }

        if (password.length < 6) {
          return null;
        }

        return {
          id: email,
          email,
          name: email.split("@")[0] ?? email,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.email = session.user.email ?? token.sub;
      }
      return session;
    },
  },
};

