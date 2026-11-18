// @vitest-environment node
/// <reference types="vite/client" />
import { expect } from "vitest";

import { defineMatrix } from "@/test/access/harness";
import { ACTIONS } from "@/test/access/matrix-table";

// RAC-4, RAC-7: every exported server action, as every identity. A new export
// in an actions file fails the exports check until it gets a row (D10).
const loaders = import.meta.glob(["./**/*actions.ts", "!./**/*.test.ts"]);

defineMatrix({
  kind: "actions",
  units: Object.entries(ACTIONS).flatMap(([key, row]) =>
    row.exports.map((name) => ({ key, name, row })),
  ),
  load: (key) => loaders[`./${key}`]?.(),
  call: (mod, { name }) => mod[name!]({}, new FormData()),
  inspect: (mods) => {
    for (const [key, mod] of mods) {
      const exported = Object.keys(mod).filter(
        (name) => typeof mod[name] === "function",
      );
      expect(exported.sort(), key).toEqual([...ACTIONS[key].exports].sort());
    }
  },
});
