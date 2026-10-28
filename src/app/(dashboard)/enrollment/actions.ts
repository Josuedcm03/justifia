"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/dal";
import { rolesSolicitantes } from "@/lib/auth/permissions";
import { dropGroup, enrollInGroup } from "@/lib/data/enrollment-write";
import type {
  DropResult,
  EnrollResult,
  EnrollmentActionResult,
} from "@/lib/enrollment/types";
import { enrollmentInputSchema } from "@/lib/validations/inscripcion";

// Server actions of /enrollment (student-enrollment SE-10, RNF-01). Every
// action re-checks the session and the student role itself (the page guard does
// not protect actions) and takes the student identity from the session only; the
// payload carries a group id and nothing else. The writer re-checks the role
// against the database and writes the audit rows in its own transaction.

const PATH = "/enrollment";

/** Run the writer for the session student. Role and session redirects are
 *  thrown by `requireRole` outside the `try`, so they are never swallowed. */
async function run<T extends EnrollResult | DropResult>(
  input: unknown,
  write: (estudianteId: number, grupoId: number) => Promise<T>,
): Promise<EnrollmentActionResult> {
  const session = await requireRole(...rolesSolicitantes);
  const parsed = enrollmentInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  let result: T;
  try {
    result = await write(Number(session.sub), parsed.data.grupoId);
  } catch {
    // The writer already logged one sanitised line; nothing was stored.
    return { ok: false, error: "unexpected" };
  }
  if (!result.ok) return { ok: false, error: result.reason };

  revalidatePath(PATH);
  return { ok: true };
}

export async function enrollAction(
  input: unknown,
): Promise<EnrollmentActionResult> {
  return run(input, enrollInGroup);
}

/** Confirmed drop (RNF-12): the confirmation dialog lives in the UI. */
export async function dropAction(
  input: unknown,
): Promise<EnrollmentActionResult> {
  return run(input, dropGroup);
}
