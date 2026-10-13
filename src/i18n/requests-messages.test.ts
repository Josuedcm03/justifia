import { describe, expect, it } from "vitest";

import { RETURN_REASONS } from "@/lib/intake/return-reasons";
import { VISIBLE_STATES } from "@/lib/intake/states";

import en from "../../i18n/en.json";
import es from "../../i18n/es.json";

// RNF-11, RNF-12: every user-facing string of the student request screens
// exists in both locales, with the same keys and a non-empty message.

function leaves(value: unknown, prefix = ""): [string, unknown][] {
  if (typeof value !== "object" || value === null) return [[prefix, value]];
  return Object.entries(value).flatMap(([key, child]) =>
    leaves(child, prefix ? `${prefix}.${key}` : key),
  );
}

const catalogs = [
  ["es", es],
  ["en", en],
] as const;

describe("requests messages", () => {
  it("es.json and en.json hold exactly the same requests keys", () => {
    const esKeys = leaves(es.requests, "requests")
      .map(([key]) => key)
      .sort();
    const enKeys = leaves(en.requests, "requests")
      .map(([key]) => key)
      .sort();

    expect(esKeys.length).toBeGreaterThan(30);
    expect(enKeys).toEqual(esKeys);
  });

  it.each(catalogs)("%s has a non-empty text for every key", (_l, m) => {
    for (const [key, text] of leaves(m.requests, "requests")) {
      expect(typeof text, key).toBe("string");
      expect((text as string).trim().length, key).toBeGreaterThan(0);
    }
  });

  it("both catalogs name the sidebar entry", () => {
    expect(es.nav.myRequests).toBe("Mis solicitudes");
    expect(en.nav.myRequests).toBe("My requests");
  });

  it.each(catalogs)("%s labels every visible state", (_l, m) => {
    const states = m.requests.states as Record<string, string>;

    expect(VISIBLE_STATES.length).toBe(5);
    for (const state of VISIBLE_STATES)
      expect(states[state], state).toBeTruthy();
  });

  it.each(catalogs)("%s labels every RN-17 return reason", (_l, m) => {
    const reasons = m.requests.detail.reasons as Record<string, string>;

    expect(RETURN_REASONS.length).toBe(3);
    for (const reason of RETURN_REASONS) {
      expect(reasons[reason], reason).toBeTruthy();
    }
  });
});
