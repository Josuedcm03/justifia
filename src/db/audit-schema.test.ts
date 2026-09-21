import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { eventoAuditoria } from "./audit-schema";

const ROOT = process.cwd();
const SNAPSHOT_0003 = resolve(ROOT, "drizzle/meta/0003_snapshot.json");
const SCHEMA_PATH = resolve(ROOT, "src/db/schema.ts");
const SQL_0004 = resolve(ROOT, "drizzle/0004_audit_log.sql");

// Decision 26: the audit table is declared by hand outside schema.ts so that
// drizzle-kit never sees it (F7: it would propose dropping the partitions).
describe("audit-schema isolation (AL: Audit record content, decision 26)", () => {
  it("keeps EventoAuditoria out of the drizzle-kit snapshot", () => {
    expect(readFileSync(SNAPSHOT_0003, "utf8")).not.toContain(
      "EventoAuditoria",
    );
  });

  it("is not referenced from src/db/schema.ts", () => {
    const source = readFileSync(SCHEMA_PATH, "utf8");
    expect(source).not.toMatch(/audit-schema/);
    expect(source).not.toMatch(/eventoAuditoria/i);
  });

  it("declares the append-only columns and no mutable ones", () => {
    const config = getTableConfig(eventoAuditoria);
    expect(config.name).toBe("EventoAuditoria");
    expect(config.columns.map((c) => c.name).sort()).toEqual(
      [
        "Accion",
        "ActorId",
        "Datos",
        "EntidadId",
        "EntidadTipo",
        "Id",
        "OcurridoEn",
      ].sort(),
    );
  });

  it("uses the composite primary key (Id, OcurridoEn) and three named indexes", () => {
    const config = getTableConfig(eventoAuditoria);
    expect(config.primaryKeys).toHaveLength(1);
    expect(config.primaryKeys[0].columns.map((c) => c.name)).toEqual([
      "Id",
      "OcurridoEn",
    ]);
    expect(config.indexes.map((i) => i.config.name).sort()).toEqual([
      "IX_EventoAuditoria_Actor",
      "IX_EventoAuditoria_Entidad",
      "IX_EventoAuditoria_Ocurrido",
    ]);
    expect(config.checks.map((c) => c.name)).toEqual([
      "CK_EventoAuditoria_Entidad",
    ]);
  });
});

// The only automated link between the hand-written DDL and the declaration.
describe("0004_audit_log.sql column list matches audit-schema.ts (AL: Record carries all fields)", () => {
  it("declares exactly the columns exported by eventoAuditoria", () => {
    const sql = readFileSync(SQL_0004, "utf8");
    const body = sql.match(
      /CREATE TABLE "EventoAuditoria" \(([\s\S]*?)\)\s*PARTITION BY RANGE/,
    );
    expect(body).not.toBeNull();
    const sqlColumns = [
      ...(body?.[1] ?? "").matchAll(/^\s*"([A-Za-z]+)"\s+\S/gm),
    ]
      .map((m) => m[1])
      .sort();
    const declared = getTableConfig(eventoAuditoria)
      .columns.map((c) => c.name)
      .sort();
    expect(sqlColumns).toEqual(declared);
  });
});
