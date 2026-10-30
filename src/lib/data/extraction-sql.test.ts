// @vitest-environment node
import { drizzle } from "drizzle-orm/postgres-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const logged: { sql: string; params: unknown[] }[] = [];

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  // A driver-less drizzle instance: the logger sees every emitted statement
  // (text + params) before the missing driver makes execution fail. It proves
  // the whole statements are well formed, which the scripted double (that
  // only sees clauses) cannot.
  db: drizzle.mock({
    logger: {
      logQuery(sql: string, params: unknown[]) {
        logged.push({ sql, params });
      },
    },
  }),
}));

import {
  abandonExpiredExtractions,
  claimExtraction,
  failExtraction,
  listExtractions,
  selectExtractionCandidates,
  type ExtractionClaim,
} from "@/lib/data/extraction";

const NOW = new Date("2026-10-22T15:00:00.000Z");
const claim: ExtractionClaim = {
  documentoId: 7,
  pathname: "intake/4/0b9f6c1e-4f0a-4d57-9a64-2f3f8f1d2c11.pdf",
  tipoDetectado: "pdf",
  intentos: 1,
  reclamoId: "11111111-1111-4111-8111-111111111111",
  submittedAt: NOW,
};

async function emitted(run: () => Promise<unknown>) {
  await run().catch(() => undefined);
  expect(logged).toHaveLength(1);
  return logged[0];
}

beforeEach(() => {
  logged.length = 0;
});

describe("statements emitted by the extraction data module", () => {
  it("claims with one UPDATE ... FROM ... JOIN ... RETURNING, the attempt bumped in SQL", async () => {
    const { sql, params } = await emitted(() => claimExtraction(7, NOW));

    expect(sql).toMatch(
      /^update "ExtraccionDocumento" set .*"Intentos" = "ExtraccionDocumento"\."Intentos" \+ 1.* from "DocumentoRespaldo" inner join "Solicitud" on "Solicitud"\."Id" = "DocumentoRespaldo"\."SolicitudId" where .* returning /,
    );
    expect(params).toHaveLength(9);
  });

  it("guards a failure by document, claim and state in one UPDATE that returns the id", async () => {
    const { sql } = await emitted(() =>
      failExtraction(claim, "not_configured", NOW),
    );

    expect(sql).toMatch(
      /^update "ExtraccionDocumento" set .*"Intentos" = greatest\("ExtraccionDocumento"\."Intentos" - 1, 0\).* where \("ExtraccionDocumento"\."DocumentoId" = \$\d+ and "ExtraccionDocumento"\."ReclamoId" = \$\d+ and "ExtraccionDocumento"\."Estado" = \$\d+\) returning "DocumentoId"$/,
    );
  });

  it("abandons expired last-attempt leases in one UPDATE", async () => {
    const { sql } = await emitted(() => abandonExpiredExtractions(NOW));

    expect(sql).toMatch(
      /^update "ExtraccionDocumento" set .* where \(.*"ReclamadaEn" < \$\d+ and .*"Intentos" >= \$\d+\) returning "DocumentoId"$/,
    );
  });

  it("selects candidates with two correlated EXISTS, a bounded ordered batch", async () => {
    const { sql, params } = await emitted(() =>
      selectExtractionCandidates(NOW, 10),
    );

    expect(sql).toMatch(
      /^select "Id" from "Solicitud" where .*exists \(select 1 from "ExtraccionDocumento" inner join .* or exists \(select 1 from "DocumentoRespaldo" .*not exists \(select 1 from "ExtraccionDocumento" .* order by coalesce\(.*\) asc, "Solicitud"\."Id" asc limit \$\d+$/,
    );
    expect(params.at(-1)).toBe(10);
  });

  it("reads the staff model with a LEFT JOIN so a document without a row appears", async () => {
    // The missing driver makes the read fail soft, which logs once.
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { sql } = await emitted(() => listExtractions(42));

    expect(sql).toMatch(
      /^select .* from "DocumentoRespaldo" left join "ExtraccionDocumento" on "ExtraccionDocumento"\."DocumentoId" = "DocumentoRespaldo"\."Id" where .* order by "DocumentoRespaldo"\."Id" asc$/,
    );
  });
});
