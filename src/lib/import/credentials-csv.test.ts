import { describe, expect, it } from "vitest";

import { buildCredentialsCsv } from "@/lib/import/credentials-csv";
import type { TemporaryCredential } from "@/lib/import/types";

const cred = (
  over: Partial<TemporaryCredential> = {},
): TemporaryCredential => ({
  login: "ana.perez@uni.edu",
  nombreCompleto: "Ana Pérez",
  clave: "ABCDEFGH23456789",
  ...over,
});

const body = (csv: string) => csv.slice(1).split("\r\n");

describe("buildCredentialsCsv (IAP: Export accompanies the successful apply)", () => {
  it("starts with the UTF-8 BOM and a header row", () => {
    const csv = buildCredentialsCsv([cred()]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(body(csv)[0]).toBe("Correo,NombreCompleto,Clave");
  });

  it("emits one row per credential and keeps accents", () => {
    const csv = buildCredentialsCsv([
      cred(),
      cred({
        login: "luis@uni.edu",
        nombreCompleto: "Luis Ñandú",
        clave: "ZZZZ",
      }),
    ]);
    expect(body(csv)).toEqual([
      "Correo,NombreCompleto,Clave",
      "ana.perez@uni.edu,Ana Pérez,ABCDEFGH23456789",
      "luis@uni.edu,Luis Ñandú,ZZZZ",
    ]);
  });

  it("emits only the header for an empty list", () => {
    expect(body(buildCredentialsCsv([]))).toEqual([
      "Correo,NombreCompleto,Clave",
    ]);
  });

  it("quotes commas, quotes and newlines (RFC 4180)", () => {
    const csv = buildCredentialsCsv([
      cred({ nombreCompleto: 'Pérez, "Ana"\nMaría' }),
    ]);
    expect(csv).toContain('"Pérez, ""Ana""\nMaría"');
  });

  it.each([
    ["=", "'=SUM(A1)"],
    ["+", "'+SUM(A1)"],
    ["-", "'-SUM(A1)"],
    ["@", "'@SUM(A1)"],
    ["\t", "'\tSUM(A1)"],
    // The prefixed cell now holds a CR, so it is also quoted.
    ["\r", '"\'\rSUM(A1)"'],
  ])(
    "prefixes a leading %j with an apostrophe (CSV injection)",
    (lead, cell) => {
      const csv = buildCredentialsCsv([
        cred({ nombreCompleto: `${lead}SUM(A1)` }),
      ]);
      expect(csv).toContain(`,${cell},`);
    },
  );

  it("neutralises the formula before quoting", () => {
    const csv = buildCredentialsCsv([
      cred({ nombreCompleto: '=HYPERLINK("x")' }),
    ]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it("does not touch a safe cell or the password column", () => {
    const csv = buildCredentialsCsv([cred({ clave: "A-B" })]);
    // The alphabet never yields a leading dangerous char; the writer does not
    // special-case the column, it just must not corrupt a generated password.
    const generated = buildCredentialsCsv([
      cred({ clave: "K7MPQRST23456789" }),
    ]);
    expect(body(generated)[1]).toBe(
      "ana.perez@uni.edu,Ana Pérez,K7MPQRST23456789",
    );
    expect(csv).toContain("A-B");
  });
});

// FE-29 (UX-21): the file names each account by the email the docente types to
// sign in. A docente's login is the normalized email, and no column is a
// "Login" or a "Usuario" to type.
describe("buildCredentialsCsv names the account by email (FE-29)", () => {
  it("has no column labelled Login or Usuario", () => {
    const header = body(buildCredentialsCsv([cred()]))[0].split(",");

    expect(header).toEqual(["Correo", "NombreCompleto", "Clave"]);
    expect(header.map((h) => h.toLowerCase())).not.toContain("login");
    expect(header.map((h) => h.toLowerCase())).not.toContain("usuario");
  });

  it("carries the normalized email of each new docente as the first cell", () => {
    const csv = buildCredentialsCsv([
      cred({ login: "ana.perez@uni.edu" }),
      cred({ login: "luis.gomez@uni.edu", nombreCompleto: "Luis Gómez" }),
    ]);

    const firstCells = body(csv)
      .slice(1)
      .map((row) => row.split(",")[0]);
    expect(firstCells).toEqual(["ana.perez@uni.edu", "luis.gomez@uni.edu"]);
    for (const email of firstCells) expect(email).toBe(email.toLowerCase());
  });
});
