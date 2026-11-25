# Proposal: Flow Experience

## Intent

Roadmap row 13 (owner Armando). A.4 requires correcting the critical and
major validation findings from 16 to 22 Nov 2026 and verifying each with its
4.9 case (`tesis/05_validacion/5.8_ajustes_finales.md:3`). Table 19 lists six
(5.8:11-16) and 5.8:20 leaves three "sin definir"; plan P2
(`bitacora/plan_cierre_brechas_2026-11-16.md:95-112`) routes them here. The
2026-11-20 diagnosis (`bitacora/evidencia_p1_2026-11-18/p2/diagnostico-validacion-2026-11-20.md`)
settles the causes. The thesis is the source of truth; grounding in
`exploration.md`.

## Scope

### In Scope

| Item | Severity | Cause | IDs | Change |
|---|---|---|---|---|
| RF-16 (5.8:15) | Crítica | System | RF-16 (c), RF-10 (a); RN-16, RN-20, RN-08; RNF-10 | Answer banner at top of detail; conditional panel copy; earlier answer in escalate dialog; history pointer |
| RF-06 (5.8:14) | Crítica | Task design | RF-06 (a, b); RN-08; RNF-10 | Description "ordered by deadline"; "Vence primero" on row 1 |
| RF-10 (5.8:16) | Mayor | System | RF-10 (a, b); RN-20; RNF-10, RNF-12 | Note marked required; stale errors cleared; motive `otro` |
| RF-07 (5.8:11) | Mayor | Kit | RF-07 (c), RF-08 (b); RN-16, RN-17; RNF-01, RNF-11 | Labelled absence dates, subjects, decision reason on cards |
| RF-08 (5.8:12) | Mayor | Kit | RF-08 (a-c), RF-02; RN-03, RN-04; RNF-06, RNF-11, RNF-12 | Client-side preview; file names in resubmit dialog |
| RF-01 (5.8:13) | Mayor | Participant | RF-01 (a-c), RF-03 (a, b), RF-04 (a); RN-05, RN-22, RN-23; RNF-11 | Dates recap; future-start notice |
| UX-20 | - | - | RNF-01 | "Cambiar contraseña" link from `/profile` |
| UX-21 | - | - | RN-02, RNF-01 | Log in with CIF (students) or institutional email (all) |

Plus backlog entries UX-22 onward for the six items.

### Out of Scope

- UX-17, UX-18 (owner's staged edit in `C:\justifia`), all other UX entries
  (plan:165), the duplicate queue-view audit row, draft-on-visit rows.
- Thesis edits: listed for the thesis session, not done here.

## Decisions (owner, 2026-11-20)

- **D-scope**: as the table. UX-21 is its own late slice; flags Anexo E:3
  ("Todos ingresan con «Usuario» y «Contraseña»"). Staff have no CIF
  (`src/db/schema.ts:106`).
- **D-RF06**: description plus marker; 5.8 reports a defensive improvement with
  the task-design diagnosis; a T-S1 repeat is a second iteration (plan:108).
- **D-diagnosis**: RF-01, RF-07, RF-06 worded "defensive improvement +
  diagnosis"; RF-10, RF-16 are confirmed system causes.
- **D-motive**: keep `caso_especial`, add `otro`; its note is the description
  (`CK_Escalamiento_Kind` already requires a note). Changes RN-20
  (`docs/requirements.md:58`), migration `0016`, thesis 4.2:89 and 5.4:19.

## Proposed defaults (owner to confirm)

- A second escalation after an answer is allowed, with a soft notice.
- RF-08 preview is client-side (`URL.createObjectURL`): no
  `documento.descargado` row.
- RF-01: dates recap plus a non-blocking notice when start date > today.
- RF-07: decided cards show the decision reason.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `request-review`: queue order copy and marker; answer banner, panel copy, history.
- `coordination-escalation`: required note, error clearing, second-escalation notice, motive `otro`.
- `student-requests`: card content; resubmit dialog file names.
- `supporting-documents`: client-side preview, no server read.
- `justification-intake`: dates recap, future-start notice.
- `auth-entry-access`: CIF/email login; profile link.
- `staff-account-creation`, `imported-account-provisioning`, `users-listing`: "Usuario" hidden, `Login` derived.

## Approach

Tracker `feat/flow-experience`, Feature Branch Chain, about 400 lines each:

| Slice | Content | Est. lines | Gate |
|---|---|---|---|
| S1 | RF-16 | 150-220 | - |
| S2 | RF-06 | 80-120 | - |
| S3 | RF-10 copy and stale errors | 80-140 | - |
| S4 | RF-07 | 200-280 | - |
| S5 | RF-08 | 150-250 | - |
| S6 | RF-01 | 100-150 | - |
| S7 | UX-20 | 40-80 | - |
| S8 | `otro`: constants, `0016`, RN-20, i18n, coordination email | 200-300 | After #98 merges |
| S9 | UX-21 (may split 9a/9b); `Login` column kept, no migration | 250-400 | - |
| S10 | Evidence per 4.9 case, backlog, roadmap row 13, archive | 100-200 | Tracker merge gate |

`0016` drops and recreates `CK_Escalamiento_Tipo`, `CK_Escalamiento_Kind`,
`CK_Escalamiento_SinRespuesta` and `UX_Escalamiento_Abierto`
(`src/db/schema.ts:767-809`).

## Affected Areas

| Area | Impact |
|---|---|
| `src/app/(dashboard)/review/**`, `requests/**`, `profile`, `login`, `users` | Modified |
| `src/lib/data/student-requests.ts`, `src/lib/intake/escalation.ts`, auth | Modified |
| `drizzle/0016_*.sql`, `src/db/schema.ts` (S8) | New/Modified |
| `i18n/{es,en}.json`, `docs/requirements.md` (RN-20), backlog, roadmap | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| A.4 window ends 22 Nov | High | Crítica first; 5.8 dates late items |
| `0016`: no new column, so Drizzle INSERTs are unchanged and existing motives keep working; an `otro` insert fails `CK_Escalamiento_Tipo` (23514) and the index misses `otro` | Med | Widening is backward-compatible: owner yes for that exact command, applied before the tracker reaches main |
| Migration-number clash with catalog-schedule | Med | Second to merge renumbers |
| RN-20 conflict with #98 | Med | S8 after #98 |
| i18n conflicts with #105; parity tests | Med | Rebase JSON late |
| Auto-deploy from main | Med | `tasks.md` merge gate |
| UX-21: `Correo` nullable (`schema.ts:130`) locks out accounts without email | Med | Read-only count before S9; design decides fallback |
| Thesis drift (5.8, 4.2:89, 5.4:19, Anexo E:3, rec. 6 and 8) | High | Thesis-sync list in S10 |

## Rollback Plan

Revert slices in reverse order; UI slices carry no data. `0016` only widens
and may stay; narrowing needs no `otro` rows, a new migration and the owner's
yes. With `otro` rows, keep its label. UX-21 keeps `Login`, so reverting
restores "Usuario" login with no data loss.

## Dependencies

- #98 merged (S8); owner yes for `0016` in production; migration-number
  agreement.

## Success Criteria

Authority: 4.9:7 "Un requisito se aprueba cuando pasa cada inciso de su criterio".
- [ ] RF-16: case 4.9:28 passes; capture shows the banner with author and date.
- [ ] RF-06: Vitest 4.9:20 passes; row 1 carries "Vence primero".
- [ ] RF-10: case 4.9:24 passes; regression test: motive error clears; `otro` with empty note refused.
- [ ] RF-07: case 4.9:21 passes; cards show labelled dates and subjects; 360 px and no-signals tests green.
- [ ] RF-08: Vitest 4.9:22 passes; preview makes no document-route request.
- [ ] RF-01: case 4.9:15 passes; notice does not block submission.
- [ ] UX-20/UX-21: auth-entry-access tests; student logs in by CIF and email, staff by email.
- [ ] `npm test`, `npm run typecheck`, `npx eslint src` green.
