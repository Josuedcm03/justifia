// @vitest-environment node
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usuario } from "@/db/schema";
import { VISIBLE_STATES } from "@/lib/intake/states";
import type { RequestScope } from "@/lib/intake/request-scope";

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

import {
  listInscripcionPeriods,
  listInscripciones,
  type ListInscripcionesParams,
} from "@/lib/data/inscripciones";

const FAC: RequestScope = { kind: "facultad", facultadId: 3 };
const NONE: RequestScope = { kind: "none" };
const LATEST = "2026-S2";

const params: ListInscripcionesParams = {
  scope: FAC,
  q: "",
  asignatura: "",
  grupo: "",
  periodo: "",
  status: "active",
  page: 1,
  pageSize: 10,
};

const row = {
  estudianteId: 5,
  grupoId: 8,
  estudianteNombre: "Ana Pérez",
  estudianteCif: "CIF-1",
  asignaturaId: 2,
  asignaturaCodigo: "MAT101",
  asignaturaNombre: "Matemática I",
  periodo: LATEST,
  numeroGrupo: "A",
  activo: true,
  grupoActivo: true,
  asignaturaActivo: true,
  hasActiveSibling: false,
  dependentRequests: 0,
};

const latest = (periodo: string | null = LATEST): Step => ({
  kind: "select",
  rows: [{ periodo }],
});
const count = (n: number): Step => ({ kind: "select", rows: [{ count: n }] });
const page = (...rows: unknown[]): Step => ({ kind: "select", rows });

function scripted(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

const dialect = new PgDialect();
function render(fragment: unknown) {
  return dialect.sqlToQuery(fragment as Parameters<PgDialect["sqlToQuery"]>[0]);
}

beforeEach(() => {
  holder.current = null;
});

describe("listInscripciones core (EA-SCOPE-1, EA-LIST-1, EA-PII-1, EA-DEG-1)", () => {
  it("reads nothing for a secretaria without a facultad", async () => {
    const double = scripted([]);

    expect(await listInscripciones({ ...params, scope: NONE })).toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      degraded: false,
      resolvedPeriodo: "",
    });
    expect(double.log).toHaveLength(0);
  });

  it("is empty, not an error, while no period is offered", async () => {
    const double = scripted([latest(null)]);

    expect(await listInscripciones(params)).toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      degraded: false,
      resolvedPeriodo: "",
    });
    expect(double.log).toHaveLength(1);
  });

  it.each([3, 9])(
    "limits the count and the page to facultad %i",
    async (id) => {
      const double = scripted([latest(), count(1), page(row)]);

      await listInscripciones({
        ...params,
        scope: { kind: "facultad", facultadId: id },
      });

      for (const statement of double.log.slice(1)) {
        const query = render(statement.where);
        expect(query.sql).toContain(
          'exists (select 1 from "Usuario" "e" inner join "Carrera" "c"',
        );
        expect(query.sql).toContain('"e"."Id" = "Inscripcion"."EstudianteId"');
        expect(query.params).toContain(id);
      }
    },
  );

  it("selects the student name and CIF only, never a contact column", async () => {
    const double = scripted([latest(), count(1), page(row)]);

    await listInscripciones(params);

    const selected = Object.values(double.log[2].selection as object);
    expect(selected).toContain(usuario.nombreCompleto);
    expect(selected).toContain(usuario.cif);
    expect(selected).not.toContain(usuario.correo);
    expect(selected).not.toContain(usuario.telefono);
  });

  it("drops any column the read did not ask for (no email, no phone)", async () => {
    scripted([
      latest(),
      count(1),
      page({ ...row, correo: "ana@uni.edu", telefono: "099111222" }),
    ]);

    const result = await listInscripciones(params);

    expect(result.data).toHaveLength(1);
    expect(JSON.stringify(result)).not.toMatch(/ana@uni|099111222|@/);
  });

  it.each([
    ["active, active, active", [true, true, true], true, true, true],
    ["active in an inactive group", [true, false, true], true, false, false],
    [
      "active in an inactive asignatura",
      [true, true, false],
      true,
      false,
      false,
    ],
    ["inactive in an active group", [false, true, true], false, false, true],
  ] as const)(
    "shows %s as raw %s, effective %s, writable %s (EA-LIST-1)",
    async (
      _label,
      [activo, grupoActivo, asignaturaActivo],
      raw,
      effective,
      writable,
    ) => {
      scripted([
        latest(),
        count(1),
        page({ ...row, activo, grupoActivo, asignaturaActivo }),
      ]);

      const { data } = await listInscripciones(params);

      expect(data).toEqual([
        {
          estudianteId: 5,
          grupoId: 8,
          estudianteNombre: "Ana Pérez",
          estudianteCif: "CIF-1",
          asignaturaId: 2,
          asignaturaCodigo: "MAT101",
          asignaturaNombre: "Matemática I",
          periodo: LATEST,
          numeroGrupo: "A",
          activo: raw,
          effective,
          writable,
          hasActiveSibling: false,
          dependentRequests: 0,
        },
      ]);
    },
  );

  it.each([
    ["an offered group", {}, true],
    ["an offered group, inactive inscripcion", { activo: false }, true],
    ["an older period", { periodo: "2026-S1" }, false],
    ["an inactive group", { grupoActivo: false }, false],
    ["an inactive asignatura", { asignaturaActivo: false }, false],
  ] as const)("marks %s writable=%s", async (_label, patch, writable) => {
    scripted([latest(), count(1), page({ ...row, ...patch })]);

    const { data } = await listInscripciones(params);

    expect(data[0].writable).toBe(writable);
  });

  it("reports the total and the page it read", async () => {
    scripted([latest(), count(41), page(row)]);

    expect(await listInscripciones({ ...params, pageSize: 25 })).toMatchObject({
      total: 41,
      page: 1,
      pageSize: 25,
      degraded: false,
    });
  });

  it.each([
    ["the latest period", 0],
    ["the count", 1],
    ["the page", 2],
  ])("degrades, without throwing, when %s fails", async (_label, failing) => {
    const script: Step[] = [latest(), count(1), page(row)];
    script[failing] = { kind: "select", error: new Error("down") };
    scripted(script);

    expect(await listInscripciones(params)).toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      degraded: true,
      resolvedPeriodo: "",
    });
  });
});

const known = (found: boolean): Step => ({
  kind: "select",
  rows: found ? [{ one: 1 }] : [],
});

/** The WHERE of the count and of the page: one shared clause. */
async function wheres(over: Partial<ListInscripcionesParams>, script?: Step[]) {
  const double = scripted(script ?? [latest(), count(1), page(row)]);
  await listInscripciones({ ...params, ...over });
  const [count_, rows] = double.log.slice(-2).map((s) => render(s.where));
  expect(count_).toEqual(rows);
  return rows;
}

describe("listInscripciones filters (EA-FILT-1)", () => {
  it("lists the latest period, raw state active, with no search by default", async () => {
    const query = await wheres({});

    expect(query.params).toContain(LATEST);
    expect(query.sql).toContain('"Grupo"."Periodo" = $');
    expect(query.sql).toContain('and "Inscripcion"."Activo"');
    expect(query.sql).not.toContain("ilike");
    expect(query.sql).not.toContain('"Grupo"."NumeroGrupo"');
  });

  it("matches the student term on the name or the CIF", async () => {
    const query = await wheres({ q: "Pérez" });

    expect(query.sql).toContain('"Usuario"."NombreCompleto" ilike');
    expect(query.sql).toContain('"Usuario"."Cif" ilike');
    expect(query.params.filter((v) => v === "%Pérez%")).toHaveLength(2);
  });

  it("matches the asignatura term on the code or the name", async () => {
    const query = await wheres({ asignatura: "MAT" });

    expect(query.sql).toContain('"Asignatura"."Codigo" ilike');
    expect(query.sql).toContain('"Asignatura"."Nombre" ilike');
    expect(query.params.filter((v) => v === "%MAT%")).toHaveLength(2);
  });

  it("escapes LIKE wildcards in the terms", async () => {
    const query = await wheres({ q: "50%_" });

    expect(query.params).toContain("%50\\%\\_%");
  });

  it("matches the group number exactly", async () => {
    const query = await wheres({ grupo: "A" });

    expect(query.sql).toContain('"Grupo"."NumeroGrupo" = $');
    expect(query.params).toContain("A");
  });

  it("filters the RAW state: inactive keeps rows whatever their group", async () => {
    const query = await wheres({ status: "inactive" });

    expect(query.sql).toContain('not "Inscripcion"."Activo"');
    expect(query.sql).not.toContain('"Grupo"."Activo"');
    expect(query.sql).not.toContain('"Asignatura"."Activo"');
  });

  it("combines every filter with AND", async () => {
    const query = await wheres({
      q: "ana",
      asignatura: "mat",
      grupo: "B",
      status: "inactive",
    });

    expect(query.sql).toContain('"Usuario"."Cif" ilike');
    expect(query.sql).toContain('"Asignatura"."Codigo" ilike');
    expect(query.sql).toContain('"Grupo"."NumeroGrupo" = $');
    expect(query.sql).toContain('and not "Inscripcion"."Activo"');
    expect(query.params).toEqual(
      expect.arrayContaining([LATEST, "%ana%", "%mat%", "B"]),
    );
  });

  it("uses an existing period other than the latest", async () => {
    const query = await wheres({ periodo: "2026-S1" }, [
      latest(),
      known(true),
      count(1),
      page(row),
    ]);

    expect(query.params).toContain("2026-S1");
    expect(query.params).not.toContain(LATEST);
  });

  it("falls back to the latest period when the period does not exist", async () => {
    const query = await wheres({ periodo: "1999-S9" }, [
      latest(),
      known(false),
      count(1),
      page(row),
    ]);

    expect(query.params).toContain(LATEST);
    expect(query.params).not.toContain("1999-S9");
  });

  it("reports the latest period it read when none was chosen", async () => {
    scripted([latest(), count(1), page(row)]);

    expect((await listInscripciones(params)).resolvedPeriodo).toBe(LATEST);
  });

  it("reports the chosen period when it exists", async () => {
    scripted([latest(), known(true), count(1), page(row)]);

    expect(
      (await listInscripciones({ ...params, periodo: "2026-S1" }))
        .resolvedPeriodo,
    ).toBe("2026-S1");
  });

  it("reports the latest period, never the typed text, when the period does not exist", async () => {
    scripted([latest(), known(false), count(1), page(row)]);

    expect(
      (await listInscripciones({ ...params, periodo: "Pérez" }))
        .resolvedPeriodo,
    ).toBe(LATEST);
  });

  it("does not look the period up again when it is the latest", async () => {
    const double = scripted([latest(), count(1), page(row)]);

    await listInscripciones({ ...params, periodo: LATEST });

    expect(double.log).toHaveLength(3);
  });
});

describe("listInscripciones order and paging (stable total order)", () => {
  const orderOf = async (over: Partial<ListInscripcionesParams>) => {
    const double = scripted([latest(), count(30), page(row)]);
    await listInscripciones({ ...params, ...over });
    return render(sql.join(double.log[2].orderBy as never[], sql`, `)).sql;
  };
  const NAME = '"Usuario"."NombreCompleto" collate "es-x-icu"';
  const SUBJECT = '"Asignatura"."Nombre" collate "es-x-icu"';

  it.each([
    [
      undefined,
      `${NAME} asc, "Inscripcion"."EstudianteId" asc, "Inscripcion"."GrupoId" asc`,
    ],
    [
      { key: "student", dir: "desc" },
      `${NAME} desc, "Inscripcion"."EstudianteId" desc, "Inscripcion"."GrupoId" desc`,
    ],
    [
      { key: "subject", dir: "asc" },
      `${SUBJECT} asc, ${NAME} asc, "Inscripcion"."EstudianteId" asc, "Inscripcion"."GrupoId" asc`,
    ],
    [
      { key: "group", dir: "desc" },
      `"Grupo"."NumeroGrupo" desc, ${NAME} asc, "Inscripcion"."EstudianteId" desc, "Inscripcion"."GrupoId" desc`,
    ],
    [
      { key: "email", dir: "asc" },
      `${NAME} asc, "Inscripcion"."EstudianteId" asc, "Inscripcion"."GrupoId" asc`,
    ],
  ] as const)("orders by %j", async (sort, expected) => {
    expect(await orderOf({ sort: sort as never })).toBe(expected);
  });

  it.each([
    [1, 25, 1, 0],
    [2, 25, 2, 10],
    [9, 25, 3, 20],
    [0, 25, 1, 0],
    [5, 0, 1, 0],
  ])(
    "reads page %i of %i rows as page %i, offset %i",
    async (requested, total, shown, offset) => {
      const double = scripted([latest(), count(total), page(row)]);

      const result = await listInscripciones({ ...params, page: requested });

      expect(result.page).toBe(shown);
      expect(double.log[2].limit).toBe(10);
      expect(double.log[2].offset).toBe(offset);
    },
  );
});

describe("listInscripciones sibling flag and request count (EA-SIB-1, EA-DEACT-1)", () => {
  const read = async (patch: Record<string, unknown> = {}) => {
    const double = scripted([latest(), count(1), page({ ...row, ...patch })]);
    const { data } = await listInscripciones(params);
    return { item: data[0], fields: double.log[2].selection as never };
  };

  it.each([
    [true, 2],
    [false, 0],
  ])("carries sibling %s and %i requests of the row", async (sibling, n) => {
    const flags = { hasActiveSibling: sibling, dependentRequests: n };
    const { item } = await read(flags);

    expect(item).toMatchObject(flags);
  });

  it("finds a sibling in the same asignatura and period, never elsewhere", async () => {
    const { fields } = await read();
    const { sql: text } = render(fields["hasActiveSibling"]);

    for (const part of [
      'exists (select 1 from "Inscripcion" "sib" inner join "Grupo" "sibg"',
      '"sib"."EstudianteId" = "Inscripcion"."EstudianteId"',
      '"sib"."Activo"',
      '"sib"."GrupoId" <> "Inscripcion"."GrupoId"',
      '"sibg"."AsignaturaId" = "Grupo"."AsignaturaId"',
      '"sibg"."Periodo" = "Grupo"."Periodo"',
    ]) {
      expect(text).toContain(part);
    }
  });

  it("counts this student's requests that name this group", async () => {
    const { fields } = await read();
    const { sql: text } = render(fields["dependentRequests"]);

    for (const part of [
      '"SolicitudAsignatura"."GrupoId" = "Inscripcion"."GrupoId"',
      '"Solicitud"."EstudianteId" = "Inscripcion"."EstudianteId"',
      "count(*)",
    ]) {
      expect(text).toContain(part);
    }
  });

  it("filters by every visible state and never names a draft", async () => {
    const { fields } = await read();
    const query = render(fields["dependentRequests"]);

    expect(query.params).toEqual([...VISIBLE_STATES]);
    expect(query.sql).not.toContain("borrador");
    expect(query.params).not.toContain("borrador");
  });

  it.each([
    [["pendiente", "devuelta"], 2],
    [["aprobada", "rechazada"], 2],
    [["borrador"], 0],
    [["pendiente", "borrador"], 1],
  ])("counts %j as %i (EA-DEACT-1 table)", async (states, expected) => {
    const { fields } = await read();
    const { params: counted } = render(fields["dependentRequests"]);

    expect(states.filter((s) => counted.includes(s))).toHaveLength(expected);
  });
});

describe("listInscripcionPeriods (EA-FILT-1 period select, EA-SCOPE-1)", () => {
  const periods = (...values: string[]): Step => ({
    kind: "select",
    rows: values.map((periodo) => ({ periodo })),
  });

  it("lists the distinct periods of the in-scope rows, newest first", async () => {
    const double = scripted([periods("2026-S2", "2026-S1")]);

    expect(
      await listInscripcionPeriods({ kind: "facultad", facultadId: 9 }),
    ).toEqual(["2026-S2", "2026-S1"]);
    const [read] = double.log;
    expect(render(read.where).params).toContain(9);
    expect(render(sql.join(read.orderBy as never[], sql`, `)).sql).toBe(
      '"Grupo"."Periodo" desc',
    );
  });

  it("reads nothing for a secretaria without a facultad", async () => {
    const double = scripted([]);

    expect(await listInscripcionPeriods(NONE)).toEqual([]);
    expect(double.log).toHaveLength(0);
  });

  it("returns no period, without throwing, when the read fails", async () => {
    scripted([{ kind: "select", error: new Error("down") }]);

    expect(await listInscripcionPeriods(FAC)).toEqual([]);
  });
});
