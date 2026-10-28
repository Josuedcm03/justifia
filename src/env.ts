import { z } from "zod";

// An unset variable and an empty one (`KEY=` in a dotenv file) both mean
// "not configured".
const unsetWhenEmpty = (value: unknown) => (value === "" ? undefined : value);

const optionalSecret = (minLength: number) =>
  z.preprocess(unsetWhenEmpty, z.string().min(minLength).optional());

// The base of the link in a coordination notice: an http(s) URL the path is
// appended to, so a query or a fragment would end up in the middle of it.
const baseUrl = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "must be an http or https URL",
  })
  .refine((value) => !/[?#]/.test(value), {
    message: "must not carry a query or a fragment",
  });

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
  // Absolute origin of the app for the link in the coordination notice
  // (escalation ES-10). No platform-URL fallback: a preview host would be the
  // wrong one. Unset leaves the notice `pendiente` (`not_configured`).
  APP_BASE_URL: z.preprocess(unsetWhenEmpty, baseUrl.optional()),
});

export const env = envSchema.parse(process.env);
