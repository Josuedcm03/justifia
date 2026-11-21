import { z } from "zod";

// Payload of the /enrollment actions (student-enrollment SE-10). The group id is
// the only client input: the student identity comes from the session, so a
// forged `estudianteId` is stripped here rather than carried to the writer.
// `z.object` drops unknown keys by default.
export const enrollmentInputSchema = z.object({
  grupoId: z.number().int().positive(),
});

export type EnrollmentInput = z.infer<typeof enrollmentInputSchema>;

// Payload of the staff toggle action of /catalog/inscripciones (enrollment-
// administration EA-ACC-1, EA-SCOPE-1, CS-9). Both ids are client input (the
// student id travels as a bound argument, which is visible to the browser), so
// both are validated here and the writer re-checks them against the facultad
// scope. The actor and the scope come from the guard, never from the payload:
// `z.object` drops an extra `actorId` or `scope` instead of carrying it.
export const staffEnrollmentInputSchema = z.object({
  estudianteId: z.number().int().positive(),
  grupoId: z.number().int().positive(),
});

export type StaffEnrollmentInput = z.infer<typeof staffEnrollmentInputSchema>;
