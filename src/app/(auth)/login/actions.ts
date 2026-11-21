"use server";

import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { clearSessionCookie, setSessionCookie } from "@/lib/auth/cookies";
import { DUMMY_PASSWORD_HASH } from "@/lib/auth/dummy-hash";
import { verifyPassword } from "@/lib/auth/password";
import { safeNextPath } from "@/lib/auth/safe-next";
import { signSession } from "@/lib/auth/session";
import { findLoginAccount } from "@/lib/data/users";
import { loginSchema } from "@/lib/validations/auth";

export type LoginState = { error: string | null };

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const t = await getTranslations("auth");

  const parsed = loginSchema.safeParse({
    login: formData.get("login"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: t("errors.invalid") };
  }

  // The identifier is a CIF or an institutional email (FE-21); the stored
  // Login is never a key. Every failure below answers with the same message
  // (FE-23), and none sets a cookie.
  const user = await findLoginAccount(parsed.data.login);
  if (!user) {
    // No rate limiter exists (D13), so an unknown or ambiguous identifier
    // still pays one password check against a constant hash, and the time of
    // the answer does not tell it from a wrong password.
    await verifyPassword(parsed.data.password, DUMMY_PASSWORD_HASH);
    return { error: t("errors.invalid") };
  }
  if (!user.activo) {
    return { error: t("errors.invalid") };
  }

  const ok = await verifyPassword(parsed.data.password, user.hashClave);
  if (!ok) {
    return { error: t("errors.invalid") };
  }

  // "Mantener la sesión iniciada" (FE-32): a native checkbox posts "on"; any
  // other value is not the box. The claim is added only when true, so an
  // unchecked token has today's shape. Every failure above returned before
  // this point, so a failed attempt never signs or sets a cookie.
  const keep = formData.get("mantener") === "on";
  const token = await signSession({
    sub: String(user.id),
    login: user.login,
    rol: user.rol,
    nombre: user.nombreCompleto,
    debeCambiarClave: user.debeCambiarClave,
    ...(keep ? { mantenerSesion: true } : {}),
  });
  await setSessionCookie(token, keep);

  redirect(safeNextPath(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
