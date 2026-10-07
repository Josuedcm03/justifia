import { describe, expect, it } from "vitest";

import { createFakeDocumentStore, createFakeIntakeDeps } from "./fakes";

describe("createFakeDocumentStore", () => {
  it("serves seeded files: head, size, stream", async () => {
    const store = createFakeDocumentStore();
    store.seed("intake/1/a.pdf", [0x25, 0x50, 0x44, 0x46, 0x2d, 9, 9]);

    const head = await store.readHead("intake/1/a.pdf", 5);
    expect(head?.size).toBe(7);
    expect(Array.from(head!.head)).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);

    const body = await store.stream("intake/1/a.pdf");
    const read = await body!.getReader().read();
    expect(Array.from(read.value!)).toEqual([
      0x25, 0x50, 0x44, 0x46, 0x2d, 9, 9,
    ]);
  });

  it("returns null for a missing path and forgets deleted ones", async () => {
    const store = createFakeDocumentStore();
    store.seed("intake/1/a.pdf", [1]);
    expect(await store.readHead("intake/1/none.pdf", 1)).toBeNull();

    await store.delete(["intake/1/a.pdf"]);
    expect(store.has("intake/1/a.pdf")).toBe(false);
    expect(await store.stream("intake/1/a.pdf")).toBeNull();
  });

  it("lists by prefix with upload dates", async () => {
    const store = createFakeDocumentStore();
    const at = new Date("2026-10-01T00:00:00Z");
    store.seed("intake/1/a.pdf", [1], at);
    store.seed("intake/2/b.png", [1], at);

    const page = await store.list("intake/1/");
    expect(page.blobs).toEqual([
      { pathname: "intake/1/a.pdf", uploadedAt: at },
    ]);
    expect(page.cursor).toBeUndefined();
  });
});

describe("createFakeIntakeDeps", () => {
  it("pairs the fake store with an all-groups schedule", async () => {
    const deps = createFakeIntakeDeps();
    const groups = await deps.schedule.groupsWithClass([3, 4], {
      from: "2026-10-01",
      to: "2026-10-02",
    });
    expect([...groups].sort()).toEqual([3, 4]);
    expect(deps.store.has("intake/1/a.pdf")).toBe(false);
  });
});
