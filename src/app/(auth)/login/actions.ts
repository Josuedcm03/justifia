"use server";

import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { clearSessionCookie, setSessionCookie } from "@/lib/auth/cookies";
import { verifyPassword } from "@/lib/auth/password";
import { signSession } from "@/lib/auth/session";
import { getUsuarioByLogin } from "@/lib/data/users";
import { loginSchema, type RolUsuario } from "@/lib/validations/auth";

export type LoginState = { error: string | null };

function safeNext(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

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

  const user = await getUsuarioByLogin(parsed.data.login);
  if (!user || !user.activo) {
    return { error: t("errors.invalid") };
  }

  const ok = await verifyPassword(parsed.data.password, user.hashClave);
  if (!ok) {
    return { error: t("errors.invalid") };
  }

  const token = await signSession({
    sub: String(user.id),
    login: user.login,
    rol: user.rol as RolUsuario,
    nombre: user.nombreCompleto,
  });
  await setSessionCookie(token);

  redirect(safeNext(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
