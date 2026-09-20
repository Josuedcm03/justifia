import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { rol, usuario } from "@/db/schema";

describe("rol table (design.md decisions 1, 5; state.yaml: surrogate_id)", () => {
  const cfg = getTableConfig(rol);

  it("Id is an identity primary key", () => {
    const id = cfg.columns.find((c) => c.name === "Id");
    expect(id).toBeDefined();
    expect(id?.primary).toBe(true);
    expect(id?.generatedIdentity).toBeDefined();
  });

  it("Codigo is varchar(20) NOT NULL and unique", () => {
    const codigo = cfg.columns.find((c) => c.name === "Codigo");
    expect(codigo).toBeDefined();
    expect(codigo?.notNull).toBe(true);
    expect(codigo?.isUnique).toBe(true);
    expect((codigo as unknown as { length?: number }).length).toBe(20);
  });

  it("Nombre is NOT NULL", () => {
    const nombre = cfg.columns.find((c) => c.name === "Nombre");
    expect(nombre).toBeDefined();
    expect(nombre?.notNull).toBe(true);
  });
});

describe("usuario — role reference (UR: User must have a role, Unknown role reference rejected)", () => {
  const cfg = getTableConfig(usuario);

  it("has a NOT NULL RolId column", () => {
    const rolId = cfg.columns.find((c) => c.name === "RolId");
    expect(rolId).toBeDefined();
    expect(rolId?.notNull).toBe(true);
  });

  it("RolId references Rol.Id via a foreign key", () => {
    const fk = cfg.foreignKeys.find(
      (f) => f.reference().columns[0].name === "RolId",
    );
    expect(fk).toBeDefined();
    const ref = fk!.reference();
    expect(getTableConfig(ref.foreignTable).name).toBe("Rol");
    expect(ref.foreignColumns[0].name).toBe("Id");
  });

  it("the legacy Rol column no longer exists", () => {
    const legacy = cfg.columns.find((c) => c.name === "Rol");
    expect(legacy).toBeUndefined();
  });
});
