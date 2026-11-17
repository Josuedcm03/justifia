// @vitest-environment node
import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { digestStream } from "@/lib/intake/stream-digest";

function streamOf(...chunks: number[][]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(new Uint8Array(chunks[i++]));
      else controller.close();
    },
  });
}

const sha256Of = (bytes: readonly number[]) =>
  createHash("sha256").update(new Uint8Array(bytes)).digest("hex");

const ABC = [0x61, 0x62, 0x63];
// The FIPS 180-2 vector for "abc".
const ABC_SHA256 =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const EMPTY_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

describe("digestStream", () => {
  it("hashes chunked input to the known SHA-256 vector, as lower-case hex", async () => {
    const result = await digestStream(streamOf([0x61], [0x62, 0x63]), 8, 100);

    expect(result.sha256).toBe(ABC_SHA256);
    expect(result.size).toBe(3);
  });

  it("agrees with a one-shot hash over many uneven chunks", async () => {
    const bytes = Array.from({ length: 1000 }, (_, i) => (i * 7) % 256);
    const chunks = [bytes.slice(0, 1), bytes.slice(1, 300), bytes.slice(300)];

    const result = await digestStream(streamOf(...chunks), 8, 5000);

    expect(result.sha256).toBe(sha256Of(bytes));
    expect(result.size).toBe(1000);
  });

  it("fills the head across chunk boundaries and no further", async () => {
    const result = await digestStream(
      streamOf([1, 2], [3], [4, 5, 6, 7]),
      5,
      100,
    );

    expect(Array.from(result.head)).toEqual([1, 2, 3, 4, 5]);
    expect(result.size).toBe(7);
  });

  it("returns a shorter head when the stream is shorter than headBytes", async () => {
    const result = await digestStream(streamOf(ABC), 8, 100);

    expect(Array.from(result.head)).toEqual(ABC);
    expect(result.size).toBe(3);
  });

  it("hashes a stream of exactly maxBytes", async () => {
    const bytes = Array.from({ length: 10 }, (_, i) => i + 1);

    const result = await digestStream(
      streamOf(bytes.slice(0, 4), bytes.slice(4)),
      8,
      10,
    );

    expect(result.sha256).toBe(sha256Of(bytes));
    expect(result.size).toBe(10);
  });

  it("cancels the stream over maxBytes and returns no hash with the counted size", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(4));
      },
      cancel,
    });

    const result = await digestStream(stream, 8, 10);

    expect(result.sha256).toBeNull();
    expect(result.size).toBeGreaterThan(10);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("reports size 0 and the empty digest for an empty stream", async () => {
    const result = await digestStream(streamOf(), 8, 100);

    expect(result.size).toBe(0);
    expect(result.head.length).toBe(0);
    expect(result.sha256).toBe(EMPTY_SHA256);
  });

  it("propagates a stream error", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(ABC));
      },
      pull(controller) {
        controller.error(new Error("connection reset"));
      },
    });

    await expect(digestStream(stream, 8, 100)).rejects.toThrow(
      "connection reset",
    );
  });
});
