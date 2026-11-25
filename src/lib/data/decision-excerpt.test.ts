import { describe, expect, it } from "vitest";

import { DECISION_EXCERPT_MAX, decisionExcerpt } from "./decision-excerpt";

// FE-15 (RF-07 c, RN-17): the card of a returned or rejected request carries an
// excerpt of the decision text, cut on the server so the full text never
// reaches the list. At most 140 characters, an ellipsis when it cut.

const ELLIPSIS = "…";

describe("decisionExcerpt (FE-15)", () => {
  it("keeps 140 characters as the limit", () => {
    expect(DECISION_EXCERPT_MAX).toBe(140);
  });

  it("cuts 200 characters to the first 140 and appends an ellipsis", () => {
    const text = `${"a".repeat(140)}${"b".repeat(60)}`;

    expect(decisionExcerpt(text)).toBe(`${"a".repeat(140)}${ELLIPSIS}`);
  });

  it("returns exactly 140 characters whole, with no ellipsis", () => {
    const text = "c".repeat(140);

    expect(decisionExcerpt(text)).toBe(text);
  });

  it("cuts at 141 characters, the first length over the limit", () => {
    expect(decisionExcerpt("d".repeat(141))).toBe(
      `${"d".repeat(140)}${ELLIPSIS}`,
    );
  });

  it("returns 60 characters whole", () => {
    const text = "Adjunte una copia legible de la constancia medica con sello.";

    expect(text).toHaveLength(60);
    expect(decisionExcerpt(text)).toBe(text);
  });

  it.each([null, undefined, "", " ", "   \n\t  "])(
    "gives null for %j",
    (text) => {
      expect(decisionExcerpt(text)).toBeNull();
    },
  );

  it("trims the whitespace around the text before measuring it", () => {
    expect(decisionExcerpt(`  ${"e".repeat(140)}  `)).toBe("e".repeat(140));
  });

  it("trims trailing whitespace before the ellipsis", () => {
    const text = `${"f".repeat(139)} ${"g".repeat(30)}`;

    expect(decisionExcerpt(text)).toBe(`${"f".repeat(139)}${ELLIPSIS}`);
  });

  it("never splits a surrogate pair at the cut", () => {
    const text = `${"h".repeat(139)}\u{1F600}${"i".repeat(20)}`;

    const excerpt = decisionExcerpt(text);

    expect(excerpt).toBe(`${"h".repeat(139)}\u{1F600}${ELLIPSIS}`);
    expect(Array.from(excerpt ?? "")).toHaveLength(141);
    expect(excerpt).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it("counts a surrogate pair as one character when it sits inside the limit", () => {
    const text = "\u{1F600}".repeat(140);

    expect(decisionExcerpt(text)).toBe(text);
  });
});
