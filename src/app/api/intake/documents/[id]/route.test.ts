// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFakeIntakeDeps } from "@/lib/intake/fakes";
import type { RolUsuario } from "@/lib/validations/auth";

vi.mock("server-only", () => ({}));

const {
  getCurrentUserMock,
  getDocumentMock,
  recordDownloadMock,
  getIntakeDepsMock,
} = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  getDocumentMock: vi.fn(),
  recordDownloadMock: vi.fn(),
  getIntakeDepsMock: vi.fn(),
}));

vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/lib/data/documentos", () => ({
  getDocumentForDownload: getDocumentMock,
  recordDocumentDownload: recordDownloadMock,
}));
vi.mock("@/lib/intake/deps", () => ({ getIntakeDeps: getIntakeDepsMock }));

import { GET } from "@/app/api/intake/documents/[id]/route";

const OWNER = 7;
const PATH = "intake/4/0b9f6c1e-4f0a-4d57-9a64-2f3f8f1d2c11.pdf";
const PDF_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37];

function session(rol: RolUsuario = "estudiante", sub = String(OWNER)) {
  return { sub, login: "ana", rol, nombre: "Ana" };
}

function doc(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    solicitudId: 4,
    estudianteId: OWNER,
    pathname: PATH,
    tipo: "pdf",
    nombreOriginal: "Dictamen médico.pdf",
    ...overrides,
  };
}

function call(id: string) {
  return GET(new Request(`http://localhost/api/intake/documents/${id}`), {
    params: Promise.resolve({ id }),
  });
}

let deps: ReturnType<typeof createFakeIntakeDeps>;

describe("GET /api/intake/documents/[id]", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    getDocumentMock.mockReset();
    recordDownloadMock.mockReset();
    getIntakeDepsMock.mockReset();
    deps = createFakeIntakeDeps();
    deps.store.seed(PATH, PDF_BYTES);
    getIntakeDepsMock.mockReturnValue(deps);
    getCurrentUserMock.mockResolvedValue(session());
    getDocumentMock.mockResolvedValue(doc());
    recordDownloadMock.mockResolvedValue(undefined);
  });

  describe("owner", () => {
    it("streams the file with its detected type and hardened headers", async () => {
      const res = await call("11");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/pdf");
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("Content-Disposition")).toBe(
        "attachment; filename=\"documento.pdf\"; filename*=UTF-8''Dictamen%20m%C3%A9dico.pdf",
      );
      expect(Array.from(new Uint8Array(await res.arrayBuffer()))).toEqual(
        PDF_BYTES,
      );
    });

    it("serves a png with image/png", async () => {
      getDocumentMock.mockResolvedValue(
        doc({ tipo: "png", pathname: "intake/4/x.png" }),
      );
      deps.store.seed("intake/4/x.png", [0x89, 0x50]);

      const res = await call("11");

      expect(res.headers.get("Content-Type")).toBe("image/png");
    });

    it("exposes no storage location or URL in the response", async () => {
      const res = await call("11");

      const headers = JSON.stringify([...res.headers.entries()]);
      expect(headers).not.toContain("intake/");
      expect(headers).not.toMatch(/https?:/);
      expect(res.headers.get("Location")).toBeNull();
    });

    it("writes exactly one documento.descargado row, after the file opens and before bytes are sent (D13)", async () => {
      const streamSpy = vi.spyOn(deps.store, "stream");

      const res = await call("11");

      expect(recordDownloadMock).toHaveBeenCalledTimes(1);
      expect(recordDownloadMock).toHaveBeenCalledWith(OWNER, {
        id: 11,
        solicitudId: 4,
        tipo: "pdf",
      });
      expect(streamSpy.mock.invocationCallOrder[0]).toBeLessThan(
        recordDownloadMock.mock.invocationCallOrder[0],
      );
      expect(res.status).toBe(200);
    });

    it("writes one row per download: two downloads, two rows", async () => {
      await call("11");
      await call("11");

      expect(recordDownloadMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("denials are identical and write no audit row", () => {
    async function denial(res: Response) {
      return { status: res.status, body: await res.text() };
    }

    it("answers 401 without a session", async () => {
      getCurrentUserMock.mockResolvedValue(null);

      const res = await call("11");

      expect(res.status).toBe(401);
      expect(getDocumentMock).not.toHaveBeenCalled();
      expect(recordDownloadMock).not.toHaveBeenCalled();
    });

    it("answers 401 for a session that must still change the password", async () => {
      getCurrentUserMock.mockResolvedValue({
        ...session(),
        debeCambiarClave: true,
      });

      const res = await call("11");

      expect(res.status).toBe(401);
      expect(getDocumentMock).not.toHaveBeenCalled();
    });

    it("answers the same 404 for another student as for an unknown id, with no bytes", async () => {
      getDocumentMock.mockResolvedValue(null);
      const unknown = await denial(await call("404"));

      getDocumentMock.mockResolvedValue(doc({ estudianteId: 99 }));
      const streamSpy = vi.spyOn(deps.store, "stream");
      const foreign = await denial(await call("11"));

      expect(unknown.status).toBe(404);
      expect(foreign).toEqual(unknown);
      expect(streamSpy).not.toHaveBeenCalled();
      expect(recordDownloadMock).not.toHaveBeenCalled();
    });

    it.each([
      "docente",
      "secretaria",
      "coordinacion",
      "administrador",
    ] as const)(
      "answers 404 for %s even if the id matches the owner (D15)",
      async (rol) => {
        getCurrentUserMock.mockResolvedValue(session(rol));

        const res = await call("11");

        expect(res.status).toBe(404);
        expect(recordDownloadMock).not.toHaveBeenCalled();
      },
    );

    it.each(["abc", "1.5", "-1", "0", ""])(
      "answers 404 for the malformed id %j without querying",
      async (id) => {
        const res = await call(id);

        expect(res.status).toBe(404);
        expect(getDocumentMock).not.toHaveBeenCalled();
      },
    );
  });

  describe("failures return no bytes and write no audit row", () => {
    it("answers 404 when the stored file is missing", async () => {
      await deps.store.delete([PATH]);

      const res = await call("11");

      expect(res.status).toBe(404);
      expect(recordDownloadMock).not.toHaveBeenCalled();
    });

    it("answers 500 when the store cannot be read", async () => {
      deps.store.stream = vi.fn().mockRejectedValue(new Error("store down"));

      const res = await call("11");

      expect(res.status).toBe(500);
      expect(await res.text()).not.toContain("store down");
      expect(recordDownloadMock).not.toHaveBeenCalled();
    });

    it("answers 500 with no bytes and cancels the stream when the audit insert fails", async () => {
      const cancelled = vi.fn();
      deps.store.stream = vi.fn().mockResolvedValue(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(PDF_BYTES));
          },
          cancel: cancelled,
        }),
      );
      recordDownloadMock.mockRejectedValue(new Error("audit down"));

      const res = await call("11");

      expect(res.status).toBe(500);
      // Only the error JSON: none of the file bytes ("%PDF-1.7").
      expect(await res.text()).toBe('{"error":"unavailable"}');
      expect(cancelled).toHaveBeenCalledTimes(1);
    });
  });
});
