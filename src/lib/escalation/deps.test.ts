// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { envMock, createMailMock } = vi.hoisted(() => ({
  envMock: { APP_BASE_URL: undefined as string | undefined },
  createMailMock: vi.fn(),
}));
vi.mock("@/env", () => ({ env: envMock }));
vi.mock("@/lib/intake/adapters/resend-mail-sender", () => ({
  createResendMailSender: createMailMock,
}));

import { getEscalationDeps } from "@/lib/escalation/deps";

describe("getEscalationDeps (ES-10)", () => {
  beforeEach(() => {
    createMailMock.mockReset();
    envMock.APP_BASE_URL = undefined;
  });

  it("wires the Resend adapter behind the MailSender port and the configured origin", () => {
    const mail = { tag: "resend" };
    createMailMock.mockReturnValue(mail);
    envMock.APP_BASE_URL = "https://justifia.example.edu";

    expect(getEscalationDeps()).toEqual({
      mail,
      baseUrl: "https://justifia.example.edu",
    });
  });

  it("still builds with APP_BASE_URL unset: the plan leaves the notice pendiente", () => {
    createMailMock.mockReturnValue({});

    expect(getEscalationDeps().baseUrl).toBeUndefined();
  });

  it("builds no document store: a notice carries no attachment", () => {
    createMailMock.mockReturnValue({});

    expect(Object.keys(getEscalationDeps()).sort()).toEqual([
      "baseUrl",
      "mail",
    ]);
  });
});
