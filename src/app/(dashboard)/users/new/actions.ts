"use server";

import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/dal";
import { hashPassword } from "@/lib/auth/password";
import { canAssignRole, rolesQueCreanUsuarios } from "@/lib/auth/permissions";
import { ACCESS_DENIED_PATH } from "@/lib/auth/routes";
import { listCarreras } from "@/lib/data/carreras";
import { createUsuario } from "@/lib/data/users";
import { crearStaffSchema } from "@/lib/validations/users";

export type CreateStaffState = { error: string | null };

export async function createStaffAction(
  _prev: CreateStaffState,
  formData: FormData,
): Promise<CreateStaffState> {
  // Check (a): the caller's role must be able to assign at least one role.
  // Runs before any parsing (design.md decision 9).
  const session = await requireRole(...rolesQueCreanUsuarios);
  const t = await getTranslations("users.new");

  const parsed = crearStaffSchema.safeParse({
    login: formData.get("login"),
    password: formData.get("password"),
    nombreCompleto: formData.get("nombreCompleto"),
    correo: formData.get("correo"),
    telefono: formData.get("telefono"),
    rol: formData.get("rol"),
    // The career select is only rendered for coordinacion, so the field is
    // absent (null) for every other role; the schema accepts "" but not null.
    carreraId: formData.get("carreraId") ?? "",
  });
  if (!parsed.success) {
    return { error: t("errors.invalid") };
  }

  // Check (b): the requested role must be inside the caller's assignable
  // set. Runs after parsing (the target role must exist), before any
  // carrera check, hash or write (design.md decisions 9-10).
  if (!canAssignRole(session.rol, parsed.data.rol)) {
    redirect(ACCESS_DENIED_PATH);
  }

  const esCoordinacion = parsed.data.rol === "coordinacion";
  if (esCoordinacion && !parsed.data.carreraId) {
    return { error: t("errors.careerRequired") };
  }
  if (esCoordinacion) {
    const carreras = await listCarreras();
    const carreraExiste = carreras.some((c) => c.id === parsed.data.carreraId);
    if (!carreraExiste) {
      return { error: t("errors.invalidCarrera") };
    }
  }

  const hashClave = await hashPassword(parsed.data.password);

  try {
    await createUsuario({
      login: parsed.data.login,
      hashClave,
      rol: parsed.data.rol,
      nombreCompleto: parsed.data.nombreCompleto,
      correo: parsed.data.correo ?? null,
      telefono: parsed.data.telefono ?? null,
      cif: null,
      carreraId: esCoordinacion ? (parsed.data.carreraId ?? null) : null,
    });
  } catch {
    return { error: t("errors.duplicate") };
  }

  redirect("/users");
}
