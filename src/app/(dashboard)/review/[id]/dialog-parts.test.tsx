import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  NoteField,
  withoutFieldErrors,
  type DialogCopy,
} from "@/app/(dashboard)/review/[id]/dialog-parts";
import type { EscalationError } from "@/lib/intake/escalation";

// flow-experience S3 (FE-11, RNF-12): the helper every staff dialog uses to drop
// the messages of a field the user just edited, and the required mark of the
// note field.

type Invalid = { ok: false; reason: "invalid"; errors: EscalationError[] };

const MOTIVO: EscalationError = { field: "motivo", code: "motivo_invalid" };
const NOTA: EscalationError = { field: "nota", code: "nota_required" };

function invalid(...errors: EscalationError[]): Invalid {
  return { ok: false, reason: "invalid", errors };
}

describe("withoutFieldErrors (FE-11)", () => {
  it("gives null for null", () => {
    expect(withoutFieldErrors(null, "motivo")).toBeNull();
  });

  it.each([
    [{ ok: false, reason: "conflict" }],
    [{ ok: false, reason: "not_found" }],
    [{ ok: false, reason: "unexpected" }],
    [{ ok: false, reason: "sin_coordinacion", carreraNombre: "Derecho" }],
  ] as const)(
    "hands a failure that names no field back unchanged: %j",
    (failure) => {
      expect(withoutFieldErrors(failure, "motivo")).toBe(failure);
      expect(withoutFieldErrors(failure, "nota")).toBe(failure);
    },
  );

  it("removes only the errors of the named field", () => {
    const failure = invalid(MOTIVO, NOTA);

    expect(withoutFieldErrors(failure, "motivo")).toEqual(invalid(NOTA));
    expect(withoutFieldErrors(failure, "nota")).toEqual(invalid(MOTIVO));
  });

  it("removes every error of the field when it has several", () => {
    const failure = invalid({ field: "nota", code: "nota_blank" }, MOTIVO, {
      field: "nota",
      code: "nota_too_long",
    });

    expect(withoutFieldErrors(failure, "nota")).toEqual(invalid(MOTIVO));
  });

  it("gives null when the last error goes, so no banner is left behind", () => {
    expect(withoutFieldErrors(invalid(NOTA), "nota")).toBeNull();
    expect(withoutFieldErrors(invalid(MOTIVO, NOTA), "motivo")).not.toBeNull();
    expect(
      withoutFieldErrors(
        withoutFieldErrors(invalid(MOTIVO, NOTA), "motivo"),
        "nota",
      ),
    ).toBeNull();
  });

  it("hands the failure back as it is when the field has no error", () => {
    const failure = invalid(NOTA);

    expect(withoutFieldErrors(failure, "motivo")).toBe(failure);
  });

  it("keeps the other properties of the failure and never mutates its input", () => {
    const errors = Object.freeze([
      MOTIVO,
      NOTA,
    ]) as unknown as EscalationError[];
    const failure = Object.freeze({ ok: false, reason: "invalid", errors });

    const next = withoutFieldErrors(failure, "motivo");

    expect(next).toEqual({ ok: false, reason: "invalid", errors: [NOTA] });
    expect(failure.errors).toEqual([MOTIVO, NOTA]);
  });
});

describe("NoteField required mark (FE-10)", () => {
  const copy: DialogCopy = (key, values) =>
    values ? `${key}:${values.count}` : key;

  function show(required?: boolean) {
    render(
      <NoteField
        id="note"
        copy={copy}
        value=""
        onChange={() => {}}
        messages={[]}
        required={required}
      />,
    );
    return screen.getByRole("textbox", { name: "dialog.noteLabel" });
  }

  it("announces the field as required when asked", () => {
    expect(show(true)).toHaveAttribute("aria-required", "true");
  });

  it.each([[undefined], [false]])(
    "announces nothing when required is %s",
    (required) => {
      expect(show(required)).not.toHaveAttribute("aria-required");
    },
  );

  it("never turns on the browser's own validation, so the server stays the authority", () => {
    expect(show(true)).not.toHaveAttribute("required");
  });
});
