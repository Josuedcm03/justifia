import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { rolesUsuario } from "@/lib/validations/auth";

import { rolesSeed } from "@/db/roles-seed-data";

describe("rolesSeed (UR: Catalog matches the code-level role list)", () => {
  it("codes exactly equal rolesUsuario (sorted)", () => {
    const codes = rolesSeed.map((r) => r.codigo).sort();
    expect(codes).toEqual([...rolesUsuario].sort());
  });

  it("every nombre is non-empty", () => {
    for (const { nombre } of rolesSeed) {
      expect(nombre.trim().length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate codes", () => {
    const codes = rolesSeed.map((r) => r.codigo);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("package.json seed chaining (UR: Users seed follows roles seed)", () => {
  const pkg = JSON.parse(
    readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
  ) as { scripts: Record<string, string> };

  it("db:seed:roles exists", () => {
    expect(pkg.scripts["db:seed:roles"]).toBeDefined();
  });

  it("db:seed runs db:seed:roles before the users seed", () => {
    const seedScript = pkg.scripts["db:seed"];
    expect(seedScript).toContain("db:seed:roles");
    const rolesIndex = seedScript.indexOf("db:seed:roles");
    const usersIndex = seedScript.indexOf("src/db/seed.ts");
    expect(rolesIndex).toBeGreaterThanOrEqual(0);
    expect(usersIndex).toBeGreaterThanOrEqual(0);
    expect(rolesIndex).toBeLessThan(usersIndex);
  });
});
