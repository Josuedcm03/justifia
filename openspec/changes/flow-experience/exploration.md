# Exploration: flow-experience (roadmap row 13)

Read-only. Code read at `C:\justifia-worktrees\p1` (main `8a3f270`). Source of
truth: the thesis at `C:\thesis-workspace`. Built from the Engram exploration
`sdd/flow-experience/explore` (2026-11-20) plus the read-only validation-data
diagnosis of the same day
(`bitacora/evidencia_p1_2026-11-18/p2/diagnostico-validacion-2026-11-20.md`,
cited below as "diagnosis"). Section 9 records what changed after the
diagnosis and the owner decisions.

## 1. Current state

- The thesis lists six Table 19 adjustments (`tesis/05_validacion/5.8_ajustes_finales.md:11-16`).
  The plan routes them to `flow-experience` (`bitacora/plan_cierre_brechas_2026-11-16.md:95-112`)
  and puts P2.1 to P2.7 in the minimum cut (plan:189). A.4 window: 16 to 22
  Nov 2026 (5.8:3). Today is 2026-11-20.
- 5.8:20 says the three "sin definir" rows fall outside the A.4 deadline
  because their cause was not diagnosed. The diagnosis now settles them.
- Main already contains things the thesis still calls pending: the secretary
  queue search on the pending tab (`43bbfeb`, `review/page.tsx:150-151`), the
  in-detail viewer (UX-16, `review/[id]/document-row.tsx`), the status note for
  non-pending requests (UX-05, `review/[id]/page.tsx:371-376`) and manual
  document data (RF-14, row 18). Recommendation 6 ("agregar un buscador a la
  bandeja", `tesis/06_conclusiones/recomendaciones.md:9`) is stale for the
  pending tab; UX-14 (approved tab) stays open.
- The six Table 19 fixes need no schema change. The owner's motive decision
  (D-motive, section 9) adds one migration, `0016`.
- Only RF-10 (stale validation error) and RF-16 (buried answer) are confirmed
  system-side causes in the code. RF-01, RF-07 and RF-06 are attributed mainly
  to the participant, the kit or the task design (diagnosis, section 9).

## 2. Item by item

### P2.1 RF-07: two students opened another request (row 1, Mayor)

- Finding: 5.8:11 "Dos consultaron otra solicitud ... Sin definir: analizar por
  qué la lista no las distingue (RF-07)"; plan:101. Evidence H1:
  `bitacora/analisis_estudiantes_2026-11-02.md:44, 54`; Anexo G G13 row 1
  (`anexos/anexo_g_resultados_validacion.md:201`); kit wording
  `anexos/instrumentos/anexo_a8_kit_formulario_estudiante.md:49`.
- Screens and files: `/requests` list: `src/app/(dashboard)/requests/page.tsx`,
  `request-card.tsx:19-39`, `state-pill.tsx`, `use-request-dates.ts:22-25`;
  data `src/lib/data/student-requests.ts:30-38, 60-81` (no subjects; ordered by
  `presentadaEn` desc); i18n `requests.list`, `requests.states`
  (`i18n/es.json:823-843`). Spec `student-requests`.
- Diagnosis (medium confidence): the cards can be told apart (number, state
  pill, cause, absence date with month name); the target is always the bottom
  card, and for P-07 every cause was the same. The kit says "una solicitud"
  while each account was seeded with two earlier requests, and it asks for a
  "motivo", which only the returned request prints. Cause: mainly the kit.
- Defensive fix: label the absence line ("Fechas de ausencia"), add subject
  codes per card (batched `listRequestClasses`, as in `revision-queue.ts:93-96`),
  show the decision reason on decided cards (proposed default). Keep
  newest-first order. `no-signals.test.ts` and the 360 px test stay green.
- IDs: RF-07 (c), RF-08 (b), RN-16, RN-17; RNF-01, RNF-10, RNF-11.
- Size: about 200-280 lines.

### P2.2 RF-08: a student resubmitted a file that was not theirs (row 2, Mayor)

- Finding: 5.8:12 "Mostrar el nombre o la vista previa del archivo (RF-08)";
  plan:102. Evidence H3: `analisis_estudiantes_2026-11-02.md:46, 58`; G13 row 3
  (`anexo_g:203`); kit file naming A.8:34, 47-52; 5.9:3 ("tres hallaron
  confusas las constancias simuladas").
- Screens and files: `/requests/[id]/correct`: `correct/page.tsx:65-71,
  123-136`; `new/documents-step.tsx:101-133, 185-222`;
  `new/review-step.tsx:223-259`; `new/resubmit-dialog.tsx:19-32` (no file
  name); `src/app/api/intake/documents/[id]/route.ts:88-98` (every GET writes
  `documento.descargado`, RNF-06).
- Root cause (medium): the file name is already shown in steps 3 and 4; what is
  missing is a content check without opening a new tab. A server preview would
  write one audit row per view.
- Fix: client-side preview with `URL.createObjectURL(file)` (image or PDF), no
  server read and no audit row (proposed default); attached file names, with
  "Nuevo" and "Anterior" marks, repeated in the resubmit dialog.
- IDs: RF-08 (a-c), RF-02, RN-03, RN-04; RNF-06, RNF-11, RNF-12.
- Size: about 150-250 lines.

### P2.3 RF-01: a student registered someone else's dates and subjects (row 3, Mayor)

- Finding: 5.8:13; plan:103. Evidence H2: `analisis_estudiantes_2026-11-02.md:45,
  50, 65`; 5.6:5; G13 row 2 (`anexo_g:202`); T2 instruction A.8:48.
- Screens and files: `new/cause-dates-step.tsx:113-142` (two native date
  inputs, no recap), `new/subjects-step.tsx:85-91, 159-177`,
  `new/flow-steps.tsx:53-63`, `new/review-step.tsx:156-176`,
  `src/lib/validations/solicitud.ts:37-69` (RN-05, RN-23 only).
- Diagnosis (high confidence, no UI or locale defect): request 29 was opened,
  filled and presented in 48 s, with no id gaps and no other draft; the
  subjects offered are exactly those meeting 1-3 Nov (RN-22); no dd/mm swap can
  turn 29/30 Oct into 1/3 Nov. The start date was the session day. The system
  accepts future absence dates by design: a design gap, not a defect.
- Defensive fix: a dates recap with weekdays at the top of step 2 and in the
  step 3 hint, with an "Editar fechas" link; a non-blocking notice when the
  start date is after today (proposed default).
- IDs: RF-01 (a-c), RF-03 (a, b), RF-04 (a); RN-05, RN-22, RN-23; RNF-11.
- Size: about 100-150 lines.

### P2.4 RF-06: the secretary did not name the priority request in T-S1 (row 4, Crítica)

- Finding: 5.8:14; plan:104. Evidence: `anexo_g:25`;
  `bitacora/resultados_sesion_p11.md:36, 44, 192, 193`; 5.6:7; 5.4:17; rule
  A.6:50.
- Screens and files: `/review` pending tab: `review/page.tsx:93-104, 153-210`,
  `review-queue-table.tsx:47-86`, `deadline-badge.tsx`, `queue-parts.tsx`;
  order `src/lib/data/revision-queue.ts:33-35, 80`; i18n description
  `es.json:1066-1068` ("de la más antigua a la más reciente").
- Diagnosis (high confidence): the queue applied RF-06 correctly. Row 1 was
  request 4, a T-S10 seed outside the five named requests, with the same
  deadline (Wed 11) and status (Vencida) as the expected answer at row 2. She
  opened row 1. Cause: the task design.
- Defensive fix: the description says the order is by deadline; a "Vence
  primero" marker on row 1 (cards and table). A repeat of T-S1 becomes trivial
  and is reported as a second iteration.
- IDs: RF-06 (a, b); RN-08; RNF-10.
- Size: about 80-120 lines.

### P2.5 RF-16: the secretary re-escalated something already answered in T-S11 (row 5, Crítica)

- Finding: 5.8:15; plan:105. Evidence: `resultados_sesion_p11.md:42, 46, 114,
  137`; Anexo G G6 row 3 and G7 (`anexo_g:98, 111`); 5.6:7 ("T-S11 no admite
  esa lectura").
- Screens and files: `/review/[id]`: `review/[id]/page.tsx` (escalation section
  at line 296, history at 345, decision panel at 350-370),
  `escalation-section.tsx:160-178`, `request-sections.tsx`,
  `escalate-dialog.tsx`; i18n `es.json:1152-1164, 1388-1389, 1401-1403`; data
  `src/lib/data/escalation-answer.ts:96-136`.
- Root cause (high, confirmed in code): after the answer the request is plainly
  "Pendiente"; the answer is a modest callout in section 2 while the decision
  panel is at the bottom; the panel still says "use «Escalar a coordinación»";
  the escalate dialog never mentions the earlier answer; the history omits
  escalations.
- Fix: a banner at the top of the detail quoting the answer with author and
  date; conditional decision-panel copy; the earlier answer as a soft notice in
  the escalate dialog (a second escalation stays allowed, proposed default);
  a history pointer for escalations.
- IDs: RF-16 (c), RF-10 (a); RN-16, RN-20, RN-08; RNF-10.
- Size: about 150-220 lines.

### P2.6 RF-10: two helps in T-S3 (row 6, Mayor)

- Finding: 5.8:16; plan:106. Evidence: `resultados_sesion_p11.md:38, 55, 139,
  141`; G6 row 4 and G7 row 3 (`anexo_g:99, 112`); 5.4:19 ("los motivos
  cerrados no cubrieron sus razones").
- Screens and files: `review/[id]/escalate-dialog.tsx:46-127`,
  `review/[id]/dialog-parts.tsx:77-99, 193-236`; i18n `es.json:1165-1190`.
- Root cause (high, confirmed in code): the note is required but the dialog
  does not say so; `fieldMessages` derives from the last `failure` and
  `onValueChange` never clears it, so "Seleccione el motivo del escalamiento."
  stays visible after a motive is chosen. The closed motive list (sospecha,
  caso especial) did not cover her reason; she asked for "Otro".
- Fix: "Nota para coordinación (obligatoria)" with an example hint; clear field
  messages on change. The "Otro" motive follows D-motive (section 9).
- IDs: RF-10 (a, b); RN-20; RNF-10, RNF-12.
- Size: about 80-140 lines.

## 3. Backlog items added on the tracker

- UX-20 (`docs/flow-experience-backlog.md:244-259`): "Cambiar contraseña" link
  from `/profile` and the user menu. RNF-01; spec `auth-entry-access`. Small
  (about 40-80 lines).
- UX-21 (`docs/flow-experience-backlog.md:261-277`): log in with CIF or
  institutional email instead of "Usuario". RN-02, RNF-01; specs
  `auth-entry-access`, `user-roles`, `users-listing`. `Usuario.Cif` is students
  only and `Usuario.Correo` is nullable (`src/db/schema.ts:106, 130, 132`).
  Affects thesis Anexo E line 3 (`anexos/anexo_e_manual_usuario.md:3`).
- UX-17 and UX-18 exist only as the owner's staged edit in `C:\justifia`. They
  are out of scope and are not touched.
- The exploration's provisional numbers UX-20 to UX-25 for the six Table 19
  items are superseded: UX-20 and UX-21 are taken, so new entries start at
  UX-22.

## 4. Approaches

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| A. One change, chained slices, Table 19 plus UX-20/UX-21 (chosen, D-scope) | Matches the plan; one slice per Table 19 row and 4.9 case; small reviews | Several i18n edits; one migration | Medium |
| B. Whole backlog UX-01 to UX-21 | Single sweep | Conflicts with plan P5 (plan:165); breaks the budget | High |
| C. Protocol-only for RF-01, RF-06, RF-08 | Smallest diff | Leaves rows with no adjustment | Low-medium |
| D. Only RF-10 and RF-16 | Fits two days | Leaves Mayor rows open | Low |

## 5. Overlap with open PRs

- Catalog-schedule stack #99 <- #100 <- #101 <- #103 <- #105 <- #108: no code
  overlap with `requests`, `review`, `student-requests.ts`, `revision-queue.ts`
  or escalation files. #105 edits `i18n/es.json` and `i18n/en.json` (catalog
  namespace): textual conflict only if hunks are adjacent. None has a migration
  today.
- #98 (docs/thesis-sync-p3-2) edits `docs/requirements.md`, RN-20 among others.
  Any RN-20 edit waits until #98 merges.
- `docs/roadmap.md` and `docs/flow-experience-backlog.md` are in none of them.

## 6. Risks

- A.4 window closes on 22 Nov; Crítica rows go first.
- Attribution in the thesis: three rows are mainly kit or task design.
- Main auto-deploys to production: merge gate in `tasks.md`.
- i18n parity and conflicts with #105.
- Audit side effects (RNF-06) if previews read the server.

## 7. Other observations from the diagnosis (not in scope)

- Draft rows are created on visiting `/requests/new`, so "unfinished drafts"
  are empty rows, not abandoned attempts.
- A queue view was logged twice in the same second (`cache()` de-duplicates
  only within one render): inflates audit counts only.

## 8. Ready for proposal

Yes, with the owner decisions of section 9.

## 9. Addendum 2026-11-20: diagnosis and owner decisions

- Diagnosis conclusions: RF-01/H2 participant under the unmoderated protocol,
  high confidence; RF-07/H1 mainly the kit, medium; RF-06/T-S1 task design,
  high. Future absence dates are accepted by design (gap). Duplicate queue-view
  audit rows (minor).
- D-scope: the six Table 19 items plus UX-20 and UX-21; UX-21 in its own late
  slice.
- D-RF06: description plus "Vence primero" on row 1; reported as a defensive
  improvement; any repeat of T-S1 is a second iteration.
- D-diagnosis: 5.8 words RF-01, RF-07 and RF-06 as "defensive improvement +
  diagnosis"; RF-10 and RF-16 as confirmed system causes.
- D-motive: keep `caso_especial`, add `otro`. Code facts:
  `ESCALATION_KINDS`/`ESCALATION_REASONS` (`src/lib/intake/escalation.ts:15-31`)
  render `CK_Escalamiento_Tipo`, `CK_Escalamiento_Kind`,
  `CK_Escalamiento_SinRespuesta` and the partial unique index
  `UX_Escalamiento_Abierto` (`src/db/schema.ts:767-809`; literal lists in
  `drizzle/0012_escalation.sql:21-24, 54`). `CK_Escalamiento_Kind` already
  requires a non-empty note for every escalation reason. Latest migration is
  `0015_manual_document_data.sql`, so the new one is `0016`. `RN-20` reads
  differently in `docs/requirements.md:58` (includes caso especial) and in the
  thesis `tesis/04_propuesta/4.2_requisitos.md:89` (sospecha only).
