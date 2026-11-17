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
  readCurrentFingerprints,
  readEarlierMatches,
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
      /^select "PresentadaEn", "FechaInicio", "FechaFin", "Causa", "EstudianteId" from "Solicitud" where "Solicitud"\."Id" = \$1/,
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

describe("RN-26 current fingerprints (Q5, current side)", () => {
  it("reads the id and fingerprint of the current student documents only", async () => {
    const { sql, params } = await emitted(() => readCurrentFingerprints(42));

    expect(sql).toMatch(
      /^select "Id", "HuellaSha256" from "DocumentoRespaldo" where /,
    );
    expect(sql).toContain('"DocumentoRespaldo"."SolicitudId" = $');
    expect(sql).toContain('"DocumentoRespaldo"."Estado" = $');
    expect(sql).toContain('"DocumentoRespaldo"."RetiradoEn" is null');
    expect(sql).toContain('"DocumentoRespaldo"."SubidoPorId" is null');
    expect(sql).toContain('"DocumentoRespaldo"."FormatoEspecial" = $');
    expect(params).toEqual(expect.arrayContaining([42, "valido", false]));
  });
});

describe("RN-26 earlier matches (Q5, other side)", () => {
  const HASHES = ["a".repeat(64), "b".repeat(64)];
  const SECRETARY = { kind: "facultad", facultadId: 4 } as const;
  const query = (
    referenceScope: Parameters<
      typeof readEarlierMatches
    >[0]["referenceScope"] = SECRETARY,
  ) =>
    emitted(() =>
      readEarlierMatches({
        solicitudId: 42,
        hashes: HASHES,
        referenceScope,
      }),
    );

  it("looks the fingerprints up with IN, once per distinct earlier request", async () => {
    const { sql, params } = await query();

    expect(sql).toMatch(/^select distinct case when /);
    expect(sql).toMatch(
      /from "DocumentoRespaldo" inner join "Solicitud" on "Solicitud"\."Id" = "DocumentoRespaldo"\."SolicitudId" where /,
    );
    expect(sql).toMatch(
      /"DocumentoRespaldo"\."HuellaSha256" in \(\$\d+, \$\d+\)/,
    );
    expect(params).toEqual(expect.arrayContaining(HASHES));
  });

  it("never matches the request itself", async () => {
    const { sql, params } = await query();

    expect(sql).toContain('"Solicitud"."Id" <> $');
    expect(params).toContain(42);
  });

  it("keeps only presented requests that are earlier in the order of presentation", async () => {
    const { sql } = await query();

    expect(sql).toContain('"Solicitud"."PresentadaEn" is not null');
    // Equal presentation time is broken by the request id, inside the database.
    expect(sql).toMatch(
      /\("Solicitud"\."PresentadaEn", "Solicitud"\."Id"\) < \(select "PresentadaEn", "Id" from "Solicitud" "r" where "r"\."Id" = \$\d+\)/,
    );
  });

  it("excludes staff uploads and special format, and includes retired documents", async () => {
    const { sql, params } = await query();

    expect(sql).toContain('"DocumentoRespaldo"."SubidoPorId" is null');
    expect(sql).toContain('"DocumentoRespaldo"."FormatoEspecial" = $');
    expect(sql).toContain('"DocumentoRespaldo"."Estado" = $');
    expect(sql).not.toContain('"DocumentoRespaldo"."RetiradoEn"');
    expect(params).toContain("valido");
    expect(params).toContain(false);
  });

  it("has no state filter, so rejected and returned requests count", async () => {
    const { sql, params } = await query();

    expect(sql).not.toContain('"Solicitud"."Estado"');
    expect(params).not.toContain("rechazada");
    expect(params).not.toContain("devuelta");
  });

  it("nulls the other request id inside the database when it is outside the scope", async () => {
    const { sql, params } = await query();

    expect(sql).toMatch(
      /^select distinct case when exists \(select 1 from "Usuario" "e" inner join "Carrera" "c" on "c"\."Id" = "e"\."CarreraId" where \("e"\."Id" = "Solicitud"\."EstudianteId" and "c"\."FacultadId" = \$\d+\)\) then "Solicitud"\."Id" end from /,
    );
    expect(params).toContain(4);
  });

  it("renders the literal false for a caller with no scope, so no id ever leaves", async () => {
    const { sql, params } = await query({ kind: "none" });

    expect(sql).toMatch(
      /^select distinct case when false then "Solicitud"\."Id" end from /,
    );
    expect(sql).not.toContain('"Usuario"');
    expect(params).not.toContain(4);
  });

  it("selects no name, document name, e-mail or fingerprint column", async () => {
    const { sql } = await query();
    const selected = sql.slice(0, sql.indexOf(' from "DocumentoRespaldo"'));

    expect(selected).not.toMatch(/Nombre|Cif|Correo|Pathname|HuellaSha256/i);
    expect(sql.match(/HuellaSha256/g)).toHaveLength(1);
  });
});
