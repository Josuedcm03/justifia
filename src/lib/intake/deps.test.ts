// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { createStoreMock } = vi.hoisted(() => ({ createStoreMock: vi.fn() }));
vi.mock("@/lib/intake/adapters/vercel-blob-store", () => ({
  createVercelBlobStore: createStoreMock,
}));

const { listGrupoDiasMock } = vi.hoisted(() => ({
  listGrupoDiasMock: vi.fn(),
}));
vi.mock("@/lib/data/grupo-dias", () => ({ listGrupoDias: listGrupoDiasMock }));

const { createMailMock } = vi.hoisted(() => ({ createMailMock: vi.fn() }));
vi.mock("@/lib/intake/adapters/resend-mail-sender", () => ({
  createResendMailSender: createMailMock,
}));

import { encodeDias } from "@/lib/catalog/dias";
import { getIntakeDeps } from "@/lib/intake/deps";

describe("getIntakeDeps", () => {
  beforeEach(() => {
    createStoreMock.mockReset();
    listGrupoDiasMock.mockReset();
    createMailMock.mockReset();
  });

  it("wires the Vercel Blob store behind the DocumentStore port", () => {
    const store = { tag: "blob-store" };
    createStoreMock.mockReturnValue(store);

    expect(getIntakeDeps().store).toBe(store);
  });

  it("wires the weekday schedule (F.4, RN-22) over the group day masks", async () => {
    createStoreMock.mockReturnValue({});
    listGrupoDiasMock.mockResolvedValue([
      { id: 1, dias: encodeDias(["lunes"]) },
      { id: 2, dias: encodeDias(["martes"]) },
    ]);

    // 2026-10-05 is a Monday.
    const groups = await getIntakeDeps().schedule.groupsWithClass([1, 2], {
      from: "2026-10-05",
      to: "2026-10-05",
    });

    expect([...groups]).toEqual([1]);
    expect(listGrupoDiasMock).toHaveBeenCalledWith([1, 2]);
  });

  it("wires the Resend adapter behind the MailSender port", () => {
    const mail = { tag: "resend" };
    createStoreMock.mockReturnValue({});
    createMailMock.mockReturnValue(mail);

    expect(getIntakeDeps().mail).toBe(mail);
  });

  it("still builds with the mail configuration unset (checked at send)", () => {
    createStoreMock.mockReturnValue({});
    createMailMock.mockReturnValue({});

    expect(() => getIntakeDeps()).not.toThrow();
  });

  it("propagates a missing store configuration instead of degrading", () => {
    createStoreMock.mockImplementation(() => {
      throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
    });

    expect(() => getIntakeDeps()).toThrow(/BLOB_READ_WRITE_TOKEN/);
  });
});
