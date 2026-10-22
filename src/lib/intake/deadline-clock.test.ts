import { describe, expect, it } from "vitest";

import { deadlineOf } from "./business-days";
import { managuaToday } from "./dates";
import {
  clockStartOf,
  pausedStartOnAnswer,
  type ClockRow,
} from "./deadline-clock";
import type { NonWorkingDaysProvider } from "./ports";

function calendar(days: readonly string[] = []): NonWorkingDaysProvider {
  return {
    isNonWorkingDay: (iso) => days.includes(iso),
    coversYear: () => true,
  };
}

// 2026-10-05 is a Monday. Instants are Managua noon (UTC-6) unless noted.
const noon = (iso: string) => new Date(`${iso}T18:00:00Z`);
const MON = "2026-10-05";
const TUE = "2026-10-06";
const WED = "2026-10-07";
const THU = "2026-10-08";
const FRI = "2026-10-09";
const NEXT_MON = "2026-10-12";
const NEXT_TUE = "2026-10-13";

/** The effective deadline of a request, as the queue and the detail read it. */
function effectiveDeadline(row: ClockRow, cal = calendar()): string {
  return deadlineOf(managuaToday(clockStartOf(row)), cal);
}

describe("clockStartOf (ES-5)", () => {
  const presented = noon(MON);
  const resubmitted = noon(WED);
  const shifted = new Date("2026-10-09T06:00:00Z");

  it("prefers the stored pause start over everything", () => {
    expect(
      clockStartOf({
        plazoInicioEn: shifted,
        reenviadaEn: resubmitted,
        presentadaEn: presented,
      }),
    ).toBe(shifted);
  });

  it("falls back to the resubmission, then to the presentation", () => {
    expect(
      clockStartOf({
        plazoInicioEn: null,
        reenviadaEn: resubmitted,
        presentadaEn: presented,
      }),
    ).toBe(resubmitted);
    expect(
      clockStartOf({
        plazoInicioEn: null,
        reenviadaEn: null,
        presentadaEn: presented,
      }),
    ).toBe(presented);
  });

  it("treats a missing pause start like null", () => {
    expect(clockStartOf({ reenviadaEn: null, presentadaEn: presented })).toBe(
      presented,
    );
  });

  it("throws when the request was never presented", () => {
    expect(() =>
      clockStartOf({
        plazoInicioEn: null,
        reenviadaEn: null,
        presentadaEn: null,
      }),
    ).toThrow(/no clock start/);
  });
});

describe("pausedStartOnAnswer (RN-08, ES-5)", () => {
  it("returns null when no business day was paused", () => {
    expect(
      pausedStartOnAnswer(
        {
          clockStart: noon(MON),
          escalatedAt: noon(TUE),
          answeredAt: noon(TUE),
        },
        calendar(),
      ),
    ).toBeNull();
  });

  it("returns null when only a weekend was paused", () => {
    expect(
      pausedStartOnAnswer(
        {
          clockStart: noon(MON),
          escalatedAt: noon("2026-10-10"),
          answeredAt: noon(NEXT_MON),
        },
        calendar(),
      ),
    ).toBeNull();
  });

  it("returns Managua midnight of the shifted start", () => {
    expect(
      pausedStartOnAnswer(
        {
          clockStart: noon(MON),
          escalatedAt: noon(MON),
          answeredAt: noon(THU),
        },
        calendar(),
      ),
    ).toEqual(new Date("2026-10-08T06:00:00Z"));
  });

  it("reads the Managua date, not the UTC date", () => {
    // Mon 21:00 Managua is already Tuesday in UTC; the answer is Tue 06:00,
    // so Managua pauses Monday (1 day) while UTC dates would pause none.
    const stored = pausedStartOnAnswer(
      {
        clockStart: noon(NEXT_MON),
        escalatedAt: new Date("2026-10-13T03:00:00Z"),
        answeredAt: new Date("2026-10-13T12:00:00Z"),
      },
      calendar(),
    );
    expect(stored).toEqual(new Date("2026-10-13T06:00:00Z"));
  });
});

describe("effective deadline table (RN-08)", () => {
  const rows: [string, string, string, string, string][] = [
    ["Mon/Mon/Thu", MON, MON, THU, NEXT_MON],
    ["Mon/Tue/Tue", MON, TUE, TUE, WED],
    ["Mon/Tue/next Mon", MON, TUE, NEXT_MON, NEXT_TUE],
  ];

  it.each(rows)(
    "presented/escalated/answered %s",
    (_label, presented, escalated, answered, expected) => {
      const stored = pausedStartOnAnswer(
        {
          clockStart: noon(presented),
          escalatedAt: noon(escalated),
          answeredAt: noon(answered),
        },
        calendar(),
      );
      expect(
        effectiveDeadline({
          plazoInicioEn: stored,
          reenviadaEn: null,
          presentadaEn: noon(presented),
        }),
      ).toBe(expected);
    },
  );

  it("does not count a holiday inside the pause", () => {
    const cal = calendar([TUE]);
    const stored = pausedStartOnAnswer(
      { clockStart: noon(MON), escalatedAt: noon(MON), answeredAt: noon(THU) },
      cal,
    );
    // Paused Mon and Wed only: base Thu (Tue is a holiday) moves two days.
    expect(
      effectiveDeadline(
        { plazoInicioEn: stored, reenviadaEn: null, presentadaEn: noon(MON) },
        cal,
      ),
    ).toBe(NEXT_MON);
  });

  it("adds up the pauses of two escalations", () => {
    const first = pausedStartOnAnswer(
      { clockStart: noon(MON), escalatedAt: noon(MON), answeredAt: noon(TUE) },
      calendar(),
    );
    expect(first).toEqual(new Date("2026-10-06T06:00:00Z"));
    const row: ClockRow = {
      plazoInicioEn: first,
      reenviadaEn: null,
      presentadaEn: noon(MON),
    };
    const second = pausedStartOnAnswer(
      {
        clockStart: clockStartOf(row),
        escalatedAt: noon(WED),
        answeredAt: noon(FRI),
      },
      calendar(),
    );
    // Base Wed + 1 + 2 paused business days = Thu, Fri, Mon.
    expect(effectiveDeadline({ ...row, plazoInicioEn: second })).toBe(NEXT_MON);
  });
});
