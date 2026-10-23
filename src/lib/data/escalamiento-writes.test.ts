import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Structural pin of the `Escalamiento` write surface (escalation, ES-1, ES-8).
 * The row is both the escalation and its notification outbox, so its writers
 * are split by purpose: the row is created only by `solicitud-escalation.ts`
 * (escalate and report, inside their transactions), the outbox columns (state,
 * attempts, claim, send time, provider id) are updated only by
 * `escalamiento.ts`, and the answer columns only by the coordinator's answer
 * module, `escalation-answer.ts`. Dispatch writes through `escalamiento.ts`.
 */

const SRC = join(process.cwd(), "src");

type Verb = "insert" | "update" | "delete";

/** Drizzle writes (`insert(escalamiento)`) and raw SQL writes on the table. */
const WRITE_PATTERNS: Record<Verb, RegExp[]> = {
  insert: [/\.insert\(\s*escalamiento\b/, /insert\s+into\s+"?Escalamiento"?/i],
  update: [/\.update\(\s*escalamiento\b/, /update\s+"?Escalamiento"?/i],
  delete: [/\.delete\(\s*escalamiento\b/, /delete\s+from\s+"?Escalamiento"?/i],
};

function escalamientoWrites(source: string): Verb[] {
  return (Object.keys(WRITE_PATTERNS) as Verb[]).filter((verb) =>
    WRITE_PATTERNS[verb].some((pattern) => pattern.test(source)),
  );
}

/** Module (relative to src, forward slashes) -> verbs it may use. */
const ALLOWED: Record<string, readonly Verb[]> = {
  "lib/data/escalamiento.ts": ["update"],
  "lib/data/escalation-answer.ts": ["update"],
  "lib/data/solicitud-escalation.ts": ["insert"],
  // The real-Postgres fixtures remove the rows of a run, children first.
  "lib/data/integration/fixtures.ts": ["delete"],
};

/** The outbox columns, as the drizzle property names. */
const OUTBOX_COLUMNS =
  /\b(intentos|reclamoId|reclamadaEn|enviadaEn|proveedorMensajeId|notificacionMotivo)\b/;

/** The coordinator's answer columns. */
const ANSWER_COLUMNS = /\b(respuesta|respondidaPorId|respondidaEn)\b/;

function productionSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__fixtures__" ? [] : productionSources(path);
    }
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });
}

function read(name: string): string {
  return readFileSync(join(SRC, name), "utf8");
}

describe("Escalamiento write surface", () => {
  it("detects the write shapes it guards against", () => {
    expect(
      escalamientoWrites("await tx.insert(escalamiento).values(r)"),
    ).toEqual(["insert"]);
    expect(escalamientoWrites("db.update( escalamiento ).set(x)")).toEqual([
      "update",
    ]);
    expect(escalamientoWrites("db.delete(escalamiento)")).toEqual(["delete"]);
    expect(escalamientoWrites('sql`UPDATE "Escalamiento" SET x = 1`')).toEqual([
      "update",
    ]);
    expect(escalamientoWrites("db.select().from(escalamiento)")).toEqual([]);
  });

  it("has no module outside the allowed writers that writes Escalamiento", () => {
    const files = productionSources(SRC);
    expect(files.length).toBeGreaterThan(0);

    const offenders = files.flatMap((file) => {
      const name = relative(SRC, file).split(sep).join("/");
      const allowed = ALLOWED[name] ?? [];
      return escalamientoWrites(readFileSync(file, "utf8"))
        .filter((verb) => !allowed.includes(verb))
        .map((verb) => `${name}: ${verb}`);
    });

    expect(offenders).toEqual([]);
  });

  it("finds every allowed writer, so the pin is not vacuous", () => {
    for (const [name, verbs] of Object.entries(ALLOWED)) {
      expect(escalamientoWrites(read(name))).toEqual([...verbs]);
    }
  });

  it("keeps the outbox columns in escalamiento.ts: creation sets only the initial state", () => {
    const creation = read("lib/data/solicitud-escalation.ts");

    expect(creation).toContain('notificacionEstado: "pendiente"');
    expect(creation).not.toMatch(OUTBOX_COLUMNS);
    expect(read("lib/data/escalamiento.ts")).toMatch(OUTBOX_COLUMNS);
  });

  it("keeps the answer columns out of the notification writer and the creation", () => {
    expect(read("lib/data/escalamiento.ts")).not.toMatch(ANSWER_COLUMNS);
    expect(read("lib/data/solicitud-escalation.ts")).not.toMatch(
      ANSWER_COLUMNS,
    );
  });

  it("keeps the answer module on the answer columns: it touches no outbox column", () => {
    const answer = read("lib/data/escalation-answer.ts");

    expect(answer).toMatch(ANSWER_COLUMNS);
    expect(answer).not.toMatch(OUTBOX_COLUMNS);
    expect(answer).not.toContain("notificacionEstado");
  });
});
