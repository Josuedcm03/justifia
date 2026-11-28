// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// A19: the maximum document size is a parameter, but the database accepts
// 10 MiB at most (`CK_Documento_Tamano`). The range of `tamano_maximo_mib`
// ends exactly there, so every value in it can be stored and no migration is
// needed. This scan keeps the registry and the check from drifting apart.

const SRC_DIR = join(__dirname, "..", "..");
const BYTES_PER_MIB = 1_048_576;

const read = (path: string) => readFileSync(join(SRC_DIR, path), "utf8");

/** The upper end of the `tamano_maximo_mib` range, in MiB, as written. */
const registryMaxMib = Number(
  /tamano_maximo_mib:\s*scalarEntry\(\s*"maxDocumentMib",\s*\d+,\s*(\d+)\s*\)/.exec(
    read("lib/parameters/registry.ts"),
  )?.[1],
);

/** The byte bound of `CK_Documento_Tamano`, as written in the schema. */
const checkBytes = Number(
  /"CK_Documento_Tamano",\s*sql`[^`]*<=\s*(\d+)\s*`/.exec(
    read("db/schema.ts"),
  )?.[1],
);

describe("the registry maximum equals the database check (NP-2, SD-LIMIT, A19)", () => {
  it("finds both numbers in the sources", () => {
    expect(Number.isInteger(registryMaxMib)).toBe(true);
    expect(Number.isInteger(checkBytes)).toBe(true);
  });

  it("is the same number of bytes, 10 MiB", () => {
    expect(registryMaxMib * BYTES_PER_MIB).toBe(checkBytes);
    expect(checkBytes).toBe(10_485_760);
  });
});
