// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_PARAMETERS } from "@/lib/parameters/registry";
import { rolesUsuario, type RolUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const {
  getCurrentUserMock,
  handleUploadMock,
  scopeMock,
  contextMock,
  getNormativeParametersMock,
} = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  handleUploadMock: vi.fn(),
  scopeMock: vi.fn(),
  contextMock: vi.fn(),
  getNormativeParametersMock: vi.fn(),
}));

vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@vercel/blob/client", () => ({ handleUpload: handleUploadMock }));
vi.mock("@/lib/data/request-scope", () => ({ resolveRequestScope: scopeMock }));
vi.mock("@/lib/data/special-format", () => ({
  getSpecialFormatContext: contextMock,
}));
// The loader is the only source of the maximum size (NP-4, A11).
vi.mock("@/lib/parameters/loader", () => ({
  getNormativeParameters: getNormativeParametersMock,
}));
vi.mock("@/env", () => ({
  env: { BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_test" },
}));

import { POST } from "@/app/api/review/special-format-token/route";

const NOW = new Date("2026-10-19T15:00:00.000Z");
const REQUEST = 12;
const OWN_PATH = `intake/${REQUEST}/0b9f6c1e-4f0a-4d57-9a64-2f3f8f1d2c11.pdf`;
const SCOPE = { kind: "facultad", facultadId: 3 } as const;
const NOT_ALLOWED = { error: "not_allowed" };

function session(rol: RolUsuario = "secretaria", debeCambiarClave?: boolean) {
  return {
    sub: "20",
    login: "rosa",
    rol,
    nombre: "Rosa",
    ...(debeCambiarClave === undefined ? {} : { debeCambiarClave }),
  };
}

function tokenRequest(pathname: string = OWN_PATH): Request {
  return new Request("http://localhost/api/review/special-format-token", {
    method: "POST",
    body: JSON.stringify({
      type: "blob.generate-client-token",
      payload: { pathname, clientPayload: null, multipart: false },
    }),
  });
}

let issuedOptions: unknown;

/** The loader result when the maximum size is in force at `mib`. */
const sizeRead = (mib: number) => ({
  values: { ...DEFAULT_PARAMETERS, maxDocumentMib: mib },
  fallback: [],
  degraded: false,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  issuedOptions = undefined;
  getNormativeParametersMock.mockReset().mockResolvedValue(sizeRead(10));
  getCurrentUserMock.mockReset().mockResolvedValue(session());
  scopeMock.mockReset().mockResolvedValue(SCOPE);
  contextMock.mockReset().mockResolvedValue({ solicitudId: REQUEST });
  handleUploadMock.mockReset();
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
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/review/special-format-token: who may ask (RNF-01)", () => {
  it("answers 401 without a session and issues nothing", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const res = await POST(tokenRequest());

    expect(res.status).toBe(401);
    expect(handleUploadMock).not.toHaveBeenCalled();
    expect(contextMock).not.toHaveBeenCalled();
  });

  it("answers 403 for an account that must still change the password", async () => {
    getCurrentUserMock.mockResolvedValue(session("secretaria", true));

    const res = await POST(tokenRequest());

    expect(res.status).toBe(403);
    expect(handleUploadMock).not.toHaveBeenCalled();
    expect(scopeMock).not.toHaveBeenCalled();
  });

  it.each(rolesUsuario.filter((r) => r !== "secretaria"))(
    "answers the uniform 400 not_allowed for %s and reads nothing",
    async (rol) => {
      getCurrentUserMock.mockResolvedValue(session(rol));

      const res = await POST(tokenRequest());

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual(NOT_ALLOWED);
      expect(handleUploadMock).not.toHaveBeenCalled();
      expect(contextMock).not.toHaveBeenCalled();
    },
  );

  it("answers 400 for a body that is not JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/review/special-format-token", {
        method: "POST",
        body: "not json",
      }),
    );

    expect(res.status).toBe(400);
    expect(handleUploadMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/review/special-format-token: the request (RN-19)", () => {
  it("issues a limited token for an approved, marked request without a format", async () => {
    const res = await POST(tokenRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      type: "blob.generate-client-token",
      clientToken: "client-token",
    });
    expect(scopeMock).toHaveBeenCalledWith(20, "secretaria");
    expect(contextMock).toHaveBeenCalledWith(REQUEST, SCOPE);
    expect(issuedOptions).toEqual({
      allowedContentTypes: ["application/pdf", "image/png", "image/jpeg"],
      maximumSizeInBytes: 10_485_760,
      validUntil: NOW.getTime() + 10 * 60 * 1000,
      addRandomSuffix: false,
      allowOverwrite: false,
    });
  });

  it.each([
    [1, 1_048_576],
    [5, 5_242_880],
    [10, 10_485_760],
  ] as const)(
    "limits the token to the loader value: %i MiB gives %i bytes (SD-LIMIT)",
    async (mib, bytes) => {
      getNormativeParametersMock.mockResolvedValue(sizeRead(mib));

      const res = await POST(tokenRequest());

      expect(res.status).toBe(200);
      expect(issuedOptions).toMatchObject({ maximumSizeInBytes: bytes });
    },
  );

  it("reads the limit again for every token: an earlier token keeps the limit it carries", async () => {
    const issued: unknown[] = [];

    await POST(tokenRequest());
    issued.push(issuedOptions);
    getNormativeParametersMock.mockResolvedValue(sizeRead(5));
    await POST(tokenRequest());
    issued.push(issuedOptions);

    expect(issued).toMatchObject([
      { maximumSizeInBytes: 10_485_760 },
      { maximumSizeInBytes: 5_242_880 },
    ]);
    expect(getNormativeParametersMock).toHaveBeenCalledTimes(2);
  });

  it("reads the limit only after the request and the scope are accepted", async () => {
    await POST(tokenRequest("other/12/a.pdf"));
    scopeMock.mockResolvedValue({ kind: "none" });
    await POST(tokenRequest());
    scopeMock.mockResolvedValue(SCOPE);
    contextMock.mockResolvedValue(null);
    await POST(tokenRequest());

    expect(getNormativeParametersMock).not.toHaveBeenCalled();
  });

  it("passes the store token and registers no completion callback", async () => {
    await POST(tokenRequest());

    const args = handleUploadMock.mock.calls[0][0];
    expect(args.token).toBe("vercel_blob_rw_test");
    expect(args.onUploadCompleted).toBeUndefined();
  });

  it.each([
    ["a pathname outside the intake root", "other/12/a.pdf"],
    ["traversal", "intake/12/../99/a.pdf"],
    ["a nested path", "intake/12/x/a.pdf"],
  ])(
    "denies %s with not_allowed and consults nothing",
    async (_l, pathname) => {
      const res = await POST(tokenRequest(pathname));

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual(NOT_ALLOWED);
      expect(contextMock).not.toHaveBeenCalled();
      expect(issuedOptions).toBeUndefined();
    },
  );

  it("checks the request the pathname names, never a neighbouring id", async () => {
    contextMock.mockResolvedValue(null);

    const res = await POST(tokenRequest("intake/120/a.pdf"));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(NOT_ALLOWED);
    expect(contextMock).toHaveBeenCalledWith(120, SCOPE);
  });

  it("denies a scope of none without looking the request up", async () => {
    scopeMock.mockResolvedValue({ kind: "none" });

    const res = await POST(tokenRequest());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(NOT_ALLOWED);
    expect(contextMock).not.toHaveBeenCalled();
  });

  it("answers an out-of-scope, unmarked, unapproved, formatted or unknown request with the same not_allowed", async () => {
    // The data layer folds all five into one null (RNF-01): one answer here.
    contextMock.mockResolvedValue(null);

    const res = await POST(tokenRequest());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(NOT_ALLOWED);
    expect(issuedOptions).toBeUndefined();
  });

  it("hides SDK error details behind a generic code", async () => {
    handleUploadMock.mockRejectedValue(new Error("secret internal detail"));

    const res = await POST(tokenRequest());

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_request" });
  });
});
