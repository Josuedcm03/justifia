import { describe, expect, it } from "vitest";

import {
  DIAS_MASK_MAX,
  DIAS_SEMANA,
  decodeDias,
  encodeDias,
  isDiaSemana,
  type DiaSemana,
} from "@/lib/catalog/dias";

describe("DIAS_SEMANA (AC-DIAS: the seven codes, week order)", () => {
  it("lists the seven unaccented Spanish names, Monday first", () => {
    expect(DIAS_SEMANA).toEqual([
      "lunes",
      "martes",
      "miercoles",
      "jueves",
      "viernes",
      "sabado",
      "domingo",
    ]);
  });

  it("is a readonly tuple whose members are all accepted as DiaSemana", () => {
    // @ts-expect-error push does not exist on a readonly tuple
    void DIAS_SEMANA.push;
    const accepted: DiaSemana[] = [...DIAS_SEMANA];
    expect(accepted).toHaveLength(7);
  });

  it("rejects a foreign code at the type level", () => {
    // @ts-expect-error "monday" is not a DiaSemana
    const invalid: DiaSemana = "monday";
    expect(DIAS_SEMANA).not.toContain(invalid);
  });
});

describe("DIAS_MASK_MAX", () => {
  it("is 127 and equals (1 << number of days) - 1", () => {
    expect(DIAS_MASK_MAX).toBe(127);
    expect(DIAS_MASK_MAX).toBe((1 << DIAS_SEMANA.length) - 1);
  });
});

describe("isDiaSemana", () => {
  it.each(DIAS_SEMANA)("accepts %s", (code) => {
    expect(isDiaSemana(code)).toBe(true);
  });

  it.each([["Lunes"], [""], [1], [null], [undefined], ["monday"]])(
    "rejects %j",
    (value) => {
      expect(isDiaSemana(value)).toBe(false);
    },
  );
});

describe("encodeDias (AC-DIAS: Set semantics)", () => {
  it("encodes the empty set as 0", () => {
    expect(encodeDias([])).toBe(0);
  });

  it("puts Monday on bit 0 and Sunday on bit 6", () => {
    expect(encodeDias(["lunes"])).toBe(1);
    expect(encodeDias(["martes"])).toBe(2);
    expect(encodeDias(["domingo"])).toBe(64);
  });

  it("encodes all seven days as 127", () => {
    expect(encodeDias(DIAS_SEMANA)).toBe(127);
  });

  it("collapses duplicates and ignores order", () => {
    expect(encodeDias(["miercoles", "lunes", "lunes"])).toBe(
      encodeDias(["lunes", "miercoles"]),
    );
    expect(encodeDias(["lunes", "miercoles"])).toBe(5);
  });

  it("accepts any iterable", () => {
    expect(encodeDias(new Set<DiaSemana>(["viernes", "sabado"]))).toBe(16 + 32);
  });
});

describe("decodeDias (CM-GRP-6: always in week order)", () => {
  it("decodes 0 as the empty set", () => {
    expect(decodeDias(0)).toEqual([]);
  });

  it("returns week order whatever the encoding order was", () => {
    expect(decodeDias(encodeDias(["viernes", "lunes", "miercoles"]))).toEqual([
      "lunes",
      "miercoles",
      "viernes",
    ]);
  });

  it("round trips over all 128 masks", () => {
    for (let mask = 0; mask <= DIAS_MASK_MAX; mask += 1) {
      expect(encodeDias(decodeDias(mask))).toBe(mask);
    }
  });

  it("decodes 127 as the whole week", () => {
    expect(decodeDias(127)).toEqual([...DIAS_SEMANA]);
  });

  it.each([[-1], [128], [1.5], [Number.NaN], [Infinity], ["5"], [null]])(
    "throws RangeError for %j",
    (value) => {
      expect(() => decodeDias(value as number)).toThrow(RangeError);
    },
  );
});
