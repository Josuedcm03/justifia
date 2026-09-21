import { drizzle } from "drizzle-orm/postgres-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const logged: { sql: string; params: unknown[] }[] = [];

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  // A driver-less drizzle instance: the logger sees every emitted statement
  // (text + params) before the missing driver makes execution fail.
  db: drizzle.mock({
    logger: {
      logQuery(sql: string, params: unknown[]) {
        logged.push({ sql, params });
      },
    },
  }),
}));

import {
  getUsuarioByCif,
  getUsuarioByCorreo,
  setDebeCambiarClave,
} from "@/lib/data/users";

async function emitted(run: () => Promise<unknown>) {
  await run().catch(() => undefined);
  expect(logged).toHaveLength(1);
  return logged[0];
}

beforeEach(() => {
  logged.length = 0;
});

describe("usuarioConRolColumns (FPC: Flag travels in the session)", () => {
  it("projects DebeCambiarClave in every UsuarioConRol read", async () => {
    const { sql } = await emitted(() => getUsuarioByCif("C-1"));
    expect(sql).toContain('"DebeCambiarClave"');
  });
});

describe("getUsuarioByCorreo (IAP: Identity resolution)", () => {
  it("compares lowercased and trimmed, value in params only", async () => {
    const { sql, params } = await emitted(() =>
      getUsuarioByCorreo("  Ana.Perez@Uni.EDU "),
    );
    expect(sql).toContain('lower("Usuario"."Correo") = $1');
    expect(params[0]).toBe("ana.perez@uni.edu");
    expect(sql).not.toContain("ana.perez");
    expect(sql).toContain('inner join "Rol"');
  });
});

describe("getUsuarioByCif (IAP: Identity resolution)", () => {
  it("looks up by exact Cif, value in params only", async () => {
    const { sql, params } = await emitted(() => getUsuarioByCif("C-1"));
    expect(sql).toContain('"Usuario"."Cif" = $1');
    expect(params[0]).toBe("C-1");
  });
});

describe("setDebeCambiarClave (FPC: flag set and cleared)", () => {
  it("updates only DebeCambiarClave for one Id", async () => {
    const { sql, params } = await emitted(() => setDebeCambiarClave(5, false));
    expect(sql).toMatch(
      /^update "Usuario" set "DebeCambiarClave" = \$1 where "Usuario"\."Id" = \$2/,
    );
    expect(params).toEqual([false, 5]);
  });
});
