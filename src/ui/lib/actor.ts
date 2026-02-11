import { getServerSession } from "next-auth";
import type { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export const ANON_ACTOR_COOKIE = "ai_actor_id";
const ANON_ACTOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export interface ActorIdentity {
  actorKey: string;
  actorEmail: string | null;
  isAuthenticated: boolean;
  setAnonCookie?: string;
}

export async function resolveActorIdentity(
  request: NextRequest
): Promise<ActorIdentity> {
  const session = await getServerSession(authOptions);
  const actorEmail = session?.user?.email?.trim().toLowerCase() ?? null;

  if (actorEmail) {
    return {
      actorKey: `user:${actorEmail}`,
      actorEmail,
      isAuthenticated: true,
    };
  }

  const existingAnonId = request.cookies.get(ANON_ACTOR_COOKIE)?.value?.trim();
  const anonId = existingAnonId && existingAnonId.length > 0
    ? existingAnonId
    : crypto.randomUUID();

  return {
    actorKey: `anon:${anonId}`,
    actorEmail: null,
    isAuthenticated: false,
    ...(existingAnonId ? {} : { setAnonCookie: anonId }),
  };
}

export function withActorCookie(
  response: NextResponse,
  actor: ActorIdentity
): NextResponse {
  if (actor.setAnonCookie) {
    response.cookies.set({
      name: ANON_ACTOR_COOKIE,
      value: actor.setAnonCookie,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env["NODE_ENV"] === "production",
      path: "/",
      maxAge: ANON_ACTOR_COOKIE_MAX_AGE_SECONDS,
    });
  }
  return response;
}

