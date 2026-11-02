// @vitest-environment node
import { drizzle } from "drizzle-orm/postgres-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const logged: { sql: string; params: unknown[] }[] = [];

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  // A driver-less drizzle instance: the logger sees every emitted statement
  // (text + params) before the missing driver makes execution fail (pattern of
  // `extraction-sql.test.ts`). It proves the whole statement is well formed.
  db: drizzle.mock({
    logger: {
      logQuery(sql: string, params: unknown[]) {
        logged.push({ sql, params });
      },
    },
  }),
}));

import {
  readIssuerHistory,
  readPeriods,
  readRequestBase,
} from "@/lib/data/signals";

async function emitted(run: () => Promise<unknown>) {
  await run().catch(() => undefined);
  expect(logged).toHaveLength(1);
  return logged[0];
}

beforeEach(() => {
  logged.length = 0;
});

describe("statements emitted by the signals read", () => {
  it("reads the request base by id (Q1)", async () => {
    const { sql, params } = await emitted(() => readRequestBase(42));

    expect(sql).toMatch(
      /^select "PresentadaEn", "FechaInicio", "FechaFin", "EstudianteId" from "Solicitud" where "Solicitud"\."Id" = \$1/,
    );
    expect(params).toEqual([42, 1]);
  });

  it("reads the distinct periods of the request's groups (Q3)", async () => {
    const { sql, params } = await emitted(() => readPeriods(42));

    expect(sql).toMatch(
      /^select distinct "Grupo"\."Periodo" from "SolicitudAsignatura" inner join "Grupo" on "Grupo"\."Id" = "SolicitudAsignatura"\."GrupoId" where "SolicitudAsignatura"\."SolicitudId" = \$1$/,
    );
    expect(params).toEqual([42]);
  });
});

describe("RN-14 history statement (Q4)", () => {
  const query = () =>
    emitted(() =>
      readIssuerHistory({
        solicitudId: 42,
        estudianteId: 7,
        period: "2026-S2",
      }),
    );

  it("selects the request id and the raw issuer of earlier presented requests of the same student", async () => {
    const { sql, params } = await query();

    expect(sql).toMatch(
      /^select "Solicitud"\."Id", "ExtraccionDocumento"\."Emisor" from "Solicitud" inner join "DocumentoRespaldo" on .* inner join "ExtraccionDocumento" on .* where /,
    );
    expect(sql).toContain('"Solicitud"."EstudianteId" = $');
    expect(sql).toContain('"Solicitud"."Id" <> $');
    expect(sql).toContain('"Solicitud"."PresentadaEn" is not null');
    expect(params).toContain(7);
    expect(params).toContain(42);
  });

  it("keeps only requests earlier in the order of presentation", async () => {
    const { sql } = await query();

    expect(sql).toMatch(
      /\("Solicitud"\."PresentadaEn", "Solicitud"\."Id"\) < \(select "PresentadaEn", "Id" from "Solicitud" "r" where "r"\."Id" = \$\d+\)/,
    );
  });

  it("requires a group of the period through an EXISTS", async () => {
    const { sql, params } = await query();

    expect(sql).toMatch(
      /exists \(select 1 from "SolicitudAsignatura" inner join "Grupo" on .* where .*"SolicitudAsignatura"\."SolicitudId" = "Solicitud"\."Id" and "Grupo"\."Periodo" = \$\d+\)/,
    );
    expect(params).toContain("2026-S2");
  });

  it("counts current student documents only: valid, not retired, not staff, not special format", async () => {
    const { sql, params } = await query();

    expect(sql).toContain('"DocumentoRespaldo"."Estado" = $');
    expect(sql).toContain('"DocumentoRespaldo"."RetiradoEn" is null');
    expect(sql).toContain('"DocumentoRespaldo"."SubidoPorId" is null');
    expect(sql).toContain('"DocumentoRespaldo"."FormatoEspecial" = $');
    expect(params).toContain("valido");
    expect(params).toContain(false);
  });

  it("needs a completed extraction with a non-null issuer", async () => {
    const { sql, params } = await query();

    expect(sql).toContain('"ExtraccionDocumento"."Estado" = $');
    expect(sql).toContain('"ExtraccionDocumento"."Emisor" is not null');
    expect(params).toContain("completada");
  });

  it("has no state filter, so rejected and returned requests count", async () => {
    const { sql, params } = await query();

    expect(sql).not.toContain('"Solicitud"."Estado"');
    expect(params).not.toContain("rechazada");
    expect(params).not.toContain("devuelta");
  });
});
