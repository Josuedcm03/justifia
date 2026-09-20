import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Table-driven WCAG contrast proof for design.md decision 16 (revised).
// Pure, test-local OKLCH -> OKLab -> linear-sRGB (clamped) -> WCAG relative
// luminance chain; no dependency on a browser. Reads the executable tokens
// straight out of globals.css so the test fails the moment the document and
// the CSS disagree.

const CSS_PATH = path.resolve(process.cwd(), "src/app/globals.css");

type Block = ":root" | ".dark";

function readCssVar(css: string, name: string, block: Block): string {
  const blockRegExp =
    block === ":root" ? /:root\s*\{([^}]*)\}/ : /\.dark\s*\{([^}]*)\}/;
  const blockMatch = css.match(blockRegExp);
  if (!blockMatch) {
    throw new Error(`Block ${block} not found in globals.css`);
  }
  const varRegExp = new RegExp(`--${name}:\\s*([^;]+);`);
  const varMatch = blockMatch[1].match(varRegExp);
  if (!varMatch) {
    throw new Error(`Token --${name} is not defined in ${block}`);
  }
  return varMatch[1].trim();
}

function parseOklch(value: string): { l: number; c: number; h: number } {
  const match = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/);
  if (!match) {
    throw new Error(`Cannot parse an OKLCH triple out of "${value}"`);
  }
  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]) };
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

/** OKLCH -> OKLab -> linear sRGB, clamping out-of-gamut channels as a browser
 *  would (design.md, sixth verified finding). */
function oklchToLinearSrgb({ l, c, h }: { l: number; c: number; h: number }): {
  r: number;
  g: number;
  b: number;
} {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const bLab = c * Math.sin(hRad);

  const lPrime = l + 0.3963377774 * a + 0.2158037573 * bLab;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * bLab;
  const sPrime = l - 0.0894841775 * a - 1.291485548 * bLab;

  const lCubed = lPrime ** 3;
  const mCubed = mPrime ** 3;
  const sCubed = sPrime ** 3;

  const r =
    4.0767416621 * lCubed - 3.3077115913 * mCubed + 0.2309699292 * sCubed;
  const g =
    -1.2684380046 * lCubed + 2.6097574011 * mCubed - 0.3413193965 * sCubed;
  const b =
    -0.0041960863 * lCubed - 0.7034186147 * mCubed + 1.707614701 * sCubed;

  return { r: clamp01(r), g: clamp01(g), b: clamp01(b) };
}

/** The OKLab matrix above already yields linear-light channels, so the WCAG
 *  relative-luminance weights apply directly (no additional sRGB gamma
 *  decoding step). */
function relativeLuminance({
  r,
  g,
  b,
}: {
  r: number;
  g: number;
  b: number;
}): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function luminanceOfToken(css: string, name: string, block: Block): number {
  return relativeLuminance(
    oklchToLinearSrgb(parseOklch(readCssVar(css, name, block))),
  );
}

describe("denied accent contrast (design.md decision 16, revised)", () => {
  const css = fs.readFileSync(CSS_PATH, "utf8");

  it.each<Block>([":root", ".dark"])(
    "meets the non-text UI floor in %s: --denied icon on --background (>= 3.0:1)",
    (block) => {
      // The only red on the screen is the ShieldOff icon (text-denied) inside
      // a bg-denied/10 badge on the app background. As a non-text UI
      // component it must clear the WCAG 1.4.11 3:1 floor
      // (docs/design-system.md §7) in both themes.
      const ratio = contrastRatio(
        luminanceOfToken(css, "denied", block),
        luminanceOfToken(css, "background", block),
      );
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    },
  );

  it.each<Block>([":root", ".dark"])(
    "keeps --denied-foreground out of %s: the pair was reduced to one accent token",
    (block) => {
      expect(() => readCssVar(css, "denied-foreground", block)).toThrow(
        /not defined/,
      );
    },
  );
});
