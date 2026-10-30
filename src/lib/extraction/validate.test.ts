import { describe, expect, it } from "vitest";

import {
  ISSUER_MAX_LENGTH,
  STUDENT_NAME_MAX_LENGTH,
  validateFields,
  type RawExtraction,
} from "./validate";

const REFERENCE = "2026-10-22";

function validate(raw: RawExtraction, submittedOn = REFERENCE) {
  return validateFields(raw, { submittedOn });
}

describe("strings (DE-10)", () => {
  it("trims and collapses whitespace in the name and the issuer", () => {
    const result = validate({
      student_name: "  Ana   Lucía \n Pérez  ",
      issuer: "\tCentro   Médico  Vista Alegre ",
    });

    expect(result.studentName).toBe("Ana Lucía Pérez");
    expect(result.issuer).toBe("Centro Médico Vista Alegre");
  });

  it.each([[""], ["   "], ["\n\t"], [null], [undefined], [42], [{}], [["a"]]])(
    "treats %j as not recognized",
    (value) => {
      const result = validate({ student_name: value, issuer: value });

      expect(result.studentName).toBeNull();
      expect(result.issuer).toBeNull();
    },
  );

  it("keeps a value exactly at the column length and drops one more", () => {
    const name = "n".repeat(STUDENT_NAME_MAX_LENGTH);
    const issuer = "i".repeat(ISSUER_MAX_LENGTH);

    expect(STUDENT_NAME_MAX_LENGTH).toBe(160);
    expect(ISSUER_MAX_LENGTH).toBe(200);
    expect(validate({ student_name: name, issuer }).studentName).toBe(name);
    expect(validate({ student_name: name, issuer }).issuer).toBe(issuer);
    expect(validate({ student_name: name + "n" }).studentName).toBeNull();
    expect(validate({ issuer: issuer + "i" }).issuer).toBeNull();
  });

  it("measures the length after collapsing the spaces", () => {
    const padded = "a" + " ".repeat(300) + "b";

    expect(validate({ student_name: padded }).studentName).toBe("a b");
  });
});

describe("issue date (DE-10, scenario: Window boundaries)", () => {
  it.each([
    [REFERENCE, "2025-10-22", "2025-10-22"],
    [REFERENCE, "2025-10-21", null],
    [REFERENCE, "2026-10-22", "2026-10-22"],
    [REFERENCE, "2026-10-23", null],
    ["2026-10-22", "2026-01-15", "2026-01-15"],
    // 29 February reference: the lower bound maps to 28 February.
    ["2028-02-29", "2027-02-28", "2027-02-28"],
    ["2028-02-29", "2027-02-27", null],
    ["2028-02-29", "2028-02-29", "2028-02-29"],
    // A leap-day issue date is a real date; the window decides.
    ["2028-03-01", "2028-02-29", "2028-02-29"],
  ])("reference %s, issue date %s -> %s", (reference, issueDate, expected) => {
    expect(validate({ issue_date: issueDate }, reference).issueDate).toBe(
      expected,
    );
  });

  it("drops a completed handwritten year (scenario: Completed year)", () => {
    // "202_" returned by the model as 2022.
    expect(validate({ issue_date: "2022-09-17" }).issueDate).toBeNull();
  });

  it.each([
    ["2026-02-30"],
    ["2026-13-01"],
    ["2026-00-10"],
    ["15/10/2026"],
    ["2026-10-15T00:00:00Z"],
    ["15 de octubre de 2026"],
    [""],
    [null],
    [20261015],
  ])("rejects %j as not a real ISO calendar date", (value) => {
    expect(validate({ issue_date: value }).issueDate).toBeNull();
  });

  it("keeps the other fields when only the issue date is out of the window", () => {
    const result = validate({
      student_name: "Ana Pérez",
      issuer: "Clínica Sur",
      issue_date: "2024-01-10",
    });

    expect(result.issueDate).toBeNull();
    expect(result.studentName).toBe("Ana Pérez");
    expect(result.issuer).toBe("Clínica Sur");
  });
});

describe("an empty answer (scenario: Empty answer completes)", () => {
  it("is still a result with every field not recognized", () => {
    expect(validate({})).toEqual({
      studentName: null,
      issuer: null,
      issueDate: null,
      restFrom: null,
      restTo: null,
      restDays: null,
    });
  });
});

describe("rest period, form (a): from and to (DE-10)", () => {
  it("computes the days inclusive in code and ignores the model's value (scenario: Days computed inclusive)", () => {
    const result = validate(
      { rest_from: "2026-07-20", rest_to: "2026-07-24", rest_days: 4 },
      "2026-07-25",
    );

    expect(result.restFrom).toBe("2026-07-20");
    expect(result.restTo).toBe("2026-07-24");
    expect(result.restDays).toBe(5);
  });

  it.each([
    ["2026-07-20", "2026-07-20", 1],
    ["2026-07-20", "2026-07-21", 2],
    ["2026-02-27", "2026-03-02", 4],
    ["2025-12-30", "2026-01-02", 4],
  ])("%s to %s is %i days", (from, to, days) => {
    const result = validate({ rest_from: from, rest_to: to }, "2026-10-22");

    expect(result.restFrom).toBe(from);
    expect(result.restTo).toBe(to);
    expect(result.restDays).toBe(days);
  });

  it("keeps a rest that is still running at submission (scenario: Rest still running)", () => {
    const result = validate({ rest_from: "2026-10-20", rest_to: "2026-10-25" });

    expect(result).toMatchObject({
      restFrom: "2026-10-20",
      restTo: "2026-10-25",
      restDays: 6,
    });
  });

  it.each([
    ["rest end exactly 30 days after submission is kept", "2026-11-21", true],
    [
      "rest end one day past the 30-day lookahead is dropped",
      "2026-11-22",
      false,
    ],
  ])("%s", (_label, to, kept) => {
    const result = validate({ rest_from: "2026-10-20", rest_to: to });

    // Scenario: Rest end outside the window (2026-11-22 -> whole period null).
    expect(result.restTo).toBe(kept ? to : null);
    expect(result.restFrom).toBe(kept ? "2026-10-20" : null);
    expect(result.restDays).toBe(kept ? 33 : null);
  });

  it("drops the whole period when the start is after submission (scenario: Rest start after submission)", () => {
    const result = validate({ rest_from: "2026-10-23", rest_to: "2026-10-25" });

    expect(result.restFrom).toBeNull();
    expect(result.restTo).toBeNull();
    expect(result.restDays).toBeNull();
  });

  it("drops the whole period when the start is older than a year", () => {
    const result = validate({ rest_from: "2025-10-21", rest_to: "2025-10-23" });

    expect([result.restFrom, result.restTo, result.restDays]).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("keeps a period that starts exactly one year before submission", () => {
    const result = validate({ rest_from: "2025-10-22", rest_to: "2025-10-24" });

    expect(result).toMatchObject({
      restFrom: "2025-10-22",
      restTo: "2025-10-24",
      restDays: 3,
    });
  });

  it("drops the whole period when the end is before the start", () => {
    const result = validate({ rest_from: "2026-07-24", rest_to: "2026-07-20" });

    expect([result.restFrom, result.restTo, result.restDays]).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("drops the whole period when a date is not a real calendar date", () => {
    const result = validate({
      rest_from: "2026-02-30",
      rest_to: "2026-03-02",
      rest_days: 3,
    });

    expect([result.restFrom, result.restTo, result.restDays]).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("does not let a recognized issue date depend on the rest period", () => {
    const result = validate({
      issue_date: "2026-10-15",
      rest_from: "2026-10-23",
      rest_to: "2026-10-25",
    });

    expect(result.issueDate).toBe("2026-10-15");
    expect(result.restFrom).toBeNull();
  });
});

describe("rest period, form (b): days only (DE-10)", () => {
  it("recognizes a duration with no dates (scenario: Duration only)", () => {
    const result = validate({ rest_days: 3 });

    expect(result).toMatchObject({
      restFrom: null,
      restTo: null,
      restDays: 3,
    });
  });

  it.each([[1], [3], [72], [366]])("accepts %i days", (days) => {
    expect(validate({ rest_days: days }).restDays).toBe(days);
  });

  it("accepts a whole number sent as a digit string", () => {
    expect(validate({ rest_days: "3" }).restDays).toBe(3);
  });

  it.each([[0], [-2], [367], [2.5], ["tres"], ["3 días"], [null], [NaN]])(
    "rejects %j days",
    (days) => {
      expect(validate({ rest_days: days }).restDays).toBeNull();
    },
  );
});

describe("rest period, any other combination is not recognized (scenario: Invented rest discarded)", () => {
  it("drops a lone rest_from equal to the issue date", () => {
    const result = validate({
      issue_date: "2026-10-15",
      rest_from: "2026-10-15",
    });

    expect(result.issueDate).toBe("2026-10-15");
    expect([result.restFrom, result.restTo, result.restDays]).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("drops a lone rest_to", () => {
    const result = validate({ rest_to: "2026-10-20" });

    expect([result.restFrom, result.restTo, result.restDays]).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("drops a date plus days", () => {
    const result = validate({ rest_from: "2026-10-20", rest_days: 3 });

    expect([result.restFrom, result.restTo, result.restDays]).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("drops a date that is present but unusable even when days are valid", () => {
    const result = validate({ rest_from: "pronto", rest_days: 3 });

    expect([result.restFrom, result.restTo, result.restDays]).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("treats blank dates as absent so a valid duration still counts", () => {
    const result = validate({ rest_from: "", rest_to: "  ", rest_days: 4 });

    expect([result.restFrom, result.restTo, result.restDays]).toEqual([
      null,
      null,
      4,
    ]);
  });

  it("keeps the name, the issuer and the issue date when the rest is dropped", () => {
    const result = validate({
      student_name: "Ana Pérez",
      issuer: "Clínica Sur",
      issue_date: "2026-10-15",
      rest_from: "2026-10-15",
    });

    expect(result).toEqual({
      studentName: "Ana Pérez",
      issuer: "Clínica Sur",
      issueDate: "2026-10-15",
      restFrom: null,
      restTo: null,
      restDays: null,
    });
  });
});
