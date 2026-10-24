// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { eventoAuditoria } from "@/db/audit-schema";
import { inscripcion, usuario } from "@/db/schema";

import { createDbDouble, type Step } from "./test-support/db-double";

vi.mock("server-only", () => ({}));

const { holder } = vi.hoisted(() => ({ holder: { current: null as unknown } }));

vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_t, prop) =>
        (holder.current as Record<string | symbol, unknown>)[prop],
    },
  ),
}));

import { dropGroup, enrollInGroup } from "./enrollment-write";

const S = 7;
const G = 9;
const STUDENT = { kind: "select", rows: [{ id: S }] } as const;
const TARGET = {
  kind: "select",
  rows: [{ id: G, asignaturaId: 3, periodo: "2026-S2" }],
} as const;
const AUDIT = { kind: "insert" } as const;

function use(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

function render(where: unknown) {
  return new PgDialect().sqlToQuery(where as SQL);
}

const occurrences = (text: string, part: string) => text.split(part).length - 1;

const kinds = (double: ReturnType<typeof use>) =>
  double.log.map((entry) => entry.kind);

beforeEach(() => {
  holder.current = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("enrollInGroup outcomes (RF-16, RN-21)", () => {
  const CREATED = {
    ok: true,
    kind: "created",
    grupoId: G,
    replaced: [],
  } as const;

  it.each([
    {
      label: "created: no inscripcion yet",
      pair: [],
      result: CREATED,
      statements: ["select", "select", "select", "update", "insert", "insert"],
      audit: "inscripcion.creada",
    },
    {
      label: "reactivated: inactive inscripcion reuses the row",
      pair: [{ activo: false }],
      result: { ...CREATED, kind: "reactivated" },
      statements: ["select", "select", "select", "update", "update", "insert"],
      audit: "inscripcion.reactivada",
    },
  ] as const)("$label", async ({ pair, result, statements, audit }) => {
    const double = use([
      STUDENT,
      TARGET,
      { kind: "select", rows: pair },
      { kind: "update", rows: [] },
      { kind: pair.length === 0 ? "insert" : "update" },
      AUDIT,
    ]);

    expect(await enrollInGroup(S, G)).toEqual(result);

    expect(kinds(double)).toEqual(statements);
    expect(double.exhausted).toBe(true);
    const auditRows = double.log.at(-1)?.values as { accion: string }[];
    expect(auditRows.map((row) => row.accion)).toEqual([audit]);
  });

  it("already enrolled changes nothing and writes no audit row", async () => {
    const double = use([
      STUDENT,
      TARGET,
      { kind: "select", rows: [{ activo: true }] },
    ]);

    expect(await enrollInGroup(S, G)).toEqual({
      ok: false,
      reason: "already_enrolled",
    });
    expect(kinds(double)).toEqual(["select", "select", "select"]);
  });

  it.each([
    "not the latest period",
    "grupo inactive",
    "asignatura inactive",
    "unknown group id",
  ])("refuses a group that is not offered (%s): nothing stored", async () => {
    // The offered-group predicate is pinned below; every case reads no row.
    const double = use([STUDENT, { kind: "select", rows: [] }]);

    expect(await enrollInGroup(S, G)).toEqual({
      ok: false,
      reason: "not_eligible",
    });
    expect(kinds(double)).toEqual(["select", "select"]);
    expect(double.exhausted).toBe(true);
  });

  it("issues no count statement, so a twelfth enrollment is accepted", async () => {
    const double = use([
      STUDENT,
      TARGET,
      { kind: "select", rows: [] },
      { kind: "update", rows: [] },
      { kind: "insert" },
      AUDIT,
    ]);

    expect((await enrollInGroup(S, G)).ok).toBe(true);
    expect(kinds(double).filter((kind) => kind === "select")).toHaveLength(3);
  });

  it("evaluates the latest period at write time over active grupos of active asignaturas", async () => {
    const double = use([STUDENT, { kind: "select", rows: [] }]);
    await enrollInGroup(S, G);

    const query = render(double.log[1].where);
    expect(query.sql).toContain("max(");
    expect(occurrences(query.sql, '"Grupo"."Activo"')).toBe(2);
    expect(occurrences(query.sql, '"Asignatura"."Activo"')).toBe(2);
    expect(query.params).toContain(G);
  });
});

describe("role integrity (RNF-01, academic-catalog role table)", () => {
  it.each([
    "docente",
    "secretaria",
    "coordinacion",
    "administrador",
    "estudiante inactive",
    "unknown id",
  ])("refuses %s with no further statement and no audit row", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    expect(await enrollInGroup(S, G)).toEqual({
      ok: false,
      reason: "not_student",
    });
    expect(kinds(double)).toEqual(["select"]);
    expect(double.exhausted).toBe(true);
  });

  it("locks the student's own active estudiante row first, only that row", async () => {
    const double = use([STUDENT, { kind: "select", rows: [] }]);
    await enrollInGroup(S, G);

    const [lock] = double.log;
    expect(lock.lock).toEqual({
      strength: "no key update",
      config: { of: usuario },
    });
    const query = render(lock.where);
    expect(query.sql).toContain('"Rol"."Codigo"');
    expect(query.sql).toContain('"Usuario"."Activo"');
    expect(query.params).toEqual(expect.arrayContaining([S, "estudiante"]));
  });
});

describe("replace and audit (RF-16, RNF-12, RNF-06)", () => {
  it("deactivates only same-asignatura same-period siblings, then audits last on the same tx", async () => {
    const double = use([
      STUDENT,
      TARGET,
      { kind: "select", rows: [] },
      { kind: "update", rows: [{ grupoId: 4 }, { grupoId: 5 }] },
      { kind: "insert" },
      AUDIT,
    ]);

    expect(await enrollInGroup(S, G)).toEqual({
      ok: true,
      kind: "created",
      grupoId: G,
      replaced: [4, 5],
    });

    expect(double.transactions).toBe(1);
    expect(double.log.every((entry) => entry.inTransaction)).toBe(true);
    const sibling = double.log[3];
    expect(sibling.set).toEqual({ activo: false });
    const query = render(sibling.where);
    for (const part of [
      '"Inscripcion"."EstudianteId"',
      '"Inscripcion"."Activo"',
      '"Inscripcion"."GrupoId" <>',
      '"Grupo"."AsignaturaId"',
      '"Grupo"."Periodo"',
    ]) {
      expect(query.sql).toContain(part);
    }
    expect(query.params).toEqual(expect.arrayContaining([S, G, 3, "2026-S2"]));

    const last = double.log.at(-1);
    expect(last?.table).toBe(eventoAuditoria);
    expect(last?.values).toEqual([
      expect.objectContaining({
        actorId: S,
        accion: "inscripcion.desactivada",
        entidadId: S,
        datos: { grupoId: 4, motivo: "reemplazo" },
      }),
      expect.objectContaining({
        accion: "inscripcion.desactivada",
        datos: { grupoId: 5, motivo: "reemplazo" },
      }),
      expect.objectContaining({
        accion: "inscripcion.creada",
        datos: { grupoId: G },
      }),
    ]);
  });
});

describe("atomicity and failure (RF-16, audit-log)", () => {
  it.each([
    { label: "a data statement", failing: "insert", reached: false },
    { label: "the audit insert", failing: "audit", reached: true },
  ])(
    "rethrows when $label throws, logs one sanitized line and reports no audit",
    async ({ failing, reached }) => {
      const logger = vi.spyOn(console, "error").mockImplementation(() => {});
      const failure = Object.assign(new Error("secret value 123"), {
        cause: { code: "23505" },
      });
      const double = use([
        STUDENT,
        TARGET,
        { kind: "select", rows: [] },
        { kind: "update", rows: [] },
        failing === "insert"
          ? { kind: "insert", error: failure }
          : { kind: "insert" },
        failing === "audit" ? { kind: "insert", error: failure } : AUDIT,
      ]);

      await expect(enrollInGroup(S, G)).rejects.toBe(failure);

      expect(double.exhausted).toBe(reached);
      expect(logger).toHaveBeenCalledTimes(1);
      const line = String(logger.mock.calls[0][0]);
      expect(JSON.parse(line)).toEqual({
        event: "enrollment.write.failed",
        actor: S,
        errorName: "Error",
        errorCode: "23505",
      });
      expect(line).not.toContain("secret");
    },
  );

  it("does not log a refusal", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    use([{ kind: "select", rows: [] }]);

    await enrollInGroup(S, G);

    expect(logger).not.toHaveBeenCalled();
  });
});

describe("dropGroup (RF-16, RNF-12, D7)", () => {
  it("deactivates the student's own enrollment and writes one baja audit row", async () => {
    const double = use([
      STUDENT,
      { kind: "update", rows: [{ grupoId: G }] },
      AUDIT,
    ]);

    expect(await dropGroup(S, G)).toEqual({ ok: true, grupoId: G });

    const drop = double.log[1];
    expect(drop.set).toEqual({ activo: false });
    expect(drop.table).toBe(inscripcion);
    const query = render(drop.where);
    expect(query.sql).toContain('"Inscripcion"."EstudianteId"');
    expect(query.sql).toContain('"Inscripcion"."Activo"');
    expect(query.params).toEqual(expect.arrayContaining([S, G]));
    expect(double.log.at(-1)?.values).toEqual([
      expect.objectContaining({
        accion: "inscripcion.desactivada",
        entidadId: S,
        datos: { grupoId: G, motivo: "baja" },
      }),
    ]);
  });

  it.each([
    "another student's inscripcion",
    "unknown group id",
    "inscripcion already inactive",
  ])("refuses %s: nothing changes and no audit row", async () => {
    const double = use([STUDENT, { kind: "update", rows: [] }]);

    expect(await dropGroup(S, G)).toEqual({
      ok: false,
      reason: "not_enrolled",
    });
    expect(kinds(double)).toEqual(["select", "update"]);
    expect(double.exhausted).toBe(true);
  });

  it("refuses a user who is not an estudiante before touching Inscripcion", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    expect(await dropGroup(S, G)).toEqual({ ok: false, reason: "not_student" });
    expect(kinds(double)).toEqual(["select"]);
  });

  it("never deletes: the writer source has no delete statement", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/data/enrollment-write.ts"),
      "utf8",
    );

    expect(source).toContain("enrollInGroup");
    expect(source).not.toMatch(/\.delete\(|delete\s+from/i);
  });
});
