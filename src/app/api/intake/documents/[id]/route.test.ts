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
  resolveScopeMock,
  resolveCoordinationMock,
} = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  getDocumentMock: vi.fn(),
  recordDownloadMock: vi.fn(),
  getIntakeDepsMock: vi.fn(),
  resolveScopeMock: vi.fn(),
  resolveCoordinationMock: vi.fn(),
}));

vi.mock("@/lib/auth/dal", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/lib/data/documentos", () => ({
  getDocumentForDownload: getDocumentMock,
  recordDocumentDownload: recordDownloadMock,
}));
vi.mock("@/lib/data/request-scope", () => ({
  resolveRequestScope: resolveScopeMock,
}));
vi.mock("@/lib/data/coordination-scope", () => ({
  resolveCoordinationScope: resolveCoordinationMock,
}));
vi.mock("@/lib/intake/deps", () => ({ getIntakeDeps: getIntakeDepsMock }));

import { GET } from "@/app/api/intake/documents/[id]/route";

const OWNER = 7;
const SECRETARIA = 20;
const FACULTAD = 3;
const COORDINADOR = 30;
const CARRERA = 9;
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
    estudianteFacultadId: FACULTAD,
    estudianteCarreraId: CARRERA,
    solicitudEstado: "pendiente",
    retiradoEn: null,
    tieneEscalamientoAbierto: false,
    pathname: PATH,
    tipo: "pdf",
    nombreOriginal: "Dictamen médico.pdf",
    ...overrides,
  };
}

function call(id: string, query = "") {
  return GET(
    new Request(`http://localhost/api/intake/documents/${id}${query}`),
    { params: Promise.resolve({ id }) },
  );
}

/** A secretaria of FACULTAD, the scope the data layer would resolve for her. */
function asSecretaria() {
  getCurrentUserMock.mockResolvedValue(
    session("secretaria", String(SECRETARIA)),
  );
  resolveScopeMock.mockResolvedValue({
    kind: "facultad",
    facultadId: FACULTAD,
  });
}

let deps: ReturnType<typeof createFakeIntakeDeps>;

describe("GET /api/intake/documents/[id]", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    getDocumentMock.mockReset();
    recordDownloadMock.mockReset();
    getIntakeDepsMock.mockReset();
    resolveScopeMock.mockReset();
    resolveScopeMock.mockResolvedValue({ kind: "none" });
    resolveCoordinationMock.mockReset();
    resolveCoordinationMock.mockResolvedValue({ kind: "none" });
    deps = createFakeIntakeDeps();
    deps.store.seed(PATH, PDF_BYTES);
    getIntakeDepsMock.mockReturnValue(deps);
    getCurrentUserMock.mockResolvedValue(session());
    getDocumentMock.mockResolvedValue(doc());
    recordDownloadMock.mockResolvedValue(undefined);
  });

  describe("owner", () => {
    it("streams the file inline with its detected type and hardened headers", async () => {
      const res = await call("11");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/pdf");
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("Content-Security-Policy")).toBe("sandbox");
      expect(res.headers.get("Content-Disposition")).toBe(
        "inline; filename=\"documento.pdf\"; filename*=UTF-8''Dictamen%20m%C3%A9dico.pdf",
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
        modo: "ver",
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
      "answers 404 for %s with no facultad scope even if the id matches the owner (D15)",
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

  describe("mode (SR-12)", () => {
    it("serves inline when the mode is absent, and records ver", async () => {
      const res = await call("11");

      expect(res.headers.get("Content-Disposition")).toMatch(/^inline;/);
      expect(recordDownloadMock.mock.calls[0][1].modo).toBe("ver");
    });

    it("serves inline for an explicit ver", async () => {
      const res = await call("11", "?modo=ver");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Disposition")).toMatch(/^inline;/);
      expect(recordDownloadMock.mock.calls[0][1].modo).toBe("ver");
    });

    it("serves an attachment with the RFC 5987 name for descarga, and records it", async () => {
      const res = await call("11", "?modo=descarga");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Disposition")).toBe(
        "attachment; filename=\"documento.pdf\"; filename*=UTF-8''Dictamen%20m%C3%A9dico.pdf",
      );
      expect(recordDownloadMock.mock.calls[0][1].modo).toBe("descarga");
      expect(recordDownloadMock).toHaveBeenCalledTimes(1);
    });

    it("keeps every other header unchanged in descarga", async () => {
      const res = await call("11", "?modo=descarga");

      expect(res.headers.get("Content-Type")).toBe("application/pdf");
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("Content-Security-Policy")).toBe("sandbox");
    });

    it.each([
      "foo",
      "",
      "DESCARGA",
      "ver,descarga",
      "descarga%00",
      "toString",
      "constructor",
    ])(
      "answers the uniform 404 for the unknown mode %j, before any lookup",
      async (modo) => {
        const unknownId = await (async () => {
          getDocumentMock.mockResolvedValueOnce(null);
          const r = await call("404");
          return { status: r.status, body: await r.text() };
        })();
        getDocumentMock.mockClear();
        const streamSpy = vi.spyOn(deps.store, "stream");

        const res = await call("11", `?modo=${modo}`);

        expect({ status: res.status, body: await res.text() }).toEqual(
          unknownId,
        );
        expect(getDocumentMock).not.toHaveBeenCalled();
        expect(streamSpy).not.toHaveBeenCalled();
        expect(recordDownloadMock).not.toHaveBeenCalled();
      },
    );
  });

  describe("repeated mode parameters", () => {
    it("answers 404 when the mode is given twice, even with equal values", async () => {
      expect((await call("11", "?modo=ver&modo=ver")).status).toBe(404);
      expect((await call("11", "?modo=ver&modo=descarga")).status).toBe(404);
      expect(recordDownloadMock).not.toHaveBeenCalled();
    });
  });

  describe("secretaria in scope (SR-12)", () => {
    beforeEach(() => asSecretaria());

    it("streams inline and writes one row with the secretary as actor and mode ver", async () => {
      const res = await call("11");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Disposition")).toMatch(/^inline;/);
      expect(res.headers.get("Content-Security-Policy")).toBe("sandbox");
      expect(recordDownloadMock).toHaveBeenCalledTimes(1);
      expect(recordDownloadMock).toHaveBeenCalledWith(SECRETARIA, {
        id: 11,
        solicitudId: 4,
        tipo: "pdf",
        modo: "ver",
      });
      expect(Array.from(new Uint8Array(await res.arrayBuffer()))).toEqual(
        PDF_BYTES,
      );
    });

    it("downloads as an attachment and records descarga", async () => {
      const res = await call("11", "?modo=descarga");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Disposition")).toMatch(/^attachment;/);
      expect(recordDownloadMock.mock.calls[0][1].modo).toBe("descarga");
    });

    it("resolves the scope for the session user and role", async () => {
      await call("11");

      expect(resolveScopeMock).toHaveBeenCalledWith(SECRETARIA, "secretaria");
    });

    it.each(["pendiente", "devuelta", "aprobada", "rechazada"])(
      "reads a document of a %s request",
      async (solicitudEstado) => {
        getDocumentMock.mockResolvedValue(doc({ solicitudEstado }));

        expect((await call("11")).status).toBe(200);
      },
    );

    it("reads a retired document of a request in scope", async () => {
      getDocumentMock.mockResolvedValue(
        doc({ retiradoEn: new Date("2026-10-07T10:00:00.000Z") }),
      );

      const res = await call("11");

      expect(res.status).toBe(200);
      expect(recordDownloadMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("coordinacion of the career (ES-9, RNF-01)", () => {
    const escalated = (overrides: Record<string, unknown> = {}) =>
      doc({
        solicitudEstado: "en_revision_coordinacion",
        tieneEscalamientoAbierto: true,
        ...overrides,
      });

    beforeEach(() => {
      getCurrentUserMock.mockResolvedValue(
        session("coordinacion", String(COORDINADOR)),
      );
      resolveCoordinationMock.mockResolvedValue({
        kind: "carrera",
        carreraId: CARRERA,
      });
      getDocumentMock.mockResolvedValue(escalated());
    });

    it("streams inline with the hardened headers and writes one row with the coordinator as actor and mode ver", async () => {
      const res = await call("11");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Disposition")).toMatch(/^inline;/);
      expect(res.headers.get("Content-Security-Policy")).toBe("sandbox");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("Cache-Control")).toBe("private, no-store");
      expect(recordDownloadMock).toHaveBeenCalledTimes(1);
      expect(recordDownloadMock).toHaveBeenCalledWith(COORDINADOR, {
        id: 11,
        solicitudId: 4,
        tipo: "pdf",
        modo: "ver",
      });
      expect(Array.from(new Uint8Array(await res.arrayBuffer()))).toEqual(
        PDF_BYTES,
      );
    });

    it("downloads as an attachment and records descarga", async () => {
      const res = await call("11", "?modo=descarga");

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Disposition")).toMatch(/^attachment;/);
      expect(recordDownloadMock.mock.calls[0][1].modo).toBe("descarga");
    });

    it("resolves the coordination scope for the session user and role", async () => {
      await call("11");

      expect(resolveCoordinationMock).toHaveBeenCalledWith(
        COORDINADOR,
        "coordinacion",
      );
    });

    it("answers 500 with no bytes when the audit insert fails", async () => {
      recordDownloadMock.mockRejectedValue(new Error("audit down"));

      const res = await call("11");

      expect(res.status).toBe(500);
      expect(await res.text()).toBe('{"error":"unavailable"}');
    });

    it.each([
      [
        "a request answered and back in pendiente",
        { solicitudEstado: "pendiente", tieneEscalamientoAbierto: false },
      ],
      [
        "an aprobada request with a notice",
        { solicitudEstado: "aprobada", tieneEscalamientoAbierto: false },
      ],
      [
        "a retired document of an escalated request",
        { retiradoEn: new Date("2026-10-07T10:00:00.000Z") },
      ],
      ["a request of another career", { estudianteCarreraId: 10 }],
      ["a student without a career", { estudianteCarreraId: null }],
    ])(
      "denies %s in every mode, like an unknown id: no bytes, no audit row",
      async (_label, overrides) => {
        getDocumentMock.mockResolvedValueOnce(null);
        const unknown = await (async () => {
          const r = await call("404");
          return { status: r.status, body: await r.text() };
        })();
        getDocumentMock.mockResolvedValue(escalated(overrides));
        const streamSpy = vi.spyOn(deps.store, "stream");

        for (const query of ["", "?modo=ver", "?modo=descarga"]) {
          const res = await call("11", query);
          expect({ status: res.status, body: await res.text() }).toEqual(
            unknown,
          );
        }
        expect(unknown.status).toBe(404);
        expect(streamSpy).not.toHaveBeenCalled();
        expect(recordDownloadMock).not.toHaveBeenCalled();
      },
    );

    it("denies a coordinacion without a career (none scope)", async () => {
      resolveCoordinationMock.mockResolvedValue({ kind: "none" });

      const res = await call("11");

      expect(res.status).toBe(404);
      expect(recordDownloadMock).not.toHaveBeenCalled();
    });

    it.each(["estudiante", "secretaria", "docente", "administrador"] as const)(
      "never resolves a coordination scope for %s",
      async (rol) => {
        getCurrentUserMock.mockResolvedValue(session(rol, "99"));

        await call("11");

        expect(resolveCoordinationMock).not.toHaveBeenCalled();
      },
    );
  });

  describe("owner and retired documents", () => {
    it("lets the owner read a document retired by a correction", async () => {
      getDocumentMock.mockResolvedValue(
        doc({ retiradoEn: new Date("2026-10-07T10:00:00.000Z") }),
      );

      expect((await call("11")).status).toBe(200);
    });

    it("does not resolve a facultad scope for a student", async () => {
      await call("11");

      expect(resolveScopeMock).toHaveBeenCalledWith(OWNER, "estudiante");
    });
  });

  describe("staff denials are identical to an unknown id and write no row", () => {
    async function denial(res: Response) {
      return { status: res.status, body: await res.text() };
    }

    async function unknownIdDenial() {
      getDocumentMock.mockResolvedValueOnce(null);
      const res = await denial(await call("404"));
      getDocumentMock.mockClear();
      return res;
    }

    it("denies a secretaria of another facultad in every mode", async () => {
      asSecretaria();
      const unknown = await unknownIdDenial();
      getDocumentMock.mockResolvedValue(doc({ estudianteFacultadId: 4 }));
      const streamSpy = vi.spyOn(deps.store, "stream");

      for (const query of ["", "?modo=ver", "?modo=descarga"]) {
        expect(await denial(await call("11", query))).toEqual(unknown);
      }
      expect(streamSpy).not.toHaveBeenCalled();
      expect(recordDownloadMock).not.toHaveBeenCalled();
    });

    it("denies a secretaria whose student has no facultad", async () => {
      asSecretaria();
      const unknown = await unknownIdDenial();
      getDocumentMock.mockResolvedValue(doc({ estudianteFacultadId: null }));

      expect(await denial(await call("11"))).toEqual(unknown);
      expect(recordDownloadMock).not.toHaveBeenCalled();
    });

    it("denies a secretaria without a facultad (none scope)", async () => {
      getCurrentUserMock.mockResolvedValue(
        session("secretaria", String(SECRETARIA)),
      );
      resolveScopeMock.mockResolvedValue({ kind: "none" });
      const unknown = await unknownIdDenial();
      getDocumentMock.mockResolvedValue(doc());

      expect(await denial(await call("11"))).toEqual(unknown);
      expect(recordDownloadMock).not.toHaveBeenCalled();
    });

    it("denies a coordinacion even with a matching facultad", async () => {
      getCurrentUserMock.mockResolvedValue(session("coordinacion", "30"));
      resolveScopeMock.mockResolvedValue({
        kind: "facultad",
        facultadId: FACULTAD,
      });
      const unknown = await unknownIdDenial();
      getDocumentMock.mockResolvedValue(doc());

      expect(await denial(await call("11"))).toEqual(unknown);
      expect(recordDownloadMock).not.toHaveBeenCalled();
    });

    it("denies a document of a borrador to an in-scope secretaria", async () => {
      asSecretaria();
      const unknown = await unknownIdDenial();
      getDocumentMock.mockResolvedValue(doc({ solicitudEstado: "borrador" }));

      expect(await denial(await call("11"))).toEqual(unknown);
      expect(recordDownloadMock).not.toHaveBeenCalled();
    });

    it("denies an unfinalized (pendiente) file, which the lookup never returns", async () => {
      asSecretaria();
      const unknown = await unknownIdDenial();
      getDocumentMock.mockResolvedValue(null);

      expect(await denial(await call("11"))).toEqual(unknown);
      expect(recordDownloadMock).not.toHaveBeenCalled();
    });

    it("does not resolve a scope without a session", async () => {
      getCurrentUserMock.mockResolvedValue(null);

      await call("11");

      expect(resolveScopeMock).not.toHaveBeenCalled();
    });
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
