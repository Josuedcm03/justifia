import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogScope } from "@/lib/catalog/scope";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/data/audit", () => ({ insertAuditEvents: vi.fn() }));

import { addressed, addressedRecord } from "@/lib/catalog/action-helpers";

const ACTOR = 41;
const SCOPE: CatalogScope = { kind: "carrera", carreraId: 7 };
const BAD_IDS = [
  undefined,
  null,
  12,
  "",
  "abc",
  "0",
  "007",
  "-1",
  "1.5",
  " 12",
  "1e3",
  ["12"],
];

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => consoleError.mockRestore());

describe("addressedRecord (DM-2, DM-6: the pre-check of a record with no scope)", () => {
  it.each(
    BAD_IDS.map((id) => [JSON.stringify(id) ?? "undefined", id] as const),
  )(
    "a malformed id (%s) is gone and the record is never read",
    async (_label, id) => {
      const read = vi.fn();

      expect(await addressedRecord(ACTOR, id, read)).toBe("gone");

      expect(read).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    },
  );

  it.each([null, undefined])(
    "a read that finds nothing (%s) is gone",
    async (found) => {
      const read = vi.fn().mockResolvedValue(found);

      expect(await addressedRecord(ACTOR, "12", read)).toBe("gone");

      expect(read).toHaveBeenCalledOnce();
    },
  );

  it("returns the parsed id and the record that was read", async () => {
    const record = { id: 12, nombreCompleto: "Ana" };
    const read = vi.fn().mockResolvedValue(record);

    expect(await addressedRecord(ACTOR, "12", read)).toEqual({
      id: 12,
      item: record,
    });
  });

  it("reads by the id alone: the reader receives no scope and no second argument", async () => {
    const read = vi.fn().mockResolvedValue({ id: 12 });

    await addressedRecord(ACTOR, "12", read);

    expect(read.mock.calls).toEqual([[12]]);
  });

  it("a failing read is `failed`, with one sanitised line and no thrown text", async () => {
    const read = vi.fn().mockRejectedValue(
      Object.assign(new Error("select failed password=hunter2"), {
        code: "08006",
      }),
    );

    expect(await addressedRecord(ACTOR, "12", read)).toBe("failed");

    expect(consoleError).toHaveBeenCalledOnce();
    const line = String(consoleError.mock.calls[0][0]);
    expect(JSON.parse(line)).toEqual({
      event: "catalog.write.failed",
      actor: ACTOR,
      errorName: "Error",
      errorCode: "08006",
    });
    expect(line).not.toContain("hunter2");
  });
});

describe("addressed (the six existing callers keep their behaviour: a wrapper of addressedRecord)", () => {
  it.each(
    BAD_IDS.map((id) => [JSON.stringify(id) ?? "undefined", id] as const),
  )(
    "a malformed id (%s) is gone and the record is never read",
    async (_label, id) => {
      const read = vi.fn();

      expect(await addressed(ACTOR, SCOPE, id, read)).toBe("gone");

      expect(read).not.toHaveBeenCalled();
    },
  );

  it("hands the scope and the id to the reader, in that order", async () => {
    const read = vi.fn().mockResolvedValue({ id: 12 });

    expect(await addressed(ACTOR, SCOPE, "12", read)).toEqual({
      id: 12,
      item: { id: 12 },
    });

    expect(read.mock.calls).toEqual([[SCOPE, 12]]);
  });

  it.each([null, undefined])(
    "a record outside the scope or missing (%s) is gone",
    async (found) => {
      const read = vi.fn().mockResolvedValue(found);

      expect(await addressed(ACTOR, SCOPE, "12", read)).toBe("gone");
    },
  );

  it("a failing read is `failed` with one sanitised line", async () => {
    const read = vi.fn().mockRejectedValue(new Error("select failed"));

    expect(await addressed(ACTOR, SCOPE, "12", read)).toBe("failed");

    expect(consoleError).toHaveBeenCalledOnce();
    expect(JSON.parse(String(consoleError.mock.calls[0][0]))).toMatchObject({
      event: "catalog.write.failed",
      actor: ACTOR,
    });
  });
});
