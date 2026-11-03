// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getMock, delMock, listMock, envMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  delMock: vi.fn(),
  listMock: vi.fn(),
  envMock: {
    BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_test" as string | undefined,
  },
}));

vi.mock("@vercel/blob", () => ({
  get: getMock,
  del: delMock,
  list: listMock,
}));
vi.mock("@/env", () => ({ env: envMock }));

import { createVercelBlobStore } from "@/lib/intake/adapters/vercel-blob-store";

function streamOf(...chunks: number[][]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(new Uint8Array(chunks[i++]));
      else controller.close();
    },
  });
}

function found(stream: ReadableStream<Uint8Array>, size: number) {
  return { statusCode: 200, stream, headers: new Headers(), blob: { size } };
}

describe("createVercelBlobStore", () => {
  beforeEach(() => {
    getMock.mockReset();
    delMock.mockReset();
    listMock.mockReset();
    envMock.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";
  });

  it("fails loud when the store token is not configured", () => {
    envMock.BLOB_READ_WRITE_TOKEN = undefined;
    expect(() => createVercelBlobStore()).toThrow(/BLOB_READ_WRITE_TOKEN/);
  });

  describe("readHead", () => {
    it("reads private, uncached, and returns the first bytes and the size", async () => {
      getMock.mockResolvedValue(
        found(streamOf([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3, 4, 5]), 4096),
      );
      const result = await createVercelBlobStore().readHead(
        "intake/1/a.pdf",
        5,
      );

      expect(getMock).toHaveBeenCalledWith("intake/1/a.pdf", {
        access: "private",
        useCache: false,
        token: "vercel_blob_rw_test",
      });
      expect(result?.size).toBe(4096);
      expect(Array.from(result!.head)).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);
    });

    it("joins chunks until it has enough bytes", async () => {
      getMock.mockResolvedValue(
        found(streamOf([0x89, 0x50], [0x4e, 0x47, 9]), 10),
      );
      const result = await createVercelBlobStore().readHead(
        "intake/1/a.png",
        4,
      );
      expect(Array.from(result!.head)).toEqual([0x89, 0x50, 0x4e, 0x47]);
    });

    it("returns whatever exists for a file shorter than requested", async () => {
      getMock.mockResolvedValue(found(streamOf([1, 2]), 2));
      const result = await createVercelBlobStore().readHead(
        "intake/1/a.pdf",
        8,
      );
      expect(Array.from(result!.head)).toEqual([1, 2]);
    });

    it("cancels the stream after reading the head", async () => {
      const cancelled = vi.fn();
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
        },
        cancel: cancelled,
      });
      getMock.mockResolvedValue(found(stream, 8));
      await createVercelBlobStore().readHead("intake/1/a.pdf", 2);
      expect(cancelled).toHaveBeenCalledTimes(1);
    });

    it("returns null for a missing file", async () => {
      getMock.mockResolvedValue(null);
      expect(
        await createVercelBlobStore().readHead("intake/1/x.pdf", 8),
      ).toBeNull();
    });
  });

  describe("stream", () => {
    it("returns the private body", async () => {
      const body = streamOf([1]);
      getMock.mockResolvedValue(found(body, 1));
      expect(await createVercelBlobStore().stream("intake/1/a.pdf")).toBe(body);
      expect(getMock).toHaveBeenCalledWith("intake/1/a.pdf", {
        access: "private",
        token: "vercel_blob_rw_test",
      });
    });

    it("returns null for a missing file", async () => {
      getMock.mockResolvedValue(null);
      expect(await createVercelBlobStore().stream("intake/1/x.pdf")).toBeNull();
    });
  });

  describe("delete", () => {
    it("deletes the given pathnames in one call", async () => {
      await createVercelBlobStore().delete([
        "intake/1/a.pdf",
        "intake/1/b.png",
      ]);
      expect(delMock).toHaveBeenCalledWith(
        ["intake/1/a.pdf", "intake/1/b.png"],
        {
          token: "vercel_blob_rw_test",
        },
      );
    });

    it("makes no call for an empty list", async () => {
      await createVercelBlobStore().delete([]);
      expect(delMock).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("maps pathname and uploadedAt and exposes the cursor only when more exists", async () => {
      const at = new Date("2026-10-01T00:00:00Z");
      listMock.mockResolvedValueOnce({
        blobs: [
          {
            pathname: "intake/1/a.pdf",
            uploadedAt: at,
            url: "https://x",
            size: 1,
          },
        ],
        cursor: "next",
        hasMore: true,
      });
      const page = await createVercelBlobStore().list("intake/", "c0");

      expect(listMock).toHaveBeenCalledWith({
        prefix: "intake/",
        cursor: "c0",
        token: "vercel_blob_rw_test",
      });
      expect(page).toEqual({
        blobs: [{ pathname: "intake/1/a.pdf", uploadedAt: at }],
        cursor: "next",
      });
    });

    it("drops the cursor on the last page and never leaks a URL", async () => {
      listMock.mockResolvedValueOnce({
        blobs: [
          {
            pathname: "intake/2/b.png",
            uploadedAt: new Date(0),
            url: "https://x",
          },
        ],
        cursor: "stale",
        hasMore: false,
      });
      const page = await createVercelBlobStore().list("intake/");
      expect(page.cursor).toBeUndefined();
      expect(JSON.stringify(page)).not.toContain("https://");
    });
  });
});
