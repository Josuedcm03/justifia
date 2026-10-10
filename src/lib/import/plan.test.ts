import { describe, expect, it } from "vitest";

import { AUDITABLE_USER_FIELDS } from "@/lib/audit/types";
import { encodeDias, type DiaSemana } from "@/lib/catalog/dias";

import {
  CARRERA,
  makeAsignaturaRow,
  makeGrupoRow,
  makeSnapshot,
  makeWorkbook,
} from "./__fixtures__/plan-fixtures";
import {
  MAX_ACCOUNT_EVENTS_PER_APPLY,
  MAX_NEW_ACCOUNTS_PER_APPLY,
} from "./limits";
import { planImport } from "./plan";
import type { GrupoRow, UsuarioRow } from "./types";

function reasons(plan: ReturnType<typeof planImport>) {
  return plan.errors.map((e) => e.reason);
}

describe("planImport — Stage A: Asignaturas", () => {
  it("creates a new Asignatura by natural key Codigo", () => {
    const plan = planImport(
      makeWorkbook({
        asignaturas: [
          {
            Codigo: "MAT-101",
            Nombre: "Cálculo",
            Carrera: CARRERA.nombre,
            HorasTotales: "64",
          },
        ],
      }),
      makeSnapshot(),
    );
    expect(plan.ok).toBe(true);
    expect(plan.counts.Asignatura).toMatchObject({
      create: 1,
      update: 0,
      unchanged: 0,
    });
    expect(plan.writes.asignaturas).toEqual([
      {
        kind: "create",
        codigo: "MAT-101",
        nombre: "Cálculo",
        carreraId: CARRERA.id,
        horasTotales: 64,
      },
    ]);
  });

  it("updates an Asignatura in place when a value changed", () => {
    const existing = makeAsignaturaRow({
      id: 9,
      codigo: "MAT-101",
      nombre: "Cálculo I",
      carreraId: CARRERA.id,
      horasTotales: 64,
    });
    const plan = planImport(
      makeWorkbook({
        asignaturas: [
          {
            Codigo: "MAT-101",
            Nombre: "Cálculo I",
            Carrera: CARRERA.nombre,
            HorasTotales: "96",
          },
        ],
      }),
      makeSnapshot({ asignaturas: [existing] }),
    );
    expect(plan.counts.Asignatura).toMatchObject({
      update: 1,
      create: 0,
      unchanged: 0,
    });
    expect(plan.writes.asignaturas).toEqual([
      {
        kind: "update",
        id: 9,
        nombre: "Cálculo I",
        carreraId: CARRERA.id,
        horasTotales: 96,
      },
    ]);
  });

  it("counts an unchanged Asignatura as unchanged and writes nothing for it", () => {
    const existing = makeAsignaturaRow({
      id: 9,
      codigo: "MAT-101",
      nombre: "Cálculo I",
      carreraId: CARRERA.id,
      horasTotales: 64,
    });
    const plan = planImport(
      makeWorkbook({
        asignaturas: [
          {
            Codigo: "MAT-101",
            Nombre: "Cálculo I",
            Carrera: CARRERA.nombre,
            HorasTotales: "64",
          },
        ],
      }),
      makeSnapshot({ asignaturas: [existing] }),
    );
    expect(plan.counts.Asignatura).toMatchObject({
      unchanged: 1,
      create: 0,
      update: 0,
    });
    expect(plan.writes.asignaturas).toEqual([]);
  });

  it("rejects an unresolved Carrera reference as a row error", () => {
    const plan = planImport(
      makeWorkbook({
        asignaturas: [
          {
            Codigo: "MAT-101",
            Nombre: "Cálculo",
            Carrera: "Carrera Fantasma",
            HorasTotales: "64",
          },
        ],
      }),
      makeSnapshot(),
    );
    expect(plan.ok).toBe(false);
    expect(reasons(plan)).toContain("carrera.unresolved");
    expect(plan.counts.Asignatura.error).toBe(1);
    expect(plan.writes.asignaturas).toEqual([]);
  });

  it.each([
    ["0", "horasTotales.invalid"],
    ["-8", "horasTotales.invalid"],
    ["", "horasTotales.required"],
  ])("rejects HorasTotales=%s as %s", (horas, reason) => {
    const plan = planImport(
      makeWorkbook({
        asignaturas: [
          {
            Codigo: "MAT-101",
            Nombre: "Cálculo",
            Carrera: CARRERA.nombre,
            HorasTotales: horas,
          },
        ],
      }),
      makeSnapshot(),
    );
    expect(plan.ok).toBe(false);
    expect(reasons(plan)).toContain(reason);
  });

  it("never deactivates an Asignatura absent from the workbook", () => {
    const existing = makeAsignaturaRow({
      id: 9,
      codigo: "MAT-101",
      nombre: "Cálculo I",
      carreraId: CARRERA.id,
      horasTotales: 64,
    });
    const plan = planImport(
      makeWorkbook({}),
      makeSnapshot({ asignaturas: [existing] }),
    );
    expect(plan.counts.Asignatura.deactivate).toBe(0);
    expect(plan.writes.asignaturas).toEqual([]);
  });
});

describe("planImport — Stage B: Docentes identity resolution and login derivation", () => {
  it("creates a new docente account with a login derived from the whole normalized email", () => {
    const plan = planImport(
      makeWorkbook({
        docentes: [{ Correo: "Juan.Perez@UAM.EDU", Nombre: "Juan Pérez" }],
      }),
      makeSnapshot(),
    );
    expect(plan.ok).toBe(true);
    expect(plan.accountsToCreate).toBe(1);
    expect(plan.writes.usuarios).toEqual([
      {
        kind: "create",
        correo: "juan.perez@uam.edu",
        login: "juan.perez@uam.edu",
        nombreCompleto: "Juan Pérez",
        telefono: null,
      },
    ]);
  });

  it("matches an existing docente by email regardless of case", () => {
    const existing: UsuarioRow = {
      id: 5,
      login: "juan.perez@uam.edu",
      correo: "juan.perez@uam.edu",
      cif: null,
      nombreCompleto: "Juan Pérez",
      telefono: null,
      carreraId: null,
      activo: true,
      rol: "docente",
    };
    const plan = planImport(
      makeWorkbook({
        docentes: [{ Correo: "JUAN.PEREZ@uam.edu", Nombre: "Juan Pérez" }],
      }),
      makeSnapshot({ usuarios: [existing] }),
    );
    expect(plan.counts.Usuario).toMatchObject({
      unchanged: 1,
      create: 0,
      update: 0,
    });
    expect(plan.accountsToCreate).toBe(0);
  });

  it("two rows normalizing to the same email is an error", () => {
    const plan = planImport(
      makeWorkbook({
        docentes: [
          { Correo: "a@uam.edu", Nombre: "A" },
          { Correo: "A@UAM.EDU", Nombre: "A Otra Vez" },
        ],
      }),
      makeSnapshot(),
    );
    expect(reasons(plan)).toContain("correo.duplicate");
  });

  it("an email that belongs to another (non-docente) account is an error", () => {
    const existing: UsuarioRow = {
      id: 5,
      login: "a@uam.edu",
      correo: "a@uam.edu",
      cif: "C-1",
      nombreCompleto: "Ana",
      telefono: null,
      carreraId: null,
      activo: true,
      rol: "secretaria",
    };
    const plan = planImport(
      makeWorkbook({ docentes: [{ Correo: "a@uam.edu", Nombre: "Ana" }] }),
      makeSnapshot({ usuarios: [existing] }),
    );
    expect(reasons(plan)).toContain("correo.assignedToOtherRole");
  });

  it("a login over 60 chars is a row error, never truncated", () => {
    const longLocal = "a".repeat(55);
    const plan = planImport(
      makeWorkbook({
        docentes: [{ Correo: `${longLocal}@uam.edu`, Nombre: "Largo" }],
      }),
      makeSnapshot(),
    );
    expect(reasons(plan)).toContain("correo.loginTooLong");
  });

  it("a login collision against an unrelated existing account is an error", () => {
    const existing: UsuarioRow = {
      id: 1,
      login: "nuevo@uam.edu",
      correo: null,
      cif: null,
      nombreCompleto: "Cuenta previa",
      telefono: null,
      carreraId: null,
      activo: true,
      rol: "secretaria",
    };
    const plan = planImport(
      makeWorkbook({
        docentes: [{ Correo: "nuevo@uam.edu", Nombre: "Nuevo Docente" }],
      }),
      makeSnapshot({ usuarios: [existing] }),
    );
    expect(reasons(plan)).toContain("login.collision");
  });

  it("existing accounts keep their credentials: an update carries no password/login change", () => {
    const existing: UsuarioRow = {
      id: 5,
      login: "juan.perez@uam.edu",
      correo: "juan.perez@uam.edu",
      cif: null,
      nombreCompleto: "Juan Perez",
      telefono: null,
      carreraId: null,
      activo: true,
      rol: "docente",
    };
    const plan = planImport(
      makeWorkbook({
        docentes: [{ Correo: "juan.perez@uam.edu", Nombre: "Juan Pérez" }],
      }),
      makeSnapshot({ usuarios: [existing] }),
    );
    expect(plan.counts.Usuario).toMatchObject({ update: 1 });
    expect(plan.writes.usuarios).toEqual([
      {
        kind: "update",
        id: 5,
        nombreCompleto: "Juan Pérez",
        telefono: null,
        changedFields: ["nombreCompleto"],
      },
    ]);
  });

  it("changedFields only ever names AUDITABLE_USER_FIELDS", () => {
    const existing: UsuarioRow = {
      id: 5,
      login: "juan.perez@uam.edu",
      correo: "juan.perez@uam.edu",
      cif: null,
      nombreCompleto: "Juan Perez",
      telefono: "555-0000",
      carreraId: null,
      activo: true,
      rol: "docente",
    };
    const plan = planImport(
      makeWorkbook({
        docentes: [
          {
            Correo: "juan.perez@uam.edu",
            Nombre: "Juan Pérez",
            Telefono: "555-1111",
          },
        ],
      }),
      makeSnapshot({ usuarios: [existing] }),
    );
    const write = plan.writes.usuarios[0];
    if (write.kind !== "update") throw new Error("expected an update");
    for (const field of write.changedFields) {
      expect(AUDITABLE_USER_FIELDS).toContain(field);
    }
    expect([...write.changedFields].sort()).toEqual([
      "nombreCompleto",
      "telefono",
    ]);
  });

  it("an inactive matched account stays inactive (plan carries no reactivation of a Usuario)", () => {
    const existing: UsuarioRow = {
      id: 5,
      login: "juan.perez@uam.edu",
      correo: "juan.perez@uam.edu",
      cif: null,
      nombreCompleto: "Juan Pérez",
      telefono: null,
      carreraId: null,
      activo: false,
      rol: "docente",
    };
    const plan = planImport(
      makeWorkbook({
        docentes: [{ Correo: "juan.perez@uam.edu", Nombre: "Juan Pérez" }],
      }),
      makeSnapshot({ usuarios: [existing] }),
    );
    // no "activo" field appears anywhere in the write (open assumption).
    const write = plan.writes.usuarios[0];
    expect(
      write === undefined || write.kind !== "update" || !("activo" in write),
    ).toBe(true);
  });
});

describe("planImport — Stage C: Grupos", () => {
  function baseSnapshot() {
    return makeSnapshot({
      asignaturas: [
        makeAsignaturaRow({
          id: 1,
          codigo: "MAT-101",
          nombre: "Cálculo",
          carreraId: CARRERA.id,
          horasTotales: 64,
        }),
      ],
      usuarios: [
        {
          id: 2,
          login: "doc@uam.edu",
          correo: "doc@uam.edu",
          cif: null,
          nombreCompleto: "Doc",
          telefono: null,
          carreraId: null,
          activo: true,
          rol: "docente",
        },
      ],
    });
  }

  it("creates a new Grupo referencing a docente already in the snapshot", () => {
    const plan = planImport(
      makeWorkbook({
        grupos: [
          {
            CodigoAsignatura: "MAT-101",
            Periodo: "2026-S1",
            NumGrupo: "1",
            CorreoDocente: "doc@uam.edu",
          },
        ],
      }),
      baseSnapshot(),
    );
    expect(plan.ok).toBe(true);
    expect(plan.counts.Grupo).toMatchObject({ create: 1 });
  });

  it("creates a new Grupo referencing a docente created in the SAME workbook", () => {
    const plan = planImport(
      makeWorkbook({
        docentes: [{ Correo: "nuevo@uam.edu", Nombre: "Nuevo" }],
        grupos: [
          {
            CodigoAsignatura: "MAT-101",
            Periodo: "2026-S1",
            NumGrupo: "1",
            CorreoDocente: "nuevo@uam.edu",
          },
        ],
      }),
      baseSnapshot(),
    );
    expect(plan.ok).toBe(true);
    expect(plan.counts.Grupo).toMatchObject({ create: 1 });
  });

  it.each(["2026-s1", "2026-S3", "26-S1", "2026-S1 "])(
    "rejects invalid Periodo %s",
    (periodo) => {
      const plan = planImport(
        makeWorkbook({
          grupos: [
            {
              CodigoAsignatura: "MAT-101",
              Periodo: periodo,
              NumGrupo: "1",
              CorreoDocente: "doc@uam.edu",
            },
          ],
        }),
        baseSnapshot(),
      );
      expect(plan.ok).toBe(false);
      expect(reasons(plan)).toContain("periodo.invalid");
    },
  );

  it("a duplicate natural key inside one sheet is an error naming the row", () => {
    const plan = planImport(
      makeWorkbook({
        grupos: [
          {
            CodigoAsignatura: "MAT-101",
            Periodo: "2026-S1",
            NumGrupo: "1",
            CorreoDocente: "doc@uam.edu",
          },
          {
            CodigoAsignatura: "MAT-101",
            Periodo: "2026-S1",
            NumGrupo: "1",
            CorreoDocente: "doc@uam.edu",
          },
        ],
      }),
      baseSnapshot(),
    );
    expect(reasons(plan)).toContain("grupo.duplicate");
    expect(plan.errors.some((e) => e.row === 3)).toBe(true);
  });

  it("the same number in another period or asignatura is allowed", () => {
    const plan = planImport(
      makeWorkbook({
        grupos: [
          {
            CodigoAsignatura: "MAT-101",
            Periodo: "2026-S1",
            NumGrupo: "1",
            CorreoDocente: "doc@uam.edu",
          },
          {
            CodigoAsignatura: "MAT-101",
            Periodo: "2026-S2",
            NumGrupo: "1",
            CorreoDocente: "doc@uam.edu",
          },
        ],
      }),
      baseSnapshot(),
    );
    expect(plan.ok).toBe(true);
    expect(plan.counts.Grupo.create).toBe(2);
  });

  it.each(["administrador", "coordinacion", "secretaria", "estudiante"])(
    "rejects a %s as the group's docente (role integrity)",
    (rol) => {
      const snapshot = baseSnapshot();
      snapshot.usuarios.push({
        id: 3,
        login: "otro@uam.edu",
        correo: "otro@uam.edu",
        cif: rol === "estudiante" ? "C-9" : null,
        nombreCompleto: "Otro",
        telefono: null,
        carreraId: null,
        activo: true,
        rol: rol as
          "administrador" | "coordinacion" | "secretaria" | "estudiante",
      });
      const plan = planImport(
        makeWorkbook({
          grupos: [
            {
              CodigoAsignatura: "MAT-101",
              Periodo: "2026-S1",
              NumGrupo: "1",
              CorreoDocente: "otro@uam.edu",
            },
          ],
        }),
        snapshot,
      );
      expect(reasons(plan)).toContain("docente.unresolved");
    },
  );

  it("rejects an unknown docente", () => {
    const plan = planImport(
      makeWorkbook({
        grupos: [
          {
            CodigoAsignatura: "MAT-101",
            Periodo: "2026-S1",
            NumGrupo: "1",
            CorreoDocente: "fantasma@uam.edu",
          },
        ],
      }),
      baseSnapshot(),
    );
    expect(reasons(plan)).toContain("docente.unresolved");
  });

  it("a docente reassignment on an existing Grupo is an update", () => {
    const snapshot = baseSnapshot();
    snapshot.usuarios.push({
      id: 4,
      login: "otro-doc@uam.edu",
      correo: "otro-doc@uam.edu",
      cif: null,
      nombreCompleto: "Otro Doc",
      telefono: null,
      carreraId: null,
      activo: true,
      rol: "docente",
    });
    snapshot.grupos.push(
      makeGrupoRow({
        id: 10,
        asignaturaId: 1,
        periodo: "2026-S1",
        numeroGrupo: "1",
        docenteId: 2,
      }),
    );
    const plan = planImport(
      makeWorkbook({
        grupos: [
          {
            CodigoAsignatura: "MAT-101",
            Periodo: "2026-S1",
            NumGrupo: "1",
            CorreoDocente: "otro-doc@uam.edu",
          },
        ],
      }),
      snapshot,
    );
    expect(plan.counts.Grupo).toMatchObject({ update: 1, create: 0 });
    expect(plan.writes.grupos).toEqual([
      {
        kind: "update",
        id: 10,
        docenteCorreo: "otro-doc@uam.edu",
        reactivated: false,
      },
    ]);
  });
});

describe("planImport — Stage D: deactivate absent, never delete", () => {
  it("a grupo present in the snapshot and absent from the workbook is deactivated", () => {
    const snapshot = makeSnapshot({
      asignaturas: [
        makeAsignaturaRow({
          id: 1,
          codigo: "MAT-101",
          nombre: "Cálculo",
          carreraId: CARRERA.id,
          horasTotales: 64,
        }),
      ],
      usuarios: [
        {
          id: 2,
          login: "doc@uam.edu",
          correo: "doc@uam.edu",
          cif: null,
          nombreCompleto: "Doc",
          telefono: null,
          carreraId: null,
          activo: true,
          rol: "docente",
        },
      ],
      grupos: [
        makeGrupoRow({
          id: 10,
          asignaturaId: 1,
          periodo: "2026-S1",
          numeroGrupo: "1",
          docenteId: 2,
        }),
      ],
    });
    const plan = planImport(makeWorkbook({}), snapshot);
    expect(plan.deactivateGrupoIds).toEqual([10]);
    expect(plan.counts.Grupo.deactivate).toBe(1);
  });

  it("a corrected re-import reactivates a deactivated grupo as an update", () => {
    const snapshot = makeSnapshot({
      asignaturas: [
        makeAsignaturaRow({
          id: 1,
          codigo: "MAT-101",
          nombre: "Cálculo",
          carreraId: CARRERA.id,
          horasTotales: 64,
        }),
      ],
      usuarios: [
        {
          id: 2,
          login: "doc@uam.edu",
          correo: "doc@uam.edu",
          cif: null,
          nombreCompleto: "Doc",
          telefono: null,
          carreraId: null,
          activo: true,
          rol: "docente",
        },
      ],
      grupos: [
        makeGrupoRow({
          id: 10,
          asignaturaId: 1,
          periodo: "2026-S1",
          numeroGrupo: "1",
          docenteId: 2,
          activo: false,
        }),
      ],
    });
    const plan = planImport(
      makeWorkbook({
        grupos: [
          {
            CodigoAsignatura: "MAT-101",
            Periodo: "2026-S1",
            NumGrupo: "1",
            CorreoDocente: "doc@uam.edu",
          },
        ],
      }),
      snapshot,
    );
    expect(plan.deactivateGrupoIds).toEqual([]);
    expect(plan.counts.Grupo).toMatchObject({ update: 1, create: 0 });
    expect(plan.writes.grupos).toEqual([
      {
        kind: "update",
        id: 10,
        docenteCorreo: "doc@uam.edu",
        reactivated: true,
      },
    ]);
  });

  it("the plan never contains a delete of any kind", () => {
    const plan = planImport(makeWorkbook({}), makeSnapshot());
    expect(JSON.stringify(plan)).not.toMatch(/delete/i);
  });

  it("Asignatura rows are never deactivated (no deactivate list exists for them)", () => {
    const plan = planImport(makeWorkbook({}), makeSnapshot());
    expect("deactivateAsignaturaIds" in plan).toBe(false);
  });
});

// Shared by the WU4 scenarios below (reactivation, inactive references, manual
// groups, precedence): one subject MAT-101 and one docente doc@uam.edu.
const MAT = {
  id: 1,
  codigo: "MAT-101",
  nombre: "Cálculo",
  carreraId: CARRERA.id,
  horasTotales: 64,
};
const matCells = (over: Record<string, string> = {}) => ({
  Codigo: "MAT-101",
  Nombre: "Cálculo",
  Carrera: CARRERA.nombre,
  HorasTotales: "64",
  ...over,
});
const grupoCells = (over: Record<string, string> = {}) => ({
  CodigoAsignatura: "MAT-101",
  Periodo: "2026-S1",
  NumGrupo: "1",
  CorreoDocente: "doc@uam.edu",
  ...over,
});
const docente = (id: number, correo: string): UsuarioRow => ({
  id,
  login: correo,
  correo,
  cif: null,
  nombreCompleto: "Doc",
  telefono: null,
  carreraId: null,
  activo: true,
  rol: "docente",
});
/** Group `id` of MAT-101, period 2026-S1, number = id, docente 2. */
const grupo = (id: number, over: Partial<GrupoRow> = {}) =>
  makeGrupoRow({
    id,
    asignaturaId: 1,
    periodo: "2026-S1",
    numeroGrupo: String(id),
    docenteId: 2,
    ...over,
  });

describe("planImport — reactivation of an inactive Asignatura (CEI-UPS, CEI-PREV, AC-LIFE)", () => {
  const inactive = makeSnapshot({
    asignaturas: [makeAsignaturaRow({ ...MAT, activo: false })],
  });

  it("reactivates an inactive match even when every field equals the stored value", () => {
    const plan = planImport(
      makeWorkbook({ asignaturas: [matCells()] }),
      inactive,
    );
    expect(plan.writes.asignaturas).toEqual([
      {
        kind: "update",
        id: 1,
        nombre: "Cálculo",
        carreraId: CARRERA.id,
        horasTotales: 64,
        reactivated: true,
      },
    ]);
    expect(plan.counts.Asignatura).toMatchObject({ update: 1, unchanged: 0 });
    expect(plan.asignaturasToReactivate).toBe(1);
  });

  it("reactivates and carries the new values when fields also changed", () => {
    const plan = planImport(
      makeWorkbook({ asignaturas: [matCells({ HorasTotales: "96" })] }),
      inactive,
    );
    expect(plan.writes.asignaturas).toEqual([
      expect.objectContaining({ horasTotales: 96, reactivated: true }),
    ]);
    expect(plan.counts.Asignatura.update).toBe(1);
  });

  it("an active match stays unchanged, or is an ordinary update, never flagged", () => {
    const active = makeSnapshot({ asignaturas: [makeAsignaturaRow(MAT)] });
    const same = planImport(
      makeWorkbook({ asignaturas: [matCells()] }),
      active,
    );
    expect(same.writes.asignaturas).toEqual([]);
    expect(same.counts.Asignatura.unchanged).toBe(1);
    const edited = planImport(
      makeWorkbook({ asignaturas: [matCells({ HorasTotales: "96" })] }),
      active,
    );
    expect(edited.writes.asignaturas).toHaveLength(1);
    expect(edited.writes.asignaturas[0]).not.toHaveProperty("reactivated");
    expect(same.asignaturasToReactivate).toBe(0);
    expect(edited.asignaturasToReactivate).toBe(0);
  });

  it("asignaturasToReactivate equals the number of reactivated writes", () => {
    const plan = planImport(
      makeWorkbook({
        asignaturas: [
          matCells(),
          matCells({ Codigo: "FIS-1", Nombre: "Física" }),
          matCells({ Codigo: "NEW-1", Nombre: "Nueva" }),
        ],
      }),
      makeSnapshot({
        asignaturas: [
          makeAsignaturaRow({ ...MAT, activo: false }),
          makeAsignaturaRow({
            ...MAT,
            id: 2,
            codigo: "FIS-1",
            nombre: "Física",
            activo: false,
          }),
        ],
      }),
    );
    const flagged = plan.writes.asignaturas.filter(
      (w) => w.kind === "update" && w.reactivated,
    );
    expect(flagged).toHaveLength(2);
    expect(plan.asignaturasToReactivate).toBe(2);
    expect(plan.counts.Asignatura).toMatchObject({ create: 1, update: 2 });
  });
});

describe("planImport — inactive Asignatura references (CEI-VAL, CEI-UPS, CEI-DEA, AC-LIFE)", () => {
  const snapshot = makeSnapshot({
    asignaturas: [makeAsignaturaRow({ ...MAT, activo: false })],
    usuarios: [docente(2, "doc@uam.edu")],
  });

  it("a Grupos row for an inactive Asignatura absent from the workbook is a row error naming it", () => {
    const plan = planImport(makeWorkbook({ grupos: [grupoCells()] }), snapshot);
    expect(plan.ok).toBe(false);
    expect(plan.errors).toEqual([
      {
        sheet: "Grupos",
        row: 2,
        reason: "asignatura.inactive",
        value: "MAT-101",
      },
    ]);
    expect(plan.counts.Grupo.error).toBe(1);
    // not reactivated, and its Grupo is not created
    expect(plan.writes.asignaturas).toEqual([]);
    expect(plan.writes.grupos).toEqual([]);
    expect(plan.asignaturasToReactivate).toBe(0);
  });

  it("an Asignatura declared in the workbook is not an error on account of its inactive state", () => {
    const plan = planImport(
      makeWorkbook({ asignaturas: [matCells()], grupos: [grupoCells()] }),
      snapshot,
    );
    expect(plan.ok).toBe(true);
    expect(plan.asignaturasToReactivate).toBe(1);
    expect(plan.writes.grupos).toEqual([
      expect.objectContaining({ kind: "create", asignaturaCodigo: "MAT-101" }),
    ]);
  });

  it("a code in neither the workbook nor the database keeps asignatura.unresolved", () => {
    const plan = planImport(
      makeWorkbook({ grupos: [grupoCells({ CodigoAsignatura: "NOPE-1" })] }),
      snapshot,
    );
    expect(plan.errors.map((e) => e.reason)).toEqual(["asignatura.unresolved"]);
  });

  it("an inactive Asignatura whose own row is invalid is not resolved by the workbook", () => {
    const plan = planImport(
      makeWorkbook({
        asignaturas: [matCells({ Carrera: "Carrera Fantasma" })],
        grupos: [grupoCells()],
      }),
      snapshot,
    );
    expect(plan.errors.map((e) => e.reason)).toEqual([
      "carrera.unresolved",
      "asignatura.inactive",
    ]);
    expect(plan.asignaturasToReactivate).toBe(0);
  });

  it("an inactive Asignatura absent from the workbook gets no write", () => {
    const plan = planImport(makeWorkbook({}), snapshot);
    expect(plan.ok).toBe(true);
    expect(plan.writes.asignaturas).toEqual([]);
    expect(plan.counts.Asignatura).toMatchObject({ update: 0, deactivate: 0 });
  });

  it("inactive groups of a reactivated Asignatura that the workbook omits get no write", () => {
    const plan = planImport(
      makeWorkbook({ asignaturas: [matCells()] }),
      makeSnapshot({
        ...snapshot,
        grupos: [grupo(10, { activo: false })],
      }),
    );
    expect(plan.asignaturasToReactivate).toBe(1);
    expect(plan.writes.grupos).toEqual([]);
    expect(plan.deactivateGrupoIds).toEqual([]);
    expect(plan.counts.Grupo).toMatchObject({ update: 0, deactivate: 0 });
  });
});

describe("planImport — manual groups (CEI-PREV, CEI-DEA, CM-GRP-5, AC-ORIG)", () => {
  const snapshotWith = (grupos: GrupoRow[]) =>
    makeSnapshot({
      asignaturas: [makeAsignaturaRow(MAT)],
      usuarios: [docente(2, "doc@uam.edu"), docente(3, "otro@uam.edu")],
      grupos,
    });

  it.each([
    { absent: 0, manual: 0 },
    { absent: 4, manual: 0 },
    { absent: 4, manual: 1 },
    { absent: 4, manual: 4 },
  ])(
    "counts $manual manual of $absent deactivated grupos",
    ({ absent, manual }) => {
      const grupos = Array.from({ length: absent }, (_, i) =>
        grupo(i + 1, { origen: i < manual ? "manual" : "importacion" }),
      );
      const plan = planImport(makeWorkbook({}), snapshotWith(grupos));
      expect(plan.deactivateGrupoIds).toHaveLength(absent);
      expect(plan.counts.Grupo.deactivate).toBe(absent);
      expect(plan.manualGruposToDeactivate).toBe(manual);
    },
  );

  it("counts only what the apply deactivates: not an inactive manual group, not a listed one", () => {
    const plan = planImport(
      makeWorkbook({ grupos: [grupoCells()] }),
      snapshotWith([
        grupo(1, { origen: "manual" }), // listed in the workbook
        grupo(2, { origen: "manual" }), // absent: deactivated and counted
        grupo(3, { origen: "manual", activo: false }), // already inactive
      ]),
    );
    expect(plan.deactivateGrupoIds).toEqual([2]);
    expect(plan.manualGruposToDeactivate).toBe(1);
  });

  it("updates a listed manual group (reassigned or reactivated) and carries no origin", () => {
    const reassigned = planImport(
      makeWorkbook({ grupos: [grupoCells({ CorreoDocente: "otro@uam.edu" })] }),
      snapshotWith([grupo(1, { origen: "manual" })]),
    );
    expect(reassigned.writes.grupos).toEqual([
      {
        kind: "update",
        id: 1,
        docenteCorreo: "otro@uam.edu",
        reactivated: false,
      },
    ]);
    const reactivated = planImport(
      makeWorkbook({ grupos: [grupoCells()] }),
      snapshotWith([grupo(1, { origen: "manual", activo: false })]),
    );
    expect(reactivated.writes.grupos).toEqual([
      {
        kind: "update",
        id: 1,
        docenteCorreo: "doc@uam.edu",
        reactivated: true,
      },
    ]);
    expect(reactivated.manualGruposToDeactivate).toBe(0);
  });
});

describe("planImport — precedence: the workbook wins (CEI-PREC)", () => {
  it("overwrites a manual Asignatura name and a manual docente as plain updates, with no warning field", () => {
    const plan = planImport(
      makeWorkbook({ asignaturas: [matCells()], grupos: [grupoCells()] }),
      makeSnapshot({
        asignaturas: [makeAsignaturaRow({ ...MAT, nombre: "Editado a mano" })],
        usuarios: [docente(2, "doc@uam.edu"), docente(3, "otro@uam.edu")],
        grupos: [grupo(1, { docenteId: 3, origen: "manual" })],
      }),
    );
    expect(plan.writes.asignaturas).toEqual([
      {
        kind: "update",
        id: 1,
        nombre: "Cálculo",
        carreraId: CARRERA.id,
        horasTotales: 64,
      },
    ]);
    expect(plan.writes.grupos).toEqual([
      {
        kind: "update",
        id: 1,
        docenteCorreo: "doc@uam.edu",
        reactivated: false,
      },
    ]);
  });

  it("with no manual groups and no inactive asignatura the plan is what it was before the change", () => {
    const plan = planImport(
      makeWorkbook({
        asignaturas: [
          matCells({ HorasTotales: "96" }),
          matCells({ Codigo: "FIS-1", Nombre: "Física", HorasTotales: "32" }),
        ],
      }),
      makeSnapshot({
        asignaturas: [makeAsignaturaRow(MAT)],
        grupos: [grupo(20)],
      }),
    );
    expect(plan.writes).toEqual({
      asignaturas: [
        {
          kind: "update",
          id: 1,
          nombre: "Cálculo",
          carreraId: CARRERA.id,
          horasTotales: 96,
        },
        {
          kind: "create",
          codigo: "FIS-1",
          nombre: "Física",
          carreraId: CARRERA.id,
          horasTotales: 32,
        },
      ],
      usuarios: [],
      grupos: [],
    });
    expect(plan.counts.Asignatura).toEqual({
      create: 1,
      update: 1,
      unchanged: 0,
      deactivate: 0,
      error: 0,
    });
    expect(plan.deactivateGrupoIds).toEqual([20]);
    expect(plan.asignaturasToReactivate).toBe(0);
    expect(plan.manualGruposToDeactivate).toBe(0);
  });
});

describe("planImport — Stage E: idempotency and error aggregation", () => {
  it("importing the same workbook twice yields all unchanged", () => {
    const workbook = makeWorkbook({
      asignaturas: [
        {
          Codigo: "MAT-101",
          Nombre: "Cálculo",
          Carrera: CARRERA.nombre,
          HorasTotales: "64",
        },
      ],
      docentes: [{ Correo: "doc@uam.edu", Nombre: "Doc" }],
      grupos: [
        {
          CodigoAsignatura: "MAT-101",
          Periodo: "2026-S1",
          NumGrupo: "1",
          CorreoDocente: "doc@uam.edu",
        },
      ],
    });
    const first = planImport(workbook, makeSnapshot());

    const snapshotAfterApply = makeSnapshot({
      asignaturas: [
        makeAsignaturaRow({
          id: 1,
          codigo: "MAT-101",
          nombre: "Cálculo",
          carreraId: CARRERA.id,
          horasTotales: 64,
        }),
      ],
      usuarios: [
        {
          id: 2,
          login: "doc@uam.edu",
          correo: "doc@uam.edu",
          cif: null,
          nombreCompleto: "Doc",
          telefono: null,
          carreraId: null,
          activo: true,
          rol: "docente",
        },
      ],
      grupos: [
        makeGrupoRow({
          id: 10,
          asignaturaId: 1,
          periodo: "2026-S1",
          numeroGrupo: "1",
          docenteId: 2,
        }),
      ],
    });
    const second = planImport(workbook, snapshotAfterApply);

    expect(first.ok).toBe(true);
    expect(second.counts).toEqual({
      Asignatura: {
        create: 0,
        update: 0,
        unchanged: 1,
        deactivate: 0,
        error: 0,
      },
      Usuario: { create: 0, update: 0, unchanged: 1, deactivate: 0, error: 0 },
      Grupo: { create: 0, update: 0, unchanged: 1, deactivate: 0, error: 0 },
    });
    expect(second.accountsToCreate).toBe(0);
    expect(second.deactivateGrupoIds).toEqual([]);
  });

  it("all row errors are returned, not just the first", () => {
    const plan = planImport(
      makeWorkbook({
        asignaturas: [
          { Codigo: "A1", Nombre: "N", Carrera: "Nadie", HorasTotales: "0" },
          {
            Codigo: "A2",
            Nombre: "N2",
            Carrera: "Tampoco",
            HorasTotales: "-1",
          },
        ],
      }),
      makeSnapshot(),
    );
    expect(plan.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("plan.ok is false whenever errors.length > 0", () => {
    const plan = planImport(
      makeWorkbook({
        asignaturas: [
          { Codigo: "A1", Nombre: "N", Carrera: "Nadie", HorasTotales: "8" },
        ],
      }),
      makeSnapshot(),
    );
    expect(plan.errors.length).toBeGreaterThan(0);
    expect(plan.ok).toBe(false);
  });

  it("a preview with errors still reports counts for the valid rest", () => {
    const plan = planImport(
      makeWorkbook({
        asignaturas: [
          {
            Codigo: "MAT-101",
            Nombre: "Cálculo",
            Carrera: CARRERA.nombre,
            HorasTotales: "64",
          },
          { Codigo: "BAD", Nombre: "N", Carrera: "Nadie", HorasTotales: "8" },
        ],
      }),
      makeSnapshot(),
    );
    expect(plan.ok).toBe(false);
    expect(plan.counts.Asignatura).toMatchObject({ create: 1, error: 1 });
  });
});

describe("planImport — Stage F: caps as validation, not throws", () => {
  function docenteRows(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      Correo: `docente${i}@uam.edu`,
      Nombre: `Docente ${i}`,
    }));
  }

  it("accountsToCreate at the cap is accepted", () => {
    const plan = planImport(
      makeWorkbook({ docentes: docenteRows(MAX_NEW_ACCOUNTS_PER_APPLY) }),
      makeSnapshot(),
    );
    expect(reasons(plan)).not.toContain("accountsToCreate.capExceeded");
  });

  it("accountsToCreate over the cap is a validation error, not a throw", () => {
    expect(() => {
      const plan = planImport(
        makeWorkbook({ docentes: docenteRows(MAX_NEW_ACCOUNTS_PER_APPLY + 1) }),
        makeSnapshot(),
      );
      expect(plan.ok).toBe(false);
      expect(reasons(plan)).toContain("accountsToCreate.capExceeded");
    }).not.toThrow();
  });

  it("created + updated account events over MAX_ACCOUNT_EVENTS_PER_APPLY is a validation error", () => {
    const existing = Array.from(
      { length: MAX_ACCOUNT_EVENTS_PER_APPLY + 1 },
      (_, i) => ({
        id: i + 1,
        login: `docente${i}@uam.edu`,
        correo: `docente${i}@uam.edu`,
        cif: null,
        nombreCompleto: `Old ${i}`,
        telefono: null,
        carreraId: null,
        activo: true,
        rol: "docente" as const,
      }),
    );
    const plan = planImport(
      makeWorkbook({
        docentes: existing.map((u, i) => ({
          Correo: u.correo!,
          Nombre: `New ${i}`,
        })),
      }),
      makeSnapshot({ usuarios: existing }),
    );
    expect(plan.ok).toBe(false);
    expect(reasons(plan)).toContain("accountEvents.capExceeded");
  });
});

describe("planImport — Stage G: purity", () => {
  it("never mutates its inputs", () => {
    const workbook = makeWorkbook({
      asignaturas: [
        {
          Codigo: "MAT-101",
          Nombre: "Cálculo",
          Carrera: CARRERA.nombre,
          HorasTotales: "64",
        },
      ],
      docentes: [{ Correo: "doc@uam.edu", Nombre: "Doc" }],
      grupos: [
        {
          CodigoAsignatura: "MAT-101",
          Periodo: "2026-S1",
          NumGrupo: "1",
          CorreoDocente: "doc@uam.edu",
        },
      ],
    });
    const snapshot = makeSnapshot();
    const workbookClone = structuredClone(workbook);
    const snapshotClone = structuredClone(snapshot);

    planImport(workbook, snapshot);

    expect(workbook).toEqual(workbookClone);
    expect(snapshot).toEqual(snapshotClone);
  });

  it("same inputs give equal output", () => {
    const workbook = makeWorkbook({
      asignaturas: [
        {
          Codigo: "MAT-101",
          Nombre: "Cálculo",
          Carrera: CARRERA.nombre,
          HorasTotales: "64",
        },
      ],
    });
    const snapshot = makeSnapshot();
    expect(planImport(workbook, snapshot)).toEqual(
      planImport(structuredClone(workbook), structuredClone(snapshot)),
    );
  });

  it("imports no node:crypto, no @/db, and no Date.now/new Date/Math.random", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/import/plan.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/node:crypto/);
    expect(source).not.toMatch(/@\/db/);
    expect(source).not.toMatch(/Date\.now|new Date\(|Math\.random/);
  });
});

// Meeting days of a Grupo (CEI-DIAS-2, CEI-DIAS-3). "Column absent" workbooks
// carry no `Dias` key at all; "empty cell" ones carry `Dias: ""`.
const days = (...d: DiaSemana[]) => encodeDias(d);
const MON = days("lunes");
const MON_WED = days("lunes", "miercoles");
const daysSnapshot = (grupos: GrupoRow[]) =>
  makeSnapshot({
    asignaturas: [makeAsignaturaRow(MAT)],
    usuarios: [docente(2, "doc@uam.edu"), docente(3, "otro@uam.edu")],
    grupos,
  });
const planDays = (cells: Record<string, string>, grupos: GrupoRow[] = []) =>
  planImport(makeWorkbook({ grupos: [cells] }), daysSnapshot(grupos));

describe("planImport — Grupo days, part 1 (CEI-DIAS-3, CEI-DIAS-2)", () => {
  it("column absent: a matched group keeps its days and is unchanged", () => {
    const plan = planDays(grupoCells(), [grupo(1, { dias: MON_WED })]);
    expect(plan.counts.Grupo).toMatchObject({ unchanged: 1, update: 0 });
    expect(plan.writes.grupos).toEqual([]);
  });

  it("column absent: a new group is created with no dias key", () => {
    const plan = planDays(grupoCells());
    expect(plan.writes.grupos).toEqual([
      {
        kind: "create",
        asignaturaCodigo: "MAT-101",
        periodo: "2026-S1",
        numeroGrupo: "1",
        docenteCorreo: "doc@uam.edu",
      },
    ]);
  });

  it("non-empty cell replaces the stored days with an update carrying the mask", () => {
    const plan = planDays(grupoCells({ Dias: "Martes, Jueves" }), [
      grupo(1, { dias: MON }),
    ]);
    expect(plan.counts.Grupo).toMatchObject({ update: 1, unchanged: 0 });
    expect(plan.writes.grupos).toEqual([
      {
        kind: "update",
        id: 1,
        docenteCorreo: "doc@uam.edu",
        reactivated: false,
        dias: days("martes", "jueves"),
      },
    ]);
  });

  it("empty cell, every other value equal: unchanged, no write, no days change", () => {
    const plan = planDays(grupoCells({ Dias: "" }), [grupo(1, { dias: MON })]);
    expect(plan.counts.Grupo).toMatchObject({ unchanged: 1, update: 0 });
    expect(plan.writes.grupos).toEqual([]);
  });

  it("empty cell with a different docente: update keeping the days (no dias key)", () => {
    const plan = planDays(
      grupoCells({ Dias: "", CorreoDocente: "otro@uam.edu" }),
      [grupo(1, { dias: MON })],
    );
    expect(plan.counts.Grupo).toMatchObject({ update: 1 });
    expect(plan.writes.grupos).toEqual([
      {
        kind: "update",
        id: 1,
        docenteCorreo: "otro@uam.edu",
        reactivated: false,
      },
    ]);
  });

  it("empty cell on a new group: created with no dias key", () => {
    const plan = planDays(grupoCells({ Dias: " , " }));
    expect(plan.writes.grupos).toEqual([
      {
        kind: "create",
        asignaturaCodigo: "MAT-101",
        periodo: "2026-S1",
        numeroGrupo: "1",
        docenteCorreo: "doc@uam.edu",
      },
    ]);
  });

  it("a new group with `Lun, Vie` is created with the Monday + Friday mask", () => {
    const plan = planDays(grupoCells({ Dias: "Lun, Vie" }));
    expect(plan.writes.grupos).toEqual([
      expect.objectContaining({
        kind: "create",
        dias: days("lunes", "viernes"),
      }),
    ]);
  });

  it("the same set in another spelling and order is unchanged", () => {
    const plan = planDays(grupoCells({ Dias: "mie, Lunes" }), [
      grupo(1, { dias: MON_WED }),
    ]);
    expect(plan.counts.Grupo).toMatchObject({ unchanged: 1, update: 0 });
    expect(plan.writes.grupos).toEqual([]);
  });
});

describe("planImport — Grupo days, part 2 (CEI-DIAS-3, CEI-PREC)", () => {
  it("a days-only difference is exactly one grupo update and nothing else", () => {
    const plan = planImport(
      makeWorkbook({
        asignaturas: [matCells()],
        docentes: [{ Correo: "doc@uam.edu", Nombre: "Doc" }],
        grupos: [grupoCells({ Dias: "Martes" })],
      }),
      makeSnapshot({
        asignaturas: [makeAsignaturaRow(MAT)],
        usuarios: [docente(2, "doc@uam.edu")],
        grupos: [grupo(1, { dias: MON })],
      }),
    );
    expect(plan.ok).toBe(true);
    expect(plan.counts).toEqual({
      Asignatura: {
        create: 0,
        update: 0,
        unchanged: 1,
        deactivate: 0,
        error: 0,
      },
      Usuario: { create: 0, update: 0, unchanged: 1, deactivate: 0, error: 0 },
      Grupo: { create: 0, update: 1, unchanged: 0, deactivate: 0, error: 0 },
    });
    expect(plan.accountsToCreate).toBe(0);
    expect(plan.deactivateGrupoIds).toEqual([]);
  });

  it("`Lunes, Funday` is a dias.invalid row error naming the token, blocking a 200-row workbook", () => {
    const rows: Record<string, string>[] = Array.from({ length: 201 }, (_, i) =>
      grupoCells({ NumGrupo: String(i + 1) }),
    );
    rows[7] = { ...rows[7], Dias: "Lunes, Funday" }; // Excel row 9
    const plan = planImport(makeWorkbook({ grupos: rows }), daysSnapshot([]));
    expect(plan.ok).toBe(false);
    expect(plan.errors).toEqual([
      { sheet: "Grupos", row: 9, reason: "dias.invalid", value: "Funday" },
    ]);
    expect(plan.counts.Grupo).toMatchObject({ create: 200, error: 1 });
    expect(plan.writes.grupos).toHaveLength(200);
  });

  it.each([
    ["Monday"],
    ["Lunes;Martes"],
    ["Lun-Vie"],
    ["Lunes y Martes"],
    ["Luness"],
    ["1"],
  ])("the invalid cell %j yields dias.invalid naming that token", (cell) => {
    const plan = planDays(grupoCells({ Dias: cell }));
    expect(plan.errors).toEqual([
      { sheet: "Grupos", row: 2, reason: "dias.invalid", value: cell },
    ]);
    expect(plan.counts.Grupo).toMatchObject({ error: 1, create: 0 });
    expect(plan.writes.grupos).toEqual([]);
  });

  it("an invalid token on a row with an unresolved Asignatura reports dias.invalid only", () => {
    const plan = planDays(
      grupoCells({ CodigoAsignatura: "NOPE-1", Dias: "Funday" }),
    );
    expect(reasons(plan)).toEqual(["dias.invalid"]);
    expect(plan.counts.Grupo.error).toBe(1);
  });

  it("no write of any days scenario carries dias: 0", () => {
    const cells = [
      undefined,
      "",
      " , ",
      "Lunes",
      "Martes, Jueves",
      "mie, Lunes",
    ];
    const stored = [undefined, 0, MON, MON_WED];
    for (const cell of cells) {
      for (const dias of stored) {
        for (const activo of [true, false]) {
          const plan = planDays(
            cell === undefined ? grupoCells() : grupoCells({ Dias: cell }),
            dias === undefined ? [] : [grupo(1, { dias, activo })],
          );
          for (const w of plan.writes.grupos) {
            if ("dias" in w) expect(w.dias).toBeGreaterThan(0);
            if (!cell || cell.replace(/[ ,]/g, "") === "")
              expect(w).not.toHaveProperty("dias");
          }
        }
      }
    }
  });

  it("an inactive group is reactivated with the cell's days, or without a dias key for an empty cell", () => {
    const stored = [grupo(1, { activo: false, dias: MON })];
    expect(
      planDays(grupoCells({ Dias: "Viernes" }), stored).writes.grupos,
    ).toEqual([
      {
        kind: "update",
        id: 1,
        docenteCorreo: "doc@uam.edu",
        reactivated: true,
        dias: days("viernes"),
      },
    ]);
    expect(planDays(grupoCells({ Dias: "" }), stored).writes.grupos).toEqual([
      {
        kind: "update",
        id: 1,
        docenteCorreo: "doc@uam.edu",
        reactivated: true,
      },
    ]);
  });

  it("an active group absent from the workbook is deactivated and its days are not touched", () => {
    const plan = planImport(
      makeWorkbook({}),
      daysSnapshot([grupo(1, { dias: MON_WED })]),
    );
    expect(plan.deactivateGrupoIds).toEqual([1]);
    expect(plan.writes.grupos).toEqual([]);
    expect(JSON.stringify(plan)).not.toMatch(/dias/i);
  });

  it("re-planning the same workbook after applying its writes yields unchanged only", () => {
    const workbook = makeWorkbook({
      grupos: [
        grupoCells({ Dias: "Lun, Vie" }),
        grupoCells({ NumGrupo: "2", Dias: "Martes" }),
      ],
    });
    const first = planImport(workbook, daysSnapshot([grupo(2, { dias: MON })]));
    expect(first.counts.Grupo).toMatchObject({ create: 1, update: 1 });
    const create = first.writes.grupos.find((w) => w.kind === "create");
    const update = first.writes.grupos.find((w) => w.kind === "update");
    const second = planImport(
      workbook,
      daysSnapshot([
        grupo(1, { dias: create?.dias }),
        grupo(2, { dias: update?.dias }),
      ]),
    );
    expect(second.counts.Grupo).toEqual({
      create: 0,
      update: 0,
      unchanged: 2,
      deactivate: 0,
      error: 0,
    });
  });

  it("a manual days edit is overwritten silently by a non-empty cell, and left alone by an empty cell or no column", () => {
    const stored = [grupo(1, { origen: "manual", dias: days("sabado") })];
    const overwritten = planDays(grupoCells({ Dias: "Lunes" }), stored);
    expect(overwritten.writes.grupos).toEqual([
      {
        kind: "update",
        id: 1,
        docenteCorreo: "doc@uam.edu",
        reactivated: false,
        dias: MON,
      },
    ]);
    expect(planDays(grupoCells({ Dias: "" }), stored).writes.grupos).toEqual(
      [],
    );
    expect(planDays(grupoCells(), stored).writes.grupos).toEqual([]);
  });

  // Characterization pin (17.19): a workbook with no `Dias` key plans as before.
  it("a workbook with no Dias key keeps the plan shape: no days key, count or field anywhere", () => {
    const plan = planImport(
      makeWorkbook({
        grupos: [
          grupoCells(),
          grupoCells({ NumGrupo: "2", CorreoDocente: "otro@uam.edu" }),
          grupoCells({ NumGrupo: "3" }),
        ],
      }),
      daysSnapshot([
        grupo(2, { dias: MON }),
        grupo(3, { activo: false, dias: MON_WED }),
        grupo(4, { dias: MON }),
      ]),
    );
    expect(Object.keys(plan).sort()).toEqual([
      "accountsToCreate",
      "asignaturasToReactivate",
      "counts",
      "deactivateGrupoIds",
      "errors",
      "manualGruposToDeactivate",
      "ok",
      "writes",
    ]);
    expect(Object.keys(plan.counts).sort()).toEqual([
      "Asignatura",
      "Grupo",
      "Usuario",
    ]);
    expect(Object.keys(plan.counts.Grupo).sort()).toEqual([
      "create",
      "deactivate",
      "error",
      "unchanged",
      "update",
    ]);
    expect(Object.keys(plan.writes).sort()).toEqual([
      "asignaturas",
      "grupos",
      "usuarios",
    ]);
    expect(plan.counts.Grupo).toEqual({
      create: 1,
      update: 2,
      unchanged: 0,
      deactivate: 1,
      error: 0,
    });
    expect(JSON.stringify(plan)).not.toMatch(/dias/i);
  });
});
