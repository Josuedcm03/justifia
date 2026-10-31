import { describe, expect, it } from "vitest";

import {
  RANKING_LIMIT,
  RANKING_STATES,
  REPORT_PAGE_SIZE,
} from "@/lib/reports/constants";
import { VISIBLE_STATES } from "@/lib/intake/states";

describe("report constants (CR-RANK-1, CR-RANK-3, CR-DET-3)", () => {
  it("shows ten entries per ranking and 25 rows per detail page", () => {
    expect(RANKING_LIMIT).toBe(10);
    expect(REPORT_PAGE_SIZE).toBe(25);
  });

  it("counts exactly aprobada and pendiente (RN-16)", () => {
    expect([...RANKING_STATES].sort()).toEqual(["aprobada", "pendiente"]);
  });

  it("only counts states a request listing may return (never borrador)", () => {
    for (const estado of RANKING_STATES) {
      expect(VISIBLE_STATES).toContain(estado);
    }
    expect(RANKING_STATES).not.toContain("borrador");
  });
});
