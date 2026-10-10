import { describe, expect, it } from "vitest";

import {
  CODIGO_MAX,
  NOMBRE_MAX,
  NUMERO_GRUPO_MAX,
  horasTotalesSchema,
  numGrupoSchema,
  periodoSchema,
  requiredString,
} from "@/lib/validations/catalog-fields";

function messageOf(result: {
  success: boolean;
  error?: { issues: { message: string }[] };
}) {
  return result.error?.issues[0]?.message;
}

describe("field caps", () => {
  it("match the varchar lengths of the schema", () => {
    expect(CODIGO_MAX).toBe(32);
    expect(NOMBRE_MAX).toBe(160);
    expect(NUMERO_GRUPO_MAX).toBe(12);
  });
});

describe("requiredString", () => {
  const schema = requiredString("codigo", CODIGO_MAX);

  it("trims the value", () => {
    expect(schema.parse("  MAT-101  ")).toBe("MAT-101");
  });

  it.each(["", "   ", "\t\n"])("rejects %j as missing", (value) => {
    expect(messageOf(schema.safeParse(value))).toBe("codigo.required");
  });

  it("rejects a non-string as missing", () => {
    expect(messageOf(schema.safeParse(undefined))).toBe("codigo.required");
  });

  it("accepts exactly the cap and rejects one more", () => {
    expect(schema.safeParse("a".repeat(CODIGO_MAX)).success).toBe(true);
    expect(messageOf(schema.safeParse("a".repeat(CODIGO_MAX + 1)))).toBe(
      "codigo.tooLong",
    );
  });
});

describe("horasTotalesSchema", () => {
  it.each([
    ["8", 8],
    [" 40 ", 40],
    [16, 16],
  ])("accepts %j", (value, expected) => {
    expect(horasTotalesSchema.parse(value)).toBe(expected);
  });

  it.each(["", "   "])("rejects %j as required", (value) => {
    expect(messageOf(horasTotalesSchema.safeParse(value))).toBe(
      "horasTotales.required",
    );
  });

  it.each([0, -8, 12.5, "0", "-8", "12.5", "abc"])(
    "rejects %j as invalid",
    (value) => {
      expect(messageOf(horasTotalesSchema.safeParse(value))).toBe(
        "horasTotales.invalid",
      );
    },
  );

  it("rejects a missing value as required", () => {
    expect(messageOf(horasTotalesSchema.safeParse(undefined))).toBe(
      "horasTotales.required",
    );
  });
});

describe("periodoSchema", () => {
  it.each(["2026-S1", "2026-S2"])("accepts %s", (value) => {
    expect(periodoSchema.parse(value)).toBe(value);
  });

  it.each(["2026-S3", "2026-1", "26-S1", "2026S1", "2026-s1", " 2026-S1"])(
    "rejects %j without trimming or changing case",
    (value) => {
      expect(messageOf(periodoSchema.safeParse(value))).toBe("periodo.invalid");
    },
  );

  it("rejects the empty string as required", () => {
    expect(messageOf(periodoSchema.safeParse(""))).toBe("periodo.required");
  });
});

describe("numGrupoSchema", () => {
  it("trims and never normalises", () => {
    expect(numGrupoSchema.parse(" 1 ")).toBe("1");
    expect(numGrupoSchema.parse("01")).toBe("01");
  });

  it("coerces a numeric cell to a string", () => {
    expect(numGrupoSchema.parse(2)).toBe("2");
  });

  it("rejects empty and over-long values", () => {
    expect(messageOf(numGrupoSchema.safeParse("  "))).toBe("numGrupo.required");
    expect(
      messageOf(numGrupoSchema.safeParse("1".repeat(NUMERO_GRUPO_MAX + 1))),
    ).toBe("numGrupo.tooLong");
  });
});
