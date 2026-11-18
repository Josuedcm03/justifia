// @vitest-environment node
/// <reference types="vite/client" />
import { defineMatrix } from "@/test/access/harness";
import { ROUTES } from "@/test/access/matrix-table";

// RAC-4, RAC-6, RAC-7: every route handler, as every identity. The cron rows
// admit no identity: a session never opens them.
const loaders = import.meta.glob("./api/**/route.ts");

defineMatrix({
  kind: "routes",
  units: Object.entries(ROUTES).map(([key, row]) => ({ key, row })),
  load: (key) => loaders[`./${key}`]?.(),
  call: (mod, { key }) => {
    const { method } = ROUTES[key];
    const request = new Request("https://app.test/api/x", {
      method,
      body: method === "POST" ? "{}" : undefined,
    });
    return mod[method](request, { params: Promise.resolve({ id: "1" }) });
  },
});
