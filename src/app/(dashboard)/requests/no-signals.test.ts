import { readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";

import { render } from "@testing-library/react";
import { createElement, type ComponentType, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  messages,
  sessionFor,
  type Locale,
} from "@/app/(dashboard)/review/test-support";
import { createDbDouble, type Step } from "@/lib/data/test-support/db-double";
import { DECISION_TEMPLATES } from "@/lib/intake/decision-templates";

// student-requests: "Students never see validation signals" (RF-05, RN-15,
// RN-26, RNF-01, RNF-02, E13). The student surface never imports, loads or
// names a signal, an outcome, a verdict or a document fingerprint, and a
// request whose signals are `present` renders exactly as one without. Three
// kinds of proof: source scans, the rendered own list and detail with the
// signal modules spied, and the shape of the own-request reads. A guard: it
// passes at write.

vi.mock("server-only", () => ({}));

const {
  redirectMock,
  notFoundMock,
  getSessionMock,
  detailMock,
  listMock,
  signalsMock,
  evaluateMock,
  holder,
  state,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
  getSessionMock: vi.fn(),
  detailMock: vi.fn(),
  listMock: vi.fn(),
  signalsMock: vi.fn(),
  evaluateMock: vi.fn(),
  holder: { current: null as unknown },
  state: { locale: "en" as Locale },
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));
vi.mock("next/link", async () =>
  (await import("@/app/(dashboard)/review/test-support")).linkDouble(),
);
vi.mock("@/lib/auth/cookies", () => ({ getSession: getSessionMock }));
// The pages read through these two functions; the data tests below load the
// real module with `importActual`.
vi.mock("@/lib/data/student-requests", () => ({
  getOwnRequestDetail: detailMock,
  listOwnRequests: listMock,
}));
vi.mock("@/lib/data/request-reads", () => ({
  recordRequestRead: vi.fn(),
  recordQueueRead: vi.fn(),
}));
vi.mock("next-intl/server", async () =>
  (await import("@/app/(dashboard)/review/test-support")).serverIntl(state),
);
// The signal entry points are spies that report a request full of `present`
// outcomes: if a student screen ever loaded them, the output would show it.
vi.mock("@/lib/data/signals", () => ({ loadSignals: signalsMock }));
vi.mock("@/lib/signals/evaluate", () => ({ evaluateSignals: evaluateMock }));
vi.mock("@/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_t, prop) =>
        (holder.current as Record<string | symbol, unknown>)[prop],
    },
  ),
}));

const ROOT = process.cwd();
const REQUESTS_DIR = "src/app/(dashboard)/requests";

type SourceFile = { path: string; text: string };

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = posix.join(dir.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) return walk(join(dir, entry.name));
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });
}

const read = (path: string): SourceFile => ({
  path,
  text: readFileSync(join(ROOT, path), "utf8"),
});

/** The module specifiers a source file imports, requires or lazy-loads. */
function specifiers(source: string): string[] {
  const text = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  return [
    ...text.matchAll(
      /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)["']([^"']+)["']/g,
    ),
  ].map((m) => m[1]);
}

function resolved(from: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) return `src/${specifier.slice(2)}`;
  if (specifier.startsWith(".")) {
    return posix.normalize(posix.join(posix.dirname(from), specifier));
  }
  return null;
}

const SIGNAL_MODULES = [
  /^src\/lib\/signals(\/|$)/,
  /^src\/lib\/data\/signals$/,
  /^src\/app\/\(dashboard\)\/review\/\[id\]\/signals-section$/,
];

/** The files that import a signals module, in any import form. */
function importersOfSignals(files: readonly SourceFile[]): string[] {
  return files
    .filter(({ path, text }) =>
      specifiers(text).some((specifier) => {
        const target = resolved(path, specifier);
        return target !== null && SIGNAL_MODULES.some((re) => re.test(target));
      }),
    )
    .map(({ path }) => path);
}

/** What a student-facing source must never name. */
const SIGNAL_VOCABULARY =
  /huellaSha256|HuellaSha256|fingerprint|sha256|loadSignals|SignalsSection|signalsAccess|toCoordinationView|suggestVerdict|evaluateSignals|SignalView/i;

const studentSources = [
  ...walk(REQUESTS_DIR),
  "src/lib/data/student-requests.ts",
].map(read);

/** The upload, finalize and correction chain a student's file goes through. */
const UPLOAD_CHAIN = [
  "src/lib/data/solicitud-correction.ts",
  "src/lib/data/solicitudes.ts",
  "src/lib/data/documentos.ts",
  "src/lib/intake/stream-digest.ts",
  ...walk("src/app/api/intake"),
].map(read);

describe("no student source reaches the signals (Detail and list carry no signal data)", () => {
  it("scans the student pages, actions and reader, so the scan is not vacuous", () => {
    const paths = studentSources.map((s) => s.path);

    expect(paths.length).toBeGreaterThan(25);
    expect(paths).toContain("src/app/(dashboard)/requests/page.tsx");
    expect(paths).toContain("src/app/(dashboard)/requests/[id]/page.tsx");
    expect(paths).toContain(
      "src/app/(dashboard)/requests/[id]/correct/actions.ts",
    );
    expect(paths).toContain("src/lib/data/student-requests.ts");
  });

  it("flags a fixture that imports a signals module and one that names a fingerprint", () => {
    expect(
      importersOfSignals([
        {
          path: "src/app/(dashboard)/requests/a.tsx",
          text: 'import { loadSignals } from "@/lib/data/signals";',
        },
        {
          path: "src/app/(dashboard)/requests/b.tsx",
          text: 'import { SignalsSection } from "@/app/(dashboard)/review/[id]/signals-section";',
        },
        {
          path: "src/app/(dashboard)/requests/c.tsx",
          text: 'import { x } from "../../../lib/signals/types";',
        },
        {
          path: "src/app/(dashboard)/requests/d.tsx",
          text: 'import { y } from "@/lib/data/solicitudes";',
        },
      ]),
    ).toEqual([
      "src/app/(dashboard)/requests/a.tsx",
      "src/app/(dashboard)/requests/b.tsx",
      "src/app/(dashboard)/requests/c.tsx",
    ]);
    expect(SIGNAL_VOCABULARY.test("select({ huellaSha256 })")).toBe(true);
    expect(SIGNAL_VOCABULARY.test("const estado = 'pendiente'")).toBe(false);
  });

  it("imports nothing from the signals modules", () => {
    expect(importersOfSignals(studentSources)).toEqual([]);
  });

  it("names no signal, verdict or fingerprint field", () => {
    const offenders = studentSources
      .filter(({ text }) => SIGNAL_VOCABULARY.test(text))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  it("keeps the upload, finalize and correction chain free of any signal read", () => {
    expect(UPLOAD_CHAIN.length).toBeGreaterThan(5);
    expect(importersOfSignals(UPLOAD_CHAIN)).toEqual([]);
    // The fingerprint is written by `finalizeDocument` and named nowhere else
    // in the chain (the digest module computes it and holds no column name).
    const naming = UPLOAD_CHAIN.filter(({ text }) =>
      /huellaSha256|HuellaSha256/.test(text),
    ).map(({ path }) => path);
    expect(naming).toEqual(["src/lib/data/documentos.ts"]);
  });

  it("words no student-facing text with a signal, a verdict or a repeated document", () => {
    const banned =
      /repeated document|documento repetido|signal|señal|suggest|sugerenc|verdict|veredicto|huella|fingerprint|hash|identical|idéntic/i;
    const texts: string[] = [];
    for (const locale of ["en", "es"] as const) {
      const catalog = messages[locale] as Record<string, unknown>;
      for (const namespace of ["requests", "intake", "privacy"]) {
        const collect = (value: unknown, path: string) => {
          if (typeof value === "string") texts.push(`${path}: ${value}`);
          else if (value && typeof value === "object") {
            for (const [key, child] of Object.entries(value)) {
              collect(child, `${path}.${key}`);
            }
          }
        };
        collect(catalog[namespace], `${locale}.${namespace}`);
      }
    }
    for (const template of DECISION_TEMPLATES) {
      texts.push(`${template.codigo}: ${JSON.stringify(template)}`);
    }

    expect(texts.length).toBeGreaterThan(300);
    expect(texts.filter((text) => banned.test(text))).toEqual([]);
  });
});

// A returned or decided request, one whose signals would all be `present`.
const DECISION_TEXT = "Attach a legible copy of the certificate.";

function detail(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 12,
    estado: "devuelta",
    causa: "medica",
    fechaInicio: "2026-10-05",
    fechaFin: "2026-10-07",
    presentadaEn: new Date("2026-10-08T15:00:00Z"),
    reenviadaEn: null,
    clases: [
      {
        asignaturaId: 1,
        codigo: "MAT-101",
        nombre: "Calculo",
        numeroGrupo: "2",
        docenteNombre: "Pedro Ruiz",
      },
    ],
    documentos: [
      {
        id: 31,
        nombreOriginal: "constancia.pdf",
        tipoDetectado: "application/pdf",
        tamanoBytes: 2048,
        creadoEn: new Date("2026-10-08T14:00:00Z"),
      },
    ],
    decision: {
      id: 5,
      tipo: "devuelta",
      motivoCodigo: "documento_ilegible",
      texto: DECISION_TEXT,
      decididaEn: new Date("2026-10-09T15:00:00Z"),
    },
    historial: [],
    revisiones: [],
    ...overrides,
  };
}

const PRESENT_REPORT = {
  verdict: "review_carefully",
  results: ["rn07", "rn09", "rn10", "rn14", "rn26"].map((signal) => ({
    signal,
    outcome: "present",
    evidence: { kind: "repeated", references: [3] },
  })),
  notEvaluable: [],
};

/** Words that would reveal a signal, an outcome, a verdict or a fingerprint. */
const REVEALING =
  /signal|señal|outcome|verdict|veredicto|suggestion|sugerencia|review carefully|revisar con cuidado|repeated document|documento repetido|not evaluable|no evaluable|fingerprint|huella|[0-9a-f]{64}/i;

type DetailPage = (props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => Promise<ReactNode>;
let DetailPage: DetailPage;
let ListPage: () => Promise<ReactNode>;

function show(ui: ReactNode) {
  return render(
    createElement(
      // The provider's props type requires `children` inside the props object.
      NextIntlClientProvider as ComponentType<Record<string, unknown>>,
      {
        locale: state.locale,
        messages: messages[state.locale],
        timeZone: "America/Managua",
        onError: (error: Error) => {
          throw error;
        },
      },
      ui,
    ),
  );
}

const renderDetail = async (id = "12") =>
  show(
    await DetailPage({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve({}),
    }),
  );

beforeAll(async () => {
  DetailPage = (await import("@/app/(dashboard)/requests/[id]/page")).default;
  ListPage = (await import("@/app/(dashboard)/requests/page")).default;
}, 60_000);

beforeEach(() => {
  state.locale = "en";
  redirectMock.mockClear();
  notFoundMock.mockClear();
  getSessionMock.mockReset();
  getSessionMock.mockResolvedValue(sessionFor("estudiante"));
  detailMock.mockReset();
  detailMock.mockResolvedValue(detail());
  listMock.mockReset();
  signalsMock.mockReset();
  signalsMock.mockResolvedValue({ data: PRESENT_REPORT, degraded: false });
  evaluateMock.mockReset();
  evaluateMock.mockReturnValue(PRESENT_REPORT);
  holder.current = null;
});

describe("the own detail shows no signal, whatever the signals are (Detail and list carry no signal data)", () => {
  it.each(["pendiente", "aprobada", "devuelta", "rechazada"])(
    "renders a %s request in both locales without a signal, outcome, verdict or fingerprint",
    async (estado) => {
      for (const locale of ["en", "es"] as const) {
        state.locale = locale;
        detailMock.mockResolvedValue(
          detail({
            estado,
            decision: estado === "pendiente" ? null : detail().decision,
          }),
        );

        const { container, unmount } = await renderDetail();

        expect(container.textContent).toContain("MAT-101");
        expect(container.textContent).not.toMatch(REVEALING);
        unmount();
      }

      expect(signalsMock).not.toHaveBeenCalled();
      expect(evaluateMock).not.toHaveBeenCalled();
    },
  );

  it.each(["devuelta", "rechazada"])(
    "shows a %s request's state, reason and the secretary's own decision text, and nothing more",
    async (estado) => {
      detailMock.mockResolvedValue(detail({ estado }));

      const { container } = await renderDetail();

      expect(container.textContent).toContain(DECISION_TEXT);
      expect(container.textContent).not.toMatch(REVEALING);
      expect(signalsMock).not.toHaveBeenCalled();
    },
  );

  it("answers another student's id exactly as an unknown id, with no signal read", async () => {
    detailMock.mockResolvedValue(null);

    const other = await renderDetail("12").catch((e: Error) => e.message);
    const unknown = await renderDetail("9999").catch((e: Error) => e.message);

    expect(other).toBe("NOT_FOUND");
    expect(unknown).toBe(other);
    expect(signalsMock).not.toHaveBeenCalled();
  });
});

describe("the own list shows no signal (Detail and list carry no signal data)", () => {
  it("renders every visible state without a signal, outcome, verdict or fingerprint", async () => {
    listMock.mockResolvedValue(
      ["pendiente", "aprobada", "devuelta", "rechazada"].map((estado, i) => ({
        id: 10 + i,
        estado,
        causa: "medica",
        fechaInicio: "2026-10-05",
        fechaFin: "2026-10-07",
        presentadaEn: new Date("2026-10-08T15:00:00Z"),
        reenviadaEn: null,
      })),
    );

    for (const locale of ["en", "es"] as const) {
      state.locale = locale;
      const { container, unmount } = show(await ListPage());

      expect(container.querySelectorAll("li")).toHaveLength(4);
      expect(container.textContent).not.toMatch(REVEALING);
      unmount();
    }

    expect(signalsMock).not.toHaveBeenCalled();
    expect(evaluateMock).not.toHaveBeenCalled();
  });
});

describe("the own-request reads keep their shape (student-requests, unchanged)", () => {
  const DETAIL_KEYS = [
    "causa",
    "clases",
    "decision",
    "documentos",
    "estado",
    "fechaFin",
    "fechaInicio",
    "historial",
    "id",
    "presentadaEn",
    "reenviadaEn",
    "revisiones",
  ];
  const LIST_KEYS = [
    "causa",
    "estado",
    "fechaFin",
    "fechaInicio",
    "id",
    "presentadaEn",
    "reenviadaEn",
  ];
  const requestRow = {
    id: 12,
    estado: "devuelta",
    causa: "medica",
    fechaInicio: "2026-10-05",
    fechaFin: "2026-10-07",
    presentadaEn: new Date("2026-10-08T15:00:00Z"),
    reenviadaEn: null,
  };

  async function actual() {
    return vi.importActual<typeof import("@/lib/data/student-requests")>(
      "@/lib/data/student-requests",
    );
  }

  function use(script: Step[]) {
    const double = createDbDouble(script);
    holder.current = double.db;
    return double;
  }

  it("returns the detail with exactly the pre-signals keys and issues only selects", async () => {
    const { getOwnRequestDetail } = await actual();
    const double = use([
      { kind: "select", rows: [requestRow] },
      { kind: "select", rows: [] },
      {
        kind: "select",
        rows: [
          {
            id: 31,
            nombreOriginal: "constancia.pdf",
            tipoDetectado: "pdf",
            tamanoBytes: 2048,
            creadoEn: new Date("2026-10-08T14:00:00Z"),
          },
        ],
      },
      { kind: "select", rows: [] },
      { kind: "select", rows: [] },
    ]);

    const result = await getOwnRequestDetail(7, 12);

    expect(Object.keys(result ?? {}).sort()).toEqual(DETAIL_KEYS);
    expect(Object.keys(result?.documentos[0] ?? {}).sort()).toEqual([
      "creadoEn",
      "id",
      "nombreOriginal",
      "tamanoBytes",
      "tipoDetectado",
    ]);
    expect(JSON.stringify(result)).not.toMatch(REVEALING);
    expect(new Set(double.log.map((s) => s.kind))).toEqual(new Set(["select"]));
    expect(double.log).toHaveLength(5);
  });

  it("returns the list rows with exactly the pre-signals keys", async () => {
    const { listOwnRequests } = await actual();
    use([{ kind: "select", rows: [requestRow] }]);

    const rows = await listOwnRequests(7);

    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(LIST_KEYS);
  });

  it("answers null with a single read for another student's id and for an unknown id alike", async () => {
    const { getOwnRequestDetail } = await actual();

    const first = use([{ kind: "select", rows: [] }]);
    const another = await getOwnRequestDetail(7, 12);
    const second = use([{ kind: "select", rows: [] }]);
    const unknown = await getOwnRequestDetail(7, 9999);

    expect(another).toBeNull();
    expect(unknown).toBeNull();
    expect(first.log).toHaveLength(1);
    expect(second.log).toHaveLength(1);
  });
});
