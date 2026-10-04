import { describe, expect, it } from "vitest";

import { AUDITABLE_USER_FIELDS } from "@/lib/audit/types";

import {
  CARRERA,
  makeSnapshot,
  makeWorkbook,
} from "./__fixtures__/plan-fixtures";
import {
  MAX_ACCOUNT_EVENTS_PER_APPLY,
  MAX_NEW_ACCOUNTS_PER_APPLY,
} from "./limits";
import { planImport } from "./plan";
import type { AsignaturaRow, UsuarioRow } from "./types";

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
    const existing: AsignaturaRow = {
      id: 9,
      codigo: "MAT-101",
      nombre: "Cálculo I",
      carreraId: CARRERA.id,
      horasTotales: 64,
    };
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
    const existing: AsignaturaRow = {
      id: 9,
      codigo: "MAT-101",
      nombre: "Cálculo I",
      carreraId: CARRERA.id,
      horasTotales: 64,
    };
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
    const existing: AsignaturaRow = {
      id: 9,
      codigo: "MAT-101",
      nombre: "Cálculo I",
      carreraId: CARRERA.id,
      horasTotales: 64,
    };
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
        {
          id: 1,
          codigo: "MAT-101",
          nombre: "Cálculo",
          carreraId: CARRERA.id,
          horasTotales: 64,
        },
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
    snapshot.grupos.push({
      id: 10,
      asignaturaId: 1,
      periodo: "2026-S1",
      numeroGrupo: "1",
      docenteId: 2,
      activo: true,
    });
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
        {
          id: 1,
          codigo: "MAT-101",
          nombre: "Cálculo",
          carreraId: CARRERA.id,
          horasTotales: 64,
        },
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
        {
          id: 10,
          asignaturaId: 1,
          periodo: "2026-S1",
          numeroGrupo: "1",
          docenteId: 2,
          activo: true,
        },
      ],
    });
    const plan = planImport(makeWorkbook({}), snapshot);
    expect(plan.deactivateGrupoIds).toEqual([10]);
    expect(plan.counts.Grupo.deactivate).toBe(1);
  });

  it("a corrected re-import reactivates a deactivated grupo as an update", () => {
    const snapshot = makeSnapshot({
      asignaturas: [
        {
          id: 1,
          codigo: "MAT-101",
          nombre: "Cálculo",
          carreraId: CARRERA.id,
          horasTotales: 64,
        },
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
        {
          id: 10,
          asignaturaId: 1,
          periodo: "2026-S1",
          numeroGrupo: "1",
          docenteId: 2,
          activo: false,
        },
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
        {
          id: 1,
          codigo: "MAT-101",
          nombre: "Cálculo",
          carreraId: CARRERA.id,
          horasTotales: 64,
        },
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
        {
          id: 10,
          asignaturaId: 1,
          periodo: "2026-S1",
          numeroGrupo: "1",
          docenteId: 2,
          activo: true,
        },
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
