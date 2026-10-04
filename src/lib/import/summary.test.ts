import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  buildImportSummary,
  logImportFailure,
  logImportSummary,
} from "@/lib/import/summary";
import type { EntityCounts, ImportSummary } from "@/lib/import/types";

const counts = (over: Partial<EntityCounts> = {}): EntityCounts => ({
  create: 0,
  update: 0,
  unchanged: 0,
  deactivate: 0,
  error: 0,
  ...over,
});

const input = {
  actor: "secretaria1",
  at: "2026-10-03T12:00:00.000Z",
  fileSha256: "a".repeat(64),
  counts: {
    Asignatura: counts({ create: 2 }),
    Usuario: counts({ create: 3, update: 1 }),
    Grupo: counts({ unchanged: 4, deactivate: 1 }),
  },
  accountsCreated: 3,
  accountsUpdated: 1,
};

describe("buildImportSummary (CEI: Successful apply returns a summary)", () => {
  it("returns exactly the summary keys", () => {
    const summary = buildImportSummary(input);
    expect(Object.keys(summary).toSorted()).toEqual(
      [
        "accountsCreated",
        "accountsUpdated",
        "actor",
        "at",
        "counts",
        "fileSha256",
      ].toSorted(),
    );
    expect(summary).toEqual(input);
  });

  it("drops any extra key a caller smuggles in (no credential can ride along)", () => {
    const summary = buildImportSummary({
      ...input,
      clave: "SECRET",
      hashClave: "$2b$12$x",
    } as typeof input);
    expect(JSON.stringify(summary)).not.toMatch(/clave|password|hash/i);
  });

  it("has no credential key at the type level", () => {
    type Keys = keyof ImportSummary;
    expectTypeOf<Keys>().toEqualTypeOf<
      | "actor"
      | "at"
      | "fileSha256"
      | "counts"
      | "accountsCreated"
      | "accountsUpdated"
    >();
    expectTypeOf<
      "clave" | "password" | "hash" | "hashClave"
    >().not.toExtend<Keys>();
  });
});

describe("logImportSummary (IAP: Logs are clean)", () => {
  it("calls the logger once with one structured line", () => {
    const logger = vi.fn();
    logImportSummary(buildImportSummary(input), logger);
    expect(logger).toHaveBeenCalledTimes(1);
    const line = logger.mock.calls[0][0] as string;
    expect(typeof line).toBe("string");
    expect(line).not.toContain("\n");
    const parsed = JSON.parse(line);
    expect(parsed.event).toBe("catalog.import.applied");
    expect(parsed.fileSha256).toBe(input.fileSha256);
    expect(parsed.accountsCreated).toBe(3);
  });

  it("contains none of clave, password or hash ", () => {
    const logger = vi.fn();
    logImportSummary(buildImportSummary(input), logger);
    const line = logger.mock.calls[0][0] as string;
    for (const word of ["clave", "password", "hash"]) {
      expect(line.toLowerCase()).not.toContain(word);
    }
  });
});

describe("logImportFailure (operational trace for a failed apply)", () => {
  const SECRET = "ZK9TQ2M4XW7HB3PD";
  const HASH = "$2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ01234";
  const base = { actor: "secretaria1", fileSha256: "b".repeat(64) };

  function line(error: unknown) {
    const logger = vi.fn();
    logImportFailure({ ...base, error }, logger);
    expect(logger).toHaveBeenCalledTimes(1);
    return logger.mock.calls[0][0] as string;
  }

  it("emits one single-line event with actor, file digest and error name", () => {
    const text = line(new TypeError("boom"));

    expect(text).not.toContain("\n");
    expect(JSON.parse(text)).toEqual({
      event: "catalog.import.failed",
      actor: "secretaria1",
      fileSha256: "b".repeat(64),
      errorName: "TypeError",
    });
  });

  it("adds the SQLSTATE when the error carries a string code", () => {
    const error = Object.assign(new Error("duplicate"), { code: "23505" });

    expect(JSON.parse(line(error))).toMatchObject({
      errorName: "Error",
      errorCode: "23505",
    });
  });

  it("reads the code of a wrapped driver error (Drizzle keeps it on cause)", () => {
    const driver = Object.assign(new Error(`bind ${SECRET}`), {
      code: "40001",
    });
    const wrapper = new Error(`Failed query: insert ... params: ${HASH}`, {
      cause: driver,
    });

    const parsed = JSON.parse(line(wrapper));

    expect(parsed.errorCode).toBe("40001");
  });

  it("omits the code when it is not a string", () => {
    const error = Object.assign(new Error("x"), { code: 23505 });

    expect(JSON.parse(line(error))).not.toHaveProperty("errorCode");
  });

  it("names a non-Error throw by its type and keeps its content out", () => {
    const parsed = JSON.parse(line(`raw ${SECRET}`));

    expect(parsed.errorName).toBe("string");
    expect(JSON.stringify(parsed)).not.toContain(SECRET);
  });

  it("never carries message, stack, cause, detail, query or parameters", () => {
    const error = Object.assign(
      new Error(`insert failed, params: ${SECRET} ${HASH}`, {
        cause: new Error(`inner ${SECRET}`),
      }),
      {
        code: "23505",
        detail: `Key (clave)=(${SECRET}) already exists`,
        query: "insert into usuario",
        params: [HASH, SECRET],
      },
    );

    const text = line(error);

    expect(text).not.toContain(SECRET);
    expect(text).not.toContain(HASH);
    expect(text).not.toContain("$2b$");
    expect(text).not.toContain("insert");
    expect(Object.keys(JSON.parse(text)).toSorted()).toEqual(
      ["actor", "errorCode", "errorName", "event", "fileSha256"].toSorted(),
    );
  });
});
