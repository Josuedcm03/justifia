import { describe, expect, it } from "vitest";

import {
  REMISSION_REASONS,
  REMISSION_STATES,
  REMISSION_TRIGGERS,
  claimableStates,
  isRemissionReason,
  isRemissionState,
} from "./states";

describe("remission constants (TR-2)", () => {
  it("lists the three states in lifecycle order", () => {
    expect(REMISSION_STATES).toEqual(["pendiente", "enviada", "bloqueada"]);
  });

  it("lists the four reason codes", () => {
    expect(REMISSION_REASONS).toEqual([
      "sin_correo",
      "formato_especial_faltante",
      "adjuntos_exceden_limite",
      "error_envio",
    ]);
  });

  it("lists the four dispatch triggers", () => {
    expect(REMISSION_TRIGGERS).toEqual([
      "aprobacion",
      "reenvio_manual",
      "reintento_automatico",
      "formato_especial",
    ]);
  });

  it("recognises only listed states and reasons", () => {
    expect(isRemissionState("enviada")).toBe(true);
    expect(isRemissionState("cancelada")).toBe(false);
    expect(isRemissionState(null)).toBe(false);
    expect(isRemissionReason("error_envio")).toBe(true);
    expect(isRemissionReason("otro")).toBe(false);
  });
});

describe("claimableStates (trigger -> allowed source states)", () => {
  it.each([
    ["aprobacion", ["pendiente"]],
    ["reintento_automatico", ["pendiente"]],
    ["formato_especial", ["pendiente"]],
    ["reenvio_manual", ["pendiente", "bloqueada"]],
  ] as const)("%s may claim %j", (trigger, expected) => {
    expect(claimableStates(trigger)).toEqual(expected);
  });

  it("never lets any trigger claim a sent remission", () => {
    for (const trigger of REMISSION_TRIGGERS) {
      expect(claimableStates(trigger)).not.toContain("enviada");
    }
  });
});
