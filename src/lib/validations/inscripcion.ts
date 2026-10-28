import { z } from "zod";

// Payload of the /enrollment actions (student-enrollment SE-10). The group id is
// the only client input: the student identity comes from the session, so a
// forged `estudianteId` is stripped here rather than carried to the writer.
// `z.object` drops unknown keys by default.
export const enrollmentInputSchema = z.object({
  grupoId: z.number().int().positive(),
});

export type EnrollmentInput = z.infer<typeof enrollmentInputSchema>;
