// @vitest-environment node
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { getRequestDetail } from "@/lib/data/solicitud-detail";

const SCOPE: RequestScope = { kind: "facultad", facultadId: 3 };
const ID = 42;

const requestRow = {
  id: ID,
  estado: "devuelta",
  causa: "medica",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
  presentadaEn: new Date("2026-10-05T16:00:00.000Z"),
  reenviadaEn: null,
  plazoInicioEn: null,
  estudianteNombre: "Ana Perez",
  estudianteCif: "2020-001",
  estudianteCarrera: "Ingenieria",
  estudianteCorreo: "ana@example.test",
  formatoEspecial: false,
  consentimientoEn: new Date("2026-10-05T15:59:30.000Z"),
  consentimientoVersion: "2026-10-20",
};

const classRow = {
  solicitudId: ID,
  asignaturaId: 10,
  codigo: "MAT101",
  nombre: "Matematica I",
  numeroGrupo: "A",
  docenteNombre: "Luis Mora",
};

function document(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    nombreOriginal: "constancia.pdf",
    tipoDetectado: "pdf",
    tamanoBytes: 2048,
    retiradoEn: null,
    formatoEspecial: false,
    creadoEn: new Date("2026-10-04T10:00:00.000Z"),
    ...overrides,
  };
}

const decisionRow = {
  id: 5,
  tipo: "devuelta",
  plantillaCodigo: "devolucion.documento_ilegible",
  motivoCodigo: "documento_ilegible",
  texto: "Adjunte una copia legible.",
  revisionId: 8,
  secretariaNombre: "Rosa Lopez",
  decididaEn: new Date("2026-10-06T15:00:00.000Z"),
};

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

const escalationRow = {
  id: 61,
  motivo: "sospecha_documento",
  nota: "El sello parece alterado.",
  autorNombre: "Rosa Lopez",
  creadoEn: new Date("2026-10-08T15:00:00.000Z"),
  respuesta: null,
  respondidaPorNombre: null,
  respondidaEn: null,
  notificacionEstado: "pendiente",
  notificacionMotivo: null,
  enviadaEn: null,
};

const reportRow = {
  id: 71,
  escalamientoId: 81,
  docenteNombre: "Luis Mora",
  comunicadoEl: "2026-10-09",
  nota: "Supera el limite de faltas.",
  registradoPorNombre: "Rosa Lopez",
  registradoEn: new Date("2026-10-10T16:00:00.000Z"),
  notificacionEstado: "enviada",
  notificacionMotivo: null,
  enviadaEn: new Date("2026-10-10T16:01:00.000Z"),
};

function loaded(): Step[] {
  return [
    { kind: "select", rows: [requestRow] },
    { kind: "select", rows: [classRow] },
    {
      kind: "select",
      rows: [
        document(),
        document({ id: 12, retiradoEn: new Date("2026-10-07T10:00:00.000Z") }),
      ],
    },
    { kind: "select", rows: [decisionRow] },
    { kind: "select", rows: [revisionRow] },
    { kind: "select", rows: [escalationRow] },
    { kind: "select", rows: [reportRow] },
  ];
}

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

describe("getRequestDetail (RF-06, RF-08 b, SR-6)", () => {
  beforeEach(() => {
    holder.current = null;
  });

  it("returns the request, snapshot, classes, documents, decisions and revisions", async () => {
    use(loaded());

    const detail = await getRequestDetail(SCOPE, ID);

    expect(detail).toMatchObject({
      id: ID,
      estado: "devuelta",
      causa: "medica",
      fechaInicio: "2026-10-01",
      fechaFin: "2026-10-03",
      presentadaEn: requestRow.presentadaEn,
      reenviadaEn: null,
      estudiante: {
        nombre: "Ana Perez",
        cif: "2020-001",
        carrera: "Ingenieria",
        correo: "ana@example.test",
      },
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
    expect(detail?.decisiones).toEqual([
      {
        id: 5,
        tipo: "devuelta",
        plantillaCodigo: "devolucion.documento_ilegible",
        motivoCodigo: "documento_ilegible",
        texto: "Adjunte una copia legible.",
        revisionId: 8,
        secretariaNombre: "Rosa Lopez",
        decididaEn: decisionRow.decididaEn,
      },
    ]);
    expect(detail?.revisiones).toEqual([revisionRow]);
  });

  describe("recorded consent (RC-9, RF-01 d, RN-25)", () => {
    const legacyRow = {
      ...requestRow,
      consentimientoEn: null,
      consentimientoVersion: null,
    };

    function withRequestRow(row: unknown): Step[] {
      const [, ...rest] = loaded();
      return [{ kind: "select", rows: [row] }, ...rest];
    }

    it("returns the version and the instant of a recorded consent", async () => {
      use(loaded());

      const detail = await getRequestDetail(SCOPE, ID);

      expect(detail?.consentimiento).toEqual({
        version: "2026-10-20",
        en: new Date("2026-10-05T15:59:30.000Z"),
      });
    });

    it("returns null for a legacy request presented before consent existed", async () => {
      use(withRequestRow(legacyRow));

      const detail = await getRequestDetail(SCOPE, ID);

      expect(detail).not.toBeNull();
      expect(detail?.consentimiento).toBeNull();
    });

    it("never invents a consent from half a pair", async () => {
      use(
        withRequestRow({ ...legacyRow, consentimientoVersion: "2026-10-20" }),
      );
      expect((await getRequestDetail(SCOPE, ID))?.consentimiento).toBeNull();

      use(
        withRequestRow({
          ...legacyRow,
          consentimientoEn: new Date("2026-10-05T15:59:30.000Z"),
        }),
      );
      expect((await getRequestDetail(SCOPE, ID))?.consentimiento).toBeNull();
    });

    it("keeps the original consent after a correction and resubmission", async () => {
      use(
        withRequestRow({
          ...requestRow,
          estado: "pendiente",
          reenviadaEn: new Date("2026-10-12T16:00:00.000Z"),
        }),
      );

      const detail = await getRequestDetail(SCOPE, ID);

      expect(detail?.reenviadaEn).toEqual(new Date("2026-10-12T16:00:00.000Z"));
      expect(detail?.consentimiento).toEqual({
        version: "2026-10-20",
        en: new Date("2026-10-05T15:59:30.000Z"),
      });
    });
  });

  describe("stored clock start (RN-08, ES-5)", () => {
    function withRequestRow(row: unknown): Step[] {
      const [, ...rest] = loaded();
      return [{ kind: "select", rows: [row] }, ...rest];
    }

    it("returns the start a coordination answer stored, so the deadline can resume from it", async () => {
      use(
        withRequestRow({
          ...requestRow,
          estado: "pendiente",
          plazoInicioEn: new Date("2026-10-15T06:00:00.000Z"),
        }),
      );

      const detail = await getRequestDetail(SCOPE, ID);

      expect(detail?.plazoInicioEn).toEqual(
        new Date("2026-10-15T06:00:00.000Z"),
      );
    });

    it("returns null for a request that never spent time in coordination", async () => {
      use(loaded());

      expect((await getRequestDetail(SCOPE, ID))?.plazoInicioEn).toBeNull();
    });
  });

  it("splits current documents from the ones retired by a correction", async () => {
    use(loaded());

    const detail = await getRequestDetail(SCOPE, ID);

    expect(detail?.documentos.map((d) => d.id)).toEqual([11]);
    expect(detail?.documentosRetirados.map((d) => d.id)).toEqual([12]);
    expect(detail?.documentosRetirados[0].retiradoEn).toEqual(
      new Date("2026-10-07T10:00:00.000Z"),
    );
  });

  it("exposes a document without any storage location", async () => {
    use(loaded());

    const detail = await getRequestDetail(SCOPE, ID);

    expect(Object.keys(detail?.documentos[0] ?? {}).sort()).toEqual([
      "creadoEn",
      "id",
      "nombreOriginal",
      "tamanoBytes",
      "tipoDetectado",
    ]);
  });

  it("shows the special format apart from the student's documents (RN-19)", async () => {
    const [, classes, , decisions, revisions, escalations, reports] = loaded();
    use([
      {
        kind: "select",
        rows: [
          {
            ...(requestRow as object),
            estado: "aprobada",
            formatoEspecial: true,
          },
        ],
      },
      classes,
      {
        kind: "select",
        rows: [
          document(),
          document({
            id: 30,
            nombreOriginal: "formato.pdf",
            formatoEspecial: true,
          }),
        ],
      },
      decisions,
      revisions,
      escalations,
      reports,
    ]);

    const detail = await getRequestDetail(SCOPE, ID);

    expect(detail?.formatoEspecial).toBe(true);
    expect(detail?.documentos.map((d) => d.id)).toEqual([11]);
    expect(detail?.formato).toEqual({
      id: 30,
      nombreOriginal: "formato.pdf",
      tipoDetectado: "pdf",
      tamanoBytes: 2048,
      creadoEn: new Date("2026-10-04T10:00:00.000Z"),
    });
  });

  it("has no format and is not marked for an ordinary request", async () => {
    use(loaded());

    const detail = await getRequestDetail(SCOPE, ID);

    expect(detail?.formatoEspecial).toBe(false);
    expect(detail?.formato).toBeNull();
  });

  it("looks the request up by id inside the scope and the visible states", async () => {
    const double = use(loaded());

    await getRequestDetail(SCOPE, ID);

    const query = render(double.log[0].where);
    expect(query.sql).toContain('"Solicitud"."Id" = $1');
    expect(query.sql).toContain('"c"."FacultadId" = $');
    expect(query.sql).toContain('"Solicitud"."Estado" in (');
    expect(query.params).toEqual([ID, 3, ...VISIBLE_STATES]);
    expect(query.params).not.toContain("borrador");
  });

  it("returns null and reads nothing else for an absent, draft or out-of-scope request", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    expect(await getRequestDetail(SCOPE, ID)).toBeNull();
    expect(double.log).toHaveLength(1);
  });

  it("matches nothing in the none scope", async () => {
    const double = use([{ kind: "select", rows: [] }]);

    expect(await getRequestDetail({ kind: "none" }, ID)).toBeNull();
    expect(render(double.log[0].where).sql).toContain("and false");
  });

  it.each(["pendiente", "devuelta", "aprobada", "rechazada"])(
    "returns a %s request",
    async (estado) => {
      use([
        { kind: "select", rows: [{ ...requestRow, estado }] },
        { kind: "select", rows: [] },
        { kind: "select", rows: [] },
        { kind: "select", rows: [] },
        { kind: "select", rows: [] },
        { kind: "select", rows: [] },
        { kind: "select", rows: [] },
      ]);

      const detail = await getRequestDetail(SCOPE, ID);

      expect(detail?.estado).toBe(estado);
    },
  );

  it("returns empty history lists for a first-time request", async () => {
    use([
      { kind: "select", rows: [{ ...requestRow, estado: "pendiente" }] },
      { kind: "select", rows: [classRow] },
      { kind: "select", rows: [document()] },
      { kind: "select", rows: [] },
      { kind: "select", rows: [] },
      { kind: "select", rows: [] },
      { kind: "select", rows: [] },
    ]);

    const detail = await getRequestDetail(SCOPE, ID);

    expect(detail?.escalamientos).toEqual([]);
    expect(detail?.reportes).toEqual([]);
    expect(detail?.decisiones).toEqual([]);
    expect(detail?.revisiones).toEqual([]);
    expect(detail?.documentosRetirados).toEqual([]);
    expect(detail?.documentos).toHaveLength(1);
  });

  it("reads only finalized documents of the request", async () => {
    const double = use(loaded());

    await getRequestDetail(SCOPE, ID);

    const query = render(double.log[2].where);
    expect(query.sql).toContain('"DocumentoRespaldo"."Estado" = $');
    expect(query.params).toEqual([ID, "valido"]);
  });

  it("orders decisions by time and revisions by number", async () => {
    const double = use(loaded());

    await getRequestDetail(SCOPE, ID);

    const order = (index: number) =>
      render(sql.join(double.log[index].orderBy as never[], sql`, `)).sql;
    expect(order(3)).toBe(
      '"SolicitudDecision"."DecididaEn" asc, "SolicitudDecision"."Id" asc',
    );
    expect(order(4)).toBe('"SolicitudRevision"."Numero" asc');
  });

  describe("escalation history and absence reports (RF-10, RF-15, ES-12)", () => {
    it("returns the escalation with its reason, note, author, time and delivery status", async () => {
      use(loaded());

      const detail = await getRequestDetail(SCOPE, ID);

      expect(detail?.escalamientos).toEqual([escalationRow]);
    });

    it("returns the answer, the answering user and the time of an answered escalation", async () => {
      const [first, classes, documents, decisions, revisions, , reports] =
        loaded();
      use([
        first,
        classes,
        documents,
        decisions,
        revisions,
        {
          kind: "select",
          rows: [
            {
              ...escalationRow,
              respuesta: "El documento es autentico.",
              respondidaPorNombre: "Marta Gomez",
              respondidaEn: new Date("2026-10-09T15:00:00.000Z"),
            },
          ],
        },
        reports,
      ]);

      const [escalation] =
        (await getRequestDetail(SCOPE, ID))?.escalamientos ?? [];

      expect(escalation).toMatchObject({
        respuesta: "El documento es autentico.",
        respondidaPorNombre: "Marta Gomez",
        respondidaEn: new Date("2026-10-09T15:00:00.000Z"),
      });
    });

    it("returns each report with the teacher snapshot, date, note, author, time and its notice status", async () => {
      use(loaded());

      const detail = await getRequestDetail(SCOPE, ID);

      expect(detail?.reportes).toEqual([reportRow]);
    });

    it("reads only the suspicion records of the request for the escalation history", async () => {
      const double = use(loaded());

      await getRequestDetail(SCOPE, ID);

      const query = render(double.log[5].where);
      expect(query.sql).toContain('"Escalamiento"."SolicitudId" = $1');
      expect(query.sql).toContain('"Escalamiento"."Tipo" = $2');
      expect(query.params).toEqual([ID, "sospecha_documento"]);
      const order = render(sql.join(double.log[5].orderBy as never[], sql`, `));
      expect(order.sql).toBe(
        '"Escalamiento"."CreadoEn" asc, "Escalamiento"."Id" asc',
      );
    });

    it("reads the reports of the request oldest first", async () => {
      const double = use(loaded());

      await getRequestDetail(SCOPE, ID);

      const query = render(double.log[6].where);
      expect(query.sql).toContain('"ReporteInasistencia"."SolicitudId" = $1');
      expect(query.params).toEqual([ID]);
      const order = render(sql.join(double.log[6].orderBy as never[], sql`, `));
      expect(order.sql).toBe(
        '"ReporteInasistencia"."RegistradoEn" asc, "ReporteInasistencia"."Id" asc',
      );
    });

    it("adds no audit row: the read is select-only", async () => {
      const double = use(loaded());

      await getRequestDetail(SCOPE, ID);

      expect(double.log.map((statement) => statement.kind)).toEqual(
        Array(7).fill("select"),
      );
      expect(double.transactions).toBe(0);
    });

    it("carries no percentage or absence count in a report", async () => {
      use(loaded());

      const [report] = (await getRequestDetail(SCOPE, ID))?.reportes ?? [];

      expect(Object.keys(report).join(" ")).not.toMatch(
        /porcentaje|percent|inasistencias|conteo|count/i,
      );
    });
  });
});
