import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import {
  SESSION_COOKIE,
  sessionMaxAge,
  verifySession,
  type SessionPayload,
} from "@/lib/auth/session";

export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
});

/** `keep`: the cookie lasts 30 days instead of 8 hours (FE-32). */
export async function setSessionCookie(
  token: string,
  keep = false,
): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAge(keep),
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
