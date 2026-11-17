// @vitest-environment node
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CoordinationScope } from "@/lib/intake/coordination-scope";

import {
  createDbDouble,
  type LoggedStatement,
  type Step,
} from "./test-support/db-double";

vi.mock("server-only", () => ({}));

const { holder, classesMock } = vi.hoisted(() => ({
  holder: { current: null as unknown },
  classesMock: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_t, prop) =>
        (holder.current as Record<string | symbol, unknown>)[prop],
    },
  ),
}));
// The only module that joins the class tables (secretary-review, SR-3).
vi.mock("@/lib/data/solicitud-clases", () => ({
  listRequestClasses: classesMock,
}));

import {
  getCoordinationDetail,
  listCoordinationEscalations,
} from "@/lib/data/coordination-queue";

const CAREER = 4;
const SCOPE: CoordinationScope = { kind: "carrera", carreraId: CAREER };
const NONE: CoordinationScope = { kind: "none" };
const ESCALATED = new Date("2026-10-14T15:00:00.000Z");

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

const orderOf = (statement: LoggedStatement) =>
  (statement.orderBy ?? []).map((part) => render(part).sql);

beforeEach(() => {
  holder.current = null;
  classesMock.mockReset();
  classesMock.mockResolvedValue(new Map());
});

describe("listCoordinationEscalations (E1, E10, RNF-01)", () => {
  const openRow = {
    id: 9,
    estudianteNombre: "Ana Lopez",
    estudianteCif: "2020-0001",
    motivo: "sospecha_documento",
    creadoEn: ESCALATED,
  };
  const noticeRow = {
    id: 12,
    estudianteNombre: "Luis Mora",
    estudianteCif: "2021-0042",
    docenteNombre: "Marta Ruiz",
    comunicadoEl: "2026-10-13",
    creadoEn: ESCALATED,
  };

  it("returns the open escalations and the notices of the own career", async () => {
    const double = use([
      { kind: "select", rows: [openRow] },
      { kind: "select", rows: [noticeRow] },
    ]);

    const result = await listCoordinationEscalations(SCOPE);

    expect(result).toEqual({ open: [openRow], notices: [noticeRow] });
    expect(double.log).toHaveLength(2);
  });

  it("lists a special case beside a suspicion, with its own motive (E18)", async () => {
    use([
      {
        kind: "select",
        rows: [openRow, { ...openRow, id: 10, motivo: "caso_especial" }],
      },
      { kind: "select", rows: [] },
    ]);

    const result = await listCoordinationEscalations(SCOPE);

    expect(result.open.map((r) => [r.id, r.motivo])).toEqual([
      [9, "sospecha_documento"],
      [10, "caso_especial"],
    ]);
  });

  it("lists open escalations oldest first, and notices newest first", async () => {
    const double = use([
      { kind: "select", rows: [] },
      { kind: "select", rows: [] },
    ]);

    await listCoordinationEscalations(SCOPE);

    expect(orderOf(double.log[0])).toEqual([
      '"Escalamiento"."CreadoEn" asc',
      '"Escalamiento"."Id" asc',
    ]);
    expect(orderOf(double.log[1])).toEqual([
      '"Escalamiento"."CreadoEn" desc',
      '"Escalamiento"."Id" desc',
    ]);
  });

  it("keeps only open escalations of either motive of a request still in coordination", async () => {
    const double = use([
      { kind: "select", rows: [] },
      { kind: "select", rows: [] },
    ]);

    await listCoordinationEscalations(SCOPE);

    const open = render(double.log[0].where);
    expect(open.sql).toContain('"Escalamiento"."Tipo" in ($1, $2)');
    expect(open.sql).toContain('"Escalamiento"."RespondidaEn" is null');
    expect(open.sql).toContain('"Solicitud"."Estado" = $3');
    expect(open.params).toEqual([
      "sospecha_documento",
      "caso_especial",
      "en_revision_coordinacion",
      CAREER,
    ]);
  });

  it("keeps only notices of a request that is not a draft", async () => {
    const double = use([
      { kind: "select", rows: [] },
      { kind: "select", rows: [] },
    ]);

    await listCoordinationEscalations(SCOPE);

    const notices = render(double.log[1].where);
    expect(notices.sql).toContain('"Escalamiento"."Tipo" = $1');
    expect(notices.sql).toContain('"Solicitud"."Estado" in (');
    expect(notices.params[0]).toBe("exceso_inasistencias");
    expect(notices.params).not.toContain("borrador");
    expect(notices.params.at(-1)).toBe(CAREER);
  });

  it("lists a blocked notification too: the delivery state is not a filter", async () => {
    const double = use([
      { kind: "select", rows: [openRow] },
      { kind: "select", rows: [] },
    ]);

    await listCoordinationEscalations(SCOPE);

    for (const statement of double.log) {
      expect(render(statement.where).sql).not.toContain("NotificacionEstado");
    }
    expect(Object.keys(double.log[0].selection as object)).not.toContain(
      "notificacionEstado",
    );
  });

  it("binds the career of the scope, so a career change takes effect", async () => {
    const first = use([
      { kind: "select", rows: [] },
      { kind: "select", rows: [] },
    ]);
    await listCoordinationEscalations({ kind: "carrera", carreraId: 5 });
    const second = use([
      { kind: "select", rows: [] },
      { kind: "select", rows: [] },
    ]);
    await listCoordinationEscalations({ kind: "carrera", carreraId: 6 });

    expect(render(first.log[0].where).params.at(-1)).toBe(5);
    expect(render(second.log[0].where).params.at(-1)).toBe(6);
  });

  it("selects no cause, dates, email, consent or note", async () => {
    const double = use([
      { kind: "select", rows: [] },
      { kind: "select", rows: [] },
    ]);

    await listCoordinationEscalations(SCOPE);

    for (const statement of double.log) {
      const keys = Object.keys(statement.selection as object).join(" ");
      expect(keys).not.toMatch(
        /causa|fechaInicio|fechaFin|correo|consentimiento|nota|respuesta/i,
      );
    }
  });

  it("reads nothing for a coordinator without a career", async () => {
    const double = use([]);

    expect(await listCoordinationEscalations(NONE)).toEqual({
      open: [],
      notices: [],
    });
    expect(double.log).toHaveLength(0);
  });
});

describe("getCoordinationDetail (E1, E10, RNF-01)", () => {
  const mainRow = {
    id: 9,
    solicitudId: 41,
    tipo: "sospecha_documento",
    nota: "La firma del medico no coincide con el sello.",
    creadoEn: ESCALATED,
    respondidaEn: null as Date | null,
    estado: "en_revision_coordinacion",
    causa: "salud",
    fechaInicio: "2026-10-12",
    fechaFin: "2026-10-14",
    estudianteNombre: "Ana Lopez",
    estudianteCif: "2020-0001",
    carrera: "Ingenieria Civil",
    docenteNombre: null as string | null,
    comunicadoEl: null as string | null,
    reporteNota: null as string | null,
  };
  const noticeRow = {
    ...mainRow,
    id: 12,
    tipo: "exceso_inasistencias",
    nota: null,
    estado: "aprobada",
    causa: "salud",
    docenteNombre: "Marta Ruiz",
    comunicadoEl: "2026-10-13",
    reporteNota: "Supera el limite de faltas.",
  };
  const document = {
    id: 5,
    nombreOriginal: "dictamen.pdf",
    tipoDetectado: "pdf",
    tamanoBytes: 2048,
    creadoEn: new Date("2026-10-10T12:00:00.000Z"),
  };
  const classRow = {
    asignaturaId: 3,
    codigo: "MAT-101",
    nombre: "Calculo I",
    numeroGrupo: "A",
    docenteNombre: "Marta Ruiz",
  };

  describe("an open escalation", () => {
    // The script of an open escalation's two reads (the class seam is a mock).
    function openScript(overrides: Record<string, unknown> = {}): Step[] {
      classesMock.mockResolvedValue(new Map([[41, [classRow]]]));
      return [
        { kind: "select", rows: [{ ...mainRow, ...overrides }] },
        { kind: "select", rows: [document] },
      ];
    }

    it("holds the student, the cause, the dates, the subjects, the documents, the reason, the note and the time", async () => {
      use(openScript());

      expect(await getCoordinationDetail(SCOPE, 9)).toEqual({
        kind: "escalation",
        id: 9,
        solicitudId: 41,
        estado: "en_revision_coordinacion",
        motivo: "sospecha_documento",
        nota: "La firma del medico no coincide con el sello.",
        creadoEn: ESCALATED,
        estudiante: {
          nombre: "Ana Lopez",
          cif: "2020-0001",
          carrera: "Ingenieria Civil",
        },
        causa: "salud",
        fechaInicio: "2026-10-12",
        fechaFin: "2026-10-14",
        clases: [classRow],
        documentos: [document],
      });
    });

    it("shows a special case with its own motive, like a suspicion (E18)", async () => {
      use(openScript({ tipo: "caso_especial", causa: "otra" }));

      expect(await getCoordinationDetail(SCOPE, 9)).toMatchObject({
        kind: "escalation",
        motivo: "caso_especial",
        nota: "La firma del medico no coincide con el sello.",
      });
    });

    it("takes the subjects with group and teacher only from the class seam", async () => {
      const double = use(openScript());

      await getCoordinationDetail(SCOPE, 9);

      expect(classesMock).toHaveBeenCalledTimes(1);
      expect(classesMock.mock.calls[0][1]).toEqual([41]);
      // main row + documents; the class tables are never joined here.
      expect(double.log).toHaveLength(2);
    });

    it("finds the escalation by id inside the career of the scope", async () => {
      const double = use(openScript());

      await getCoordinationDetail(SCOPE, 9);

      const where = render(double.log[0].where);
      expect(where.sql).toContain('"Escalamiento"."Id" = $1');
      expect(where.params).toEqual([9, CAREER]);
    });

    it("lists the current documents: valid, not retired, not the special format", async () => {
      const double = use(openScript());

      await getCoordinationDetail(SCOPE, 9);

      const where = render(double.log[1].where);
      expect(where.sql).toContain('"DocumentoRespaldo"."SolicitudId" = $1');
      expect(where.sql).toContain('"DocumentoRespaldo"."Estado" = $2');
      expect(where.sql).toContain('"DocumentoRespaldo"."RetiradoEn" is null');
      expect(where.sql).toContain('"DocumentoRespaldo"."FormatoEspecial" = $3');
      expect(where.params).toEqual([41, "valido", false]);
    });

    it("selects neither the student email, the consent nor the decision history", async () => {
      const double = use(openScript());

      const detail = await getCoordinationDetail(SCOPE, 9);

      const selected = Object.keys(double.log[0].selection as object).join(" ");
      expect(selected).not.toMatch(
        /correo|email|consentimiento|decision|respuesta|secretaria/i,
      );
      expect(Object.keys(detail ?? {})).not.toEqual(
        expect.arrayContaining(["correo"]),
      );
      expect(JSON.stringify(detail)).not.toMatch(/@|consent/i);
    });

    it("is hidden once answered, even when the request is still in coordination", async () => {
      use(openScript({ respondidaEn: new Date("2026-10-15T10:00:00.000Z") }));

      expect(await getCoordinationDetail(SCOPE, 9)).toBeNull();
    });

    it.each(["pendiente", "aprobada", "borrador", "rechazada", "devuelta"])(
      "is hidden when the request is %s, not in coordination",
      async (estado) => {
        use(openScript({ estado }));

        expect(await getCoordinationDetail(SCOPE, 9)).toBeNull();
      },
    );
  });

  describe("a notice", () => {
    it("holds the student, the teacher, the communicated date and the note, and nothing else", async () => {
      const double = use([{ kind: "select", rows: [noticeRow] }]);

      const detail = await getCoordinationDetail(SCOPE, 12);

      expect(detail).toEqual({
        kind: "notice",
        id: 12,
        solicitudId: 41,
        estado: "aprobada",
        creadoEn: ESCALATED,
        estudiante: {
          nombre: "Ana Lopez",
          cif: "2020-0001",
          carrera: "Ingenieria Civil",
        },
        docenteNombre: "Marta Ruiz",
        comunicadoEl: "2026-10-13",
        nota: "Supera el limite de faltas.",
      });
      // No documents and no classes are read for a notice.
      expect(double.log).toHaveLength(1);
      expect(classesMock).not.toHaveBeenCalled();
    });

    it("reads the report through the notice's own link", async () => {
      const double = use([{ kind: "select", rows: [noticeRow] }]);

      await getCoordinationDetail(SCOPE, 12);

      const fields = double.log[0].selection as Record<string, unknown>;
      expect(Object.keys(fields)).toEqual(
        expect.arrayContaining([
          "docenteNombre",
          "comunicadoEl",
          "reporteNota",
        ]),
      );
    });

    it("is hidden for a draft request", async () => {
      use([{ kind: "select", rows: [{ ...noticeRow, estado: "borrador" }] }]);

      expect(await getCoordinationDetail(SCOPE, 12)).toBeNull();
    });
  });

  it("is null for an unknown id or another career: the same as a missing record", async () => {
    use([{ kind: "select", rows: [] }]);

    expect(await getCoordinationDetail(SCOPE, 404)).toBeNull();
    expect(classesMock).not.toHaveBeenCalled();
  });

  it("reads nothing for a coordinator without a career", async () => {
    const double = use([]);

    expect(await getCoordinationDetail(NONE, 9)).toBeNull();
    expect(double.log).toHaveLength(0);
  });
});
