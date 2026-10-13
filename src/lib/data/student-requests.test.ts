// @vitest-environment node
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("listOwnRequests (RF-07 c, RNF-01)", () => {
  beforeEach(() => {
    holder.current = null;
  });

  it("returns the rows of the owner, as the query gave them", async () => {
    const newer = { ...listRow, id: 8, estado: "pendiente" };
    use([{ kind: "select", rows: [newer, listRow] }]);

    expect(await listOwnRequests(USER)).toEqual([newer, listRow]);
  });

  it("selects only the owner's rows in the visible states, never a draft", async () => {
    const double = use([{ kind: "select", rows: [listRow] }]);

    await listOwnRequests(USER);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"Solicitud"."EstudianteId" = $1');
    expect(query.sql).toContain('"Solicitud"."Estado" in (');
    expect(query.params).toEqual([USER, ...VISIBLE_STATES]);
    expect(query.params).not.toContain("borrador");
  });

  it("orders newest presentation first, then newest id", async () => {
    const double = use([{ kind: "select", rows: [listRow] }]);

    await listOwnRequests(USER);

    expect(
      render(sql.join(double.log[0].orderBy as never[], sql`, `)).sql,
    ).toBe('"Solicitud"."PresentadaEn" desc, "Solicitud"."Id" desc');
  });

  it("is empty for a student with no presented request, and only reads", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    expect(await listOwnRequests(USER)).toEqual([]);
    expect(double.log.map((s) => s.kind)).toEqual(["select"]);
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
