import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/dal";
import { canImportCatalog } from "@/lib/auth/permissions";
import { ACCESS_DENIED_PATH } from "@/lib/auth/routes";
import { buildTemplate } from "@/lib/import/template";
import { rolesUsuario } from "@/lib/validations/auth";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// The proxy never sees `/api`, so this handler guards itself, and in this
// order: authentication and the forced-change redirect (`requireRole`), then
// the single import predicate. No bytes exist before both have passed.
export async function GET(): Promise<Response> {
  const session = await requireRole(...rolesUsuario);
  if (!canImportCatalog(session.rol)) redirect(ACCESS_DENIED_PATH);

  const bytes = await buildTemplate();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Disposition": 'attachment; filename="PlantillaCatalogo.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
