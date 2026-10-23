import "server-only";

import { env } from "@/env";
import { createResendMailSender } from "@/lib/intake/adapters/resend-mail-sender";
import type { EscalationDispatchDeps } from "@/lib/data/escalation-dispatch";

// Wiring of the coordination notice (escalation, ES-10): the mail port and the
// origin of the link. It builds no document store, which a notice never needs,
// and asserts nothing at construction: an unset `APP_BASE_URL` or mail key
// leaves the notice `pendiente`, decided at send time by the plan and the
// adapter.

export function getEscalationDeps(): Pick<
  EscalationDispatchDeps,
  "mail" | "baseUrl"
> {
  return { mail: createResendMailSender(), baseUrl: env.APP_BASE_URL };
}
