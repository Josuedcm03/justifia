// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createStoreMock } = vi.hoisted(() => ({ createStoreMock: vi.fn() }));
vi.mock("@/lib/intake/adapters/vercel-blob-store", () => ({
  createVercelBlobStore: createStoreMock,
}));

import { getIntakeDeps } from "@/lib/intake/deps";

describe("getIntakeDeps", () => {
  beforeEach(() => {
    createStoreMock.mockReset();
  });

  it("wires the Vercel Blob store behind the DocumentStore port", () => {
    const store = { tag: "blob-store" };
    createStoreMock.mockReturnValue(store);

    expect(getIntakeDeps().store).toBe(store);
  });

  it("wires the permissive schedule (D5): every group has class", async () => {
    createStoreMock.mockReturnValue({});

    const groups = await getIntakeDeps().schedule.groupsWithClass([1, 2], {
      from: "2026-10-01",
      to: "2026-10-01",
    });

    expect([...groups].sort()).toEqual([1, 2]);
  });

  it("propagates a missing store configuration instead of degrading", () => {
    createStoreMock.mockImplementation(() => {
      throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
    });

    expect(() => getIntakeDeps()).toThrow(/BLOB_READ_WRITE_TOKEN/);
  });
});
