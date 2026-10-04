import { describe, expect, it } from "vitest";

import { buildCredentialsCsv } from "@/lib/import/credentials-csv";
import type { TemporaryCredential } from "@/lib/import/types";

const cred = (
  over: Partial<TemporaryCredential> = {},
): TemporaryCredential => ({
  login: "ana.perez",
  nombreCompleto: "Ana Pérez",
  clave: "ABCDEFGH23456789",
  ...over,
});

const body = (csv: string) => csv.slice(1).split("\r\n");

describe("buildCredentialsCsv (IAP: Export accompanies the successful apply)", () => {
  it("starts with the UTF-8 BOM and a header row", () => {
    const csv = buildCredentialsCsv([cred()]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(body(csv)[0]).toBe("Login,NombreCompleto,Clave");
  });

  it("emits one row per credential and keeps accents", () => {
    const csv = buildCredentialsCsv([
      cred(),
      cred({ login: "luis", nombreCompleto: "Luis Ñandú", clave: "ZZZZ" }),
    ]);
    expect(body(csv)).toEqual([
      "Login,NombreCompleto,Clave",
      "ana.perez,Ana Pérez,ABCDEFGH23456789",
      "luis,Luis Ñandú,ZZZZ",
    ]);
  });

  it("emits only the header for an empty list", () => {
    expect(body(buildCredentialsCsv([]))).toEqual([
      "Login,NombreCompleto,Clave",
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
    expect(body(generated)[1]).toBe("ana.perez,Ana Pérez,K7MPQRST23456789");
    expect(csv).toContain("A-B");
  });
});
