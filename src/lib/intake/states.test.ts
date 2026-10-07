import { describe, expect, it } from "vitest";

import { ESTADOS_SOLICITUD, VISIBLE_STATES, isVisibleState } from "./states";

describe("VISIBLE_STATES (D7)", () => {
  it("excludes borrador", () => {
    expect(VISIBLE_STATES).not.toContain("borrador");
  });

  it("contains every other request state", () => {
    expect([...VISIBLE_STATES].sort()).toEqual(
      ESTADOS_SOLICITUD.filter((e) => e !== "borrador").sort(),
    );
    expect(VISIBLE_STATES).toHaveLength(5);
  });

  it("includes pendiente", () => {
    expect(VISIBLE_STATES).toContain("pendiente");
  });
});

describe("isVisibleState", () => {
  it("hides a draft and shows a pending request", () => {
    expect(isVisibleState("borrador")).toBe(false);
    expect(isVisibleState("pendiente")).toBe(true);
  });

  it("rejects an unknown state", () => {
    expect(isVisibleState("archivada")).toBe(false);
  });
});
