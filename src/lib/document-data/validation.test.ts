import { describe, expect, it } from "vitest";

import {
  DOCUMENT_DATA_ERROR_CODES,
  validateDocumentData,
  type DocumentDataPayload,
} from "./validation";

// manual-document-data: "Structural validation only" (MD-3, D7), "Document type
// from a closed set" (MD-4) and "Firma and sello marks with three states"
// (MD-5). The payload is the complete state of the eight values, `null` meaning
// empty (the action of the form builds it). Pure: no database, no signal.

const EMPTY: DocumentDataPayload = {
  studentName: null,
  issuer: null,
  issueDate: null,
  restFrom: null,
  restTo: null,
  type: null,
  hasSignature: null,
  hasSeal: null,
};

function payload(
  overrides: Partial<Record<keyof DocumentDataPayload, unknown>> = {},
) {
  return { ...EMPTY, ...overrides } as DocumentDataPayload;
}

describe("validateDocumentData: text bounds (MD-3)", () => {
  it.each([
    ["name of 160 characters", { studentName: "n".repeat(160) }, true],
    ["name of 161 characters", { studentName: "n".repeat(161) }, false],
    ["issuer of 200 characters", { issuer: "i".repeat(200) }, true],
    ["issuer of 201 characters", { issuer: "i".repeat(201) }, false],
  ] as const)("%s is accepted: %s", (_label, overrides, accepted) => {
    expect(validateDocumentData(payload(overrides)).ok).toBe(accepted);
  });

  it("reports text_too_long on the name only", () => {
    const result = validateDocumentData(
      payload({ studentName: "n".repeat(161), issuer: "Clinica" }),
    );

    expect(result).toEqual({
      ok: false,
      errors: { studentName: "text_too_long" },
    });
  });

  it("reports text_too_long on the issuer only", () => {
    const result = validateDocumentData(payload({ issuer: "i".repeat(201) }));

    expect(result).toEqual({ ok: false, errors: { issuer: "text_too_long" } });
  });

  it("counts characters the way the column does, not UTF-16 units", () => {
    // 160 code points are 320 UTF-16 units; varchar(160) counts characters.
    const result = validateDocumentData(
      payload({ studentName: "\u{1F600}".repeat(160) }),
    );

    expect(result.ok).toBe(true);
  });

  it("measures the length after trimming", () => {
    const padded = `  ${"n".repeat(160)}  `;
    const result = validateDocumentData(payload({ studentName: padded }));

    expect(result).toEqual({
      ok: true,
      data: { ...EMPTY, studentName: "n".repeat(160) },
    });
  });
});

describe("validateDocumentData: trimming and empty values (D8)", () => {
  it("trims the name and the issuer", () => {
    const result = validateDocumentData(
      payload({ studentName: "  Ana Lopez ", issuer: "\tClinica Central\n" }),
    );

    expect(result).toEqual({
      ok: true,
      data: { ...EMPTY, studentName: "Ana Lopez", issuer: "Clinica Central" },
    });
  });

  it.each([[""], ["   "], ["\t\n"]])(
    "turns the empty text %j into null",
    (blank) => {
      const result = validateDocumentData(
        payload({
          studentName: blank,
          issuer: blank,
          issueDate: blank,
          restFrom: blank,
          restTo: blank,
        }),
      );

      expect(result).toEqual({ ok: true, data: EMPTY });
    },
  );

  it("accepts the all-empty payload: it clears every manual value", () => {
    expect(validateDocumentData(EMPTY)).toEqual({ ok: true, data: EMPTY });
  });
});

describe("validateDocumentData: the issue date (MD-3)", () => {
  it.each([
    ["2026-02-30"],
    ["2026-13-01"],
    ["not a date"],
    ["2026-1-5"],
    ["15/01/2024"],
  ])("refuses %j with date_invalid", (issueDate) => {
    expect(validateDocumentData(payload({ issueDate }))).toEqual({
      ok: false,
      errors: { issueDate: "date_invalid" },
    });
  });

  it("accepts 2024-01-15: no plausibility window applies", () => {
    expect(validateDocumentData(payload({ issueDate: "2024-01-15" }))).toEqual({
      ok: true,
      data: { ...EMPTY, issueDate: "2024-01-15" },
    });
  });

  it("accepts the leap day and refuses it in a common year", () => {
    expect(validateDocumentData(payload({ issueDate: "2028-02-29" })).ok).toBe(
      true,
    );
    expect(validateDocumentData(payload({ issueDate: "2026-02-29" })).ok).toBe(
      false,
    );
  });
});

describe("validateDocumentData: the rest period, dates only (MD-3)", () => {
  it("accepts one day, from equal to to", () => {
    expect(
      validateDocumentData(
        payload({ restFrom: "2026-11-09", restTo: "2026-11-09" }),
      ),
    ).toEqual({
      ok: true,
      data: { ...EMPTY, restFrom: "2026-11-09", restTo: "2026-11-09" },
    });
  });

  it("accepts a period of several days", () => {
    expect(
      validateDocumentData(
        payload({ restFrom: "2026-11-05", restTo: "2026-11-07" }),
      ).ok,
    ).toBe(true);
  });

  it("refuses from after to with rest_order", () => {
    expect(
      validateDocumentData(
        payload({ restFrom: "2026-11-10", restTo: "2026-11-09" }),
      ),
    ).toEqual({ ok: false, errors: { rest: "rest_order" } });
  });

  it.each([
    ["only a from date", { restFrom: "2026-11-09", restTo: null }],
    ["only a to date", { restFrom: null, restTo: "2026-11-09" }],
    ["only a from date, to blank", { restFrom: "2026-11-09", restTo: "  " }],
  ])("refuses %s with rest_incomplete", (_label, overrides) => {
    expect(validateDocumentData(payload(overrides))).toEqual({
      ok: false,
      errors: { rest: "rest_incomplete" },
    });
  });

  it("accepts both empty as no manual rest period", () => {
    expect(
      validateDocumentData(payload({ restFrom: null, restTo: null })),
    ).toEqual({ ok: true, data: EMPTY });
  });

  it("returns both dates or neither, so the writer can rely on restFrom alone", () => {
    const accepted = [
      payload({ restFrom: "2026-11-09", restTo: "2026-11-12" }),
      EMPTY,
    ];

    for (const input of accepted) {
      const result = validateDocumentData(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.restFrom === null).toBe(result.data.restTo === null);
      }
    }
  });

  it.each([
    ["from", { restFrom: "2026-02-30", restTo: "2026-03-05" }],
    ["to", { restFrom: "2026-03-01", restTo: "2026-02-30" }],
    ["a lone", { restFrom: "not a date", restTo: null }],
  ])(
    "a rest date that is not a real date (%s) is date_invalid",
    (_l, input) => {
      expect(validateDocumentData(payload(input))).toEqual({
        ok: false,
        errors: { rest: "date_invalid" },
      });
    },
  );

  it("accepts a period across a month end and a leap day", () => {
    expect(
      validateDocumentData(
        payload({ restFrom: "2028-02-28", restTo: "2028-03-01" }),
      ).ok,
    ).toBe(true);
  });

  it("stores no day count: the result has no days field", () => {
    const result = validateDocumentData(
      payload({ restFrom: "2026-11-05", restTo: "2026-11-07" }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(Object.keys(result.data)).not.toContain("restDays");
  });
});

describe("validateDocumentData: the document type (MD-4)", () => {
  it.each([["constancia_medica"], ["constancia_institucional"], ["otro"]])(
    "accepts %s",
    (type) => {
      expect(validateDocumentData(payload({ type }))).toEqual({
        ok: true,
        data: { ...EMPTY, type },
      });
    },
  );

  it.each([[null], [""]])("accepts %j as not registered", (type) => {
    expect(validateDocumentData(payload({ type }))).toEqual({
      ok: true,
      data: EMPTY,
    });
  });

  it.each([
    ["formato_especial"],
    ["Otro"],
    [" otro"],
    ["constancia"],
    [7],
    [true],
    [undefined],
  ])("refuses %j with type_invalid", (type) => {
    expect(validateDocumentData(payload({ type }))).toEqual({
      ok: false,
      errors: { type: "type_invalid" },
    });
  });
});

describe("validateDocumentData: the marks (MD-5)", () => {
  it.each([["hasSignature"], ["hasSeal"]] as const)(
    "%s is true, false or null",
    (field) => {
      for (const mark of [true, false, null]) {
        expect(validateDocumentData(payload({ [field]: mark }))).toEqual({
          ok: true,
          data: { ...EMPTY, [field]: mark },
        });
      }
    },
  );

  it.each([["hasSignature"], ["hasSeal"]] as const)(
    "%s refuses any other value with mark_invalid, on that field only",
    (field) => {
      for (const mark of ["yes", "true", "", 0, 1, undefined, {}]) {
        expect(validateDocumentData(payload({ [field]: mark }))).toEqual({
          ok: false,
          errors: { [field]: "mark_invalid" },
        });
      }
    },
  );

  it("keeps false distinct from null", () => {
    const result = validateDocumentData(
      payload({ hasSignature: false, hasSeal: null }),
    );

    expect(result).toEqual({
      ok: true,
      data: { ...EMPTY, hasSignature: false, hasSeal: null },
    });
  });
});

describe("validateDocumentData: the whole save", () => {
  it("accepts a complete valid payload and returns all eight values", () => {
    const complete = payload({
      studentName: " Ana Lopez ",
      issuer: "Clinica Central",
      issueDate: "2026-11-09",
      restFrom: "2026-11-09",
      restTo: "2026-11-11",
      type: "constancia_medica",
      hasSignature: true,
      hasSeal: false,
    });

    expect(validateDocumentData(complete)).toEqual({
      ok: true,
      data: {
        studentName: "Ana Lopez",
        issuer: "Clinica Central",
        issueDate: "2026-11-09",
        restFrom: "2026-11-09",
        restTo: "2026-11-11",
        type: "constancia_medica",
        hasSignature: true,
        hasSeal: false,
      },
    });
  });

  it("one invalid field refuses the whole save, with the error on that field only", () => {
    const result = validateDocumentData(
      payload({ issuer: "Clinica Central", issueDate: "2026-02-30" }),
    );

    expect(result).toEqual({
      ok: false,
      errors: { issueDate: "date_invalid" },
    });
    expect(result).not.toHaveProperty("data");
  });

  it("reports every invalid field at once, one code each", () => {
    const result = validateDocumentData(
      payload({
        studentName: "n".repeat(161),
        issuer: "i".repeat(201),
        issueDate: "nope",
        restFrom: "2026-11-10",
        restTo: "2026-11-09",
        type: "formato_especial",
        hasSignature: "yes",
        hasSeal: 3,
      }),
    );

    expect(result).toEqual({
      ok: false,
      errors: {
        studentName: "text_too_long",
        issuer: "text_too_long",
        issueDate: "date_invalid",
        rest: "rest_order",
        type: "type_invalid",
        hasSignature: "mark_invalid",
        hasSeal: "mark_invalid",
      },
    });
  });

  it("the error codes are exactly the six of the spec", () => {
    expect([...DOCUMENT_DATA_ERROR_CODES].sort()).toEqual(
      [
        "date_invalid",
        "mark_invalid",
        "rest_incomplete",
        "rest_order",
        "text_too_long",
        "type_invalid",
      ].sort(),
    );
  });

  it.each([
    ["studentName", 5],
    ["issuer", undefined],
    ["issueDate", {}],
    ["restFrom", false],
    ["restTo", 20260101],
  ])("throws for a %s that is not a string or null", (field, value) => {
    // A caller bug, not a user error: it must not clear a stored value.
    expect(() => validateDocumentData(payload({ [field]: value }))).toThrow(
      TypeError,
    );
  });

  it("never echoes a submitted value in an error", () => {
    const result = validateDocumentData(
      payload({ studentName: "x".repeat(161), issueDate: "secret-text" }),
    );

    expect(JSON.stringify(result)).not.toContain("secret-text");
    expect(JSON.stringify(result)).not.toContain("xxxx");
  });
});
