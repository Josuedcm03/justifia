"use server";

import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { setSessionCookie } from "@/lib/auth/cookies";
import { hashPassword } from "@/lib/auth/password";
import { signSession } from "@/lib/auth/session";
import { listCarreras } from "@/lib/data/carreras";
import { createUsuario } from "@/lib/data/users";
import { registroEstudianteSchema } from "@/lib/validations/users";

export type RegisterState = { error: string | null };

export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const t = await getTranslations("auth.register");

  if (formData.get("password") !== formData.get("confirmPassword")) {
    return { error: t("errors.passwordMismatch") };
  }

  const parsed = registroEstudianteSchema.safeParse({
    login: formData.get("login"),
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

  const hashClave = await hashPassword(parsed.data.password);

  let userId: number;
  try {
    const nuevo = await createUsuario({
      login: parsed.data.login,
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
    login: parsed.data.login,
    rol: "estudiante",
    nombre: parsed.data.nombreCompleto,
  });
  await setSessionCookie(token);

  redirect("/");
}
