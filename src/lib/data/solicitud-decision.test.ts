// @vitest-environment node
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderTemplate,
  type TemplateVars,
} from "@/lib/intake/decision-templates";
import type { DecisionInput } from "@/lib/intake/decision-validation";
import type { RequestScope } from "@/lib/intake/request-scope";
import { canTransition } from "@/lib/intake/transitions";

import {
  createDbDouble,
  type LoggedStatement,
  type Step,
} from "./test-support/db-double";

vi.mock("server-only", () => ({}));

const { holder, insertAuditMock } = vi.hoisted(() => ({
  holder: { current: null as unknown },
  insertAuditMock: vi.fn(),
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
vi.mock("@/lib/data/audit", () => ({ insertAuditEvents: insertAuditMock }));

import { decideRequest } from "@/lib/data/solicitud-decision";

const ACTOR = 20;
const ID = 42;
const SCOPE: RequestScope = { kind: "facultad", facultadId: 3 };
const NOW = new Date("2026-10-14T15:00:00.000Z");

const vars: TemplateVars = {
  estudiante: "Ana Perez",
  causa: "medica",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
};

const requestRow = {
  id: ID,
  causa: "medica",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-10-03",
  estudianteNombre: "Ana Perez",
};

const APPROVE: DecisionInput = {
  tipo: "aprobada",
  plantilla: "aprobacion.general",
  texto: null,
};
const REJECT: DecisionInput = {
  tipo: "rechazada",
  plantilla: "rechazo.documento_no_acredita",
  texto: "El documento no acredita las fechas.",
};
const RETURN: DecisionInput = {
  tipo: "devuelta",
  plantilla: "devolucion.documento_ilegible",
  motivo: "documento_ilegible",
  texto: "Adjunte una copia legible.",
};

function input(decision: DecisionInput, scope: RequestScope = SCOPE) {
  return { actorId: ACTOR, scope, solicitudId: ID, decision, now: NOW };
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

const ofKind = (log: LoggedStatement[], kind: LoggedStatement["kind"]) =>
  log.filter((s) => s.kind === kind);

const rejectScript = (): Step[] => [
  { kind: "update", rows: [requestRow] },
  { kind: "insert", rows: [{ id: 9 }] },
];

/** A row of the teacher listing joined on the request's groups. */
function teacherRow(overrides: Record<string, unknown> = {}) {
  return {
    docenteId: 5,
    docenteNombre: "Ana Perez",
    docenteCorreo: "ana@uam.edu.ni",
    asignaturaId: 10,
    codigo: "MAT101",
    nombre: "Matematica I",
    numeroGrupo: "A",
    ...overrides,
  };
}

/**
 * Approval: guarded update, [mark update], decision insert, teacher listing,
 * [remission insert]. Teachers default to none, so the base approval writes
 * the decision only.
 */
const approveScript = (
  options: {
    marked?: boolean;
    request?: Record<string, unknown>;
    teachers?: unknown[];
    remisiones?: { id: number; docenteId: number }[];
  } = {},
): Step[] => [
  { kind: "update", rows: [options.request ?? requestRow] },
  ...(options.marked ? [{ kind: "update" as const, rows: [] }] : []),
  { kind: "insert", rows: [{ id: 9 }] },
  { kind: "select", rows: options.teachers ?? [] },
  ...(options.remisiones
    ? [{ kind: "insert" as const, rows: options.remisiones }]
    : []),
];

const returnScript = (maxNumero: number | null = null): Step[] => [
  { kind: "update", rows: [requestRow] },
  {
    kind: "select",
    rows: [
      {
        solicitudId: ID,
        asignaturaId: 10,
        codigo: "MAT101",
        nombre: "Matematica I",
        numeroGrupo: "A",
        docenteNombre: "Luis Mora",
      },
    ],
  },
  { kind: "select", rows: [{ id: 11 }, { id: 12 }] },
  { kind: "select", rows: [{ max: maxNumero }] },
  { kind: "insert", rows: [{ id: 8 }] },
  { kind: "insert", rows: [{ id: 9 }] },
];

describe("decideRequest (SR-4, SR-7)", () => {
  beforeEach(() => {
    holder.current = null;
    insertAuditMock.mockReset();
    insertAuditMock.mockResolvedValue(undefined);
  });

  describe.each([
    [
      "aprobada",
      APPROVE,
      "aprobada",
      approveScript,
      ["update", "insert", "select"],
    ],
    ["rechazada", REJECT, "rechazada", rejectScript, ["update", "insert"]],
  ] as const)("%s", (_name, decision, estado, script, kinds) => {
    it("moves the request, writes one decision row and one audit row", async () => {
      const double = use(script());

      const result = await decideRequest(input(decision));

      expect(result).toEqual({
        ok: true,
        remisionIds: [],
        formatoEspecial: false,
      });
      expect(double.transactions).toBe(1);
      expect(double.log.map((s) => s.kind)).toEqual(kinds);
      expect(double.log.every((s) => s.inTransaction)).toBe(true);
      expect(double.log[0].set).toEqual({ estado, actualizadoEn: NOW });
      expect(double.log[1].values).toMatchObject({
        solicitudId: ID,
        tipo: estado,
        plantillaCodigo: decision.plantilla,
        motivoCodigo: null,
        revisionId: null,
        secretariaId: ACTOR,
      });
      expect(insertAuditMock).toHaveBeenCalledTimes(1);
      expect(insertAuditMock.mock.calls[0][1]).toBe(ACTOR);
      expect(insertAuditMock.mock.calls[0][2]).toHaveLength(1);
      expect(insertAuditMock.mock.calls[0][2][0]).toMatchObject({
        accion: `solicitud.${estado}`,
        entidadTipo: "Solicitud",
        entidadId: ID,
      });
    });

    it("writes no revision snapshot", async () => {
      const double = use(script());

      await decideRequest(input(decision));

      expect(ofKind(double.log, "insert")).toHaveLength(1);
      expect(double.log[1].values).toHaveProperty("plantillaCodigo");
    });
  });

  describe("return (devuelta)", () => {
    it("moves to devuelta and links the decision to the new snapshot", async () => {
      const double = use(returnScript());

      const result = await decideRequest(input(RETURN));

      expect(result).toEqual({
        ok: true,
        remisionIds: [],
        formatoEspecial: false,
      });
      expect(double.log[0].set).toEqual({
        estado: "devuelta",
        actualizadoEn: NOW,
      });
      expect(ofKind(double.log, "insert")).toHaveLength(2);
      const decisionRow = double.log[5].values as Record<string, unknown>;
      expect(decisionRow).toMatchObject({
        tipo: "devuelta",
        motivoCodigo: "documento_ilegible",
        texto: "Adjunte una copia legible.",
        revisionId: 8,
        secretariaId: ACTOR,
      });
    });

    it("snapshots the returned version: cause, dates, classes and document ids", async () => {
      const double = use(returnScript());

      await decideRequest(input(RETURN));

      expect(double.log[4].values).toEqual({
        solicitudId: ID,
        numero: 1,
        causa: "medica",
        fechaInicio: "2026-10-01",
        fechaFin: "2026-10-03",
        clases: [
          {
            asignaturaId: 10,
            codigo: "MAT101",
            nombre: "Matematica I",
            numeroGrupo: "A",
          },
        ],
        documentoIds: [11, 12],
      });
    });

    it("numbers the snapshot as the previous maximum plus one", async () => {
      const double = use(returnScript(2));

      await decideRequest(input(RETURN));

      expect(double.log[4].values).toMatchObject({ numero: 3 });
    });

    it("reads only current valid documents of the request", async () => {
      const double = use(returnScript());

      await decideRequest(input(RETURN));

      const query = render(double.log[2].where);
      expect(query.sql).toContain('"DocumentoRespaldo"."RetiradoEn" is null');
      expect(query.params).toEqual([ID, "valido"]);
    });

    it("writes the return audit event with the reason code and no text", async () => {
      use(returnScript());

      await decideRequest(input(RETURN));

      const [event] = insertAuditMock.mock.calls[0][2];
      expect(event).toMatchObject({
        accion: "solicitud.devuelta",
        datos: {
          decisionId: 9,
          plantilla: "devolucion.documento_ilegible",
          motivo: "documento_ilegible",
        },
      });
      expect(JSON.stringify(event)).not.toContain("copia legible");
    });
  });

  describe("guarded update", () => {
    it.each([
      ["aprobada", APPROVE],
      ["rechazada", REJECT],
      ["devuelta", RETURN],
    ] as const)(
      "guards %s on the state the transition table allows",
      async (tipo, decision) => {
        const double = use(
          tipo === "devuelta" ? returnScript() : approveScript(),
        );

        await decideRequest(input(decision));

        const query = render(double.log[0].where);
        expect(query.sql).toContain('"Solicitud"."Estado" = $');
        expect(query.params).toEqual([ID, "pendiente", 3]);
        expect(canTransition("pendiente", tipo, "secretaria")).toBe(true);
        expect(canTransition("borrador", tipo, "secretaria")).toBe(false);
      },
    );

    it("applies only inside the caller's facultad scope", async () => {
      const double = use(approveScript());

      await decideRequest(input(APPROVE));

      const query = render(double.log[0].where);
      expect(query.sql).toContain('"c"."FacultadId" = $');
      expect(query.sql).toContain('"Solicitud"."Id" = $1');
    });

    it("looks for the request in scope after a missed update", async () => {
      const double = use([
        { kind: "update", rows: [] },
        { kind: "select", rows: [] },
      ]);

      await decideRequest(input(APPROVE));

      const query = render(double.log[1].where);
      expect(query.sql).toContain('"c"."FacultadId" = $');
      expect(query.sql).toContain('"Solicitud"."Estado" in (');
      expect(query.params).not.toContain("borrador");
    });
  });

  describe("outcomes", () => {
    it("reports not_found for an out-of-scope or unknown request, with no writes", async () => {
      const double = use([
        { kind: "update", rows: [] },
        { kind: "select", rows: [] },
      ]);

      const result = await decideRequest(input(APPROVE));

      expect(result).toEqual({ ok: false, reason: "not_found" });
      expect(ofKind(double.log, "insert")).toHaveLength(0);
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("reports not_found in the none scope", async () => {
      use([
        { kind: "update", rows: [] },
        { kind: "select", rows: [] },
      ]);

      const result = await decideRequest(input(APPROVE, { kind: "none" }));

      expect(result).toEqual({ ok: false, reason: "not_found" });
    });

    it("reports conflict for a request that is already decided, with no writes", async () => {
      const double = use([
        { kind: "update", rows: [] },
        { kind: "select", rows: [{ id: ID, estado: "aprobada" }] },
      ]);

      const result = await decideRequest(input(REJECT));

      expect(result).toEqual({ ok: false, reason: "conflict" });
      expect(ofKind(double.log, "insert")).toHaveLength(0);
      expect(insertAuditMock).not.toHaveBeenCalled();
    });

    it("rolls back by rejecting when the audit insert fails", async () => {
      const double = use(approveScript());
      insertAuditMock.mockRejectedValue(new Error("audit down"));

      await expect(decideRequest(input(APPROVE))).rejects.toThrow("audit down");

      expect(double.transactions).toBe(1);
      expect(insertAuditMock).toHaveBeenCalledTimes(1);
    });

    it("propagates a failure after the state change instead of reporting success", async () => {
      use([
        { kind: "update", rows: [requestRow] },
        { kind: "insert", error: new Error("insert failed") },
      ]);

      await expect(decideRequest(input(APPROVE))).rejects.toThrow(
        "insert failed",
      );
      expect(insertAuditMock).not.toHaveBeenCalled();
    });
  });

  describe("teacher remissions created with the approval (TR-4, RF-09 a)", () => {
    const fuerzaMayor = { ...requestRow, causa: "fuerza_mayor" };
    const luis = teacherRow({
      docenteId: 6,
      docenteNombre: "Luis Mora",
      docenteCorreo: "luis@uam.edu.ni",
      asignaturaId: 11,
      codigo: "FIS101",
      nombre: "Fisica I",
      numeroGrupo: "B",
    });

    it("inserts one pending remission per distinct teacher with the snapshot", async () => {
      const double = use(
        approveScript({
          teachers: [teacherRow(), luis],
          remisiones: [
            { id: 31, docenteId: 5 },
            { id: 32, docenteId: 6 },
          ],
        }),
      );

      const result = await decideRequest(input(APPROVE));

      expect(result).toEqual({
        ok: true,
        remisionIds: [31, 32],
        formatoEspecial: false,
      });
      expect(double.log.map((s) => s.kind)).toEqual([
        "update",
        "insert",
        "select",
        "insert",
      ]);
      expect(double.log.every((s) => s.inTransaction)).toBe(true);
      expect(double.log[3].values).toEqual([
        {
          solicitudId: ID,
          docenteId: 5,
          docenteNombre: "Ana Perez",
          correo: "ana@uam.edu.ni",
          clases: [
            {
              asignaturaId: 10,
              codigo: "MAT101",
              nombre: "Matematica I",
              numeroGrupo: "A",
            },
          ],
          estado: "pendiente",
          motivoCodigo: null,
        },
        {
          solicitudId: ID,
          docenteId: 6,
          docenteNombre: "Luis Mora",
          correo: "luis@uam.edu.ni",
          clases: [
            {
              asignaturaId: 11,
              codigo: "FIS101",
              nombre: "Fisica I",
              numeroGrupo: "B",
            },
          ],
          estado: "pendiente",
          motivoCodigo: null,
        },
      ]);
    });

    it("creates one remission when two groups belong to the same teacher", async () => {
      const double = use(
        approveScript({
          teachers: [
            teacherRow(),
            teacherRow({
              asignaturaId: 12,
              codigo: "QUI101",
              numeroGrupo: "C",
            }),
          ],
          remisiones: [{ id: 31, docenteId: 5 }],
        }),
      );

      await decideRequest(input(APPROVE));

      const rows = double.log[3].values as { clases: unknown[] }[];
      expect(rows).toHaveLength(1);
      expect(rows[0].clases).toHaveLength(2);
    });

    it("writes one remision.creada per row after the approval event, in the same transaction", async () => {
      use(
        approveScript({
          teachers: [teacherRow(), luis],
          remisiones: [
            { id: 31, docenteId: 5 },
            { id: 32, docenteId: 6 },
          ],
        }),
      );

      await decideRequest(input(APPROVE));

      expect(insertAuditMock).toHaveBeenCalledTimes(2);
      expect(
        insertAuditMock.mock.calls[0][2].map(
          (e: { accion: string }) => e.accion,
        ),
      ).toEqual(["solicitud.aprobada"]);
      expect(insertAuditMock.mock.calls[1][1]).toBe(ACTOR);
      expect(insertAuditMock.mock.calls[1][2]).toEqual([
        {
          accion: "remision.creada",
          entidadTipo: "Remision",
          entidadId: 31,
          datos: { solicitudId: ID, estado: "pendiente" },
        },
        {
          accion: "remision.creada",
          entidadTipo: "Remision",
          entidadId: 32,
          datos: { solicitudId: ID, estado: "pendiente" },
        },
      ]);
    });

    it("blocks a teacher without an email with sin_correo and audits the reason", async () => {
      const double = use(
        approveScript({
          teachers: [teacherRow({ docenteCorreo: null })],
          remisiones: [{ id: 31, docenteId: 5 }],
        }),
      );

      await decideRequest(input(APPROVE));

      expect(double.log[3].values).toMatchObject([
        { correo: null, estado: "bloqueada", motivoCodigo: "sin_correo" },
      ]);
      expect(insertAuditMock.mock.calls[1][2][0].datos).toEqual({
        solicitudId: ID,
        estado: "bloqueada",
        motivo: "sin_correo",
      });
    });

    it("inserts nothing when no group has an identified teacher", async () => {
      const double = use(
        approveScript({
          teachers: [
            teacherRow({
              docenteId: null,
              docenteNombre: null,
              docenteCorreo: null,
            }),
          ],
        }),
      );

      const result = await decideRequest(input(APPROVE));

      expect(result).toEqual({
        ok: true,
        remisionIds: [],
        formatoEspecial: false,
      });
      expect(ofKind(double.log, "insert")).toHaveLength(1);
      expect(insertAuditMock).toHaveBeenCalledTimes(1);
    });

    it("creates no remission on rejection or return", async () => {
      const rejected = use(rejectScript());
      await decideRequest(input(REJECT));
      expect(rejected.log.map((s) => s.kind)).toEqual(["update", "insert"]);

      // A return reads classes and documents for its snapshot, but inserts
      // only the revision and the decision.
      const returned = use(returnScript());
      await decideRequest(input(RETURN));
      expect(ofKind(returned.log, "insert")).toHaveLength(2);

      expect(
        insertAuditMock.mock.calls
          .flatMap((c) => c[2] as { accion: string }[])
          .map((e) => e.accion),
      ).toEqual(["solicitud.rechazada", "solicitud.devuelta"]);
    });

    it("rolls back everything when the remission insert fails", async () => {
      use([
        ...approveScript({ teachers: [teacherRow()] }),
        { kind: "insert", error: new Error("insert failed") },
      ]);

      await expect(decideRequest(input(APPROVE))).rejects.toThrow(
        "insert failed",
      );
      expect(insertAuditMock).toHaveBeenCalledTimes(1);
    });

    it("rolls back everything when the remission audit fails", async () => {
      use(
        approveScript({
          teachers: [teacherRow()],
          remisiones: [{ id: 31, docenteId: 5 }],
        }),
      );
      insertAuditMock
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("audit down"));

      await expect(decideRequest(input(APPROVE))).rejects.toThrow("audit down");
    });

    describe("special-format mark (RN-19)", () => {
      const MARKED: DecisionInput = { ...APPROVE, formatoEspecial: true };

      it("sets the mark and creates every remission blocked as formato_especial_faltante", async () => {
        const double = use(
          approveScript({
            marked: true,
            request: fuerzaMayor,
            teachers: [teacherRow(), luis],
            remisiones: [
              { id: 31, docenteId: 5 },
              { id: 32, docenteId: 6 },
            ],
          }),
        );

        const result = await decideRequest(input(MARKED));

        expect(result).toEqual({
          ok: true,
          remisionIds: [31, 32],
          formatoEspecial: true,
        });
        expect(double.log[1].kind).toBe("update");
        expect(double.log[1].set).toEqual({ formatoEspecial: true });
        const rows = double.log[4].values as {
          estado: string;
          motivoCodigo: string;
        }[];
        expect(rows.map((r) => [r.estado, r.motivoCodigo])).toEqual([
          ["bloqueada", "formato_especial_faltante"],
          ["bloqueada", "formato_especial_faltante"],
        ]);
      });

      it("reports sin_correo before the missing format", async () => {
        const double = use(
          approveScript({
            marked: true,
            request: fuerzaMayor,
            teachers: [teacherRow({ docenteCorreo: null })],
            remisiones: [{ id: 31, docenteId: 5 }],
          }),
        );

        await decideRequest(input(MARKED));

        expect(double.log[4].values).toMatchObject([
          { motivoCodigo: "sin_correo" },
        ]);
      });

      it("refuses the mark on another cause: invalid, nothing created, state untouched", async () => {
        const double = use([{ kind: "update", rows: [requestRow] }]);

        const result = await decideRequest(input(MARKED));

        expect(result).toEqual({ ok: false, reason: "invalid" });
        expect(ofKind(double.log, "insert")).toHaveLength(0);
        expect(insertAuditMock).not.toHaveBeenCalled();
        expect(double.transactions).toBe(1);
      });

      it("refuses the mark on a rejection before touching the database", async () => {
        const double = use([]);

        const result = await decideRequest(
          input({
            ...REJECT,
            formatoEspecial: true,
          } as unknown as DecisionInput),
        );

        expect(result).toEqual({ ok: false, reason: "invalid" });
        expect(double.transactions).toBe(0);
      });
    });
  });

  describe("server-side validation", () => {
    it("refuses a rejection with blank text before touching the database", async () => {
      const double = use([]);

      const result = await decideRequest(
        input({ ...REJECT, texto: "   " } as DecisionInput),
      );

      expect(result).toEqual({ ok: false, reason: "invalid" });
      expect(double.log).toHaveLength(0);
      expect(double.transactions).toBe(0);
    });

    it("refuses a return without a reason code", async () => {
      const double = use([]);

      const result = await decideRequest(
        input({ ...RETURN, motivo: undefined } as unknown as DecisionInput),
      );

      expect(result).toEqual({ ok: false, reason: "invalid" });
      expect(double.log).toHaveLength(0);
    });

    it("refuses a return with a code outside the RN-17 list", async () => {
      use([]);

      const result = await decideRequest(
        input({ ...RETURN, motivo: "otro" } as unknown as DecisionInput),
      );

      expect(result).toEqual({ ok: false, reason: "invalid" });
    });

    it("refuses a template of another kind", async () => {
      use([]);

      const result = await decideRequest(
        input({ ...APPROVE, plantilla: "rechazo.general" }),
      );

      expect(result).toEqual({ ok: false, reason: "invalid" });
    });
  });

  describe("actor and audit payload", () => {
    it("takes the actor only from the call, for the decision row and the audit row", async () => {
      const double = use(approveScript());

      await decideRequest({ ...input(APPROVE), actorId: 77 });

      expect(double.log[1].values).toMatchObject({ secretariaId: 77 });
      expect(insertAuditMock.mock.calls[0][1]).toBe(77);
    });

    it("reports an unedited template as textoEditado false", async () => {
      use(approveScript());

      await decideRequest(
        input({
          tipo: "aprobada",
          plantilla: "aprobacion.general",
          texto: renderTemplate("aprobacion.general", vars),
        }),
      );

      expect(insertAuditMock.mock.calls[0][2][0].datos.textoEditado).toBe(
        false,
      );
    });

    it("reports an edited or cleared text as textoEditado true", async () => {
      use(approveScript());
      await decideRequest(
        input({
          tipo: "aprobada",
          plantilla: "aprobacion.general",
          texto: "Aprobada. Saludos.",
        }),
      );
      expect(insertAuditMock.mock.calls[0][2][0].datos.textoEditado).toBe(true);

      use(approveScript());
      await decideRequest(input(APPROVE));
      expect(insertAuditMock.mock.calls[1][2][0].datos.textoEditado).toBe(true);
    });

    it("stores the trimmed approval text, or none when blank", async () => {
      const double = use(approveScript());
      await decideRequest(input({ ...APPROVE, texto: "  Aprobada.  " }));
      expect(double.log[1].values).toMatchObject({ texto: "Aprobada." });

      const blank = use(approveScript());
      await decideRequest(input({ ...APPROVE, texto: "   " }));
      expect(blank.log[1].values).toMatchObject({ texto: null });
    });
  });
});
