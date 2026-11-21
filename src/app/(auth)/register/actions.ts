"use server";

import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { env } from "@/env";
import { setSessionCookie } from "@/lib/auth/cookies";
import { hashPassword } from "@/lib/auth/password";
import { signSession } from "@/lib/auth/session";
import { listCarreras } from "@/lib/data/carreras";
import { createUsuario, getUsuarioByCorreo } from "@/lib/data/users";
import { deriveLogin } from "@/lib/import/normalize";
import { registroEstudianteSchema } from "@/lib/validations/users";

export type RegisterState = { error: string | null };

export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const t = await getTranslations("auth.register");

  // The real control behind REGISTRATION_OPEN: refuse before reading the form
  // or the database, so a closed switch can never create an account.
  if (!env.REGISTRATION_OPEN) {
    return { error: t("errors.closed") };
  }

  if (formData.get("password") !== formData.get("confirmPassword")) {
    return { error: t("errors.passwordMismatch") };
  }

  const parsed = registroEstudianteSchema.safeParse({
    password: formData.get("password"),
    nombreCompleto: formData.get("nombreCompleto"),
    correo: formData.get("correo"),
    telefono: formData.get("telefono"),
    cif: formData.get("cif"),
    carreraId: formData.get("carreraId"),
  });
  if (!parsed.success) {
    return { error: t("errors.invalid") };
  }

  const carreras = await listCarreras();
  const carreraExiste = carreras.some((c) => c.id === parsed.data.carreraId);
  if (!carreraExiste) {
    return { error: t("errors.invalidCarrera") };
  }

  // The Login is derived from the normalized email, never taken from the
  // request (FE-26); a Login over its column limit is shown as an email error
  // and never truncated or suffixed.
  const derived = deriveLogin(parsed.data.correo);
  if ("error" in derived) {
    return { error: t("errors.emailTooLong") };
  }

  // Correo is UNIQUE only case-sensitively and legacy rows may be mixed-case,
  // so an email equal to an existing one ignoring case is refused here (FE-22)
  // before anything is hashed or written.
  if (await getUsuarioByCorreo(parsed.data.correo)) {
    return { error: t("errors.duplicate") };
  }

  const hashClave = await hashPassword(parsed.data.password);

  let userId: number;
  try {
    const nuevo = await createUsuario({
      login: derived.login,
      hashClave,
      rol: "estudiante",
      nombreCompleto: parsed.data.nombreCompleto,
      correo: parsed.data.correo,
      telefono: parsed.data.telefono ?? null,
      cif: parsed.data.cif,
      carreraId: parsed.data.carreraId,
    });
    userId = nuevo.id;
  } catch {
    return { error: t("errors.duplicate") };
  }

  const token = await signSession({
    sub: String(userId),
    login: derived.login,
    rol: "estudiante",
    nombre: parsed.data.nombreCompleto,
  });
  await setSessionCookie(token);

  redirect("/");
}
