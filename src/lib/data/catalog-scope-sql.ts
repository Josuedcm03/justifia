import "server-only";

import { and, eq, sql, type SQL } from "drizzle-orm";

import { asignatura, grupo } from "@/db/schema";
import type { CatalogScope } from "@/lib/catalog/scope";

function unhandled(scope: never): never {
  throw new Error(`Unhandled catalog scope: ${JSON.stringify(scope)}`);
}

/**
 * The ONLY place a scope becomes SQL (design decision 2). `all` adds nothing,
 * `carrera` filters by the Asignatura's carrera, `none` is a literal `false`.
 */
export function asignaturaInScope(scope: CatalogScope): SQL | undefined {
  switch (scope.kind) {
    case "all":
      return undefined;
    case "carrera":
      return eq(asignatura.carreraId, scope.carreraId);
    case "none":
      return sql`false`;
    default:
      return unhandled(scope);
  }
}

/** One Asignatura by id, inside the scope. Zero rows means "not found". */
export function asignaturaRowInScope(scope: CatalogScope, id: number): SQL {
  const byId = eq(asignatura.id, id);
  const inScope = asignaturaInScope(scope);
  return (inScope ? and(byId, inScope) : byId) as SQL;
}

/** One Grupo by id; a Grupo is scoped through its Asignatura (subquery). */
export function grupoRowInScope(scope: CatalogScope, id: number): SQL {
  const byId = eq(grupo.id, id);
  const inScope = asignaturaInScope(scope);
  if (!inScope) return byId;
  const inScopeAsignatura = sql`${grupo.asignaturaId} in (select ${asignatura.id} from ${asignatura} where ${inScope})`;
  return and(byId, inScopeAsignatura) as SQL;
}
