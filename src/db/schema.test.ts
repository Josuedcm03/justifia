import { PgDialect, getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { asignatura, grupo, inscripcion, rol, usuario } from "@/db/schema";

describe("rol table (design.md decisions 1, 5; state.yaml: surrogate_id)", () => {
  const cfg = getTableConfig(rol);

  it("Id is an identity primary key", () => {
    const id = cfg.columns.find((c) => c.name === "Id");
    expect(id).toBeDefined();
    expect(id?.primary).toBe(true);
    expect(id?.generatedIdentity).toBeDefined();
  });

  it("Codigo is varchar(20) NOT NULL and unique", () => {
    const codigo = cfg.columns.find((c) => c.name === "Codigo");
    expect(codigo).toBeDefined();
    expect(codigo?.notNull).toBe(true);
    expect(codigo?.isUnique).toBe(true);
    expect((codigo as unknown as { length?: number }).length).toBe(20);
  });

  it("Nombre is NOT NULL", () => {
    const nombre = cfg.columns.find((c) => c.name === "Nombre");
    expect(nombre).toBeDefined();
    expect(nombre?.notNull).toBe(true);
  });
});

describe("usuario — role reference (UR: User must have a role, Unknown role reference rejected)", () => {
  const cfg = getTableConfig(usuario);

  it("has a NOT NULL RolId column", () => {
    const rolId = cfg.columns.find((c) => c.name === "RolId");
    expect(rolId).toBeDefined();
    expect(rolId?.notNull).toBe(true);
  });

  it("RolId references Rol.Id via a foreign key", () => {
    const fk = cfg.foreignKeys.find(
      (f) => f.reference().columns[0].name === "RolId",
    );
    expect(fk).toBeDefined();
    const ref = fk!.reference();
    expect(getTableConfig(ref.foreignTable).name).toBe("Rol");
    expect(ref.foreignColumns[0].name).toBe("Id");
  });

  it("the legacy Rol column no longer exists", () => {
    const legacy = cfg.columns.find((c) => c.name === "Rol");
    expect(legacy).toBeUndefined();
  });
});

describe("asignatura table (AC: Asignatura shape and natural key)", () => {
  const cfg = getTableConfig(asignatura);

  it("Codigo is varchar(32) NOT NULL and unique (natural key)", () => {
    const codigo = cfg.columns.find((c) => c.name === "Codigo");
    expect(codigo?.notNull).toBe(true);
    expect(codigo?.isUnique).toBe(true);
    expect((codigo as unknown as { length?: number }).length).toBe(32);
  });

  it("carries Nombre, CarreraId (FK to Carrera) and HorasTotales, all NOT NULL", () => {
    for (const name of ["Nombre", "CarreraId", "HorasTotales"]) {
      expect(cfg.columns.find((c) => c.name === name)?.notNull).toBe(true);
    }
    const fk = cfg.foreignKeys.find(
      (f) => f.reference().columns[0].name === "CarreraId",
    );
    expect(getTableConfig(fk!.reference().foreignTable).name).toBe("Carrera");
  });

  it("has CK_Asignatura_Horas checking HorasTotales > 0 (X9)", () => {
    const ck = cfg.checks.find((c) => c.name === "CK_Asignatura_Horas");
    expect(ck).toBeDefined();
    const text = new PgDialect().sqlToQuery(ck!.value).sql;
    expect(text).toBe('"Asignatura"."HorasTotales" > 0');
  });
});

describe("grupo table (AC: Grupo shape, natural key, partial index)", () => {
  const cfg = getTableConfig(grupo);

  it("NumeroGrupo is varchar(12) text (X3) and Periodo is varchar(12)", () => {
    const numero = cfg.columns.find((c) => c.name === "NumeroGrupo");
    expect(numero?.notNull).toBe(true);
    expect((numero as unknown as { length?: number }).length).toBe(12);
    expect(cfg.columns.find((c) => c.name === "Periodo")?.notNull).toBe(true);
  });

  it("Activo is NOT NULL and defaults to true (X1)", () => {
    const activo = cfg.columns.find((c) => c.name === "Activo");
    expect(activo?.notNull).toBe(true);
    expect(activo?.default).toBe(true);
  });

  it("has a unique constraint on (AsignaturaId, Periodo, NumeroGrupo)", () => {
    const cols = cfg.uniqueConstraints.map((u) => u.columns.map((c) => c.name));
    expect(cols).toContainEqual(["AsignaturaId", "Periodo", "NumeroGrupo"]);
  });

  it("declares IX_Grupo_Docente and a PARTIAL IX_Grupo_Activo (D11)", () => {
    const docente = cfg.indexes.find(
      (i) => i.config.name === "IX_Grupo_Docente",
    );
    expect(docente).toBeDefined();
    const activo = cfg.indexes.find((i) => i.config.name === "IX_Grupo_Activo");
    expect(activo).toBeDefined();
    expect(activo!.config.where).toBeDefined();
    expect(docente!.config.where).toBeUndefined();
  });
});

describe("inscripcion table (AC: Estudiante role integrity, duplicate enrollment)", () => {
  const cfg = getTableConfig(inscripcion);

  it("has a composite primary key (EstudianteId, GrupoId)", () => {
    expect(cfg.primaryKeys).toHaveLength(1);
    expect(cfg.primaryKeys[0].columns.map((c) => c.name)).toEqual([
      "EstudianteId",
      "GrupoId",
    ]);
  });

  it("Activo is NOT NULL and defaults to true (X1)", () => {
    const activo = cfg.columns.find((c) => c.name === "Activo");
    expect(activo?.notNull).toBe(true);
    expect(activo?.default).toBe(true);
  });

  it("has IX_Inscripcion_Grupo and NO partial index (D11)", () => {
    expect(
      cfg.indexes.find((i) => i.config.name === "IX_Inscripcion_Grupo"),
    ).toBeDefined();
    expect(cfg.indexes.filter((i) => i.config.where !== undefined)).toEqual([]);
  });
});

describe("usuario additions (AC: Duplicate emails; FPC: DebeCambiarClave default false)", () => {
  const cfg = getTableConfig(usuario);

  it("Correo stays nullable but is unique", () => {
    const correo = cfg.columns.find((c) => c.name === "Correo");
    expect(correo?.notNull).toBe(false);
    expect(correo?.isUnique).toBe(true);
  });

  it("DebeCambiarClave is NOT NULL and defaults to false", () => {
    const flag = cfg.columns.find((c) => c.name === "DebeCambiarClave");
    expect(flag).toBeDefined();
    expect(flag?.notNull).toBe(true);
    expect(flag?.default).toBe(false);
  });
});
