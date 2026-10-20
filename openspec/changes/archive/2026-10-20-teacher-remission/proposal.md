# Proposal: Teacher Remission

## Intent

Approved requests never reach teachers; nothing sends mail today. Deliver roadmap row 3: RF-09; RN-18, RN-19; RNF-07. Confirmed decisions D1-D8 (pre-proposal handoff, exploration `sdd/teacher-remission/explore`) are authoritative.

## Scope

### In Scope
- `MailSender` port; Resend adapter selected by env, optional secrets asserted at use (Blob pattern); fake for tests (D1).
- Outbox: `Remision` table, one row per teacher (dedupe `DocenteId`), created in the approval transaction with snapshot `DocenteId` + email (D2, D7).
- Send after commit; failure leaves row pending resend (RNF-07); idempotent guarded per-row claim; secretary "Reenviar" plus cron retry.
- Spanish constant message with RN-18 content; each teacher sees only their groups; student in CC (D8).
- Documents attached from `DocumentStore` with a total-size guard; over-limit stays pending with a reason code (D3).
- RN-19: secretary marks special-format case at approval and uploads the format signed and stamped by the coordinación de carrera (at approval or later); missing format blocks rows, approval stands (RF-09 b, D4, revised after interview E-02 05:33). The prefilled printable template is out of scope (roadmap #12 `printable-forms`).
- Teacher without `Correo`: row blocked with visible reason; fix catalog, then resend (D6).
- Per-row `EnviadaEn` (RF-09 c) and code-only, leak-tested audit events (D5).
- Review detail: per-teacher send state, time, reason, resend; i18n es/en.

### Out of Scope
- `document-extraction`, `validation-signals` (RF-14 d document type), `escalation`, `request-consent`, `secretary-templates`, `catalog-schedule`; signed links; SMTP/Graph adapters.

## Capabilities

### New Capabilities
- `teacher-remission`: outbox, send, retry/resend, RN-18 message, RN-19 gate, size guard, send time.

### Modified Capabilities
- `request-review`: approval creates remission rows, special-format mark and staff upload of the signed format, remission state and resend on detail.
- `audit-log`: remission created/sent/failed/blocked/resent events.

## Approach

Hexagonal. Pure builders (recipients, message, size guard) in `src/lib/`; `MailSender` beside `DocumentStore` in `ports.ts`/`deps.ts`/`fakes.ts`. Rows inserted inside `decideRequest`'s transaction; dispatch after commit (`after()`, read Next 16 docs first) via a guarded per-row claim (`UPDATE ... WHERE` pending/unclaimed `RETURNING`). Cron route reuses `CRON_SECRET`. Strict TDD.

## Affected Areas

| Area | Impact |
|------|--------|
| `src/db/schema.ts`, `drizzle/0009_*` | Modified/New |
| `src/lib/data/solicitud-decision.ts`, `review/[id]/actions.ts` | Modified |
| `src/lib/intake/ports.ts`, `deps.ts`, `fakes.ts`, `src/env.ts` | Modified |
| `src/lib/audit/types.ts`, `events.ts` | Modified |
| new `src/app/api/cron/remission-retry`, `vercel.json` | New/Modified |
| review detail page, `i18n/{es,en}.json`, `docs/roadmap.md` | Modified |

**DB schema: YES** (migration 0009). It MUST NOT be applied to Neon without explicit per-command user confirmation.

Delivery: single PR, budget 2000 lines.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Sender domain DNS depends on UAM IT | High | Port + fake; rows stay pending until configured |
| Double send on retry | Med | Guarded per-row claim, concurrency test |
| 50 MiB worst case vs provider limit | Med | Size guard, reason code |
| Documents/PII leave system (RNF-02/04) | Med | TLS provider; codes-only audit |
| RN-19 overlaps RF-14 d | Med | Minimal flag; note for `validation-signals` |
| Cron frequency limited by Vercel plan | Low | Manual resend |

## Rollback Plan

Revert the PR; remove the cron entry. If 0009 was applied, a confirmed down-migration drops `Remision` and the special-format column; approvals and requests are untouched.

## Dependencies

- `secretary-review` archived. Resend account and UAM IT DNS for the sender domain.

## Success Criteria

- [ ] Approval creates one row per teacher; each teacher gets their groups, RN-18 text, documents, student CC.
- [ ] Mail outage keeps approval; rows pending resend (RNF-07).
- [ ] RN-19 case without format is not sent.
- [ ] `EnviadaEn` recorded; no row sent twice under concurrent retry.
