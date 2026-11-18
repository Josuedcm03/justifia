import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// One tree walker for every access check (design D8). The ratchet reads the
// tree through it; the matrix table is later compared against the same list.

export const APP_ROOT = fileURLToPath(new URL("../../app", import.meta.url));

const ENTRY_FILE = /^(page\.tsx|route\.ts)$/;
const SOURCE_FILE = /\.tsx?$/;
const TEST_FILE = /\.test\.tsx?$/;
const USE_SERVER = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*["']use server["']/;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function isServerActionsFile(path: string): boolean {
  return USE_SERVER.test(readFileSync(path, "utf8").replace(/^﻿/, ""));
}

/**
 * Entry points under `src/app`, as posix paths relative to it: every
 * `page.tsx` and `route.ts`, plus every file whose first statement is
 * `"use server"`. Sorted, so a failure message is stable.
 */
export function listAppEntries(): string[] {
  return walk(APP_ROOT)
    .filter((path) => SOURCE_FILE.test(path) && !TEST_FILE.test(path))
    .filter(
      (path) =>
        ENTRY_FILE.test(path.split(sep).at(-1) ?? "") ||
        isServerActionsFile(path),
    )
    .map((path) => relative(APP_ROOT, path).split(sep).join("/"))
    .sort();
}

/**
 * Entry points that are public on purpose: no session guard, each with the
 * reason. An entry without a reason, or one that matches no file, fails the
 * ratchet (RAC-3).
 */
export const PUBLIC_ENTRY_POINTS: Record<string, string> = {
  "(auth)/login/page.tsx":
    "Sign-in screen; signed-in users are redirected away instead of denied.",
  "(auth)/register/page.tsx":
    "Self-registration screen, open until roadmap 0.6 closes it.",
  "denied/page.tsx": "Target of every role denial; it must stay reachable.",
  "privacy/page.tsx": "Public privacy notice.",
  "(auth)/login/actions.ts":
    "Sign-in and sign-out actions; they authenticate, so no guard applies.",
  "(auth)/register/actions.ts":
    "Self-registration action, open until roadmap 0.6 closes it.",
};
