import "server-only";

import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/cookies";
import { ACCESS_DENIED_PATH, PASSWORD_CHANGE_PATH } from "@/lib/auth/routes";
import type { SessionPayload } from "@/lib/auth/session";
import type { RolUsuario } from "@/lib/validations/auth";

export async function getCurrentUser(): Promise<SessionPayload | null> {
  return getSession();
}

export async function requireUser(): Promise<SessionPayload> {
  const user = await getSession();
  if (!user) redirect("/login");
  // Server-side enforcement of the forced password change (design D12). Runs
  // before any role check, so a flagged user is never shown /denied.
  if (user.debeCambiarClave === true) redirect(PASSWORD_CHANGE_PATH);
  return user;
}

/**
 * ONLY for /change-password and its action. It cannot emit the forced-change
 * redirect, which is the structural no-loop proof (design D13).
 */
export async function requireUserAllowingPasswordChange(): Promise<SessionPayload> {
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
