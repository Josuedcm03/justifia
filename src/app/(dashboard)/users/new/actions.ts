"use server";

import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/dal";
import { hashPassword } from "@/lib/auth/password";
import { canAssignRole, rolesQueCreanUsuarios } from "@/lib/auth/permissions";
import { ACCESS_DENIED_PATH } from "@/lib/auth/routes";
import { listCarreras } from "@/lib/data/carreras";
import { RolDesconocidoError } from "@/lib/data/roles";
import {
  createUsuario,
  getUserFacultadId,
  getUsuarioByCorreo,
} from "@/lib/data/users";
import { deriveLogin } from "@/lib/import/normalize";
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
    // An unusable email gets its own message (FE-28); the other fields share
    // the generic one.
    const emailIssue = parsed.error.issues.some((i) => i.path[0] === "correo");
    return { error: t(emailIssue ? "errors.emailInvalid" : "errors.invalid") };
  }

  // Check (b): the requested role must be inside the caller's assignable
  // set. Runs after parsing (the target role must exist), before any
  // carrera check, hash or write (design.md decisions 9-10).
  if (!canAssignRole(session.rol, parsed.data.rol)) {
    redirect(ACCESS_DENIED_PATH);
  }

  // The Login is derived from the normalized email, never taken from the
  // request (FE-27); a Login over its column limit is shown as an email error
  // and never truncated or suffixed.
  const derived = deriveLogin(parsed.data.correo);
  if ("error" in derived) {
    return { error: t("errors.emailTooLong") };
  }

  // Correo is UNIQUE only case-sensitively and legacy rows may be mixed-case,
  // so an email equal to an existing one ignoring case is refused here (FE-22,
  // FE-28) before anything is hashed or written.
  if (await getUsuarioByCorreo(parsed.data.correo)) {
    return { error: t("errors.duplicate") };
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

  // SR-16: a new secretaria inherits the facultad of the creating coordinator's
  // carrera, read from the database now. It never comes from the form, so a
  // forged `facultadId` is not even parsed. A creator with no carrera has no
  // facultad to give: refuse with an ordinary form error before anything is
  // hashed or written.
  let facultadId: number | null = null;
  if (parsed.data.rol === "secretaria") {
    facultadId = await getUserFacultadId(Number(session.sub));
    if (facultadId === null) {
      return { error: t("errors.facultadRequired") };
    }
  }

  const hashClave = await hashPassword(parsed.data.password);

  try {
    await createUsuario({
      login: derived.login,
      hashClave,
      rol: parsed.data.rol,
      nombreCompleto: parsed.data.nombreCompleto,
      correo: parsed.data.correo,
      telefono: parsed.data.telefono ?? null,
      cif: null,
      carreraId: esCoordinacion ? (parsed.data.carreraId ?? null) : null,
      facultadId,
    });
  } catch (err) {
    // A config error (an assignable role missing from the catalog) is not a
    // duplicate login; only rethrow narrows the catch-all (design.md
    // decision 7). A derived Login or an email that already exists lands in
    // the catch-all too: an ordinary form error, no redirect, no suffix.
    if (err instanceof RolDesconocidoError) throw err;
    return { error: t("errors.duplicate") };
  }

  redirect("/users");
}
