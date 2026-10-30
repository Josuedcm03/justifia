import type {
  EscalationNoticeReason,
  EscalationNoticeState,
} from "@/lib/intake/escalation";

// Which of the four notification texts the staff screens show (RF-10 b,
// RNF-07). The stored state is the outbox state of the escalation or notice; a
// failed send keeps it `pendiente` with the reason `error_envio`, so the text
// tells the secretary that a retry is waiting.

export type NoticeStatusKey =
  "pendiente" | "pendienteFallido" | "enviada" | "bloqueada" | "respondida";

/**
 * `answered` is true when the escalation was answered: a notice not sent by
 * then is never sent (the dispatch skips it), whatever its stored state.
 */
export function noticeStatusKey(
  estado: EscalationNoticeState,
  motivo: EscalationNoticeReason | null,
  answered = false,
): NoticeStatusKey {
  if (estado === "enviada") return "enviada";
  if (answered) return "respondida";
  if (estado === "bloqueada") return "bloqueada";
  return motivo === "error_envio" ? "pendienteFallido" : "pendiente";
}
