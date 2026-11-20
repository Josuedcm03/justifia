// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { escalamiento, reporteInasistencia } from "@/db/schema";
import { VISIBLE_STATES } from "@/lib/intake/states";

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
  getCorrectionReason,
  getOwnRequestDetail,
  getReturnedDocumentIds,
  listOwnRequests,
} from "@/lib/data/student-requests";

const USER = 9;
const ID = 42;

function use(script: Step[]) {
  const double = createDbDouble(script);
  holder.current = double.db;
  return double;
}

function render(fragment: unknown) {
  return new PgDialect().sqlToQuery(
    fragment as Parameters<PgDialect["sqlToQuery"]>[0],
  );
}

const listRow = {
  id: 7,
  estado: "devuelta",
  causa: "medica",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
  presentadaEn: new Date("2026-10-05T16:00:00.000Z"),
  reenviadaEn: null,
};

function listClass(solicitudId: number, codigo: string, numeroGrupo = "A") {
  return {
    solicitudId,
    asignaturaId: 100 + Number(codigo.replace(/\D/g, "")),
    codigo,
    nombre: `Nombre ${codigo}`,
    numeroGrupo,
    docenteNombre: "Luis Mora",
  };
}

function listDecision(
  solicitudId: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    solicitudId,
    motivoCodigo: null,
    texto: "Texto de la decision.",
    ...overrides,
  };
}

describe("listOwnRequests (RF-07 c, RNF-01)", () => {
  beforeEach(() => {
    holder.current = null;
  });

  it("returns the rows of the owner with their subjects and decision, as the query gave them", async () => {
    const newer = { ...listRow, id: 8, estado: "pendiente" };
    use([
      { kind: "select", rows: [newer, listRow] },
      {
        kind: "select",
        rows: [
          listClass(7, "FIS201"),
          listClass(8, "MAT101"),
          listClass(8, "QUI110"),
        ],
      },
      {
        kind: "select",
        rows: [
          listDecision(7, {
            motivoCodigo: "documento_ilegible",
            texto: "Adjunte una copia legible.",
          }),
        ],
      },
    ]);

    expect(await listOwnRequests(USER)).toEqual([
      {
        ...newer,
        asignaturas: [
          { codigo: "MAT101", nombre: "Nombre MAT101" },
          { codigo: "QUI110", nombre: "Nombre QUI110" },
        ],
        decision: null,
      },
      {
        ...listRow,
        asignaturas: [{ codigo: "FIS201", nombre: "Nombre FIS201" }],
        decision: {
          motivoCodigo: "documento_ilegible",
          texto: "Adjunte una copia legible.",
        },
      },
    ]);
  });

  it("selects only the owner's rows in the visible states, never a draft", async () => {
    const double = use([
      { kind: "select", rows: [listRow] },
      { kind: "select", rows: [] },
      { kind: "select", rows: [] },
    ]);

    await listOwnRequests(USER);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"Solicitud"."EstudianteId" = $1');
    expect(query.sql).toContain('"Solicitud"."Estado" in (');
    expect(query.params).toEqual([USER, ...VISIBLE_STATES]);
    expect(query.params).not.toContain("borrador");
  });

  it("orders newest presentation first, then newest id", async () => {
    const double = use([
      { kind: "select", rows: [listRow] },
      { kind: "select", rows: [] },
      { kind: "select", rows: [] },
    ]);

    await listOwnRequests(USER);

    expect(
      render(sql.join(double.log[0].orderBy as never[], sql`, `)).sql,
    ).toBe('"Solicitud"."PresentadaEn" desc, "Solicitud"."Id" desc');
  });

  it("is empty for a student with no presented request, and only reads once", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    expect(await listOwnRequests(USER)).toEqual([]);
    expect(double.log.map((s) => s.kind)).toEqual(["select"]);
  });

  it.each([1, 2, 5])(
    "issues exactly three selects for %i rows: the rows, the classes and the decisions",
    async (count) => {
      const rows = Array.from({ length: count }, (_, i) => ({
        ...listRow,
        id: 20 + i,
      }));
      const double = use([
        { kind: "select", rows },
        { kind: "select", rows: rows.map((r) => listClass(r.id, "MAT101")) },
        { kind: "select", rows: [] },
      ]);

      await listOwnRequests(USER);

      expect(double.log.map((s) => s.kind)).toEqual([
        "select",
        "select",
        "select",
      ]);
      expect(double.exhausted).toBe(true);
    },
  );

  it("reads the classes and the decisions only for the ids of the owner's rows", async () => {
    const other = { ...listRow, id: 9, estado: "rechazada" };
    const double = use([
      { kind: "select", rows: [listRow, other] },
      { kind: "select", rows: [] },
      { kind: "select", rows: [] },
    ]);

    await listOwnRequests(USER);

    const classes = render(double.log[1].where);
    expect(classes.sql).toContain('"SolicitudAsignatura"."SolicitudId" in (');
    expect(classes.params).toEqual([7, 9]);
    const decisions = render(double.log[2].where);
    expect(decisions.sql).toContain('"SolicitudDecision"."SolicitudId" in (');
    expect(decisions.params).toEqual([7, 9]);
  });

  it("attaches the subjects to each request in the order of listRequestClasses", async () => {
    const second = { ...listRow, id: 8 };
    use([
      { kind: "select", rows: [second, listRow] },
      {
        kind: "select",
        rows: [
          listClass(7, "BIO100"),
          listClass(7, "MAT101", "A"),
          listClass(7, "MAT101", "B"),
          listClass(8, "ZOO300"),
        ],
      },
      { kind: "select", rows: [] },
    ]);

    const [first, last] = await listOwnRequests(USER);

    expect(first.asignaturas.map((a) => a.codigo)).toEqual(["ZOO300"]);
    expect(last.asignaturas.map((a) => a.codigo)).toEqual([
      "BIO100",
      "MAT101",
      "MAT101",
    ]);
  });

  it("gives a request without class rows an empty subject list", async () => {
    use([
      { kind: "select", rows: [listRow] },
      { kind: "select", rows: [] },
      { kind: "select", rows: [] },
    ]);

    const [row] = await listOwnRequests(USER);

    expect(row.asignaturas).toEqual([]);
  });

  it("orders the decisions by time, then id, and keeps the latest one of each request", async () => {
    const double = use([
      { kind: "select", rows: [listRow] },
      { kind: "select", rows: [] },
      {
        kind: "select",
        rows: [
          listDecision(7, {
            motivoCodigo: "fecha_incorrecta",
            texto: "Primera devolucion",
          }),
          listDecision(7, {
            motivoCodigo: "documento_ilegible",
            texto: "Ultima devolucion",
          }),
        ],
      },
    ]);

    const [row] = await listOwnRequests(USER);

    expect(
      render(sql.join(double.log[2].orderBy as never[], sql`, `)).sql,
    ).toBe(
      '"SolicitudDecision"."DecididaEn" asc, "SolicitudDecision"."Id" asc',
    );
    expect(row.decision).toEqual({
      motivoCodigo: "documento_ilegible",
      texto: "Ultima devolucion",
    });
  });

  it("gives a returned request its reason code and its text", async () => {
    use([
      { kind: "select", rows: [listRow] },
      { kind: "select", rows: [] },
      {
        kind: "select",
        rows: [
          listDecision(7, {
            motivoCodigo: "fecha_alterada",
            texto: "La fecha esta alterada.",
          }),
        ],
      },
    ]);

    const [row] = await listOwnRequests(USER);

    expect(row.decision).toEqual({
      motivoCodigo: "fecha_alterada",
      texto: "La fecha esta alterada.",
    });
  });

  it.each([
    ["a 200-character text", "x".repeat(200), `${"x".repeat(140)}…`],
    ["a 60-character text", "y".repeat(60), "y".repeat(60)],
    ["no text", null, null],
    ["a blank text", "   ", null],
  ])(
    "cuts the text of a rejected request on the server: %s",
    async (_name, texto, expected) => {
      use([
        { kind: "select", rows: [{ ...listRow, estado: "rechazada" }] },
        { kind: "select", rows: [] },
        { kind: "select", rows: [listDecision(7, { texto })] },
      ]);

      const [row] = await listOwnRequests(USER);

      expect(row.decision).toEqual({ motivoCodigo: null, texto: expected });
    },
  );

  it("never lets the complete text of a long decision leave the reader", async () => {
    const full = `${"z".repeat(300)} FINAL`;
    use([
      { kind: "select", rows: [{ ...listRow, estado: "rechazada" }] },
      { kind: "select", rows: [] },
      { kind: "select", rows: [listDecision(7, { texto: full })] },
    ]);

    const rows = await listOwnRequests(USER);

    expect(JSON.stringify(rows)).not.toContain("FINAL");
    expect(JSON.stringify(rows)).not.toContain("z".repeat(141));
  });

  it("keeps the reason code only for a returned request, never for a rejected one", async () => {
    use([
      {
        kind: "select",
        rows: [{ ...listRow, id: 9, estado: "rechazada" }, listRow],
      },
      { kind: "select", rows: [] },
      {
        kind: "select",
        rows: [
          listDecision(9, { motivoCodigo: "documento_ilegible" }),
          listDecision(7, { motivoCodigo: "documento_ilegible" }),
        ],
      },
    ]);

    const [rejected, returned] = await listOwnRequests(USER);

    expect(rejected.decision?.motivoCodigo).toBeNull();
    expect(returned.decision?.motivoCodigo).toBe("documento_ilegible");
  });

  // Owner decision 2026-11-20 (FE-15): the approval text is template
  // boilerplate, so an approved card carries no decision at all.
  it.each([["Su solicitud fue aprobada."], [null]])(
    "gives an approved request no decision, whatever its text (%j)",
    async (texto) => {
      use([
        {
          kind: "select",
          rows: [
            { ...listRow, estado: "aprobada" },
            { ...listRow, id: 6 },
          ],
        },
        { kind: "select", rows: [] },
        // The stray row of request 7 must be ignored: it is approved.
        { kind: "select", rows: [listDecision(6), listDecision(7, { texto })] },
      ]);

      const rows = await listOwnRequests(USER);

      expect(rows[0].decision).toBeNull();
      expect(JSON.stringify(rows[0])).not.toContain("aprobada.");
    },
  );

  it("never reads the decisions of an approved request", async () => {
    const double = use([
      {
        kind: "select",
        rows: [
          { ...listRow, id: 7, estado: "aprobada" },
          { ...listRow, id: 8, estado: "devuelta" },
          { ...listRow, id: 9, estado: "rechazada" },
        ],
      },
      { kind: "select", rows: [] },
      { kind: "select", rows: [] },
    ]);

    await listOwnRequests(USER);

    expect(render(double.log[2].where).params).toEqual([8, 9]);
  });

  it.each(["pendiente", "en_revision_coordinacion"])(
    "gives a %s request no decision, even one corrected and resubmitted after a return",
    async (estado) => {
      // The earlier return still sits in the table, but the request is open
      // again, so the reader issues no decisions select for it.
      const double = use([
        { kind: "select", rows: [{ ...listRow, estado }] },
        { kind: "select", rows: [] },
      ]);

      const [row] = await listOwnRequests(USER);

      expect(row.decision).toBeNull();
      expect(double.log).toHaveLength(2);
    },
  );

  it("skips the decisions select when no request is returned or rejected", async () => {
    const double = use([
      {
        kind: "select",
        rows: [
          { ...listRow, id: 7, estado: "pendiente" },
          { ...listRow, id: 8, estado: "aprobada" },
          { ...listRow, id: 9, estado: "en_revision_coordinacion" },
        ],
      },
      { kind: "select", rows: [] },
    ]);

    const rows = await listOwnRequests(USER);

    expect(double.log).toHaveLength(2);
    expect(double.exhausted).toBe(true);
    expect(rows.map((r) => r.decision)).toEqual([null, null, null]);
  });

  it("reads only: no write and no audit row", async () => {
    const double = use([
      { kind: "select", rows: [listRow] },
      { kind: "select", rows: [] },
      { kind: "select", rows: [] },
    ]);

    await listOwnRequests(USER);

    expect(new Set(double.log.map((s) => s.kind))).toEqual(new Set(["select"]));
    expect(double.log.map((s) => s.table)).not.toContain(escalamiento);
    expect(double.log.map((s) => s.table)).not.toContain(reporteInasistencia);
  });
});

const requestRow = {
  id: ID,
  estado: "devuelta",
  causa: "medica",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
  presentadaEn: new Date("2026-10-05T16:00:00.000Z"),
  reenviadaEn: null,
};

const classRow = {
  solicitudId: ID,
  asignaturaId: 10,
  codigo: "MAT101",
  nombre: "Matematica I",
  numeroGrupo: "A",
  docenteNombre: "Luis Mora",
};

const documentRow = {
  id: 11,
  nombreOriginal: "constancia.pdf",
  tipoDetectado: "pdf",
  tamanoBytes: 2048,
  creadoEn: new Date("2026-10-04T10:00:00.000Z"),
};

function decision(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    tipo: "devuelta",
    motivoCodigo: "documento_ilegible",
    texto: "Adjunte una copia legible.",
    decididaEn: new Date("2026-10-06T15:00:00.000Z"),
    ...overrides,
  };
}

const revisionRow = {
  id: 8,
  numero: 1,
  causa: "medica",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-02",
  clases: [
    {
      asignaturaId: 10,
      codigo: "MAT101",
      nombre: "Matematica I",
      numeroGrupo: "A",
    },
  ],
  documentoIds: [11],
  creadaEn: new Date("2026-10-06T15:00:00.000Z"),
};

function loaded(decisions: unknown[] = [decision()]): Step[] {
  return [
    { kind: "select", rows: [requestRow] },
    { kind: "select", rows: [classRow] },
    { kind: "select", rows: [documentRow] },
    { kind: "select", rows: decisions },
    { kind: "select", rows: [revisionRow] },
  ];
}

describe("getOwnRequestDetail (RF-07 c, RF-08 b, RNF-01)", () => {
  beforeEach(() => {
    holder.current = null;
  });

  it("returns the request with its classes, documents, latest decision and revisions", async () => {
    use(loaded());

    const detail = await getOwnRequestDetail(USER, ID);

    expect(detail).toMatchObject({
      id: ID,
      estado: "devuelta",
      causa: "medica",
      fechaInicio: "2026-10-01",
      fechaFin: "2026-10-03",
      presentadaEn: requestRow.presentadaEn,
      reenviadaEn: null,
    });
    expect(detail?.clases).toEqual([
      {
        asignaturaId: 10,
        codigo: "MAT101",
        nombre: "Matematica I",
        numeroGrupo: "A",
        docenteNombre: "Luis Mora",
      },
    ]);
    expect(detail?.documentos).toEqual([documentRow]);
    expect(detail?.revisiones).toEqual([revisionRow]);
    expect(detail?.decision).toEqual(decision());
    expect(detail?.historial).toEqual([]);
  });

  // Scenario "Student never sees them" (request-review): characterization pin.
  // The own-request payload stays as it was before the escalation change.
  it("exposes no escalation, note, answer or report and never reads those tables (ES-14)", async () => {
    const double = use(loaded());

    const detail = await getOwnRequestDetail(USER, ID);

    expect(Object.keys(detail ?? {}).sort()).toEqual([
      "causa",
      "clases",
      "decision",
      "documentos",
      "estado",
      "fechaFin",
      "fechaInicio",
      "historial",
      "id",
      "presentadaEn",
      "reenviadaEn",
      "revisiones",
    ]);
    expect(double.log).toHaveLength(5);
    expect(double.log.map((statement) => statement.table)).not.toContain(
      escalamiento,
    );
    expect(double.log.map((statement) => statement.table)).not.toContain(
      reporteInasistencia,
    );
  });

  it("lists only the student's own documents, never a staff upload (RN-19)", async () => {
    const double = use(loaded());

    await getOwnRequestDetail(USER, ID);

    const query = render(double.log[2].where);
    expect(query.sql).toContain('"SubidoPorId" is null');
  });

  it("looks the request up by id and owner in the visible states, and issues only selects", async () => {
    const double = use(loaded());

    await getOwnRequestDetail(USER, ID);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"Solicitud"."Id" = $1');
    expect(query.sql).toContain('"Solicitud"."EstudianteId" = $2');
    expect(query.params).toEqual([ID, USER, ...VISIBLE_STATES]);
    expect(query.params).not.toContain("borrador");
    expect(new Set(double.log.map((s) => s.kind))).toEqual(new Set(["select"]));
  });

  it("answers null and reads nothing else for another student's id, an unknown id and a draft", async () => {
    // All three reach the same empty result: the owner and visible-state
    // filter is in the query, so the layer cannot tell them apart.
    const double = use([{ kind: "select", rows: [] }]);

    expect(await getOwnRequestDetail(USER, ID)).toBeNull();
    expect(double.log).toHaveLength(1);
  });

  it("reads only current, finalized documents", async () => {
    const double = use(loaded());

    await getOwnRequestDetail(USER, ID);

    const query = render(double.log[2].where);
    expect(query.sql).toContain('"DocumentoRespaldo"."Estado" = $');
    expect(query.sql).toContain('"DocumentoRespaldo"."RetiradoEn" is null');
    expect(query.params).toEqual([ID, "valido"]);
  });

  it("exposes no storage location and no secretary name", async () => {
    use(loaded());

    const detail = await getOwnRequestDetail(USER, ID);

    expect(Object.keys(detail?.documentos[0] ?? {}).sort()).toEqual([
      "creadoEn",
      "id",
      "nombreOriginal",
      "tamanoBytes",
      "tipoDetectado",
    ]);
    expect(Object.keys(detail?.decision ?? {}).sort()).toEqual([
      "decididaEn",
      "id",
      "motivoCodigo",
      "texto",
      "tipo",
    ]);
  });

  it("orders decisions by time and revisions by number", async () => {
    const double = use(loaded());

    await getOwnRequestDetail(USER, ID);

    const order = (index: number) =>
      render(sql.join(double.log[index].orderBy as never[], sql`, `)).sql;
    expect(order(3)).toBe(
      '"SolicitudDecision"."DecididaEn" asc, "SolicitudDecision"."Id" asc',
    );
    expect(order(4)).toBe('"SolicitudRevision"."Numero" asc');
  });

  it.each(["devuelta", "rechazada", "aprobada"])(
    "shows the latest decision of a %s request and keeps the earlier ones as history",
    async (estado) => {
      const first = decision({ id: 1, texto: "Primera devolucion" });
      const last = decision({
        id: 2,
        tipo: estado,
        motivoCodigo: null,
        texto: "Ultima decision",
      });
      use([
        { kind: "select", rows: [{ ...requestRow, estado }] },
        ...loaded([first, last]).slice(1),
      ]);

      const detail = await getOwnRequestDetail(USER, ID);

      expect(detail?.decision).toEqual(last);
      expect(detail?.historial).toEqual([first]);
    },
  );

  it("treats every decision as history once the request is pending again", async () => {
    const first = decision({ id: 1 });
    use([
      { kind: "select", rows: [{ ...requestRow, estado: "pendiente" }] },
      ...loaded([first]).slice(1),
    ]);

    const detail = await getOwnRequestDetail(USER, ID);

    expect(detail?.decision).toBeNull();
    expect(detail?.historial).toEqual([first]);
  });

  it("has no decision and an empty history for a first-time pending request", async () => {
    use([
      { kind: "select", rows: [{ ...requestRow, estado: "pendiente" }] },
      ...loaded([]).slice(1),
    ]);

    const detail = await getOwnRequestDetail(USER, ID);

    expect(detail?.decision).toBeNull();
    expect(detail?.historial).toEqual([]);
  });
});

describe("getCorrectionReason (RN-17, SR-17)", () => {
  beforeEach(() => {
    holder.current = null;
  });

  it("returns the code and text of the latest decision of an own returned request", async () => {
    use([
      {
        kind: "select",
        rows: [
          { motivo: "documento_ilegible", texto: "Adjunte una copia legible." },
        ],
      },
    ]);

    expect(await getCorrectionReason(USER, ID)).toEqual({
      motivo: "documento_ilegible",
      texto: "Adjunte una copia legible.",
    });
  });

  it("keeps a missing code or text as null", async () => {
    use([{ kind: "select", rows: [{ motivo: null, texto: null }] }]);

    expect(await getCorrectionReason(USER, ID)).toEqual({
      motivo: null,
      texto: null,
    });
  });

  it("is null for another student's id, a request that is not returned and an unknown id", async () => {
    // The owner and `devuelta` filters are in the query, so the three reach
    // the same empty result.
    const double = use([{ kind: "select", rows: [] }]);

    expect(await getCorrectionReason(USER, ID)).toBeNull();
    expect(double.log).toHaveLength(1);
  });

  it("filters by request id, owner and the returned state, and takes the newest decision", async () => {
    const double = use([{ kind: "select", rows: [decision()] }]);

    await getCorrectionReason(USER, ID);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"SolicitudDecision"."SolicitudId" = $1');
    expect(query.sql).toContain('"Solicitud"."EstudianteId" = $2');
    expect(query.sql).toContain('"Solicitud"."Estado" = $3');
    expect(query.params).toEqual([ID, USER, "devuelta"]);
    expect(
      render(sql.join(double.log[0].orderBy as never[], sql`, `)).sql,
    ).toBe(
      '"SolicitudDecision"."DecididaEn" desc, "SolicitudDecision"."Id" desc',
    );
  });

  it("only reads: no audit row and no write", async () => {
    const double = use([{ kind: "select", rows: [decision()] }]);

    await getCorrectionReason(USER, ID);

    expect(double.log.map((s) => s.kind)).toEqual(["select"]);
  });
});

// Scenario "Student does not see it" (request-review, C11): the recorded consent
// is a staff-only fact. The own-detail read selects explicit columns, and the
// db double cannot show a select list, so this pins the sources themselves: the
// data function and the student detail screens never name the consent.
describe("the student's own detail carries no consent (C11)", () => {
  const root = process.cwd();
  const sources = [
    join(root, "src/lib/data/student-requests.ts"),
    ...readdirSync(join(root, "src/app/(dashboard)/requests/[id]"))
      .filter((name) => /\.tsx?$/.test(name) && !/\.test\./.test(name))
      .map((name) => join(root, "src/app/(dashboard)/requests/[id]", name)),
  ];

  it("covers the data function and the detail screens", () => {
    expect(sources.length).toBeGreaterThan(3);
    expect(sources.some((path) => path.endsWith("page.tsx"))).toBe(true);
  });

  it.each(sources.map((path) => [path.slice(root.length + 1), path]))(
    "%s never selects or shows the consent",
    (_name, path) => {
      expect(readFileSync(path, "utf8")).not.toMatch(/consent/i);
    },
  );
});

// RF-08 (b), D9: the version just returned is the latest revision snapshot.
// A correction marks a document "Anterior" when it is listed there, "Nuevo"
// when it is not (FE-16).
describe("getReturnedDocumentIds (RF-08 b, FE-16)", () => {
  beforeEach(() => {
    holder.current = null;
  });

  it("returns the document ids of the latest revision of an own returned request", async () => {
    use([{ kind: "select", rows: [{ documentoIds: [4, 7, 9] }] }]);

    expect(await getReturnedDocumentIds(USER, ID)).toEqual([4, 7, 9]);
  });

  it("returns an empty list when the revision lists no document", async () => {
    use([{ kind: "select", rows: [{ documentoIds: [] }] }]);

    expect(await getReturnedDocumentIds(USER, ID)).toEqual([]);
  });

  it("is an empty list for another student's id, a request in another state and an unknown id", async () => {
    // The owner and `devuelta` filters are in the query, so the three reach the
    // same empty result, with one select.
    const double = use([{ kind: "select", rows: [] }]);

    expect(await getReturnedDocumentIds(USER, ID)).toEqual([]);
    expect(double.log).toHaveLength(1);
  });

  it("filters by request id, owner and the returned state, and takes the newest revision", async () => {
    const double = use([{ kind: "select", rows: [{ documentoIds: [1] }] }]);

    await getReturnedDocumentIds(USER, ID);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"SolicitudRevision"."SolicitudId" = $1');
    expect(query.sql).toContain('"Solicitud"."EstudianteId" = $2');
    expect(query.sql).toContain('"Solicitud"."Estado" = $3');
    expect(query.params).toEqual([ID, USER, "devuelta"]);
    expect(
      render(sql.join(double.log[0].orderBy as never[], sql`, `)).sql,
    ).toBe('"SolicitudRevision"."Numero" desc');
  });

  it("only reads: one select, no audit row and no write", async () => {
    const double = use([{ kind: "select", rows: [{ documentoIds: [1] }] }]);

    await getReturnedDocumentIds(USER, ID);

    expect(double.log.map((s) => s.kind)).toEqual(["select"]);
  });
});
