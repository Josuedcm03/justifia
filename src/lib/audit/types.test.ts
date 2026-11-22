import { describe, expect, it } from "vitest";

import type { AuditEntityType, AuditEvent } from "./types";
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
  it("keeps the existing codes unchanged and adds exactly the eight catalog, five intake, seven review, six remission, three inscripcion, two inscripcion read, three escalation, four escalation notice one coordinator read three report ones, one retention one and one manual document data one", () => {
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
        "remision.creada",
        "remision.enviada",
        "remision.fallida",
        "remision.bloqueada",
        "remision.reenviada",
        "documento.formato_especial",
        "inscripcion.creada",
        "inscripcion.reactivada",
        "inscripcion.desactivada",
        "inscripcion.lista.consultada",
        "inscripcion.estudiantes.consultada",
        "solicitud.ranking.consultado",
        "solicitud.reporte.consultado",
        "solicitud.reporte.descargado",
        "solicitud.escalada",
        "solicitud.escalamiento_resuelto",
        "solicitud.reporte_inasistencias",
        "escalamiento.notificacion_enviada",
        "escalamiento.notificacion_fallida",
        "escalamiento.notificacion_bloqueada",
        "escalamiento.notificacion_reenviada",
        "escalamiento.cola.consultada",
        "usuario.cancelado",
        "documento.datos_registrados",
      ].sort(),
    );
    expect(AUDIT_ACTIONS.slice(0, 3)).toEqual([
      "catalogo.importacion.aplicada",
      "usuario.creado",
      "usuario.actualizado",
    ]);
  });

  it("adds no inscripcion write action: the write set stays the three of student-enrollment (audit-log)", () => {
    const writes = AUDIT_ACTIONS.filter(
      (action) =>
        action.startsWith("inscripcion.") && !action.endsWith(".consultada"),
    );
    expect(writes).toEqual([
      "inscripcion.creada",
      "inscripcion.reactivada",
      "inscripcion.desactivada",
    ]);
  });

  it("registers the two staff read actions of the inscriptions, each once (D10)", () => {
    const reads = AUDIT_ACTIONS.filter((action) =>
      action.startsWith("inscripcion."),
    ).filter((action) => action.endsWith(".consultada"));
    expect(reads).toEqual([
      "inscripcion.lista.consultada",
      "inscripcion.estudiantes.consultada",
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

  it("includes Remision for the remission events", () => {
    const remision: AuditEntityType = "Remision";
    expect(remision).toBe("Remision");
  });

  it("includes Facultad for the queue read event", () => {
    const facultad: AuditEntityType = "Facultad";
    expect(facultad).toBe("Facultad");
  });

  it("includes Carrera for the coordination report events", () => {
    const carrera: AuditEntityType = "Carrera";
    expect(carrera).toBe("Carrera");
  });

  it("includes Inscripcion for the enrollment events", () => {
    const inscripcion: AuditEntityType = "Inscripcion";
    expect(inscripcion).toBe("Inscripcion");
  });
});

describe("AuditEntityType (escalation)", () => {
  it("includes Escalamiento and Carrera next to the existing types", () => {
    const types: AuditEntityType[] = ["Escalamiento", "Carrera", "Solicitud"];
    expect(types).toEqual(["Escalamiento", "Carrera", "Solicitud"]);
  });
});

describe("AuditEvent (manual document data, MD-31)", () => {
  it("maps documento.datos_registrados to the existing DocumentoRespaldo entity type", () => {
    // Compile-time pin: the assignment fails typecheck if the union changes
    // the entity type of this action.
    const entity: Extract<
      AuditEvent,
      { accion: "documento.datos_registrados" }
    >["entidadTipo"] = "DocumentoRespaldo";
    expect(AUDIT_ACTIONS).toContain("documento.datos_registrados");
    expect(entity).toBe("DocumentoRespaldo");
  });

  it("adds no audit entity type", () => {
    // `satisfies Record<AuditEntityType, true>` fails typecheck when a type is
    // added to or removed from the union without this list changing.
    const entityTypes = {
      Importacion: true,
      Usuario: true,
      Solicitud: true,
      DocumentoRespaldo: true,
      Facultad: true,
      Asignatura: true,
      Grupo: true,
      Remision: true,
      Inscripcion: true,
      Escalamiento: true,
      Carrera: true,
    } satisfies Record<AuditEntityType, true>;
    expect(Object.keys(entityTypes)).toHaveLength(11);
  });
});
