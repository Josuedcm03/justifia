// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RolUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const { getCurrentUserMock, handleUploadMock, getUploadContextMock } =
  vi.hoisted(() => ({
    getCurrentUserMock: vi.fn(),
    handleUploadMock: vi.fn(),
    getUploadContextMock: vi.fn(),
  }));

vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@vercel/blob/client", () => ({ handleUpload: handleUploadMock }));
vi.mock("@/lib/data/documentos", () => ({
  getUploadContext: getUploadContextMock,
}));
vi.mock("@/env", () => ({
  env: { BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_test" },
}));

import { POST } from "@/app/api/intake/upload-token/route";

const NOW = new Date("2026-10-07T15:00:00.000Z");
const DRAFT_ID = 4;
const OWN_PATH = `intake/${DRAFT_ID}/0b9f6c1e-4f0a-4d57-9a64-2f3f8f1d2c11.pdf`;

function session(rol: RolUsuario = "estudiante", debeCambiarClave?: boolean) {
  return {
    sub: "7",
    login: "ana",
    rol,
    nombre: "Ana",
    ...(debeCambiarClave === undefined ? {} : { debeCambiarClave }),
  };
}

function tokenRequest(pathname: string = OWN_PATH): Request {
  return new Request("http://localhost/api/intake/upload-token", {
    method: "POST",
    body: JSON.stringify({
      type: "blob.generate-client-token",
      payload: { pathname, clientPayload: null, multipart: false },
    }),
  });
}

let issuedOptions: unknown;

describe("POST /api/intake/upload-token", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    getCurrentUserMock.mockReset();
    getUploadContextMock.mockReset();
    handleUploadMock.mockReset();
    issuedOptions = undefined;
    // Run the route's `onBeforeGenerateToken` exactly like the SDK does.
    handleUploadMock.mockImplementation(
      async ({ body, onBeforeGenerateToken }) => {
        issuedOptions = await onBeforeGenerateToken(
          body.payload.pathname,
          body.payload.clientPayload,
          false,
        );
        return {
          type: "blob.generate-client-token",
          clientToken: "client-token",
        };
      },
    );
    getCurrentUserMock.mockResolvedValue(session());
    getUploadContextMock.mockResolvedValue({
      solicitudId: DRAFT_ID,
      documentCount: 1,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers 401 without a session and issues nothing", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const res = await POST(tokenRequest());

    expect(res.status).toBe(401);
    expect(handleUploadMock).not.toHaveBeenCalled();
    expect(getUploadContextMock).not.toHaveBeenCalled();
  });

  it.each(["docente", "secretaria", "coordinacion", "administrador"] as const)(
    "answers 403 for %s and issues nothing",
    async (rol) => {
      getCurrentUserMock.mockResolvedValue(session(rol));

      const res = await POST(tokenRequest());

      expect(res.status).toBe(403);
      expect(handleUploadMock).not.toHaveBeenCalled();
      expect(getUploadContextMock).not.toHaveBeenCalled();
    },
  );

  it("answers 403 for a student who must still change the password", async () => {
    getCurrentUserMock.mockResolvedValue(session("estudiante", true));

    const res = await POST(tokenRequest());

    expect(res.status).toBe(403);
    expect(handleUploadMock).not.toHaveBeenCalled();
  });

  it("answers 400 for a body that is not JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/intake/upload-token", {
        method: "POST",
        body: "not json",
      }),
    );

    expect(res.status).toBe(400);
    expect(handleUploadMock).not.toHaveBeenCalled();
  });

  it("issues a token for the own open draft, with the limits payload (RN-04, D2)", async () => {
    getUploadContextMock.mockImplementation(
      async (_user: number, _now: Date, target: { kind: string }) =>
        target.kind === "draft"
          ? { solicitudId: DRAFT_ID, documentCount: 1 }
          : null,
    );

    const res = await POST(tokenRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      type: "blob.generate-client-token",
      clientToken: "client-token",
    });
    expect(getUploadContextMock).toHaveBeenCalledWith(7, NOW, {
      kind: "draft",
    });
    expect(issuedOptions).toEqual({
      allowedContentTypes: ["application/pdf", "image/png", "image/jpeg"],
      maximumSizeInBytes: 10_485_760,
      validUntil: NOW.getTime() + 10 * 60 * 1000,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
  });

  it("passes the store token to the SDK and registers no completion callback (C15)", async () => {
    await POST(tokenRequest());

    const args = handleUploadMock.mock.calls[0][0];
    expect(args.token).toBe("vercel_blob_rw_test");
    expect(args.onUploadCompleted).toBeUndefined();
  });

  it("denies a student without an open draft (none or expired)", async () => {
    getUploadContextMock.mockResolvedValue(null);

    const res = await POST(tokenRequest());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "no_draft" });
    expect(issuedOptions).toBeUndefined();
  });

  it.each([
    ["another draft", "intake/99/0b9f6c1e-4f0a-4d57-9a64-2f3f8f1d2c11.pdf"],
    ["a numeric prefix collision", "intake/40/a.pdf"],
    ["a path outside the intake root", "other/4/a.pdf"],
    ["traversal", "intake/4/../99/a.pdf"],
  ])(
    "denies a pathname under %s with not_allowed",
    async (_label, pathname) => {
      const res = await POST(tokenRequest(pathname));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "not_allowed" });
      expect(issuedOptions).toBeUndefined();
    },
  );

  it("refuses the 6th document with too_many_documents and no token (D12)", async () => {
    getUploadContextMock.mockResolvedValue({
      solicitudId: DRAFT_ID,
      documentCount: 5,
    });

    const res = await POST(tokenRequest());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "too_many_documents" });
    expect(issuedOptions).toBeUndefined();
  });

  it("still issues a token for the 5th document (count 4 including pendiente)", async () => {
    getUploadContextMock.mockResolvedValue({
      solicitudId: DRAFT_ID,
      documentCount: 4,
    });

    const res = await POST(tokenRequest());

    expect(res.status).toBe(200);
    expect(issuedOptions).toBeDefined();
  });

  it("hides SDK error details behind a generic code", async () => {
    handleUploadMock.mockRejectedValue(new Error("secret internal detail"));

    const res = await POST(tokenRequest());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_request" });
  });
});

describe("POST /api/intake/upload-token: correction of a returned request (supporting-documents)", () => {
  const RETURNED_ID = 31;
  const RETURNED_PATH = `intake/${RETURNED_ID}/0b9f6c1e-4f0a-4d57-9a64-2f3f8f1d2c11.pdf`;
  const correction = { kind: "correction", solicitudId: RETURNED_ID };
  const contexts = (returned: number | null, draft: number | null) =>
    getUploadContextMock.mockImplementation(
      async (_user: number, _now: Date, target: { kind: string }) => {
        const count = target.kind === "correction" ? returned : draft;
        return count === null
          ? null
          : {
              solicitudId:
                target.kind === "correction" ? RETURNED_ID : DRAFT_ID,
              documentCount: count,
            };
      },
    );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    getCurrentUserMock.mockReset().mockResolvedValue(session());
    getUploadContextMock.mockReset();
    handleUploadMock.mockReset();
    issuedOptions = undefined;
    handleUploadMock.mockImplementation(
      async ({ body, onBeforeGenerateToken }) => {
        issuedOptions = await onBeforeGenerateToken(
          body.payload.pathname,
          body.payload.clientPayload,
          false,
        );
        return {
          type: "blob.generate-client-token",
          clientToken: "client-token",
        };
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("issues the same limited token for the own devuelta request named in the pathname", async () => {
    contexts(2, null);

    const res = await POST(tokenRequest(RETURNED_PATH));

    expect(res.status).toBe(200);
    expect(getUploadContextMock).toHaveBeenCalledWith(7, NOW, correction);
    expect(issuedOptions).toEqual({
      allowedContentTypes: ["application/pdf", "image/png", "image/jpeg"],
      maximumSizeInBytes: 10_485_760,
      validUntil: NOW.getTime() + 10 * 60 * 1000,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
  });

  it("prefers the returned request when the student also has a live draft", async () => {
    contexts(1, 0);

    const res = await POST(tokenRequest(RETURNED_PATH));

    expect(res.status).toBe(200);
    expect(getUploadContextMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the live draft when the pathname is not a returned request's", async () => {
    contexts(null, 1);

    const res = await POST(tokenRequest());

    expect(res.status).toBe(200);
    expect(getUploadContextMock.mock.calls.map((c) => c[2])).toEqual([
      { kind: "correction", solicitudId: DRAFT_ID },
      { kind: "draft" },
    ]);
  });

  it("denies a request that is foreign or not devuelta (nothing open, no draft either)", async () => {
    contexts(null, null);

    const res = await POST(tokenRequest(RETURNED_PATH));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "no_draft" });
    expect(issuedOptions).toBeUndefined();
  });

  it("denies a draft pathname that is not under the open context's prefix", async () => {
    contexts(null, 1);

    const res = await POST(tokenRequest(RETURNED_PATH));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "not_allowed" });
    expect(issuedOptions).toBeUndefined();
  });

  it("applies the cap to the count the data layer reports (retired already excluded)", async () => {
    contexts(5, null);
    const refused = await POST(tokenRequest(RETURNED_PATH));
    expect(await refused.json()).toEqual({ error: "too_many_documents" });
    expect(issuedOptions).toBeUndefined();

    contexts(4, null);
    const allowed = await POST(tokenRequest(RETURNED_PATH));
    expect(allowed.status).toBe(200);
    expect(issuedOptions).toBeDefined();
  });
});
