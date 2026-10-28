import { describe, expect, it } from "vitest";

import { noticeStatusKey } from "@/app/(dashboard)/review/notice-status";

// Scenario "Status texts" (request-review): the four texts the secretary reads
// for a coordination notification, chosen from the stored state and reason.

describe("noticeStatusKey (RF-10 b, RNF-07)", () => {
  it.each([
    ["pendiente", null, "pendiente"],
    ["pendiente", "error_envio", "pendienteFallido"],
    ["enviada", null, "enviada"],
    ["bloqueada", "sin_destinatarios", "bloqueada"],
  ] as const)("maps %s with reason %s to %s", (estado, motivo, key) => {
    expect(noticeStatusKey(estado, motivo)).toBe(key);
  });

  it("does not let a stray reason change a sent or blocked notification", () => {
    expect(noticeStatusKey("enviada", "error_envio")).toBe("enviada");
    expect(noticeStatusKey("bloqueada", "error_envio")).toBe("bloqueada");
  });
});
