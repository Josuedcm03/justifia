import fs from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONSENT_VERSION } from "@/lib/intake/consent";

import enMessages from "../../../i18n/en.json";
import esMessages from "../../../i18n/es.json";

// RC-10, RNF-11: the public privacy notice. The page is a server component, so
// the test mocks only the locale source and keeps real ICU message formatting.

const { locale } = vi.hoisted(() => ({ locale: { current: "es" } }));

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  const catalogs: Record<string, unknown> = {};
  const { default: es } = await import("../../../i18n/es.json");
  const { default: en } = await import("../../../i18n/en.json");
  catalogs.es = es;
  catalogs.en = en;
  return {
    getTranslations: async (namespace: string) =>
      createTranslator({
        locale: locale.current,
        messages: catalogs[locale.current] as never,
        namespace: namespace as never,
      }),
  };
});

const CATALOGS = { es: esMessages, en: enMessages } as const;
const VIEWPORT = 360;
const SPACING_PX = 4;

/** Every text of the draft marker and of the nine items, in required order. */
function orderedTexts(l: "es" | "en"): string[] {
  const p = CATALOGS[l].privacy;
  return [
    p.draft,
    p.title,
    p.version.replace(/<\/?date>/g, "").replace("{version}", CONSENT_VERSION),
    p.controller.title,
    p.purpose.title,
    p.recipients.title,
    p.data.title,
    p.mandatory.title,
    p.rights.title,
    p.retention.title,
  ];
}

async function renderPage(l: "es" | "en") {
  locale.current = l;
  const { default: PrivacyPage } = await import("@/app/privacy/page");
  return render(await PrivacyPage());
}

function fixedWidths(root: ParentNode): number[] {
  return [...root.querySelectorAll("[class]")].flatMap((element) =>
    element.className
      .toString()
      .split(/\s+/)
      .flatMap((token) => {
        const arbitrary = /^(?:min-)?w-\[(\d+(?:\.\d+)?)px\]$/.exec(token);
        if (arbitrary) return [Number(arbitrary[1])];
        const scale = /^(?:min-)?w-(\d+)$/.exec(token);
        return scale ? [Number(scale[1]) * SPACING_PX] : [];
      })
      .filter((width) => width > VIEWPORT),
  );
}

beforeEach(() => {
  locale.current = "es";
});

describe.each(["es", "en"] as const)("privacy notice (%s)", (l) => {
  it("shows the draft marker first, then the nine items in order", async () => {
    const { container } = await renderPage(l);
    const text = container.textContent ?? "";

    const positions = orderedTexts(l).map((fragment) => {
      const at = text.indexOf(fragment);
      expect(at, `missing: ${fragment}`).toBeGreaterThanOrEqual(0);
      return at;
    });
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(positions[0]).toBe(0);
  });

  it("puts the marker before the title, as the first element of the notice", async () => {
    const { container } = await renderPage(l);
    const marker = container.querySelector('[role="note"]');
    expect(marker).toHaveTextContent(CATALOGS[l].privacy.draft);
    const article = marker?.parentElement;
    expect(article?.firstElementChild).toBe(marker);
  });

  it("states every required fact", async () => {
    const { container } = await renderPage(l);
    const p = CATALOGS[l].privacy;
    for (const fact of [
      p.controller.body,
      p.controller.contact,
      p.purpose.body,
      p.recipients.body,
      p.data.identity,
      p.data.request,
      p.data.documents,
      p.data.health,
      p.mandatory.body,
      p.rights.body,
      p.retention.body,
    ]) {
      expect(container.textContent).toContain(fact);
    }
  });

  it("shows the version as the date of CONSENT_VERSION", async () => {
    const { container } = await renderPage(l);
    const time = container.querySelector("time");
    expect(time).toHaveAttribute("datetime", CONSENT_VERSION);
    expect(time).toHaveTextContent(CONSENT_VERSION);
  });

  it("names the career coordination as a recipient, with a minimal email and in-system consultation", async () => {
    const { container } = await renderPage(l);
    const text = container.textContent ?? "";
    const recipients = CATALOGS[l].privacy.recipients.body;

    expect(text).toContain(recipients);
    expect(recipients).toMatch(
      l === "es"
        ? /coordinación de tu carrera/
        : /coordination of your career/,
    );
    expect(recipients).toMatch(
      l === "es" ? /aviso mínimo por correo/ : /minimal notification by email/,
    );
    expect(recipients).toMatch(
      l === "es" ? /dentro del sistema/ : /inside the system/,
    );
  });

  it("never names the mail provider", async () => {
    const { container } = await renderPage(l);
    expect(container.textContent?.length).toBeGreaterThan(500);
    expect(container.textContent).not.toMatch(/resend/i);
  });

  it("has no fixed width above 360 px and lets the article shrink", async () => {
    const { container } = await renderPage(l);
    expect(fixedWidths(container)).toEqual([]);
    const article = container.querySelector("article");
    expect(article).toHaveClass("w-full", "min-w-0");
  });

  it("reports no accessibility violation", async () => {
    const { container } = await renderPage(l);
    const results = await axe.run(container, {
      runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    expect(results.passes.length).toBeGreaterThan(0);
  });
});

describe("privacy notice contents", () => {
  it("agrees with the consent label on the career coordination as recipient", () => {
    expect(esMessages.intake.review.consent.label).toMatch(/coordinación/);
    expect(esMessages.privacy.recipients.body).toMatch(/coordinación/);
    expect(enMessages.intake.review.consent.label).toMatch(/coordination/);
    expect(enMessages.privacy.recipients.body).toMatch(/coordination/);
  });

  it("marks health data as sensitive", () => {
    expect(esMessages.privacy.data.health).toMatch(/sensibles/i);
    expect(enMessages.privacy.data.health).toMatch(/sensitive/i);
  });

  it("names the four rights and the secretary's office for revocation", () => {
    for (const right of [
      "acceso",
      "rectificación",
      "cancelación",
      "oposición",
    ]) {
      expect(esMessages.privacy.rights.body).toContain(right);
    }
    expect(esMessages.privacy.rights.body).toMatch(/secretaría/i);
    for (const right of [
      "access",
      "rectification",
      "cancellation",
      "opposition",
    ]) {
      expect(enMessages.privacy.rights.body).toContain(right);
    }
    expect(enMessages.privacy.rights.body).toMatch(/secretary/i);
  });

  it("states five years of retention, then cancellation", () => {
    expect(esMessages.privacy.retention.body).toMatch(/cinco años/);
    expect(esMessages.privacy.retention.body).toMatch(/cancel/);
    expect(enMessages.privacy.retention.body).toMatch(/five years/);
    expect(enMessages.privacy.retention.body).toMatch(/cancel/);
  });

  it("marks the contact office as a placeholder until the owner supplies it", () => {
    expect(esMessages.privacy.controller.contact).toBe(
      "[Domicilio y oficina de contacto de la UAM: por definir]",
    );
    expect(enMessages.privacy.controller.contact).toBe(
      "[UAM address and contact office: to be defined]",
    );
  });
});

describe("privacy page metadata and access", () => {
  it("exposes a title through generateMetadata", async () => {
    locale.current = "en";
    const { generateMetadata } = await import("@/app/privacy/page");
    const metadata = await generateMetadata();
    expect(String(metadata.title)).toContain(enMessages.privacy.title);
    expect(String(metadata.title)).toContain(enMessages.common.appName);
  });

  it("reads no session and no per-user data", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/privacy/page.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/@\/lib\/auth\/(dal|session|permissions)/);
    expect(source).not.toMatch(/@\/lib\/data/);
    expect(source).not.toMatch(/next\/headers/);
    expect(source).not.toMatch(/redirect\(|next\/navigation/);
  });

  it("sits outside the guarded route groups", () => {
    const file = path.resolve(process.cwd(), "src/app/privacy/page.tsx");
    expect(fs.existsSync(file)).toBe(true);
    expect(file).not.toMatch(/\((dashboard|auth)\)/);
  });
});
