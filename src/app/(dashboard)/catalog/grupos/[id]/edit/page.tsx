import { notFound, redirect } from "next/navigation";

import { requireCatalogAccess } from "@/lib/auth/catalog-access";
import { getGrupoById } from "@/lib/data/grupos";
import { parseRecordId } from "@/lib/validations/catalog";

/**
 * The retired edit URL of a Grupo (CM-RTE-1, UG-4). Groups are edited under
 * their Asignatura now, so this page only forwards there. It is the one
 * redirect that needs data: the owner Asignatura is read from the scoped record,
 * after the access guard, and the target holds no more than that id.
 */
export default async function LegacyEditGrupoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { scope } = await requireCatalogAccess();

  // A scope of kind `none` reads nothing (CM-SCOPE-2): the user lands on the
  // Asignaturas list, which explains the missing Carrera.
  if (scope.kind === "none") redirect("/catalog/asignaturas");

  // A malformed id, an unknown group and a group of another Carrera all end in
  // the same `notFound()`, so the answer never says whether a group outside the
  // scope exists (CM-SCOPE-1). Both calls throw, so they stay out of any `try`
  // and the redirect is temporary (U4).
  const id = parseRecordId((await params).id);
  if (id === null) notFound();
  const record = await getGrupoById(scope, id);
  if (record === null) notFound();

  redirect(`/catalog/asignaturas/${record.asignaturaId}/grupos/${id}/edit`);
}
