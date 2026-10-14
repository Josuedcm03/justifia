import { describe, expect, it } from "vitest";

import type { AuditEntityType } from "./types";
import {
  AUDIT_ACTIONS,
  AUDITABLE_ASIGNATURA_FIELDS,
  AUDITABLE_GRUPO_FIELDS,
} from "./types";

describe("closed auditable field lists", () => {
  it("lists the Asignatura fields in order", () => {
    expect(AUDITABLE_ASIGNATURA_FIELDS).toEqual([
      "codigo",
      "nombre",
      "carreraId",
      "horasTotales",
      "activo",
    ]);
  });

  it("lists the Grupo fields in order", () => {
    expect(AUDITABLE_GRUPO_FIELDS).toEqual([
      "asignaturaId",
      "periodo",
      "numeroGrupo",
      "docenteId",
      "activo",
      "origen",
      "dias",
    ]);
  });
});

describe("AUDIT_ACTIONS", () => {
  it("keeps the existing codes unchanged and adds exactly the eight catalog, five intake and seven review ones", () => {
    expect([...AUDIT_ACTIONS].sort()).toEqual(
      [
        "catalogo.importacion.aplicada",
        "usuario.creado",
        "usuario.actualizado",
        "asignatura.creada",
        "asignatura.actualizada",
        "asignatura.desactivada",
        "asignatura.reactivada",
        "grupo.creado",
        "grupo.actualizado",
        "grupo.desactivado",
        "grupo.reactivado",
        "solicitud.presentada",
        "documento.adjuntado",
        "documento.rechazado",
        "documento.eliminado",
        "documento.descargado",
        "solicitud.aprobada",
        "solicitud.rechazada",
        "solicitud.devuelta",
        "solicitud.corregida",
        "solicitud.consultada",
        "solicitud.cola.consultada",
        "documento.retirado",
      ].sort(),
    );
    expect(AUDIT_ACTIONS.slice(0, 3)).toEqual([
      "catalogo.importacion.aplicada",
      "usuario.creado",
      "usuario.actualizado",
    ]);
  });
});

describe("AuditEntityType", () => {
  it("includes Asignatura and Grupo next to the existing types", () => {
    const types: AuditEntityType[] = [
      "Importacion",
      "Usuario",
      "Asignatura",
      "Grupo",
    ];
    expect(types).toHaveLength(4);
  });

  it("includes Facultad for the queue read event", () => {
    const facultad: AuditEntityType = "Facultad";
    expect(facultad).toBe("Facultad");
  });
});
