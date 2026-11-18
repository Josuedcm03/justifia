/// <reference types="vite/client" />
import { defineMatrix } from "@/test/access/harness";
import { PAGES } from "@/test/access/matrix-table";

// RAC-4, RAC-7: every protected page, as every identity, through the real guard.
const loaders = import.meta.glob("./**/page.tsx");
const P = (value: Record<string, string>) => Promise.resolve(value);

defineMatrix({
  kind: "pages",
  units: Object.entries(PAGES).map(([key, row]) => ({ key, row })),
  load: (key) => loaders[`./${key}`]?.(),
  call: (mod) =>
    mod.default({ params: P({ id: "1", grupoId: "1" }), searchParams: P({}) }),
});
