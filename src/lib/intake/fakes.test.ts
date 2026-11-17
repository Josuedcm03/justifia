import { describe, expect, it } from "vitest";

import type { MailMessage } from "./ports";
import {
  createFakeDocumentStore,
  createFakeIntakeDeps,
  createFakeMailSender,
} from "./fakes";

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

  it("digests a seeded file: size, head and the SHA-256 of the whole content", async () => {
    const store = createFakeDocumentStore();
    store.seed("intake/1/a.pdf", [0x61, 0x62, 0x63]);

    const digest = await store.readDigest("intake/1/a.pdf", {
      headBytes: 2,
      maxBytes: 100,
    });

    expect(digest?.size).toBe(3);
    expect(Array.from(digest!.head)).toEqual([0x61, 0x62]);
    expect(digest?.sha256).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("digests different bytes to a different hash and leaves readHead unchanged", async () => {
    const store = createFakeDocumentStore();
    store.seed("intake/1/a.pdf", [0x61, 0x62, 0x63]);
    store.seed("intake/1/b.pdf", [0x61, 0x62, 0x64]);

    const a = await store.readDigest("intake/1/a.pdf", {
      headBytes: 2,
      maxBytes: 100,
    });
    const b = await store.readDigest("intake/1/b.pdf", {
      headBytes: 2,
      maxBytes: 100,
    });
    expect(a?.sha256).not.toBe(b?.sha256);

    const head = await store.readHead("intake/1/a.pdf", 2);
    expect(head?.size).toBe(3);
    expect(Array.from(head!.head)).toEqual([0x61, 0x62]);
  });

  it("answers null for a missing file and no hash over the cap", async () => {
    const store = createFakeDocumentStore();
    store.seed("intake/1/big.pdf", [1, 2, 3, 4, 5, 6]);

    expect(
      await store.readDigest("intake/1/none.pdf", {
        headBytes: 2,
        maxBytes: 100,
      }),
    ).toBeNull();

    const over = await store.readDigest("intake/1/big.pdf", {
      headBytes: 2,
      maxBytes: 5,
    });
    expect(over?.sha256).toBeNull();
    expect(over?.size).toBeGreaterThan(5);
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

function mail(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    to: "ana@uam.edu.ni",
    cc: ["estudiante@uam.edu.ni"],
    subject: "Asunto",
    text: "Cuerpo",
    attachments: [],
    idempotencyKey: "remision-1-aaaa",
    ...overrides,
  };
}

describe("createFakeMailSender", () => {
  it("records the delivered messages and returns a provider id", async () => {
    const sender = createFakeMailSender();
    const result = await sender.send(mail());

    expect(result.ok).toBe(true);
    expect(result.ok && result.providerId).toMatch(/^fake-/);
    expect(sender.sent).toEqual([mail()]);
  });

  it("dedupes by idempotency key: a replay delivers once and answers the same id", async () => {
    const sender = createFakeMailSender();
    const first = await sender.send(mail());
    const replay = await sender.send(mail());
    const other = await sender.send(
      mail({ idempotencyKey: "remision-1-bbbb" }),
    );

    expect(replay).toEqual(first);
    expect(sender.sent).toHaveLength(2);
    expect(sender.calls).toHaveLength(3);
    expect(other.ok && first.ok && other.providerId).not.toBe(
      first.ok && first.providerId,
    );
  });

  it("fails with a scripted code and delivers nothing", async () => {
    const sender = createFakeMailSender();
    sender.failWith("unavailable");

    await expect(sender.send(mail())).resolves.toEqual({
      ok: false,
      code: "unavailable",
    });
    expect(sender.sent).toHaveLength(0);
    expect(sender.calls).toHaveLength(1);
  });

  it("recovers once the scripted failure is cleared", async () => {
    const sender = createFakeMailSender();
    sender.failWith("rejected");
    await sender.send(mail());
    sender.failWith(null);

    const result = await sender.send(mail());
    expect(result.ok).toBe(true);
    expect(sender.sent).toHaveLength(1);
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

  it("includes a fake mail sender", async () => {
    const deps = createFakeIntakeDeps();
    await deps.mail.send(mail());
    expect(deps.mail.sent).toHaveLength(1);
  });
});
