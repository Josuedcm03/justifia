"use server";

import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { setSessionCookie } from "@/lib/auth/cookies";
import { requireUserAllowingPasswordChange } from "@/lib/auth/dal";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signSession } from "@/lib/auth/session";
import { getUsuarioByLogin, updateClaveAndClearFlag } from "@/lib/data/users";
import { changePasswordSchema } from "@/lib/validations/auth";

export type ChangePasswordState = { error: string | null };

type ErrorKey = "invalid" | "weak" | "mismatch" | "sameAsCurrent";

/** Maps the first schema issue to one of the screen's own error messages. */
function errorKeyFor(issue: { path: PropertyKey[]; code: string }): ErrorKey {
  if (issue.path[0] === "confirmPassword") return "mismatch";
  if (issue.path[0] === "newPassword") {
    return issue.code === "custom" ? "sameAsCurrent" : "weak";
  }
  return "invalid";
}

/**
 * Changes the caller's own password (FPC). It is guarded by the sibling
 * `requireUserAllowingPasswordChange`, never the ordinary guard: a flagged
 * session must be able to reach this action (design D13). The account is
 * resolved from the session only, never from the form.
 */
export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await requireUserAllowingPasswordChange();
  const t = await getTranslations("changePassword");

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: t(`errors.${errorKeyFor(parsed.error.issues[0])}`) };
  }

  const sessionId = Number(session.sub);
  const account = await getUsuarioByLogin(session.login);
  if (!account || !account.activo || account.id !== sessionId) {
    return { error: t("errors.unexpected") };
  }

  const ok = await verifyPassword(
    parsed.data.currentPassword,
    account.hashClave,
  );
  if (!ok) {
    return { error: t("errors.wrongCurrent") };
  }

  const hashClave = await hashPassword(parsed.data.newPassword);

  try {
    await updateClaveAndClearFlag(sessionId, hashClave);
  } catch {
    // Deliberately not logged: a driver error can embed the bound parameters,
    // and one of them is the new hash.
    return { error: t("errors.unexpected") };
  }

  // The flag travels in the session JWT (design D14): without a fresh cookie
  // the user would keep a token that still says "must change" and bounce back
  // here until the next login. Only the identity claims are carried over.
  const token = await signSession({
    sub: session.sub,
    login: session.login,
    rol: session.rol,
    nombre: session.nombre,
    debeCambiarClave: false,
  });
  await setSessionCookie(token);

  redirect("/");
}
