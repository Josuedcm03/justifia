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

// Payload of the staff assign action (EA-SIB-1, EA-CHG-1, EA-CRE-1). It adds the
// optimistic check: the group the user saw and confirmed as replaced, or `null`
// when the page showed none. The key is REQUIRED (an absent value is not `null`),
// so a caller cannot opt out of the check by omitting it.
export const assignEnrollmentInputSchema = staffEnrollmentInputSchema.extend({
  expectedReplaced: z.number().int().positive().nullable(),
});

export type AssignEnrollmentInput = z.infer<typeof assignEnrollmentInputSchema>;
