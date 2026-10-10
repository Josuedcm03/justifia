import { describe, expect, it } from "vitest";

import { GRUPO_ORIGENES, type GrupoOrigen } from "@/lib/catalog/origen";

describe("GRUPO_ORIGENES (AC-ORIG: origin values)", () => {
  it("lists exactly importacion and manual, in that order", () => {
    expect(GRUPO_ORIGENES).toEqual(["importacion", "manual"]);
    expect(GRUPO_ORIGENES).toHaveLength(2);
  });

  it("is a readonly tuple whose members are all accepted as GrupoOrigen", () => {
    // Type-level: `as const` makes the tuple readonly, so a mutating call
    // must not compile (checked by `npm run typecheck`).
    // @ts-expect-error push does not exist on a readonly tuple
    void GRUPO_ORIGENES.push;
    const accepted: GrupoOrigen[] = [...GRUPO_ORIGENES];
    expect(accepted).toEqual(["importacion", "manual"]);
  });

  it("rejects values outside the set at the type level", () => {
    // @ts-expect-error "otro" is not a GrupoOrigen
    const invalid: GrupoOrigen = "otro";
    expect(GRUPO_ORIGENES).not.toContain(invalid);
    const valid: GrupoOrigen = "manual";
    expect(GRUPO_ORIGENES).toContain(valid);
  });
});
