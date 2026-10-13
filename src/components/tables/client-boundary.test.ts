import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Design decision 5: column definitions hold function-valued `cell`
// renderers, which cannot be serialized across the server boundary. Every
// module that builds or renders them is therefore a client module, and a
// server page only ever hands plain row data to a client table.
const CLIENT_MODULES = [
  "data-table.tsx",
  "sortable-header.tsx",
  "list-navigation.tsx",
  "status-filter.tsx",
  "table-toolbar.tsx",
  "table-pagination.tsx",
  "list-table.tsx",
] as const;

describe("table kit client boundary (design decision 5)", () => {
  it.each(CLIENT_MODULES)("%s is a client module", (file) => {
    const source = readFileSync(
      join(process.cwd(), "src/components/tables", file),
      "utf8",
    );

    expect(source.trimStart().startsWith('"use client"')).toBe(true);
  });

  it("the shared table primitives are client modules too", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/ui/table.tsx"),
      "utf8",
    );

    expect(source.trimStart().startsWith('"use client"')).toBe(true);
  });

  it("DataTable's props type its columns, not a server-supplied slot", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/tables/data-table.tsx"),
      "utf8",
    );

    expect(source).toContain("columns: ColumnDef<T>[]");
    expect(source).not.toMatch(/\bempty\??:/);
  });
});
