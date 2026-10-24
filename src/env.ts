import { z } from "zod";

// An unset variable and an empty one (`KEY=` in a dotenv file) both mean
// "not configured".
const optionalSecret = (minLength: number) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(minLength).optional(),
  );

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  // Optional here so builds and tests need no store; the Blob adapter and the
  // cron route assert them at use (justification-intake D1, D10).
  BLOB_READ_WRITE_TOKEN: optionalSecret(1),
  CRON_SECRET: optionalSecret(16),
  // Teacher remission mail (teacher-remission TR-9). Optional so builds and
  // tests need no provider; the Resend adapter asserts both at send time and
  // a missing value leaves the remission `pendiente`.
  RESEND_API_KEY: optionalSecret(1),
  MAIL_FROM: optionalSecret(1),
  // Document extraction (document-extraction DE-12). Optional so builds and
  // tests need no model server; `resolveExtractionConfig` judges the address at
  // use, and an unset one means "not configured", never a boot failure.
  EXTRACTION_API_URL: optionalSecret(1),
  EXTRACTION_API_KEY: optionalSecret(16),
});

export const env = envSchema.parse(process.env);
