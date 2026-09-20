import "server-only";

import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/cookies";
import { ACCESS_DENIED_PATH } from "@/lib/auth/routes";
import type { SessionPayload } from "@/lib/auth/session";
import type { RolUsuario } from "@/lib/validations/auth";

export async function getCurrentUser(): Promise<SessionPayload | null> {
  return getSession();
}

export async function requireUser(): Promise<SessionPayload> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(
  ...roles: RolUsuario[]
): Promise<SessionPayload> {
  const user = await requireUser();
  if (!roles.includes(user.rol)) redirect(ACCESS_DENIED_PATH);
  return user;
}
