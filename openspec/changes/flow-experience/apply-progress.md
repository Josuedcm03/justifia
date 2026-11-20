# Apply progress: flow-experience

## Phase 0: Planning and decisions

Mode: Strict TDD (vitest). Delivery: Feature Branch Chain, twelve slices on the tracker "feat/flow-experience". Size exception: none requested; the stop line is 460 changed lines per PR excluding "openspec/", ".engram/" and "drizzle/meta/0016_snapshot.json".

### 0.1 Owner resolutions (2026-11-20, Managua, all final)

1. **Copy register.** Each screen keeps its existing register. "Tú": student screens (namespaces "requests", "intake", the register page) and admin screens ("users", "catalog"). "Usted": staff screens ("review", "coordination") and the sign-in page. A new Spanish line never mixes registers on its screen. This overrides the design's blanket "usted". Labels with no verb are neutral.
2. **Old-login fallback.** It ships in S9a only for accounts that would otherwise be locked out (no email) and is removed once the read-only count of such accounts is zero.
3. **Decided-card reason.** At most 140 characters in up to 2 lines.
4. **RF-08 preview.** It covers files attached during the current visit to step 3; older files keep the audited "Ver".
5. **CIF.** Students' CIF is digits only (last two digits of the enrollment year, then digits; the owner's has 8). Staff have another unknown CIF format that is not stored today. Login rule: an identifier containing "@" is an email (trimmed, case-insensitive); otherwise it is a CIF (trimmed, spaces and hyphens stripped, exact match against the stored CIF, 20-character limit). No hard-coded 8-digit format.
6. **UX-22 "Mantener la sesión iniciada".** 30 days when checked, 8 h unchecked; logout ends both.
7. **Backlog numbering.** The six Table 19 backlog entries are UX-23 to UX-28.

### Copy-register map (resolution 1)

| Screen or namespace                     | Register |
| --------------------------------------- | -------- |
| "review" (staff detail, queue, dialogs) | usted    |
| "coordination"                          | usted    |
| sign-in page                            | usted    |
| "requests", "intake", register page     | tú       |
| "users", "catalog" (admin)              | tú       |
| Labels with no verb                     | neutral  |

### Migration plan

- Migration 0016, "drizzle/0016_escalation_otro.sql", belongs to S8 only (the motive "otro"); it only widens four existing constraints. S1 to S7 and S9 carry no schema change.
- Generation is local, "npx drizzle-kit generate --name escalation_otro", which opens no database connection. Applying it to production is owner-run, after an explicit "yes" for that exact command (task 8.25).
- Whoever merges second renumbers: if catalog-schedule takes 0016 first (task 8.0), S8 regenerates as the next number.

### 0.2 Coordination (2026-11-20)

- (a) **Migration number: 0016 is free.** "git fetch origin" then the file list of "origin/main" (8a3f270): the last file is "drizzle/0015_manual_document_data.sql"; no "0016" file exists. catalog-schedule has no migration today.
- (b) **PR states, "gh pr view", 2026-11-20:**
  - #98 "docs: sync requirements with the thesis and close catalog-management open tasks" (base "main"): **OPEN**, not merged. Gate: it must merge before S8 (task 8.0).
  - #105 "feat(catalog-schedule): add the inscripciones list table and copy (S1c-1)" (base "feat/catalog-schedule-s1b2-list-read"): **OPEN**, not merged. If it merges, the JSON is rebased last and the parity tests must be green.
  - Neither blocks S1 to S7.

### 0.3 Baseline on the tracker (2026-11-20)

- The tracker "feat/flow-experience" already exists and is pushed (owner-created, on top of main 8a3f270), so "git switch -c" was not re-run.
- "$env:DATABASE_URL='postgres://u:p@127.0.0.1:9/x'; npm test -- src/lib/data src/lib/signals src/db src/lib/audit src/lib/auth src/app src/i18n": **242 files, 6461 tests, all passed**, 166.6 s vitest duration (2 m 49 s wall).

### 0.4 Spec and design edits hold (2026-11-20)

- "rg -n 'FE-32' specs/auth-entry-access/spec.md": the requirement heading at line 333.
- "rg -n 'removing spaces and hyphens' specs/auth-entry-access/spec.md": line 148 (FE-22).
- "rg -n 'UX-22 addendum' design.md": exactly one heading (line 385).

### 0.5 Planning commits (already on the tracker; nothing re-committed)

"git log --oneline origin/main..HEAD" at the tracker tip 42f7c93 (oldest first):

| Hash    | Message                                                                       |
| ------- | ----------------------------------------------------------------------------- |
| 1e5f5f7 | docs(backlog): add UX-20 change-password link and UX-21 login by CIF or email |
| 963cfe2 | docs(backlog): name the existing specs in UX-20 and UX-21                     |
| b4ad8a3 | docs(flow-experience): add exploration and proposal                           |
| c7e900a | docs(flow-experience): add delta specs                                        |
| 623eee2 | docs(flow-experience): add technical design                                   |
| 1c2cfd1 | docs(backlog): add UX-22 keep me signed in                                    |
| 42f7c93 | docs(flow-experience): add tasks, FE-32 and the UX-22 design addendum         |

The tracker is pushed ("git ls-remote" shows "refs/heads/feat/flow-experience" at 42f7c93). The staged UX-17 and UX-18 edit in "C:<BS>justifia" is not touched, so the numbering gap (UX-17, UX-18) stays until the owner lands it.

## Phase 1 (PR 1): S1 RF-16, the answer at the top

Mode: Strict TDD. Date: 2026-11-20. Slice branch "feat/flow-experience-1-answer-banner" from the tracker tip 42f7c93 (task 1.0). Units 1 and 2 are on it; unit 3 is on "feat/flow-experience-1b-escalate-dialog-pointer", cut from it at the unit boundary because the slice went over the stop line (see "Checkpoint"). Nothing was pushed and PR 1 was NOT opened: the owner decides how the over-size slice ships (task 1.13 is open).

### Owner decision on slice size (2026-11-20)

Owner decision 2026-11-20: size exception for the whole flow-experience change; each slice is cut at its natural unit boundary into one or two PRs and its size recorded, without stopping.

Result for S1: PRs 109 (1a, 554 lines) and 110 (1b, 440 lines) were opened 2026-11-20 under this exception (task 1.13). PR 109 targets the tracker "feat/flow-experience"; PR 110 targets "feat/flow-experience-1-answer-banner". The "Nothing was pushed" sentence above describes the state before that decision.

### Commits

| Unit     | Hash    | Branch                        | Message                                                                                           |
| -------- | ------- | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| 0 (docs) | a1e9eb8 | "-1-answer-banner"            | docs(flow-experience): record the owner resolutions and the Phase 0 baseline                      |
| 1        | 3029bff | "-1-answer-banner"            | feat(review): add the coordination answer banner                                                  |
| 2        | 3daa9d9 | "-1-answer-banner"            | feat(review): show the answer at the top of the staff detail                                      |
| 3        | 8fe35d0 | "-1b-escalate-dialog-pointer" | feat(review): show the earlier answer in the escalate dialog and point the history to escalations |

The docs commit of Phase 1 (this file and the task marks) is on the tip of "-1b-escalate-dialog-pointer".

### TDD cycle evidence

| Task                         | Test file                                                                                                                                                                                 | Layer              | Safety net                                       | RED                                                                         | GREEN                                                       | Triangulation                                                                                                                                                                                                           | Refactor    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1.1 and 1.2                  | `src/app/(dashboard)/review/[id]/answer-banner.test.tsx`, `src/i18n/review-messages.test.ts`                                                                                              | Unit and component | N/A (new file); 84 review-messages cases passing | Module missing (file failed to load); 6 i18n cases failed                   | 2 files, 104 passed                                         | 7 latestAnswer cases (none, unanswered only, half an answer, one, two, answered then open, a notice is never the answer) and 7 banner cases (en, es, next-day UTC instant in Managua, 1000 characters, link, no action) | None needed |
| 1.4 and 1.5                  | `src/app/(dashboard)/review/[id]/page.test.tsx`, `src/i18n/review-messages.test.ts`                                                                                                       | Component (page)   | 132 page cases passing before the change         | 7 page cases and 2 i18n cases failed first                                  | Review directory and review-messages: 30 files, 1012 passed | Banner table of 6 states, later of two answers, document order, today's copy in 2 situations, four decisions unchanged, one audit read                                                                                  | None needed |
| 1.4 (layout and design pins) | `src/app/(dashboard)/review/layout-360.test.tsx`, `src/app/(dashboard)/review/design-system.test.tsx`                                                                                     | Component          | Existing suites green                            | Pass at write (the banner module existed from unit 1); mutation check below | Pass                                                        | Banner: no width above 360 px, axe es and en, long answer wraps, card tokens                                                                                                                                            | None needed |
| 1.7 and 1.8                  | `src/app/(dashboard)/review/[id]/escalate-dialog.test.tsx`, `src/app/(dashboard)/review/[id]/request-sections.test.tsx`, `src/app/(dashboard)/review/[id]/page.test.tsx`, review-messages | Component          | Existing cases of the four files green           | 14 cases failed first (notice, pointer count, copy, page pass-down)         | 4 files, 282 passed                                         | Notice present, informational, second escalation, null and omitted, long answer, Spanish (7 cases); pointer for 2, 1, 0, no text, Spanish (5 cases)                                                                     | None needed |
| 1.9                          | `src/app/(dashboard)/review/[id]/answer-banner.test.tsx`                                                                                                                                  | Structural pin     | N/A                                              | Pass at write; mutation check below                                         | 15 passed                                                   | Single importer                                                                                                                                                                                                         | None needed |

### Mutation checks (revert-only; the file was confirmed clean after each)

| Pass-at-write test                                                                                                                                                            | Temporary edit                                                                                                                                                                                                                            | Result                                    | Reverted                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| layout-360 "answer banner sets no width above the viewport"; design-system "frames the answer banner as a card"; layout-360 long answer wraps; design-system fixed-width scan | In `src/app/(dashboard)/review/[id]/answer-banner.tsx`: add a fixed width of 400 px, drop the "bg-primary/5" tint, drop "break-words" and "whitespace-pre-wrap"                                                                           | 4 tests failed, as expected               | "git restore"                                            |
| 1.9 structural pin                                                                                                                                                            | Import the banner in `src/app/(dashboard)/requests/[id]/page.tsx`                                                                                                                                                                         | The pin failed (2 importers instead of 1) | "git restore"                                            |
| "still escalates a second time"; "no notice when omitted or null"; "no pointer when never escalated"                                                                          | In `src/app/(dashboard)/review/[id]/escalate-dialog.tsx`: confirm does nothing when an earlier answer exists, and the notice always renders. In `src/app/(dashboard)/review/[id]/request-sections.tsx`: the pointer renders for 0 records | 4 tests failed, as expected               | Restored from a byte-identical backup copy (deviation 4) |
| layout-360 "escalate dialog with a long earlier answer"                                                                                                                       | Drop "break-words" and "whitespace-pre-wrap" from the notice text                                                                                                                                                                         | 1 test failed, as expected                | Restored from the backup copy                            |

### Checkpoint (task 1.11): measured size

Measure: "git diff --numstat feat/flow-experience...HEAD" excluding "openspec/" and ".engram/" (additions plus deletions).

| Scope                                                      | Changed lines              |
| ---------------------------------------------------------- | -------------------------- |
| Unit 1 (banner module, i18n, tests)                        | 319                        |
| Unit 2 (page, decision copy, layout and design pins, i18n) | 235                        |
| Units 1 and 2 (branch "-1-answer-banner")                  | 554 (551 added, 3 deleted) |
| Unit 3 (dialog notice, history pointer, pass-down, i18n)   | 440                        |
| All of S1 (tip of "-1b-escalate-dialog-pointer")           | 994 (985 added, 9 deleted) |

Production code is 216 of the 994 lines (banner module 92, dialog 43, page 29, sections 18, two catalogs 34); tests are 778 (78 percent). The design forecast was about 200, and the 1.3x to 1.8x precedent ratio would give 260 to 360; the slice is 4.9 times the forecast. The stop line is 460 and it is exceeded. The plan's cut point (after unit 2) does not bring the first part under the line either: units 1 and 2 alone are 554. Unit 3 alone (440) is under the line. Tests were not trimmed. Decision needed from the owner; task 1.13 is held.

### Work unit evidence

| Evidence                              | Value                                                                                                                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | "$env:DATABASE_URL='postgres://u:p@127.0.0.1:9/x'; npm test -- src/app/(dashboard)/review src/i18n": 38 files, 1351 tests, all passed (tip of "-1b-escalate-dialog-pointer") |
| Runtime harness                       | N/A in this run: the owner-run capture "RF-16_c" on "flow-it" (task 12.6) is not part of Phase 1, and no database or Neon command was run                                    |
| Rollback boundary                     | Revert the PR (units 1 and 2, then unit 3 if shipped): the staff detail returns to the buried answer. No data, no schema, no audit event type                                |

### Gates (task 1.12), tip of "-1b-escalate-dialog-pointer", dummy DB

- Full "npm test": 368 files, 8987 tests, all passed, 242.4 s vitest duration (4 m 04 s wall). The Phase 0 baseline was a subset (242 files, 6461 tests). S1 adds one test file and 50 new "it" blocks (table rows expand to more cases).
- "npm run typecheck": exit 0.
- "npx eslint src": apart from the known CRLF "Delete" prettier noise (147453 lines; the working tree is CRLF), the only findings are three in files S1 does not touch: a warning for the unused `SidebarGroupLabel` in `src/components/app-sidebar.tsx` and two prettier quote errors in `src/test/access/inventory.ts`. "npx eslint" on the S1 files alone is clean, and "npx prettier --check" passes on every touched file.

### Files (all LF in the working tree; the index was already LF)

| File                                                                                                                                                                                                                                                                                                                | Action                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/app/(dashboard)/review/[id]/answer-banner.tsx`                                                                                                                                                                                                                                                                 | Created: latestAnswer, AnswerBanner, ANSWER_DATE_OPTIONS                        |
| `src/app/(dashboard)/review/[id]/answer-banner.test.tsx`                                                                                                                                                                                                                                                            | Created: 15 cases, with the importer pin                                        |
| `src/app/(dashboard)/review/[id]/page.tsx`                                                                                                                                                                                                                                                                          | Modified: banner first, decision copy, previousAnswer and escalations pass-down |
| `src/app/(dashboard)/review/[id]/escalate-dialog.tsx`                                                                                                                                                                                                                                                               | Modified: optional previousAnswer prop and notice                               |
| `src/app/(dashboard)/review/[id]/request-sections.tsx`                                                                                                                                                                                                                                                              | Modified: HistorySection prop escalations and pointer                           |
| `src/app/(dashboard)/review/[id]/page.test.tsx`, `src/app/(dashboard)/review/[id]/escalate-dialog.test.tsx`, `src/app/(dashboard)/review/[id]/request-sections.test.tsx`, `src/app/(dashboard)/review/layout-360.test.tsx`, `src/app/(dashboard)/review/design-system.test.tsx`, `src/i18n/review-messages.test.ts` | Modified: new cases                                                             |
| `i18n/es.json`, `i18n/en.json`                                                                                                                                                                                                                                                                                      | Modified: the keys listed below                                                 |

### Final Spanish UI copy added (staff screens, "usted")

- "review.detail.answerBanner.title": "Respuesta de coordinación"
- "review.detail.answerBanner.byline": "{name}, {date}"
- "review.detail.answerBanner.hint": "Tenga en cuenta esta respuesta al decidir."
- "review.detail.answerBanner.link": "Ver el escalamiento completo"
- "review.detail.decisionPanel.descriptionAnswered": "La coordinación ya respondió esta solicitud (vea la respuesta al inicio de esta página) y la decisión ahora es suya. Apruebe, devuelva para corrección o rechace la solicitud. Cada decisión le pide confirmarla."
- "review.escalation.dialog.previousAnswer.title": "La coordinación ya respondió esta solicitud ({byline}):"
- "review.escalation.dialog.previousAnswer.hint": "Si la escala de nuevo, vuelve a coordinación y no podrá decidir hasta que responda."
- "review.detail.history.escalations": "{count, plural, one {Esta solicitud tiene # escalamiento a coordinación.} other {Esta solicitud tiene # escalamientos a coordinación.}} Los detalles y las respuestas están en la sección «Escalamientos a coordinación»."
- "review.detail.history.escalationsLink": "Ir a los escalamientos"

English twins: "Coordination answer"; "Take this answer into account when you decide."; "See the full escalation"; "Coordination has already answered this request (see the answer at the top of this page) and the decision is now yours. Approve, return for correction or reject the request. Each decision asks you to confirm it."; "Coordination already answered this request ({byline}):"; "If you escalate it again, it goes back to coordination and you cannot decide until it answers."; the plural pointer; "Go to the escalations".

### Deviations

1. **Slice over the stop line, cut applied, PR held.** S1 measures 994 lines; units 1 and 2 are 554. Unit 3 lives on "-1b-escalate-dialog-pointer". No push and no PR 1: task 1.13 waits for the owner.
2. **Decision copy.** The design sentence "Si necesita otra opinión, puede escalarla de nuevo" is not used: FE-4 forbids telling the secretary to escalate to obtain the coordination's opinion, and the spec governs. The decided copy ends with the confirmation sentence instead. The second escalation stays allowed and is explained in the dialog notice (FE-12).
3. **Pass-down moved to unit 3.** Task 1.5 lists the pass of previousAnswer and the escalations count in `src/app/(dashboard)/review/[id]/page.tsx`, but those props only exist after unit 3, so unit 2 would not typecheck. Those lines are in unit 3 (the page is touched by both commits).
4. **Mutation checks with an uncommitted GREEN.** Task 1.9 asks for "git restore"; for the unit 3 files the GREEN was not committed yet, so a byte-identical backup copy was restored (checked with "cmp") instead.
5. **Props.** previousAnswer is optional (default null) so existing renders of the dialog stay valid; HistorySection's escalations is required, as the design says.
6. **Extra keys and tests.** The banner has the design's "byline" and "link" keys beyond the two the task names. Extra tests beyond the list: two page-level cases for the pass-down, a long answer in the open dialog at 360 px, and the banner card tokens in design-system.
7. **Keyboard access.** The scrollable answer box in the dialog has "tabIndex={0}" so the overflow can be scrolled from the keyboard.
8. **Line endings.** The touched files were CRLF in the working tree (index LF); they were converted to LF without changing the index content.

### Notes for S2 (RF-06, "Vence primero")

- Base: S2 is planned from the PR 1 branch. If the owner accepts the split, S2 stacks on "-1b-escalate-dialog-pointer" (the tip with all of S1); if the owner prefers one PR for all of S1 with a size exception, S2 stacks on that.
- S2 overlaps S1 only in `src/i18n/review-messages.test.ts`, `src/app/(dashboard)/review/layout-360.test.tsx` and `src/app/(dashboard)/review/design-system.test.tsx` (append-only blocks), and in `i18n/es.json` and `i18n/en.json` (new keys under "review.queue").
- Tests are about 78 percent of S1 lines. The S2 forecast is about 100 lines; expect 250 to 350. Plan one commit and check the stop line at the checkpoint.
- The design-system test scans every production module of the review directory for spacing steps, raw colours and fixed widths, so a new module such as `src/app/(dashboard)/review/deadline-badge.tsx` is checked automatically.
- Tooling: shell commands that carry a backslash lose it in this environment, so write patch scripts as files and use the Edit tool for regular expressions. A catalog insert helper exists in the scratchpad ("i18n-set.cjs"). Run "npx prettier --write" on a test file before the gates to avoid one-line prettier errors.

## Phase 2 (PR 2): S2 RF-06, "Vence primero" and the deadline-order description

Mode: Strict TDD. Date: 2026-11-20. Branch "feat/flow-experience-2-first-due", cut from the tip of "feat/flow-experience-1b-escalate-dialog-pointer" (19b98f3, all of S1). One work unit (unit 4), one code commit. Size exception per the owner decision of 2026-11-20 (see Phase 1).

### Commits

| Unit | Hash    | Message                                                            |
| ---- | ------- | ------------------------------------------------------------------ |
| 4    | 37ca062 | feat(review): state the queue order and mark the request due first |
| docs | (tip)   | docs(flow-experience): record the Phase 2 apply progress           |

### TDD cycle evidence

| Task        | Test file                                                                                             | Layer            | Safety net                                           | RED                                                                                                                                                                                                                  | GREEN                                                                       | Triangulation                                                                                                                                                                                                                                                                                             | Refactor    |
| ----------- | ----------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 2.1 and 2.2 | `src/app/(dashboard)/review/page.test.tsx`                                                            | Component (page) | Existing cases of the file passing before the change | 10 of the 21 RED failures: description en and es, mark on row 1 (table and cards), accessible name, overdue and due-soon next to it, ids 4 and 7, position, Spanish, term matching row 1, term matching several rows | Review directory, review-messages and revision-queue: 31 files, 1089 passed | Description en and es and the other two tabs; one mark per layout; accessible name; overdue next to it; equal deadlines (ids 4 and 7); queue position beats presentation date; Spanish; search hides row 1, matches row 1, matches several rows, matches none; empty queue; two other tabs; one audit row | None needed |
| 2.1 and 2.2 | `src/app/(dashboard)/review/review-queue-table.test.tsx`                                              | Component        | Existing cases passing                               | 1 case failed first (the mark in the deadline cell and in the row name); the null case passes at write                                                                                                               | Pass                                                                        | Mark present in cell 5, in the name of its row only; null label renders nothing; the row keys list gains "firstDueLabel"                                                                                                                                                                                  | None needed |
| 2.1 and 2.2 | `src/app/(dashboard)/review/design-system.test.tsx`, `src/app/(dashboard)/review/layout-360.test.tsx` | Component        | Existing suites green                                | 2 design-system and 3 layout-360 cases failed first (export missing)                                                                                                                                                 | Pass                                                                        | Neutral pill classes, no warning or alarm tint, told apart from the on-time state by weight and ink, no width above 360 px, axe es and en inside a card list                                                                                                                                              | None needed |
| 2.1 and 2.2 | `src/i18n/review-messages.test.ts`                                                                    | Unit             | Existing cases passing                               | 5 cases failed first (description es and en, no age wording es and en, mark)                                                                                                                                         | Pass                                                                        | Exact copy es and en; the other two tab descriptions pinned unchanged                                                                                                                                                                                                                                     | None needed |
| 2.3         | `src/lib/data/revision-queue.test.ts` (read-only)                                                     | Unit             | N/A                                                  | Pass at write (4.9:20 order tests, no edit)                                                                                                                                                                          | 28 passed                                                                   | Three-way effective start then id; paused days move the deadline; the order the database returned is kept                                                                                                                                                                                                 | N/A         |

### Mutation checks (revert-only; every file was restored from a byte-identical backup copy and confirmed with "cmp", because the GREEN was not committed yet)

| Pass-at-write test                                                                                                                          | Temporary edit                                                                                                         | Result                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| page "shows no mark and does not move it when the term hides row 1"                                                                         | In `src/app/(dashboard)/review/page.tsx`: firstDueId from visibleRows[0] instead of queue.rows[0]                      | Failed, with 7 other cases that depend on row 1 |
| review-queue-table "renders no first-due mark when the label is null"                                                                       | In `src/app/(dashboard)/review/review-queue-table.tsx`: always render the badge, label falling back to the text        | Failed                                          |
| review-messages and page "keeps the descriptions of the other two tabs"                                                                     | In `i18n/en.json`: change the coordination description                                                                 | Both failed                                     |
| page "is absent from an empty queue", "is absent from the En coordinacion and Aprobadas tabs", "writes one queue-read row ... search hides" | In `src/app/(dashboard)/review/page.tsx`: a badge in the other-tab branch and in the empty branch, a second audit call | 8 failed, including those three                 |
| page "shows no mark when nothing matches"                                                                                                   | In `src/app/(dashboard)/review/page.tsx`: a badge beside the no-results state                                          | Failed                                          |

### Checkpoint (task 2.5): measured size

Measure: the diff of the unit against its base (the tip of "-1b-escalate-dialog-pointer"), excluding "openspec/" and ".engram/".

| Scope                                                                           | Changed lines |
| ------------------------------------------------------------------------------- | ------------- |
| Production code (badge 14, page 27, table 10, two catalogs 6)                   | 57            |
| Tests (page 286, table 29, design-system 42, layout-360 11, review-messages 46) | 414           |
| All of S2 (460 added, 11 deleted)                                               | 471           |

The design forecast was about 100; the slice is 4.7 times that. It is 11 lines over the 460 stop line, which is "about 460". It is not cut: the planned cut list has no boundary inside PR 2, the only seam is FE-1 (the description, about 70 lines of copy and tests) against FE-2 (the mark), both share the same test files and the same commit, and a 70-line PR 2a would only add a stacked branch. Tests are 88 percent of the lines and were not trimmed. Size exception per the owner decision of 2026-11-20.

### Work unit evidence

| Evidence                              | Value                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused test command and exact result | "$env:DATABASE_URL='postgres://u:p@127.0.0.1:9/x'; npm test -- src/app/(dashboard)/review src/i18n/review-messages src/lib/data/revision-queue": 31 files, 1089 tests, all passed                                                                                                                      |
| Runtime harness                       | N/A in this run: the owner-run check on "flow-it" with the seeded queue (task 12.6) is not part of Phase 2, and no database or Neon command was run                                                                                                                                                    |
| Rollback boundary                     | Revert the PR: `src/app/(dashboard)/review/deadline-badge.tsx` loses FirstDueBadge, `src/app/(dashboard)/review/page.tsx` and `src/app/(dashboard)/review/review-queue-table.tsx` lose the mark, and the Pendientes description returns. Copy and marker only; no data, no schema, no audit event type |

### Gates (task 2.6), tip of "-2-first-due", dummy DB

- Full "npm test": 368 files, 9016 tests, all passed, 248.0 s vitest duration (4 m 10 s wall). Phase 1 was 368 files and 8987 tests; S2 adds 29 tests and no file.
- "npm run typecheck": exit 0.
- "npx eslint src": apart from the known CRLF "Delete" prettier noise (145879 lines; the working tree is CRLF outside the touched files), the only findings are the same three in files S2 does not touch: the unused `SidebarGroupLabel` warning in `src/components/app-sidebar.tsx` and two prettier quote errors in `src/test/access/inventory.ts`. "npx eslint" on the S2 files alone is clean, and "npx prettier --check" passes on every touched file and on both catalogs.
- "npm test -- src/i18n": 9 files, 421 tests, all passed.

### Files (all LF in the working tree; the index was already LF)

| File                                                                                                                                                                                                                                            | Action                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/app/(dashboard)/review/deadline-badge.tsx`                                                                                                                                                                                                 | Modified: FirstDueBadge (neutral pill, no hooks)                                     |
| `src/app/(dashboard)/review/page.tsx`                                                                                                                                                                                                           | Modified: firstDueId before the search, badge in the card deadline, label to the row |
| `src/app/(dashboard)/review/review-queue-table.tsx`                                                                                                                                                                                             | Modified: row field firstDueLabel, rendered in the deadline cell                     |
| `src/app/(dashboard)/review/page.test.tsx`, `src/app/(dashboard)/review/review-queue-table.test.tsx`, `src/app/(dashboard)/review/design-system.test.tsx`, `src/app/(dashboard)/review/layout-360.test.tsx`, `src/i18n/review-messages.test.ts` | Modified: new cases                                                                  |
| `i18n/es.json`, `i18n/en.json`                                                                                                                                                                                                                  | Modified: "review.queue.description" (replaced) and "review.queue.firstDue" (new)    |

### Final Spanish UI copy added (staff screen "review", "usted")

- "review.queue.description" (replaces "Solicitudes pendientes de su facultad, de la más antigua a la más reciente."): "Solicitudes pendientes de su facultad, ordenadas por vencimiento del plazo: primero la que vence antes."
- "review.queue.firstDue": "Vence primero"

English twins: "Pending requests of your faculty, ordered by deadline: the one due first comes first."; "Due first". The descriptions of the other two tabs are unchanged.

### Deviations

1. **Branch base.** Task 2.0 says "from the PR 1 branch"; the owner's run order cut it from the tip of "feat/flow-experience-1b-escalate-dialog-pointer" (the tip with all of S1), as the S1 notes planned. The PR targets that branch (stacked on #110), not "feat/flow-experience-1-answer-banner".
2. **Slice 471 lines, one PR.** See the checkpoint: 11 lines over "about 460"; no natural boundary inside the unit; recorded under the owner's size exception.
3. **Test file for the layout pin.** The 360 px axe check renders the mark inside a list item (a card), because axe reports no applicable rule for a lone span. The width check and the axe check cover the same component as the other describe.each entries.
4. **Mutation checks with an uncommitted GREEN.** As in S1: byte-identical backup copies restored, checked with "cmp".
5. **Task 2.7 is marked in Phase 3.** The PR number does not exist until the PR is opened, so the S3 docs commit records it.
6. **Line endings.** Five production and test files were CRLF in the working tree (index LF); converted to LF without changing the index content.

## Phase 3 (PR 3): S3 RF-10, required note and stale errors

Mode: Strict TDD. Date: 2026-11-20. Size exception per the owner decision of 2026-11-20 (see Phase 1). The slice measured 690 changed lines before any cut (unit 5: 151, unit 6: 539), so it is cut at its natural unit boundary into two PRs, as S1 was:

- **PR 3a**, branch "feat/flow-experience-3-dialog-errors", cut from the tip of "feat/flow-experience-2-first-due" (7a38971): unit 5 (the helper and the required mark) and unit 6a (the escalate dialog adopts both, plus its copy). 429 changed lines.
- **PR 3b**, branch "feat/flow-experience-3b-report-answer-errors", cut from the tip of PR 3a: unit 6b (the report dialog and the coordinator answer adopt the same helper, RNF-12).

The motive "otro" is NOT part of this slice (S8).

### Commits (PR 3a)

| Unit | Hash    | Message                                                                              |
| ---- | ------- | ------------------------------------------------------------------------------------ |
| 5    | 12c920a | feat(review): add the helper that clears stale dialog errors                         |
| 6a   | 53d7cd1 | fix(review): clear escalate dialog field errors on change and mark the note required |
| docs | (tip)   | docs(flow-experience): record the Phase 3 apply progress for PR 3a                   |

### TDD cycle evidence (PR 3a)

| Task        | Test file                                                     | Layer              | Safety net                       | RED                                                                                                                                                           | GREEN                                                                    | Triangulation                                                                                                                                                                                                                                                                                               | Refactor    |
| ----------- | ------------------------------------------------------------- | ------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 3.1 and 3.2 | `src/app/(dashboard)/review/[id]/dialog-parts.test.tsx` (new) | Unit and component | N/A (new file)                   | 11 of 14 cases failed first (the export was missing, and the required mark was absent); the three pass-at-write cases pin the unchanged optional behaviour    | 14 passed                                                                | Truth table of withoutFieldErrors: null in, four failures that name no field (same reference back), one field removed, several errors of one field, last error gives null, field with no error (same reference), frozen input never mutated; required mark on, undefined, false, never the native attribute | None needed |
| 3.4 and 3.5 | `src/app/(dashboard)/review/[id]/escalate-dialog.test.tsx`    | Component          | Existing cases of the file green | 7 cases failed first: label and hint en, label and hint es, motive error clears, note error clears, no banner in either order, still-invalid form fails again | review directory, coordination directory and i18n: 43 files, 1523 passed | Label and hint en and es, no native required; both errors; motive clears only itself; note clears only itself; no banner in two orders; a second confirmation brings the note error back; conflict, not_found, unexpected and no-coordination persist while editing (4 cases); reopening starts clean       | None needed |
| 3.4 and 3.5 | `src/i18n/review-messages.test.ts`                            | Unit               | Existing cases green             | 2 cases failed first (exact label and hint, es and en); the staff-only statement and the other note labels pass at write                                      | Pass                                                                     | Exact copy es and en; hint keeps the staff-only statement and no informal address; the report and answer labels pinned unchanged                                                                                                                                                                            | None needed |

### Mutation checks (revert-only; files restored from byte-identical backup copies, checked with "cmp", because the GREEN was not committed yet)

| Pass-at-write test                                                                                                                     | Temporary edit                                                                                             | Result                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| dialog-parts "announces nothing when required is undefined or false" and "never turns on the browser's own validation"                 | In `src/app/(dashboard)/review/[id]/dialog-parts.tsx`: the mark always on, plus the native attribute       | 3 failed                                                   |
| escalate-dialog "keeps the %s message while the fields are edited" (4 cases)                                                           | In `src/app/(dashboard)/review/[id]/escalate-dialog.tsx`: a motive change clears the whole failure         | 5 failed, the 4 persistence cases and the motive-only case |
| escalate-dialog "starts with no message when the dialog is reopened"                                                                   | In `src/app/(dashboard)/review/[id]/escalate-dialog.tsx`: the discard keeps the failure                    | Failed                                                     |
| escalate-dialog "shows both errors after confirming with nothing filled"                                                               | In `src/app/(dashboard)/review/[id]/escalate-dialog.tsx`: the motive messages are never read               | 8 failed, including it                                     |
| escalate-dialog "does not turn on the browser's validation"                                                                            | In `src/app/(dashboard)/review/[id]/dialog-parts.tsx`: add the native "required" next to the aria mark     | Failed                                                     |
| review-messages "keeps the staff-only statement and no informal address" and "leaves the labels of the other note fields as they were" | In `i18n/en.json` and `i18n/es.json`: the report label shortened, the Spanish hint in the informal address | 3 failed, including both                                   |

### Checkpoint (task 3.8): measured size of PR 3a

Measure: "git diff --numstat feat/flow-experience-2-first-due...HEAD" excluding "openspec/" and ".engram/".

| Scope                                                                   | Changed lines |
| ----------------------------------------------------------------------- | ------------- |
| Unit 5 (helper, required mark, their tests)                             | 151           |
| Unit 6a (escalate dialog, its tests, the two catalogs, the i18n pin)    | 278           |
| All of PR 3a (422 added, 7 deleted; production 50 and tests 379)        | 429           |
| Unit 6b (report dialog, coordinator answer, their tests) before the cut | 261           |
| All of S3 before the cut                                                | 690           |

The design forecast for S3 was about 110; the slice is 6.3 times that. Unit 6 alone is 539, so the cut is inside unit 6, at the seam the design draws: the escalate dialog (FE-10 and FE-11 for the dialog the requirement names) against the two dialogs that adopt the helper only for consistency (RNF-12). Tests are 88 percent of the lines and were not trimmed.

### Work unit evidence (PR 3a)

| Evidence                              | Value                                                                                                                                                                                                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | "$env:DATABASE_URL='postgres://u:p@127.0.0.1:9/x'; npm test -- src/app/(dashboard)/review src/app/(dashboard)/coordination src/i18n": 43 files, 1523 tests, all passed                                                                                          |
| Runtime harness                       | N/A in this run: the owner-run capture "RF-10_b" on "flow-it" (task 12.7) is not part of Phase 3, and no database or Neon command was run                                                                                                                       |
| Rollback boundary                     | Revert the PR: `src/app/(dashboard)/review/[id]/dialog-parts.tsx` loses the helper and the mark, `src/app/(dashboard)/review/[id]/escalate-dialog.tsx` returns to its old behaviour, and the two catalog labels return. No data, no schema, no audit event type |

### Gates (PR 3a), tip of "-3-dialog-errors", dummy DB

- Full "npm test": 369 files, 9049 tests, all passed, 257.5 s vitest duration (4 m 20 s wall). PR 2 was 368 files and 9016 tests; PR 3a adds one test file (dialog-parts) and 33 tests.
- "npm run typecheck": exit 0.
- "npx eslint src": apart from the known CRLF "Delete" prettier noise (145008 lines), the only findings are the same three in files PR 3a does not touch: the unused `SidebarGroupLabel` warning in `src/components/app-sidebar.tsx` and two prettier quote errors in `src/test/access/inventory.ts`. "npx eslint" on the touched files alone is clean, and "npx prettier --check" passes on every touched file and on both catalogs.
- "npm test -- src/app/(dashboard)/review src/app/(dashboard)/coordination src/i18n": 43 files, 1523 tests, all passed.

### Files (PR 3a; all LF in the working tree, the index was already LF)

| File                                                                                           | Action                                                                              |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/app/(dashboard)/review/[id]/dialog-parts.tsx`                                             | Modified: withoutFieldErrors, optional "required" of NoteField (aria-required only) |
| `src/app/(dashboard)/review/[id]/dialog-parts.test.tsx`                                        | Created: 14 cases                                                                   |
| `src/app/(dashboard)/review/[id]/escalate-dialog.tsx`                                          | Modified: field errors cleared on change, NoteField required                        |
| `src/app/(dashboard)/review/[id]/escalate-dialog.test.tsx`, `src/i18n/review-messages.test.ts` | Modified: new cases                                                                 |
| `i18n/es.json`, `i18n/en.json`                                                                 | Modified: "review.escalation.dialog.noteLabel" and "noteHint" (replaced)            |

### Final Spanish UI copy added so far (staff screen "review", "usted")

- "review.escalation.dialog.noteLabel" (replaces "Nota para coordinación"): "Nota para coordinación (obligatoria)"
- "review.escalation.dialog.noteHint" (replaces "Explique por qué escala la solicitud a coordinación. Solo la ve el personal."): "Explique por qué escala la solicitud; por ejemplo, qué dato del documento no coincide o qué situación no prevé el reglamento. Solo la ve el personal."

English twins: "Note for coordination (required)"; "Explain why you are escalating the request; for example, which document detail does not match or which situation the regulation does not cover. Only staff can see it." The labels of the report dialog ("Nota (opcional)") and of the coordinator answer ("Respuesta para la secretaría") are unchanged.

### Deviations (PR 3a)

1. **Branch names.** Task 3.0 says "feat/flow-experience-3-note-errors"; the owner's run order says "feat/flow-experience-3-dialog-errors", which is used. The cut branch is "feat/flow-experience-3b-report-answer-errors".
2. **Cut inside unit 6.** Tasks 3.4 and 3.5 name one commit for the escalate dialog, the report dialog and the answer form; the 539-line unit is split in two commits, one per PR (6a and 6b), because it is over the stop line on its own.
3. **Branch base.** The PR targets "feat/flow-experience-2-first-due" (stacked on PR 2), as planned.
4. **Mutation checks with an uncommitted GREEN.** As in S1 and S2: byte-identical backup copies restored and checked with "cmp".
5. **Task 3.6.** The planned mutation (drop the motive clear in the escalate dialog, the motive case must fail) is done in a stronger form: the clear is replaced by clearing the whole failure, and five cases fail, including the motive-only case.
6. **Line endings.** Four production and test files were CRLF in the working tree (index LF); converted to LF without changing the index content.

### PR 3b: the report dialog and the coordinator answer adopt the helper (unit 6b)

Branch "feat/flow-experience-3b-report-answer-errors", cut from the tip of PR 3a ("feat/flow-experience-3-dialog-errors", a251e2d). It targets that branch. The motive "otro" is still not part of S3 (S8).

#### Commits (PR 3b)

| Unit | Hash    | Message                                                            |
| ---- | ------- | ------------------------------------------------------------------ |
| 6b   | 33a3f7f | fix(review): clear report and answer dialog field errors on change |
| docs | (tip)   | docs(flow-experience): record the Phase 3 apply progress for PR 3b |

#### TDD cycle evidence (PR 3b)

| Task        | Test file                                                    | Layer     | Safety net                       | RED                                                                                                                                                                          | GREEN                                                                    | Triangulation                                                                                                                                                                                                             | Refactor                                                                |
| ----------- | ------------------------------------------------------------ | --------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 3.4 and 3.5 | `src/app/(dashboard)/review/[id]/report-dialog.test.tsx`     | Component | Existing cases of the file green | 5 cases failed first: teacher clears, date clears, note clears, no banner once cleared, still-invalid form fails again; the form-level and optional-note cases pass at write | review directory, coordination directory and i18n: 43 files, 1535 passed | Each of the three fields clears only itself; no banner once every field error is cleared; a still-invalid confirmation brings the error back; a conflict persists while editing; the optional note is not marked required | One existing test edited (see deviation 2): it now releases its promise |
| 3.4 and 3.5 | `src/app/(dashboard)/coordination/[id]/answer-form.test.tsx` | Component | Existing cases of the file green | 2 cases failed first: the text error clears, no banner once cleared; the still-empty confirmation and the two persistence cases pass at write                                | Pass                                                                     | The text error clears and the field loses aria-invalid; no banner; a second confirmation with the text still empty shows the error again; conflict and unexpected persist while editing                                   | None needed                                                             |

#### Mutation checks (revert-only; files restored from byte-identical backup copies, checked with "cmp")

| Pass-at-write test                                                                | Temporary edit                                                                                                | Result                                                                     |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| report-dialog "keeps the form-level message while the fields are edited"          | In `src/app/(dashboard)/review/[id]/report-dialog.tsx`: the teacher and note changes clear the whole failure  | 3 failed, including it                                                     |
| report-dialog "does not mark the optional note as required"                       | In `src/app/(dashboard)/review/[id]/report-dialog.tsx`: pass "required" to the note                           | Failed                                                                     |
| answer-form "keeps the conflict and unexpected messages while the text is edited" | In `src/app/(dashboard)/coordination/[id]/answer-form.tsx`: a change clears the whole failure                 | 2 failed, both persistence cases                                           |
| answer-form "fails again when the text is still empty on the next confirmation"   | In `src/app/(dashboard)/coordination/[id]/answer-form.tsx`: only the first result of the action is ever shown | 12 failed, including it (a global counter, so every later case also fails) |

#### Checkpoint (task 3.8): measured size of PR 3b

Measure: "git diff --numstat feat/flow-experience-3-dialog-errors...HEAD" excluding "openspec/" and ".engram/".

| Scope                                        | Changed lines |
| -------------------------------------------- | ------------- |
| Production (report dialog 18, answer form 6) | 24            |
| Tests (report dialog 152, answer form 85)    | 237           |
| All of PR 3b (256 added, 5 deleted)          | 261           |
| PR 3a (units 5 and 6a)                       | 429           |
| All of S3 (units 5, 6a and 6b)               | 690           |

Both parts are under the 460 stop line. Tests were not trimmed.

#### Work unit evidence (PR 3b)

| Evidence                              | Value                                                                                                                                                                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | "$env:DATABASE_URL='postgres://u:p@127.0.0.1:9/x'; npm test -- src/app/(dashboard)/review src/app/(dashboard)/coordination src/i18n": 43 files, 1535 tests, all passed                                                                   |
| Runtime harness                       | N/A in this run: the owner-run capture "RF-10_b" on "flow-it" (task 12.7) is not part of Phase 3, and no database or Neon command was run                                                                                                |
| Rollback boundary                     | Revert the PR: `src/app/(dashboard)/review/[id]/report-dialog.tsx` and `src/app/(dashboard)/coordination/[id]/answer-form.tsx` return to keeping their field errors until the next confirmation. No data, no schema, no audit event type |

#### Gates (task 3.9), tip of "-3b-report-answer-errors", dummy DB

- Full "npm test": 369 files, 9061 tests, all passed, 249.9 s vitest duration (4 m 12 s wall). PR 3a was 369 files and 9049 tests; PR 3b adds 12 tests and no file. Against PR 2 (368 files, 9016 tests) all of S3 adds one file and 45 tests.
- "npm run typecheck": exit 0.
- "npx eslint src": apart from the known CRLF "Delete" prettier noise (145008 lines), the only findings are the same three in files S3 does not touch: the unused `SidebarGroupLabel` warning in `src/components/app-sidebar.tsx` and two prettier quote errors in `src/test/access/inventory.ts`. "npx eslint" on all the S3 files (and S2) is clean, and "npx prettier --check" passes on every touched file and on both catalogs.
- "npm test -- src/app/(dashboard)/review src/app/(dashboard)/coordination src/i18n": 43 files, 1535 tests, all passed.

#### Files (PR 3b; all LF in the working tree, the index was already LF)

| File                                                                                                                   | Action                                                                |
| ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/app/(dashboard)/review/[id]/report-dialog.tsx`                                                                    | Modified: teacher, date and note changes clear their own field errors |
| `src/app/(dashboard)/coordination/[id]/answer-form.tsx`                                                                | Modified: a text change clears its field error                        |
| `src/app/(dashboard)/review/[id]/report-dialog.test.tsx`, `src/app/(dashboard)/coordination/[id]/answer-form.test.tsx` | Modified: new cases                                                   |

No Spanish UI copy is added in PR 3b: the report dialog and the coordinator answer keep their labels. The final Spanish copy of all of S3 is the two keys listed under PR 3a ("review.escalation.dialog.noteLabel" and "review.escalation.dialog.noteHint").

#### Deviations (PR 3b)

1. **Cut.** PR 3b exists only because S3 measured 690 lines (see PR 3a). The report dialog and the coordinator answer adopt the helper exactly as task 3.5 lists.
2. **One existing test edited.** In `src/app/(dashboard)/review/[id]/report-dialog.test.tsx`, "sends nothing twice while the first confirm is still running" used a promise that never settles. React entangles async actions across roots, so every later test of the file kept its confirm button pending. The test now holds the promise and releases it at the end; its assertions are unchanged.
3. **Task 3.6 and the answer form.** The report dialog and the answer form have no "otro" and no motive; the mutation checks above stand in for task 3.6 on those two files.

### Notes for S4 (RF-07, cards that tell requests apart)

- Base: S4 stacks on "feat/flow-experience-3b-report-answer-errors", the tip with all of S3.
- Task 4.1 is an [ASK OWNER] confirmation of two defaults. Owner resolution 3 of 2026-11-20 already fixes (b), at most 140 characters in up to 2 lines; (a), the excerpt on an "aprobada" card, is only in the spec (FE-15) and the design did not list it, so it still needs the owner's go-ahead before unit 7 starts.
- S4 does not overlap S3 files: it touches `src/lib/data/student-requests.ts`, `src/lib/data/decision-excerpt.ts` (new), `src/app/(dashboard)/requests/request-card.tsx`, `src/app/(dashboard)/requests/page.tsx`, their tests, `src/i18n/requests-messages.test.ts` and the "requests.list" keys of both catalogs. The student screens use "tú".
- Size: tests are 88 percent of S2 and S3 lines; the forecast of about 250 will run 2 to 3 times higher, so plan the cut the tasks name (after unit 7: the data layer and its excerpt helper, 4.2 to 4.7; then the card, 4.8 to 4.10) and measure at each unit.
- React async transitions: a test that leaves a never-settling server action pending keeps every later "isPending" in the same file true (React entangles async actions across roots). Resolve promises of mocked actions at the end of the test.
- Tooling: write patch scripts as files; the helpers in the scratchpad ("i18n-set.cjs", the append and the line-ending scripts) work as before. the owner's rules ask for "rg", "fd", "bat", "eza" and "sd"; only "rg" is installed here, so use "rg", Node scripts and the Read and Edit tools. After "git show HEAD:<path> > <path>" the file is LF, which is what the index holds.

## Phase 4 (PR 4): S4 RF-07, cards that tell requests apart

Mode: Strict TDD. Date: 2026-11-20. Branch "feat/flow-experience-4-card-reasons", cut from the tip of "feat/flow-experience-3b-report-answer-errors" (67cf703, all of S3). Size exception per the owner decision of 2026-11-20 (see Phase 1); if the slice goes over the stop line it is cut after unit 7 into "-4-card-reasons" (data and excerpt helper) and "-4b-..." (the card), as the plan says.

### Owner decision of 2026-11-20 on task 4.1

- **(a) No excerpt on "aprobada" cards.** The decision excerpt shows ONLY on "devuelta" and "rechazada" cards, never on "aprobada" cards. Reason: approval text is template boilerplate and approved students do not ask why, so the excerpt would add noise; the student already sees the full text in the detail. This reverses the spec default (FE-15 listed "aprobada"). Edited to match: spec FE-15 in `openspec/changes/flow-experience/specs/student-requests/spec.md` (requirement text, header note, the table-driven scenario split in two, and a new scenario "Approved card shows no excerpt"), design D7 in `openspec/changes/flow-experience/design.md`, and the tasks 4.1, 4.4 and 4.8 text and the convention line about known spec differences in `openspec/changes/flow-experience/tasks.md`.
- **(b) Excerpt rule.** At most 140 characters with an ellipsis when cut, shown in up to 2 lines (owner resolution 3, 2026-11-20).

### PR #98 merged (2026-11-20): unblocks S8

"gh pr view 98": MERGED at 2026-11-20T17:57:26Z as 27abd8c on "main" ("Merge pull request #98 from Josuedcm03/docs/thesis-sync-p3-2"). After "git fetch origin main", "drizzle/" on "origin/main" still ends at 0015, so 0016 is still free. This satisfies the precondition of task 8.0 (the entry itself is recorded when S8 starts). Main was NOT merged into the tracker or into any slice now; it is merged into the tracker only when the plan says (before S8).

### Cut decision

Unit 7 (the data layer and the excerpt helper) measured 606 changed lines, over the 460 stop line on its own, so the slice is cut after unit 7 as the plan says (candidate cut: PR 4 after unit 7):

- **PR 4**, branch "feat/flow-experience-4-card-reasons", cut from the tip of "feat/flow-experience-3b-report-answer-errors": unit 7 (tasks 4.2 to 4.7). It stacks on #113.
- **PR 4b**, branch "feat/flow-experience-4b-request-card", cut from the tip of PR 4: unit 8 (tasks 4.8 to 4.10), the card and its copy.

Unit 7 is not cut further: its only seam (the excerpt helper, 101 lines, against the reader and its tests, 505 lines) would leave a PR whose helper nothing calls. Tests are 81 percent of the lines and were not trimmed. Size exception per the owner decision of 2026-11-20 (see Phase 1).

### Commits (PR 4)

| Unit | Hash    | Message                                                                              |
| ---- | ------- | ------------------------------------------------------------------------------------ |
| 4.1  | 7d86f90 | docs(flow-experience): record the owner decision that approved cards show no excerpt |
| 7    | a2fe9f2 | feat(requests): read subjects and the decision reason for each own request           |
| docs | (tip)   | docs(flow-experience): record the Phase 4 apply progress for PR 4                    |

### TDD cycle evidence (PR 4)

| Task        | Test file                                         | Layer | Safety net                                                          | RED                                                                                                                       | GREEN                         | Triangulation                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Refactor      |
| ----------- | ------------------------------------------------- | ----- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 4.2 and 4.3 | `src/lib/data/decision-excerpt.test.ts` (new)     | Unit  | N/A (new file)                                                      | The file failed to load (module missing)                                                                                  | 1 file, 14 passed             | 200 chars cut to 140 plus an ellipsis; exactly 140 whole; 141 cut; 60 whole; null, undefined, empty and two whitespace-only texts give null; surrounding whitespace trimmed; trailing whitespace trimmed before the ellipsis; a surrogate pair at the cut kept whole; 140 emoji count as 140                                                                                                                                                                                  | Prettier only |
| 4.4 and 4.5 | `src/lib/data/student-requests.test.ts`           | Unit  | 4 listOwnRequests cases and the detail and correction cases passing | 20 cases failed first (shape, select count, class and decision reads, excerpt, reason code, approved rule, skip rule)     | 66 passed with the next row   | Rows with subjects and decision; owner and visible-state filter; order; empty list issues 1 select; 1, 2 and 5 rows issue 3; ids passed to both reads; subjects in the order of `listRequestClasses`; no class rows; latest of two decisions; returned code and text; rejected excerpt (200, 60, null, blank); long text never leaves; code only for returned; approved gets none (2 texts); approved never read; open states get none (2); skip rule; read-only             | None needed   |
| 4.4 and 4.5 | `src/app/(dashboard)/requests/no-signals.test.ts` | Unit  | Existing cases passing                                              | 2 cases failed first (the list keys gain "asignaturas" and "decision"; a list row with a long decision reveals no signal) | Pass                          | Exact list keys, selects only, 3 statements; the card decision carries only "motivoCodigo" and "texto"; the subject carries only "codigo" and "nombre"; the REVEALING scan of the serialized rows                                                                                                                                                                                                                                                                             | None needed   |

### Mutation checks (revert-only; the file was restored from a byte-identical backup copy and checked with "cmp", because the GREEN was not committed yet)

| Test                                                                          | Temporary edit in `src/lib/data/student-requests.ts`   | Result                                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| select-count cases (task 4.6)                                                 | Read the classes once per row inside the mapping       | 10 failed, including the 2- and 5-row select-count cases             |
| approved-gets-none (2), approved-never-read, skip rule                        | Add "aprobada" to the states whose decision is read    | 4 failed, as expected                                                |
| "keeps the reason code only for a returned request, never for a rejected one" | Pass the reason code through for every state           | 1 failed, as expected                                                |
| "reads only: no write and no audit row" and the statement-count cases         | Add an insert before the class read                    | 22 failed, including it (the double refuses an unscripted statement) |

### Checkpoint (task 4.11): measured size of PR 4

Measure: "git diff --numstat feat/flow-experience-3b-report-answer-errors...HEAD" excluding "openspec/" and ".engram/".

| Scope                                         | Changed lines |
| --------------------------------------------- | ------------- |
| Production (excerpt helper 28, reader 88)     | 116           |
| Tests (excerpt 73, reader 365, no-signals 52) | 490           |
| All of PR 4 (596 added, 10 deleted)           | 606           |

The design forecast for all of S4 was about 250; unit 7 alone is 2.4 times that. Tests are 81 percent of the lines.

### Work unit evidence (PR 4)

| Evidence                              | Value                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | "DATABASE_URL='postgres://u:p@127.0.0.1:9/x' npm test -- src/lib/data/student-requests src/lib/data/decision-excerpt src/app/(dashboard)/requests": 23 files, 533 tests, all passed                                                                                                    |
| Runtime harness                       | N/A in this run: the owner-run capture "RF-07_c" on "flow-it" (task 12.8) is not part of PR 4, and no database or Neon command was run (the dummy DB URL and the statement double only)                                                                                                |
| Rollback boundary                     | Revert the PR: `src/lib/data/decision-excerpt.ts` is removed and `src/lib/data/student-requests.ts` returns its old list shape (one select, no subjects, no decision). Nothing renders the new fields until PR 4b, so the screens do not change. No data, no schema, no audit event type |

### Gates (task 4.12), tip of "-4-card-reasons", dummy DB

- Full "npm test": 370 files, 9097 tests, all passed, 272.6 s vitest duration. PR 3b was 369 files and 9061 tests; PR 4 adds one test file (decision-excerpt) and 36 tests.
- "npm run typecheck": exit 0.
- "npx eslint src": apart from the known CRLF "Delete" prettier noise (143810 lines), the only findings are the same three in files PR 4 does not touch: the unused `SidebarGroupLabel` warning in `src/components/app-sidebar.tsx` and two prettier quote errors in `src/test/access/inventory.ts`. "npx eslint" on the five touched files alone is clean, and "npx prettier --check" passes on all of them.
- i18n is not touched by PR 4.

### Files (PR 4; all LF in the working tree, the index was already LF)

| File                                                                                       | Action                                                                                           |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `src/lib/data/decision-excerpt.ts`                                                         | Created: DECISION_EXCERPT_MAX and the pure decisionExcerpt                                       |
| `src/lib/data/decision-excerpt.test.ts`                                                    | Created: 14 cases                                                                                |
| `src/lib/data/student-requests.ts`                                                         | Modified: OwnCardDecision, OwnRequestListItem, listOwnRequests with the class and decision reads |
| `src/lib/data/student-requests.test.ts`, `src/app/(dashboard)/requests/no-signals.test.ts` | Modified: the list block rewritten and extended; LIST_KEYS gains "asignaturas" and "decision"    |

No Spanish UI copy is added in PR 4 (the card copy is PR 4b).

### Deviations (PR 4)

1. **Branch names.** Task 4.0 says "feat/flow-experience-4-request-cards"; the owner's run order says "feat/flow-experience-4-card-reasons", which is used. The cut branch is "feat/flow-experience-4b-request-card". Tasks 4.11 and 4.13 name "feat/flow-experience-3-note-errors" as the base; the real base is the tip of "feat/flow-experience-3b-report-answer-errors" (#113).
2. **Approved cards (owner decision of 2026-11-20).** The design, the spec and tasks 4.1, 4.4 and 4.8 changed so an approved request carries no decision at all; the data layer does not even read it. The spec was edited first.
3. **Reason code kept only for a returned request.** The design types the decision as a code and a text; the reader sets the code to null for a rejected request (D7 says a rejection carries no code), so the card cannot show a code the design does not allow.
4. **Excerpt applied to every kept text.** Including the text of a returned request, so no complete decision text reaches the client list.
5. **Mutation checks with an uncommitted GREEN.** As in S1 to S3: byte-identical backup copy restored and checked with "cmp".
6. **Cut at unit 7, size exception.** See the cut decision.
7. **Tasks 4.11 to 4.13.** They close when PR 4b is done, over both PRs.

### PR 4b: the card (unit 8)

Branch "feat/flow-experience-4b-request-card", cut from the tip of PR 4 ("feat/flow-experience-4-card-reasons", 7f8c018). It targets that branch. Together with PR 4 it closes S4. Pull requests: PR 4 is #114 ("https://github.com/Josuedcm03/justifia/pull/114", base "feat/flow-experience-3b-report-answer-errors", stacked on #113) and PR 4b is #115 ("https://github.com/Josuedcm03/justifia/pull/115", base "feat/flow-experience-4-card-reasons").

#### Commits (PR 4b)

| Unit | Hash    | Message                                                                  |
| ---- | ------- | ------------------------------------------------------------------------ |
| 8    | 6f8fd63 | feat(requests): label the dates and show subjects and reasons on the cards |
| docs | (tip)   | docs(flow-experience): record the Phase 4 apply progress for PR 4b       |

#### TDD cycle evidence (PR 4b)

| Task        | Test file                                                  | Layer     | Safety net                                   | RED                                                                                                                                                                                     | GREEN                                       | Triangulation                                                                                                                                                                                                                                                                                                                                                                                                                    | Refactor    |
| ----------- | ---------------------------------------------------------- | --------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 4.8 and 4.9 | `src/app/(dashboard)/requests/request-card.test.tsx` (new) | Component | N/A (new file); existing requests cases passing    | 16 cases failed first (the labelled absence line en, es, one day; subjects 1, 3, 5 and 4 codes and es; the five reasons; the clamp; es reason; 360 px); the negative cases pass at write | requests directory and i18n: 31 files, 936 passed | Range, one day, Spanish, missing dates; 1, 3, 5, 4 subjects and Spanish and none; returned with code, with the date code, without a known code; rejected short and cut; no line for a returned request with nothing, a rejected one without a decision, a pending one with a stray decision, one in coordination; approved with text, with a long text, without a decision; props with signals, an outcome, a verdict and an escalation note; link; 360 px | None needed |
| 4.8 and 4.9 | `src/app/(dashboard)/requests/page.test.tsx`               | Component | Existing cases passing                       | 2 cases failed first (items passed through to their own cards; the label on every card); the approved stray-decision case passes at write                                               | Pass                                        | Returned, rejected and approved items in one list; labelled dates; approved card with a carried decision                                                                                                                                                                                                                                                                                                                          | None needed |
| 4.8 and 4.9 | `src/app/(dashboard)/requests/design-system.test.tsx`      | Component | Existing suites green                        | 2 cases failed first (muted ink for the labelled lines and body ink with the clamp for the reason; five long codes inside 360 px)                                                      | Pass                                        | Class-level pins: muted ink, line-clamp-2, break-words, no fixed width above the viewport                                                                                                                                                                                                                                                                                                                                         | None needed |
| 4.8 and 4.9 | `src/i18n/requests-messages.test.ts`                       | Unit      | Existing cases passing                       | 3 cases failed first (exact copy es and en; the reason label equals the detail's label)                                                                                                  | Pass                                        | Exact copy of the four keys in es and en; no form of address in either; same "Motivo" and "Reason" label as the detail                                                                                                                                                                                                                                                                                                            | None needed |
| 4.8         | `src/app/(dashboard)/requests/no-signals.test.ts`          | Component | Existing cases passing                       | Pass at write (its list rows now carry subjects and a decision, and the page shows them); mutation check below                                                                         | Pass                                        | Four states in both locales with no signal word                                                                                                                                                                                                                                                                                                                                                                                   | None needed |

#### Mutation checks (revert-only; files restored from byte-identical backup copies and checked with "cmp", because the GREEN was not committed yet)

| Pass-at-write test                                                                                        | Temporary edit                                                                              | Result                                                                                |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| no reason line (returned with nothing, pending, coordination) and the three approved cases, page approved | In `src/app/(dashboard)/requests/request-card.tsx`: drop the state gate of the reason       | 5 failed, including the pending, coordination and approved cases                       |
| the reason cases and no-signals list                                                                      | A signal word and a verdict word added to the reason line                                   | The reason cases failed, and so did the no-signals list case "renders every visible state without a signal, outcome, verdict or fingerprint" |
| the state labels, the neutral label                                                                       | The state pill always receives "pendiente"                                                  | Failed, including the coordination and every state-label case                         |
| "shows no absence line when the dates are missing", "shows no subject line for a request without subjects" | The dates line and the subjects line always render                                         | 2 failed, as expected                                                                 |
| "links to the detail of its own request" and the page link case                                           | The link target is the next id                                                              | 2 failed, as expected                                                                 |
| "renders no signal, outcome, verdict, motive, note or answer even when the props carry them"              | The serialized props are rendered inside the card                                           | 6 failed, including it                                                                |
| "keeps the card labels free of any form of address" and the exact-copy case                                | In `i18n/es.json`: "Revisa tus fechas de ausencia: {period}" instead of the absence label  | 2 failed, as expected                                                                 |

#### Checkpoint (task 4.11): measured size of PR 4b

Measure: "git diff --numstat feat/flow-experience-4-card-reasons...HEAD" excluding "openspec/" and ".engram/".

| Scope                                                                                                       | Changed lines |
| ----------------------------------------------------------------------------------------------------------- | ------------- |
| Production (card 56, two catalogs 8)                                                                        | 64            |
| Tests (card 307, page 56, design system 42, copy 46, no-signals 5)                                          | 456           |
| All of PR 4b (514 added, 6 deleted)                                                                         | 520           |
| PR 4 (unit 7)                                                                                               | 606           |
| All of S4                                                                                                   | 1126          |

The design forecast for S4 was about 250; S4 is 4.5 times that. Tests are 88 percent of PR 4b. Both parts are over the 460 stop line; PR 4 is the plan's cut after unit 7, and unit 8 has no seam (the card, the page pin and the copy are one behaviour). Size exception per the owner decision of 2026-11-20. Tests were not trimmed.

#### Work unit evidence (PR 4b)

| Evidence                              | Value                                                                                                                                                                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | "DATABASE_URL='postgres://u:p@127.0.0.1:9/x' npm test -- src/app/(dashboard)/requests src/i18n": 31 files, 936 tests, all passed                                                                                                                                                            |
| Runtime harness                       | N/A in this run: the owner-run capture "RF-07_c" on "flow-it" (task 12.8) is not part of Phase 4, and no database or Neon command was run                                                                                                                                                  |
| Rollback boundary                     | Revert the PR: `src/app/(dashboard)/requests/request-card.tsx` returns to its old three lines and the four catalog keys go. The list reader of PR 4 keeps returning the new fields, which nothing renders. No data, no schema, no audit event type                                          |

#### Gates (task 4.12), tip of "-4b-request-card" (the S4 tip), dummy DB

- Full "npm test": 371 files, 9136 tests, all passed, 262.3 s vitest duration. PR 4 was 370 files and 9097 tests; PR 4b adds one test file (request-card) and 39 tests. Against PR 3b (369 files, 9061 tests) all of S4 adds two files and 75 tests.
- "npm run typecheck": exit 0.
- "npx eslint src": apart from the known CRLF "Delete" prettier noise (143072 lines), the only findings are the same three in files S4 does not touch: the unused `SidebarGroupLabel` warning in `src/components/app-sidebar.tsx` and two prettier quote errors in `src/test/access/inventory.ts`. "npx eslint" on the touched files alone is clean, and "npx prettier --check" passes on all of them and on both catalogs.
- "npm test -- src/app/(dashboard)/requests src/i18n": 31 files, 936 tests, all passed.

#### Files (PR 4b; all LF in the working tree, the index was already LF)

| File                                                                                                                                                                                                                  | Action                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/app/(dashboard)/requests/request-card.tsx`                                                                                                                                                                       | Modified: absence label, subjects line, reason line gated on the state; takes the list item |
| `src/app/(dashboard)/requests/request-card.test.tsx`                                                                                                                                                                  | Created: 29 cases                                                                           |
| `src/app/(dashboard)/requests/page.test.tsx`, `src/app/(dashboard)/requests/design-system.test.tsx`, `src/app/(dashboard)/requests/no-signals.test.ts`, `src/i18n/requests-messages.test.ts`                            | Modified: new cases and fuller fixtures                                                     |
| `i18n/es.json`, `i18n/en.json`                                                                                                                                                                                        | Modified: "requests.list.absence", "subjects", "moreSubjects" and "reason"                  |

#### Final Spanish UI copy added in S4 (student screen "requests", "tú"; labels with no verb, so neutral)

- "requests.list.absence": "Fechas de ausencia: {period}" (the period keeps the existing "{start} al {end}" with the month name, for example "1 nov 2026 al 3 nov 2026")
- "requests.list.subjects": "Asignaturas: {codes}"
- "requests.list.moreSubjects": "{codes} y {count} más"
- "requests.list.reason": "Motivo: {reason}" (the same label as "requests.detail.decision.reason"; the reason is the RN-17 label of a returned request, for example "El documento no es legible", or the excerpt of a rejection)

English twins: "Absence dates: {period}"; "Subjects: {codes}"; "{codes} and {count} more"; "Reason: {reason}". The state labels, the title and the other list keys are unchanged.

#### Deviations (all of S4)

1. **`src/app/(dashboard)/requests/page.tsx` not edited.** Task 4.9 lists it, but the page already passes each list item to the card; `src/app/(dashboard)/requests/page.test.tsx` pins the pass-through.
2. **Branch names.** See the PR 4 deviations: "-4-card-reasons" and "-4b-request-card" instead of "-4-request-cards".
3. **Cut at unit 7; both parts over the stop line.** PR 4 606 and PR 4b 520 changed lines. Size exception.
4. **Approved cards (owner decision of 2026-11-20).** The spec, design D7 and tasks 4.1, 4.4 and 4.8 were edited first; the reader never reads an approved decision and the card gates on the state as well.
5. **Reason fallback.** A returned request whose code is not in the catalog shows the excerpt of its text (D7), which the spec's "label of its RN-17 reason code" does not cover; with a known code the label is shown.
6. **Reason line clamp.** The excerpt is at most 140 characters and the card clamps it to 2 lines (owner resolution 3). At 360 px a line holds about 40 characters, so a long excerpt is visually cut by the clamp before the ellipsis the server added; the complete text is on the detail.
7. **Mutation checks with an uncommitted GREEN.** Byte-identical backup copies, checked with "cmp".

### Notes for S5 (RF-08, local preview and file names)

- Base: S5 stacks on "feat/flow-experience-4b-request-card" (the S4 tip, #115).
- Overlap with S4: `src/lib/data/student-requests.ts` (S5 adds `getReturnedDocumentIds` after `getCorrectionReason`, so no conflict with the list reader) and `src/lib/data/student-requests.test.ts` (S4 rewrote only the listOwnRequests block; append a new describe at the end). The helpers `listClass` and `listDecision` in that file serve only the list block.
- `src/app/(dashboard)/requests/design-system.test.tsx` and `src/app/(dashboard)/requests/no-signals.test.ts` skip or scan the "new" and "correct" folders differently: the design pins skip "new" and "correct" (they have their own pins), while the signals scan walks every file under the requests directory, so a new module under "new" must name no signal word.
- Size: S4 ran 4.5 times its forecast and tests were 81 to 88 percent of the lines. S5's forecast is about 240, so expect 700 to 1000; the plan's cut is after unit 10 (the preview component, then the documents step, then the review and resubmit marks). Measure after each unit.
- Pitfalls met in S4: the Write tool turns a typed backslash-u escape into the real character; shell heredocs lose backslashes, and a heredoc with an apostrophe in a quoted body can end the command early, so write scripts and long text with the Write tool and run them with node. A shell count of carriage returns with rg and a dollar-quote was unreliable; count them with a node one-liner. "npx prettier --write <file> --end-of-line lf" converts a CRLF file to LF without changing the index content.
- Still true from S3: resolve the promise of a mocked server action at the end of the test, because React entangles async actions across roots.
- Tooling: only "rg" is installed (no "fd", "bat", "eza", "sd"); the catalog insert helper "i18n-set.cjs" and the "fixengram.sh" script are in the scratchpad.
## Phase 5 (PR 5): S5 RF-08, the local preview and the marked file names

Mode: Strict TDD. Date: 2026-11-20. Branch "feat/flow-experience-5-local-preview", cut from the tip of "feat/flow-experience-4b-request-card" (78b3d80, the S4 tip, #115). Size exception per the owner decision of 2026-11-20 (see Phase 1). Units 9 and 10 (the preview) measured 772 changed lines, over the 460 stop line, so the slice is cut at the plan's cut point, after unit 10:

- **PR 5**, branch "feat/flow-experience-5-local-preview": unit 9 (the preview component) and unit 10 (the documents step offers it). It stacks on #115.
- **PR 5b**, branch "feat/flow-experience-5b-file-marks", cut from the tip of PR 5: unit 11 (the "Nuevo" and "Anterior" marks in the correction flow, FE-16).

### Owner decisions of 2026-11-20 applied here (final)

- The RF-08 preview is client-side only, with browser object URLs (the pattern of `src/app/(dashboard)/catalog/import/credentials-download.tsx`). It writes no audit row and makes no server read.
- It covers the files attached during the current visit to step 3. Older files keep the audited "Ver".
- The resubmit dialog and steps 3 and 4 mark each file "Nuevo" or "Anterior" (PR 5b).

### Commits (PR 5)

| Unit | Hash    | Message                                                            |
| ---- | ------- | ------------------------------------------------------------------ |
| 9    | 033de53 | feat(requests): add the client-side file preview                   |
| 10   | 94310a8 | feat(requests): offer the preview for files attached in this visit |
| docs | (tip)   | docs(flow-experience): record the Phase 5 apply progress for PR 5  |

### TDD cycle evidence (PR 5)

| Task        | Test file                                                       | Layer              | Safety net                            | RED                                                                                                                                                                                                                                                                                        | GREEN             | Triangulation                                                                                                                                                                                                                                                                                                                                                                                                                                    | Refactor                                                        |
| ----------- | --------------------------------------------------------------- | ------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| 5.1 and 5.2 | `src/app/(dashboard)/requests/new/local-preview.test.tsx` (new) | Unit and component | N/A (new file)                        | The file failed to load (module missing)                                                                                                                                                                                                                                                   | 1 file, 19 passed | previewKind for 8 types (pdf, png, jpeg, gif, svg, html, exe, empty); iframe for a PDF and img for png and jpeg, with the name as title or alt and a blob URL; name and size in es and en; a file the browser cannot render shows name and size only and creates no URL; unmount revokes the exact URL; a StrictMode double mount leaves none unrevoked; a changed file revokes the old URL; no fetch and no route URL; no fixed width at 360 px | The test helper got StrictMode and rerender options (see below) |
| 5.4 and 5.5 | `src/app/(dashboard)/requests/new/documents-step.test.tsx`      | Component          | 28 existing cases of the file passing | 13 cases failed first (closed toggle, open iframe, img, close revokes, two rows, no route, removal revokes and drops, failed removal keeps, unmount revokes, stored document keeps Ver, English, correction flow, 360 px); the "finalize rejects" and "no document id" cases pass at write | 43 passed         | PDF and PNG; closed then open then closed; each row on its own; no fetch and no route URL in the markup; removal revokes and drops, a failed removal keeps; step unmount revokes; a document stored before the visit keeps "Ver" and offers no preview, next to one attached now; a rejected file offers none even if a row with its name appeared; no document id gives none; English; the correction flow; no fixed width                      | None needed                                                     |
| 5.4 and 5.5 | `src/i18n/intake-messages.test.ts`                              | Unit               | Existing cases passing                | 4 cases failed first (exact copy es and en, the informal address, the visible label inside each accessible name in es and en)                                                                                                                                                              | Pass              | Exact copy of the five keys in es and en; no formal "Compruebe"; "{name}" present in both accessible names                                                                                                                                                                                                                                                                                                                                       | None needed                                                     |

### Mutation checks (revert-only; files restored from byte-identical backup copies and checked with "cmp", because the GREEN was not committed yet)

| Pass-at-write test or guard                                                                   | Temporary edit                                                                                             | Result                                                                                                                |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| local-preview "mounts an iframe", the img cases, the StrictMode case, the route case (5.6)    | In `src/app/(dashboard)/requests/new/local-preview.tsx`: the src is a document-route URL                   | 5 local-preview cases failed, and 4 documents-step cases failed, including "reads nothing from the server to preview" |
| local-preview unmount, StrictMode and changed-file cases                                      | In `src/app/(dashboard)/requests/new/local-preview.tsx`: the cleanup does not revoke                       | 3 failed, as expected                                                                                                 |
| documents-step "offers no preview when finalize returns no document id"                       | In `src/app/(dashboard)/requests/new/documents-step.tsx`: a missing id falls back to 9                     | Failed                                                                                                                |
| documents-step "offers no preview, and shows the rejection, for a file that finalize rejects" | In `src/app/(dashboard)/requests/new/documents-step.tsx`: the file is held before the ok check             | Failed (the case was first strengthened to show a row with the rejected name, because the first version passed)       |
| documents-step "keeps Ver, and offers no preview, for a document stored before this visit"    | In `src/app/(dashboard)/requests/new/documents-step.tsx`: a fallback file for every row                    | 4 failed, including it                                                                                                |
| documents-step "keeps the preview when the removal fails"                                     | In `src/app/(dashboard)/requests/new/documents-step.tsx`: the entry is dropped even when the removal fails | Failed                                                                                                                |

### Checkpoint (task 5.12): measured size of PR 5

Measure: "git diff --numstat feat/flow-experience-4b-request-card...HEAD" excluding "openspec/" and ".engram/".

| Scope                                                                     | Changed lines |
| ------------------------------------------------------------------------- | ------------- |
| Unit 9 (component 64, its test 181, shared test helper 55)                | 300           |
| Unit 10 (documents step 157, its test 261, copy test 44, two catalogs 10) | 472           |
| All of PR 5 (725 added, 47 deleted; production 231 and tests 541)         | 772           |

The design forecast for all of S5 was about 240. Units 9 and 10 alone are 3.2 times that. Tests are 70 percent of the lines and were not trimmed. Unit 10 alone is over the 460 stop line, and unit 9 and unit 10 have no seam that would bring either under it, so the slice is cut after unit 10, as the plan says. Size exception.

### Work unit evidence (PR 5)

| Evidence                              | Value                                                                                                                                                                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused test command and exact result | "DATABASE_URL='postgres://u:p@127.0.0.1:9/x' npm test -- src/app/(dashboard)/requests src/i18n": 32 files, 974 tests, all passed                                                                                                                             |
| Runtime harness                       | N/A in this run: the owner-run RF-08 regression on "flow-it" (task 12.2) is not part of Phase 5, and no database or Neon command was run (the dummy DB URL only). The preview never reaches a server, so there is no audit row to compare                    |
| Rollback boundary                     | Revert the PR: `src/app/(dashboard)/requests/new/local-preview.tsx` is removed, `src/app/(dashboard)/requests/new/documents-step.tsx` returns to its audited "Ver" link for every row, and the five catalog keys go. No data, no schema, no audit event type |

### Gates (task 5.13), tip of "-5-local-preview", dummy DB

- Full "npm test": 372 files, 9174 tests, all passed, 255.2 s vitest duration (4 m 17 s wall). The S4 tip was 371 files and 9136 tests; PR 5 adds one test file (local-preview) and 38 tests.
- "npm run typecheck": exit 0.
- "npx eslint src": apart from the known CRLF "Delete" prettier noise (142135 findings counted with it), the only findings are the same three in files S5 does not touch: the unused `SidebarGroupLabel` warning in `src/components/app-sidebar.tsx` and two prettier quote errors in `src/test/access/inventory.ts`. "npx eslint" on the touched files alone is clean, and "npx prettier --check" passes on every touched file and on both catalogs.

### Files (PR 5; all LF in the working tree, the index was already LF)

| File                                                       | Action                                                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/(dashboard)/requests/new/local-preview.tsx`       | Created: previewKind and LocalPreview (object URL assigned in an effect, revoked in the cleanup)                                     |
| `src/app/(dashboard)/requests/new/local-preview.test.tsx`  | Created: 19 cases                                                                                                                    |
| `src/app/(dashboard)/requests/new/documents-step.tsx`      | Modified: files held by document id, the "Vista previa" toggle and panel for a file attached in this visit, entry dropped on removal |
| `src/app/(dashboard)/requests/new/documents-step.test.tsx` | Modified: 15 new cases                                                                                                               |
| `src/app/(dashboard)/requests/new/test-support.tsx`        | Modified: stubObjectUrls, and renderIntl keeps the provider on rerender and takes a StrictMode flag                                  |
| `src/i18n/intake-messages.test.ts`                         | Modified: exact copy of the preview keys                                                                                             |
| `i18n/es.json`, `i18n/en.json`                             | Modified: "intake.documents.preview", "previewNamed", "hidePreview", "hidePreviewNamed" and "previewHint"                            |

### Final Spanish UI copy added in PR 5 (student screen "intake", "tú"; the labels have no verb, so neutral)

- "intake.documents.preview": "Vista previa"
- "intake.documents.previewNamed": "Vista previa de {name}" (the accessible name of the toggle)
- "intake.documents.hidePreview": "Ocultar vista previa"
- "intake.documents.hidePreviewNamed": "Ocultar vista previa de {name}"
- "intake.documents.previewHint": "Comprueba que este es el documento correcto antes de continuar."

English twins: "Preview"; "Preview of {name}"; "Hide preview"; "Hide preview of {name}"; "Check that this is the right document before you continue."

### Deviations (PR 5)

1. **Cut after unit 10.** The preview measured 772 lines; PR 5b carries unit 11. Size exception.
2. **Base.** Task 5.0 says "from the PR 4 branch" and tasks 5.12 and 5.14 name "feat/flow-experience-4-request-cards"; the real base is the tip of "feat/flow-experience-4b-request-card" (#115). The PR targets that branch.
3. **Unit 9 lists three files, not two.** The object-URL spies and the StrictMode and rerender options are shared by the preview and documents-step tests, so they live in `src/app/(dashboard)/requests/new/test-support.tsx`. StrictMode only double-runs effects at the root of the tree, so `renderIntl` takes a flag instead of letting each test wrap its own element.
4. **No "previewImageAlt" or "previewPdfTitle" keys.** FE-17 says the preview has the file name as its text alternative, so the image alt and the frame title are the name itself; a "Documento {name}" wrapper would only add a key.
5. **Accessible names.** The design words them "Ver la vista previa de {name}" and "Ocultar la vista previa de {name}"; the visible labels are "Vista previa" and "Ocultar vista previa", and the second accessible name did not contain its visible label (WCAG 2.5.3). The names are now "Vista previa de {name}" and "Ocultar vista previa de {name}". Task 5.4 leaves the exact copy open.
6. **Informal address.** The hint is "Comprueba..." (student screen, owner resolution 1), not the design's "Compruebe...".
7. **Name and size twice.** The preview caption repeats the name and size the row already shows, because FE-17 requires them with the preview and the component also serves a file the browser cannot render.
8. **The preview applies to files attached in this visit only.** A file attached, then a navigation to step 4 and back, has no local copy and shows "Ver" (owner decision 4). The held files live in the step's state and go with it.
9. **Task 5.6.** The documents-step mutation is made in `src/app/(dashboard)/requests/new/local-preview.tsx` because the documents step builds no URL itself.
10. **Mutation checks with an uncommitted GREEN.** As in S1 to S4: byte-identical backup copies, checked with "cmp".
11. **Line endings.** The touched files were CRLF in the working tree (index LF); they were converted to LF without changing the index content. "git status" still lists some as modified (a line-ending artifact only).
12. **Tasks 5.12 to 5.14.** They close when PR 5b is done, over both PRs.
### PR 5b: the file marks in the correction flow (unit 11)

Branch "feat/flow-experience-5b-file-marks", cut from the tip of PR 5 ("feat/flow-experience-5-local-preview", 1720a98). It targets that branch. Together with PR 5 it closes S5. Pull requests: PR 5 is #116 ("https://github.com/Josuedcm03/justifia/pull/116", base "feat/flow-experience-4b-request-card", stacked on #115) and PR 5b is #117 ("https://github.com/Josuedcm03/justifia/pull/117", base "feat/flow-experience-5-local-preview").

#### Commits (PR 5b)

| Unit | Hash    | Message                                                                 |
| ---- | ------- | ----------------------------------------------------------------------- |
| 11   | 3e60505 | feat(requests): name the files with their origin in the correction flow |
| docs | (tip)   | docs(flow-experience): record the Phase 5 apply progress for PR 5b      |

#### TDD cycle evidence (PR 5b)

| Task         | Test file                                                                  | Layer            | Safety net                                        | RED                                                                                                                                                                                                                                  | GREEN     | Triangulation                                                                                                                                                                                                                                                                       | Refactor    |
| ------------ | -------------------------------------------------------------------------- | ---------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 5.8 and 5.10 | `src/lib/data/student-requests.test.ts`                                    | Unit             | The list, detail and correction-reason cases pass | 5 cases failed first (export missing)                                                                                                                                                                                                | 53 passed | Ids of the latest revision; an empty snapshot; no row for another student, another state or an unknown id (one select); id, owner, "devuelta" filters and the newest-first order; reads only                                                                                        | None needed |
| 5.9 and 5.10 | `src/app/(dashboard)/requests/new/resubmit-dialog.test.tsx` (new)          | Component        | N/A (new file)                                    | 6 cases failed first (kept Anterior and added Nuevo without the retired one, all Nuevo, names with no mark, English, 120-character name, mark as text); the confirm, cancel, refusal, no-route, no-list and copy cases pass at write | 12 passed | Kept and added; empty returned version; null ids; English; no documents; title, description and two buttons unchanged; confirm once calls the action once with no argument; cancel; refusal closes and reports; no fetch and no route link; 120 characters wrap with no fixed width | None needed |
| 5.9 and 5.10 | `src/app/(dashboard)/requests/new/documents-step.test.tsx`                 | Component        | 43 existing cases of the file passing             | 4 cases failed first (marks, all Nuevo, English, a file attached now); the null and absent cases pass at write                                                                                                                       | Pass      | Anterior and Nuevo; empty returned version; null and absent give no mark; English; a file attached now is Nuevo, keeps its preview, and a kept file keeps Ver                                                                                                                       | None needed |
| 5.9 and 5.10 | `src/app/(dashboard)/requests/new/review-step.test.tsx`                    | Component        | Existing cases passing                            | 2 cases failed first (marks in the section, marks in the dialog); the null, absent, Ver link and submit-dialog cases pass at write                                                                                                   | Pass      | Marks; the audited Ver link kept; null and absent give none; the dialog gets the same names and marks; the submit dialog of a new request lists nothing                                                                                                                             | None needed |
| 5.9 and 5.10 | `src/app/(dashboard)/requests/[id]/correct/page.test.tsx`                  | Component (page) | Existing cases passing                            | 5 cases failed first (read by id, read together with the draft and the reason, marks on step 3, on step 4 and in the dialog, all Nuevo); the unreadable ids and no-route cases pass at write                                         | Pass      | Read with the session user and the id; started before the draft resolves; marks on steps 3 and 4 and in the dialog; empty snapshot; a failed read shows names with no mark; no fetch                                                                                                | None needed |
| 5.9 and 5.10 | `src/i18n/correction-messages.test.ts`, `src/i18n/intake-messages.test.ts` | Unit             | Existing cases passing                            | 4 cases failed first (exact copy es and en; the two marks differ, es and en); the confirmation copy case passes at write                                                                                                             | Pass      | Exact title and marks in es and en; the confirmation copy still present                                                                                                                                                                                                             | None needed |
| 5.9          | `src/app/(dashboard)/requests/correct-design-system.test.tsx`              | Component        | Existing suites green                             | 12 cases failed first only because its mock of the reader lacked the new export; no new case                                                                                                                                         | Pass      | Its mock now returns an empty returned version, so every 360 px and 44 px pin also covers the marks                                                                                                                                                                                 | None needed |

#### Mutation checks (revert-only; files restored from byte-identical backup copies and checked with "cmp", because the GREEN was not committed yet)

| Pass-at-write test                                                                  | Temporary edit                                                                                    | Result                                                            |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| the null and absent cases of the dialog, documents step and review step             | In `src/app/(dashboard)/requests/new/file-origin-mark.tsx`: unknown ids claim the origin "new"    | 5 failed, as expected                                             |
| resubmit-dialog "shows no list when the request holds no document"                  | In `src/app/(dashboard)/requests/new/resubmit-dialog.tsx`: the list always renders                | Failed                                                            |
| student-requests owner, state and order guard                                       | In `src/lib/data/student-requests.ts`: the reader drops its owner and state filters               | 2 failed (the new guard and one older guard hit by the same edit) |
| page "shows the names with no mark, and still renders, when the ids cannot be read" | In `src/app/(dashboard)/requests/[id]/correct/page.tsx`: the read has no catch                    | Failed                                                            |
| resubmit-dialog "resubmits once on one confirmation, with no extra step"            | In `src/app/(dashboard)/requests/new/confirm-dialog.tsx`: confirming runs the action twice        | Failed                                                            |
| resubmit-dialog "wraps a 120-character name"                                        | In `src/app/(dashboard)/requests/new/resubmit-dialog.tsx`: the name truncates instead of wrapping | Failed                                                            |
| page "reads nothing from the document route to name the files"                      | In `src/app/(dashboard)/requests/[id]/correct/page.tsx`: the page fetches a document route URL    | Failed                                                            |

#### Checkpoint (task 5.12): measured size of PR 5b

Measure: "git diff --numstat feat/flow-experience-5-local-preview...HEAD" excluding "openspec/" and ".engram/".

| Scope                                                                                                                                            | Changed lines |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| Production (reader 28, page 14, resubmit dialog 38, review step 20, documents step 18, confirm dialog 6, flow steps 5, mark 51, two catalogs 14) | 194           |
| Tests (resubmit dialog 187, page 120, review step 76, documents step 75, correction copy 42, reader 54, intake copy 16, design system 10)        | 580           |
| All of PR 5b (758 added, 16 deleted)                                                                                                             | 774           |
| PR 5 (units 9 and 10)                                                                                                                            | 772           |
| All of S5                                                                                                                                        | 1546          |

The design forecast for all of S5 was about 240; S5 is 6.4 times that. Unit 11 alone is over the 460 stop line and the plan names no cut inside it. Its only seam, the reader and the page against the components, would leave a PR whose reader nothing renders. Tests are 75 percent of the lines and were not trimmed. Size exception per the owner decision of 2026-11-20.

#### Work unit evidence (PR 5b)

| Evidence                              | Value                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | "DATABASE_URL='postgres://u:p@127.0.0.1:9/x' npm test -- src/app/(dashboard)/requests src/i18n src/lib/data/student-requests": 34 files, 1064 tests, all passed                                                                                                                                                                   |
| Runtime harness                       | N/A in this run: the owner-run RF-08 regression on "flow-it" (task 12.2) is not part of Phase 5, and no database or Neon command was run (the dummy DB URL and the statement double only). The reader is the only new read; it is owner-scoped, reads no document and writes no audit row                                         |
| Rollback boundary                     | Revert the PR: `src/app/(dashboard)/requests/new/file-origin-mark.tsx` is removed, the documents step, review step and `src/app/(dashboard)/requests/new/resubmit-dialog.tsx` lose their marks and the file list, the page stops reading the returned ids, and the three catalog keys go. No data, no schema, no audit event type |

#### Gates (task 5.13), tip of "-5b-file-marks" (the S5 tip), dummy DB

- Full "npm test": 373 files, 9216 tests, all passed, 270.2 s vitest duration. PR 5 was 372 files and 9174 tests; PR 5b adds one test file (resubmit-dialog) and 42 tests. Against the S4 tip (371 files, 9136 tests) all of S5 adds two files and 80 tests.
- "npm run typecheck": exit 0.
- "npx eslint src": apart from the known CRLF "Delete" prettier noise, the only findings are the same three in files S5 does not touch: the unused "SidebarGroupLabel" warning in `src/components/app-sidebar.tsx` and two prettier quote errors in `src/test/access/inventory.ts`. "npx eslint" on the touched files alone is clean, and "npx prettier --check" passes on every touched file and on both catalogs.
- "npm test -- src/app/(dashboard)/requests src/i18n src/lib/data/student-requests": 34 files, 1064 tests, all passed.

#### Files (PR 5b; all LF in the working tree, the index was already LF)

| File                                                                                                                                                                                                                                                                                                                                                               | Action                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `src/app/(dashboard)/requests/new/file-origin-mark.tsx`                                                                                                                                                                                                                                                                                                            | Created: originOf and FileOriginMark, the text mark "Nuevo" or "Anterior"                        |
| `src/lib/data/student-requests.ts`                                                                                                                                                                                                                                                                                                                                 | Modified: getReturnedDocumentIds, one owner-scoped select                                        |
| `src/app/(dashboard)/requests/[id]/correct/page.tsx`                                                                                                                                                                                                                                                                                                               | Modified: the ids are read in the existing Promise.all with a catch to null and passed down      |
| `src/app/(dashboard)/requests/new/flow-steps.tsx`                                                                                                                                                                                                                                                                                                                  | Modified: previousDocumentIds to the documents and review steps                                  |
| `src/app/(dashboard)/requests/new/documents-step.tsx`, `src/app/(dashboard)/requests/new/review-step.tsx`                                                                                                                                                                                                                                                          | Modified: the mark beside each file's size                                                       |
| `src/app/(dashboard)/requests/new/resubmit-dialog.tsx`, `src/app/(dashboard)/requests/new/confirm-dialog.tsx`                                                                                                                                                                                                                                                      | Modified: the dialog lists the files with their marks; the confirm dialog takes an optional body |
| `src/app/(dashboard)/requests/new/resubmit-dialog.test.tsx`                                                                                                                                                                                                                                                                                                        | Created: 12 cases                                                                                |
| `src/lib/data/student-requests.test.ts`, `src/app/(dashboard)/requests/[id]/correct/page.test.tsx`, `src/app/(dashboard)/requests/new/documents-step.test.tsx`, `src/app/(dashboard)/requests/new/review-step.test.tsx`, `src/app/(dashboard)/requests/correct-design-system.test.tsx`, `src/i18n/correction-messages.test.ts`, `src/i18n/intake-messages.test.ts` | Modified: new cases, and the reader mock of the design-system pin                                |
| `i18n/es.json`, `i18n/en.json`                                                                                                                                                                                                                                                                                                                                     | Modified: "intake.correction.resubmit.filesTitle" and "marks" (with "new" and "previous")        |

#### Final Spanish UI copy added in PR 5b (student screen "intake", "tú"; a title and two marks, so neutral)

- "intake.correction.resubmit.filesTitle": "Documentos que se enviarán"
- "intake.correction.resubmit.marks.new": "Nuevo"
- "intake.correction.resubmit.marks.previous": "Anterior"

English twins: "Documents that will be sent"; "New"; "Previous". The dialog title, description and buttons are unchanged.

#### Final Spanish UI copy of all of S5

"intake.documents.preview": "Vista previa"; "previewNamed": "Vista previa de {name}"; "hidePreview": "Ocultar vista previa"; "hidePreviewNamed": "Ocultar vista previa de {name}"; "previewHint": "Comprueba que este es el documento correcto antes de continuar."; "intake.correction.resubmit.filesTitle": "Documentos que se enviarán"; "marks.new": "Nuevo"; "marks.previous": "Anterior".

#### Deviations (PR 5b)

1. **Cut.** PR 5b exists because the preview alone measured 772 lines (see PR 5). Unit 11 is not cut further (774 lines, no plan seam).
2. **New file.** The mark and the origin rule live in `src/app/(dashboard)/requests/new/file-origin-mark.tsx`, which task 5.10 does not list: the documents step, the review step and the dialog share them.
3. **"documents" is optional on the dialog.** Task 5.10 does not say; `src/app/(dashboard)/requests/correct-design-system.test.tsx` renders the dialog without it, so an absent list lists nothing instead of forcing an edit of that unrelated render.
4. **Mark position.** The mark sits beside the size under the name in the documents and review rows, so the name keeps the row at 360 px; in the dialog it follows the name on the same line and wraps under a long name.
5. **The ids are read on every step.** The page reads the returned ids with the draft and the reason, before the step is known, as task 5.10 says (the existing Promise.all). Steps 1 and 2 pay one owner-scoped select they do not use.
6. **One existing test file edited.** `src/app/(dashboard)/requests/correct-design-system.test.tsx` mocks the reader module, so the mock gained the new export (an empty returned version, so its pins also cover the marks).
7. **Mutation checks with an uncommitted GREEN.** Byte-identical backup copies, checked with "cmp". The reader mutation also hit one older guard of the list reader, because both share an owner filter line.
8. **Fixture typo.** The 120-character name of the dialog test was built 114 characters long and its length guard failed first; the fixture was corrected and the case still fails against the old dialog for the right reason (no wrapping span).
9. **Line endings.** The touched files were CRLF in the working tree (index LF); they were converted to LF without changing the index content.

### Notes for S6 (RF-01, dates recap and future-start notice)

- Base: S6 stacks on "feat/flow-experience-5b-file-marks" (the S5 tip, #117). Tasks 6.0, 6.9 and 6.11 name "feat/flow-experience-5-local-preview" as the base; the real base is the 5b tip, which holds all of S5.
- Overlap with S5, all in files S5 changed (append-only in the tests, small hunks in the sources):
  - `src/app/(dashboard)/requests/new/documents-step.tsx`: each row is now an "li" with a "flex-col" holding the row and the preview panel, the name column also holds the size and the origin mark, and the step keeps two state values (held files, open previews). The recap goes at the top of the step shell, above the hint; do not touch the list.
  - `src/app/(dashboard)/requests/new/review-step.tsx`: the documents section has the same size and mark row. The future-start notice goes under the period paragraph of the details section; the new "previousDocumentIds" prop stays.
  - `src/app/(dashboard)/requests/new/flow-steps.tsx`: it already passes "previousDocumentIds" to steps 3 and 4. Add "today" the same way and pass it to steps 1 to 4.
  - `src/app/(dashboard)/requests/[id]/correct/page.tsx`: the Promise.all now has three entries and the page passes "previousDocumentIds" to FlowSteps; "today" is a plain value computed after it, not a read.
  - `src/app/(dashboard)/requests/new/documents-step.test.tsx` and `src/app/(dashboard)/requests/new/review-step.test.tsx`: append a new describe at the end. `src/app/(dashboard)/requests/[id]/correct/page.test.tsx` now mocks "getReturnedDocumentIds" with an empty list by default (every file renders the mark "Nuevo" there), and `src/app/(dashboard)/requests/correct-design-system.test.tsx` does the same.
- Test helper: renderIntl in `src/app/(dashboard)/requests/new/test-support.tsx` now returns a "rerender" that keeps the provider (pass the bare element) and takes a third "strict" argument; StrictMode only double-runs effects at the root of the tree. For fake time, use "vi.useFakeTimers" with "toFake" set to only "Date" and "vi.setSystemTime", so the user-event clicks keep working, and restore real timers in afterEach.setSystemTime" and restore real timers in afterEach, because the user-event clicks in the same file need real ones.
- Copy: the recap is on student screens, so "tú". The design's "Fechas de la ausencia" is overridden by "Fechas de ausencia" (FE-18, spec governs), the same label as the request card of S4 ("requests.list.absence"); the future-start line of the design uses "corrija" and "puede", so word it in "tú" as task 6.2 gives it. A label has no verb, so it is neutral.
- Size: S5 ran 6.4 times its forecast (1546 lines for about 240) and tests were 70 to 75 percent. S6's forecast is about 140, so expect 600 to 900; the plan has no cut inside S6, so cut at unit 12 (the pure helper and the recap component, tasks 6.1 to 6.4) and unit 13 (the wiring, tasks 6.5 to 6.8), as the owner's size exception allows. Measure after each unit.
- Pitfalls met in S5: "getByTitle" has no "selector" option, and the name span of a document row carries the file name as its title, so find an iframe by tag; "getByText" with a name finds the row span and the preview caption, so use a "selector" or the row; React async actions entangle across roots, so resolve every mocked promise of a server action before the test ends; Write and heredocs mangle some backslashes and quotes, so write scripts as files and run them with node.
- Tooling: only "rg" is installed (no "fd", "bat", "eza", "sd"). The scratchpad helpers still work: "i18n-set.cjs" (catalog insert, now also takes object values), "mark-p1.cjs" (task marks with a "_date" key), "p5-append.cjs" (append a file as LF), "p5-lf.sh" (restore unmodified files from HEAD as LF) and "fixengram.sh". "git status" lists LF-converted files as modified; that is a line-ending artifact only.
## Phase 6 (PR 6): S6 RF-01, the dates recap and the future-start check

Mode: Strict TDD. Date: 2026-11-20. Branch "feat/flow-experience-6-dates-recap", cut from the tip of "feat/flow-experience-5b-file-marks" (1aca0ed, the S5 tip, #117). Size exception per the owner decision of 2026-11-20 (see Phase 1). The plan has one cut inside S6, between unit 12 (the pure helper and the recap component) and unit 13 (the wiring into the steps and pages), so the slice is cut there as the owner's size rule allows:

- **PR 6**, branch "feat/flow-experience-6-dates-recap": unit 12, the helper `startsAfterToday`, the `DatesRecap` and `FutureStartNotice` components and the four catalog keys. Nothing renders them yet, so no screen changes in this PR. It stacks on #117.
- **PR 6b**, branch "feat/flow-experience-6b-dates-wiring", cut from the tip of PR 6: unit 13 (today from the server in Managua, the recap on steps 2 and 3, the notice on steps 1 and 4).

### Owner decisions of 2026-11-20 applied here (final)

- The future-start notice never blocks: no control is disabled, no field error is raised and no validation changes.
- "Today" is computed on the server, in the Managua time zone, and passed down to the steps.

### Commits (PR 6)

| Unit | Hash    | Message                                                           |
| ---- | ------- | ----------------------------------------------------------------- |
| 12   | df0f688 | feat(requests): add the dates recap and the future-start check    |
| docs | (tip)   | docs(flow-experience): record the Phase 6 apply progress for PR 6 |

### TDD cycle evidence (PR 6)

| Task        | Test file                                                     | Layer              | Safety net                            | RED                                                                             | GREEN     | Triangulation                                                                                                                                                                                                                                                                                                                                                                                                            | Refactor    |
| ----------- | ------------------------------------------------------------- | ------------------ | ------------------------------------- | ------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| 6.1 and 6.3 | `src/app/(dashboard)/requests/new/steps.test.ts`              | Unit               | 35 existing cases of the file passing | 12 cases failed first (export missing)                                          | 47 passed | Start tomorrow, today, yesterday, far past and far future; a month boundary and a year boundary in both directions; null, an empty start, an impossible date and a word; a start alone with no end; a today that is not a real date                                                                                                                                                                                      | None needed |
| 6.2 and 6.3 | `src/app/(dashboard)/requests/new/dates-recap.test.tsx` (new) | Unit and component | N/A (new file)                        | The file failed to load (module missing)                                        | 24 passed | Label and range with weekday and month name in es and en; one day with its weekday in es and en; the same days under three host zones (UTC-11, UTC+14, Managua); read only, one link only; long text wraps; the edit link in es and en with its 44 px target; the notice as a note for a start after today in es and en; tomorrow, today and yesterday; a past start; no today given; no alert role and no error styling | None needed |
| 6.2 and 6.3 | `src/i18n/intake-messages.test.ts`                            | Unit               | Existing cases passing                | 3 cases failed first (exact copy es and en; the label matches the request card) | Pass      | Exact copy of the four keys in es and en; no formal "corrija" or "puede " in the notice; the label is the start of the S4 card line                                                                                                                                                                                                                                                                                      | None needed |

### Mutation checks (revert-only; the file was restored from a byte-identical backup copy and checked with "cmp", because the GREEN was not committed yet)

Every case of this unit failed first (the module or the export was missing), so there is no pass-at-write case. Two checks confirm that the two rules with a subtle failure are really pinned.

| Rule pinned                          | Temporary edit                                                                                      | Result                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| No time-zone shift of a calendar day | In `src/app/(dashboard)/requests/new/dates-recap.tsx`: format in "America/Managua" instead of "UTC" | 8 failed (every date case, in es and en, and the three host zones) |
| The start day itself gets no notice  | In `src/app/(dashboard)/requests/new/steps.ts`: compare with ">=" instead of ">"                    | 2 failed (the helper's "today" case and the recap's "today" case)  |

### Checkpoint (task 6.9): measured size of PR 6

Measure: "git diff --numstat feat/flow-experience-5b-file-marks...HEAD" excluding "openspec/" and ".engram/".

| Scope                                                        | Changed lines |
| ------------------------------------------------------------ | ------------- |
| Production (recap and notice 81, helper 16, two catalogs 12) | 109           |
| Tests (recap 194, helper 37, copy 32)                        | 263           |
| All of PR 6 (372 added, 0 deleted)                           | 372           |

The design forecast for all of S6 was about 140. Unit 12 alone is 2.7 times that and under the 460 stop line; the wiring is the rest of the slice (see PR 6b). Tests are 71 percent of the lines and were not trimmed.

### Work unit evidence (PR 6)

| Evidence                              | Value                                                                                                                                                                                                                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | "DATABASE_URL='postgres://u:p@127.0.0.1:9/x' npm test -- steps.test dates-recap src/i18n": 11 files, 515 tests, all passed                                                                                                                                                              |
| Runtime harness                       | N/A in this run: the owner-run capture "RF-01" on "flow-it" (task 12.9) belongs to PR 6b, where the recap first renders. No database or Neon command was run (the dummy DB URL only)                                                                                                    |
| Rollback boundary                     | Revert the PR: `src/app/(dashboard)/requests/new/dates-recap.tsx` is removed, `src/app/(dashboard)/requests/new/steps.ts` loses `startsAfterToday`, and the four "intake.datesRecap" keys go. Nothing renders them yet, so no screen, no data, no schema and no audit event type change |

### Gates (task 6.10), tip of "-6-dates-recap", dummy DB

- Full "npm test": 374 files, 9255 tests, all passed, 251.9 s vitest duration. The S5 tip was 373 files and 9216 tests; PR 6 adds one test file (dates-recap) and 39 tests.
- "npm run typecheck": exit 0.
- "npx eslint src": apart from the known CRLF "Delete" prettier noise (140040 findings counted with it), the only findings are the same three in files S6 does not touch: the unused "SidebarGroupLabel" warning in `src/components/app-sidebar.tsx` and two prettier quote errors in `src/test/access/inventory.ts`. "npx eslint" on the touched files alone is clean, and "npx prettier --check" passes on every touched file and on both catalogs.

### Files (PR 6; all LF in the working tree, the index was already LF)

| File                                                    | Action                                                                                                                 |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/app/(dashboard)/requests/new/steps.ts`             | Modified: startsAfterToday (the start alone, a real date after today)                                                  |
| `src/app/(dashboard)/requests/new/dates-recap.tsx`      | Created: DatesRecap (label, range with weekday and month, "Editar fechas" link, notice) and FutureStartNotice (a note) |
| `src/app/(dashboard)/requests/new/steps.test.ts`        | Modified: 12 new cases                                                                                                 |
| `src/app/(dashboard)/requests/new/dates-recap.test.tsx` | Created: 24 cases                                                                                                      |
| `src/i18n/intake-messages.test.ts`                      | Modified: exact copy of the recap keys                                                                                 |
| `i18n/es.json`, `i18n/en.json`                          | Modified: "intake.datesRecap.label", "range", "edit" and "futureStart"                                                 |

### Final Spanish UI copy added in PR 6 (student screen "intake", "tú"; the label, range and link have no verb, so neutral)

- "intake.datesRecap.label": "Fechas de ausencia"
- "intake.datesRecap.range": "Del {start} al {end}"
- "intake.datesRecap.edit": "Editar fechas"
- "intake.datesRecap.futureStart": "La fecha de inicio es posterior a hoy. Si la ausencia ya ocurrió, corrige las fechas; si es una ausencia prevista, puedes continuar."

English twins: "Absence dates"; "From {start} to {end}"; "Edit dates"; "The start date is later than today. If the absence already happened, correct the dates; if it is a planned absence, you can continue."

### Deviations (PR 6)

1. **Cut after unit 12.** The plan has no cut inside S6; the owner's size rule allows one at the seam between the helper and recap (unit 12) and the wiring (unit 13). PR 6 renders nothing on its own.
2. **Base.** Tasks 6.0, 6.9 and 6.11 name "feat/flow-experience-5-local-preview" as the base; the real base is the tip of "feat/flow-experience-5b-file-marks" (#117), which holds all of S5. The PR targets that branch.
3. **Helper signature.** The design writes `startsAfterToday(range, today)` with a full range. The parameter is typed `{ from: string } | null`, so step 1, where the end date may still be empty, can ask with the start alone; a full range passes unchanged. Only the start decides, and an impossible date, an empty start or an invalid today give false.
4. **Extra export.** `FutureStartNotice` is exported from `src/app/(dashboard)/requests/new/dates-recap.tsx`, which the tasks do not list: steps 1 and 4 show the same note without the recap, so the text and the styling live in one place.
5. **Label.** "Fechas de ausencia" (FE-18, the spec governs) replaces the design's "Fechas de la ausencia", the same words as the S4 card line "requests.list.absence".
6. **Copy register.** The notice is worded in "tú" ("corrige", "puedes"), as the student screens do; the design's "corrija" and "puede" are not used.
7. **Touch target.** The edit link is a text link with "min-h-11" (44 px), not a ghost button: a full button would take a whole row at 360 px for a secondary action.
8. **`today` is optional on the recap.** Without it no notice shows, so the recap never guesses a date; PR 6b passes the server's value.
9. **Host zone test.** The three-zone case sets "process.env.TZ" for the run and restores it afterwards. The Managua-zone mutation shows it fails when the recap formats in the wrong zone.
10. **Mutation checks with an uncommitted GREEN.** Byte-identical backup copies, checked with "cmp".
11. **Line endings.** `src/app/(dashboard)/requests/new/steps.ts` and `src/app/(dashboard)/requests/new/steps.test.ts` were CRLF in the working tree (index LF); they were converted to LF without changing the index content.
### PR 6b: the recap and the notice in the flow (unit 13)

Branch "feat/flow-experience-6b-dates-wiring", cut from the tip of PR 6 ("feat/flow-experience-6-dates-recap", e89ef49). It targets that branch. Together with PR 6 it closes S6. Pull requests: PR 6 is #118 ("https://github.com/Josuedcm03/justifia/pull/118", base "feat/flow-experience-5b-file-marks", stacked on #117) and PR 6b is #119 ("https://github.com/Josuedcm03/justifia/pull/119", base "feat/flow-experience-6-dates-recap").

#### Commits (PR 6b)

| Unit | Hash    | Message                                                                           |
| ---- | ------- | --------------------------------------------------------------------------------- |
| 13   | dab5332 | feat(requests): show the recap on steps 2 and 3 and the notice for a future start |
| docs | (tip)   | docs(flow-experience): record the Phase 6 apply progress for PR 6b                |

#### TDD cycle evidence (PR 6b)

| Task        | Test file                                                    | Layer            | Safety net                            | RED                                                                                                                                                  | GREEN                 | Triangulation                                                                                                                                                                                                                                                                      | Refactor    |
| ----------- | ------------------------------------------------------------ | ---------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 6.5 and 6.6 | `src/app/(dashboard)/requests/new/page.test.tsx`             | Component (page) | Existing cases of the file passing    | 8 of 13 new cases failed first (Managua today, 02:00 UTC instant, step 1 usable, recap on steps 2 and 3, notice in the recap on both, review notice) | 34 files, 1126 passed | 2026-11-20 05:30 UTC gives 2026-11-19; 2026-11-02 02:00 UTC with a start of 2026-11-02; a start of today in Managua; recap on steps 2 and 3 with the edit link; none on steps 1 and 4; none without dates or with an end before the start; notice under the period; submit enabled | None needed |
| 6.5 and 6.6 | `src/app/(dashboard)/requests/[id]/correct/page.test.tsx`    | Component (page) | Existing cases of the file passing    | 8 of 9 new cases failed first; the start of today in Managua passes at write                                                                         | Pass                  | The same instants; the request's current dates on steps 2 and 3 with the edit link inside "/requests/31/correct"; notice in the recap and on the review; resubmit enabled; step 1 usable                                                                                           | None needed |
| 6.5 and 6.6 | `src/app/(dashboard)/requests/new/cause-dates-step.test.tsx` | Component        | 13 existing cases of the file passing | 7 of 12 new cases failed first (shown, English, tomorrow, typed, end does not move it, no aria-invalid, not in the server alert)                     | Pass                  | Tomorrow, today and yesterday; empty draft and no today give none; typed then set to today clears; cleared start clears; end change does not move it; saves the future dates and moves to step 2; the cause error alone is an alert                                                | None needed |
| 6.5 and 6.6 | `src/app/(dashboard)/requests/new/subjects-step.test.tsx`    | Component        | Existing cases of the file passing    | 8 of 11 new cases failed first (recap, one day, English, read only, notice, empty, degraded, correction link)                                        | Pass                  | Recap above the list; one day; English; one added link; notice only for a future start; saves as before with the notice; recap with the empty and degraded states; none without dates or without a range; link inside the correction                                               | None needed |
| 6.5 and 6.6 | `src/app/(dashboard)/requests/new/documents-step.test.tsx`   | Component        | Existing cases of the file passing    | 5 of 7 new cases failed first                                                                                                                        | Pass                  | Recap above the list; one day in English; notice only for a future start; the continue link and the picker stay usable; none for a null range or no range; link inside the correction                                                                                              | None needed |
| 6.5 and 6.6 | `src/app/(dashboard)/requests/new/review-step.test.tsx`      | Component        | Existing cases of the file passing    | 4 of 10 new cases failed first (notice in the section after the period, English, tomorrow, resubmit with the notice)                                 | Pass                  | After the period; tomorrow, today and yesterday; none without today or with an unset date; no alert; submit still sends the consent version; resubmit enabled; the days equal the recap's                                                                                          | None needed |
| 6.5 and 6.6 | `src/app/(dashboard)/requests/new/layout-360.test.tsx`       | Component        | Existing cases of the file passing    | 6 of 10 new cases failed first (no width above the viewport on steps 1 to 4, wrapping text, 44 px link)                                              | Pass                  | No fixed width above 360 px on the four steps; footer actions on the full row; axe in es and en with the note showing                                                                                                                                                              | None needed |
| 6.7         | `src/app/(dashboard)/requests/new/actions.test.ts`           | Unit (actions)   | 71 existing cases of the file passing | Pass at write (4 cases)                                                                                                                              | 75 passed             | Step 1 and submit, each with a complete future-start draft accepted as before and a future start with no cause giving the cause error only                                                                                                                                         | None needed |

#### Mutation checks (revert-only; every file was restored from a byte-identical backup copy, because the GREEN was not committed yet)

| Pass-at-write test                                                                                         | Temporary edit                                                                                                                      | Result                                                                     |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| cause-dates-step "disables nothing and still saves the future dates"; the page "keeps step 1 usable" cases | In `src/app/(dashboard)/requests/new/cause-dates-step.tsx`: the button is disabled while the notice shows                           | 4 failed (the step case, the cause-only alert case and the two page cases) |
| review-step "shows no notice without today, or while a date is not set"                                    | In `src/app/(dashboard)/requests/new/review-step.tsx`: the notice no longer waits for the end date                                  | 1 failed                                                                   |
| both pages "shows no notice for a start that is today in Managua"                                          | In `src/app/(dashboard)/requests/new/page.tsx` and `src/app/(dashboard)/requests/[id]/correct/page.tsx`: today is taken a day early | 2 failed                                                                   |
| actions.test, step 1: "accepts a future start as before" and "reports the cause only"                      | In `src/lib/validations/solicitud.ts`: a refinement refuses a start after today                                                     | 3 failed (the two new cases and one older case)                            |
| actions.test, submit: "submits a complete draft with a future start" and "reports the cause error only"    | In `src/lib/intake/submission.ts`: the start validator refuses a start after 2026-10-07                                             | 3 failed (the two new cases and one older case)                            |

The first version of the step-1 mutation put the refusal in a refinement that Zod skips when another field already failed, so it missed the cause-only case; moving it onto the start field made it fire beside the cause error.

#### Checkpoint (task 6.9): measured size of PR 6b

Measure: "git diff --numstat feat/flow-experience-6-dates-recap...HEAD" excluding "openspec/" and ".engram/".

| Scope                                                                                                                                     | Changed lines |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Production (subjects step 21, cause step 20, documents step 18, flow steps 12, review step 11, correction page 5, new page 4)             | 91            |
| Tests (new page 186, cause step 122, correction page 114, subjects step 142, review step 126, layout 118, documents step 104, actions 68) | 980           |
| All of PR 6b (1062 added, 9 deleted)                                                                                                      | 1071          |
| PR 6 (unit 12)                                                                                                                            | 372           |
| All of S6                                                                                                                                 | 1443          |

The design forecast for all of S6 was about 140; S6 is 10 times that. Unit 13 alone is over the 460 stop line and has no seam inside it: every file exists to show the recap or the notice on one step. Tests are 91 percent of the lines and were not trimmed. Size exception per the owner decision of 2026-11-20.

#### Work unit evidence (PR 6b)

| Evidence                              | Value                                                                                                                                                                                                                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | "DATABASE_URL='postgres://u:p@127.0.0.1:9/x' npm test -- src/app/(dashboard)/requests src/i18n": 34 files, 1126 tests, all passed                                                                                                                                                                                |
| Runtime harness                       | N/A in this run: the owner-run capture "RF-01" on "flow-it" (task 12.9) is not part of Phase 6, and no database or Neon command was run (the dummy DB URL and the statement doubles only). The recap and the notice read nothing and write no audit row; the pages add only the Managua date of the server clock |
| Rollback boundary                     | Revert the PR: the two pages stop passing today, `src/app/(dashboard)/requests/new/flow-steps.tsx` and the five step files lose the recap and the notice, and PR 6 returns to blocks nothing renders. No data, no schema, no audit event type, no catalog key                                                    |

#### Gates (task 6.10), tip of "-6b-dates-wiring" (the S6 tip), dummy DB

- Full "npm test": 374 files, 9331 tests, all passed, 256.3 s vitest duration. PR 6 was 374 files and 9255 tests; PR 6b adds 76 tests and no file. Against the S5 tip (373 files, 9216 tests) all of S6 adds one file and 115 tests.
- "npm run typecheck": exit 0.
- "npx eslint src": apart from the known CRLF "Delete" prettier noise (133946 findings counted with it), the only findings are the same three in files S6 does not touch: the unused "SidebarGroupLabel" warning in `src/components/app-sidebar.tsx` and two prettier quote errors in `src/test/access/inventory.ts`. "npx eslint" on the touched files alone is clean, and "npx prettier --check" passes on every touched file.
- "npm test -- src/app/(dashboard)/requests src/i18n": 34 files, 1126 tests, all passed.

#### Files (PR 6b; all LF in the working tree, the index was already LF)

| File                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Action                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `src/app/(dashboard)/requests/new/page.tsx`, `src/app/(dashboard)/requests/[id]/correct/page.tsx`                                                                                                                                                                                                                                                                                                                                                                     | Modified: today = managuaToday(new Date()), passed to FlowSteps             |
| `src/app/(dashboard)/requests/new/flow-steps.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                     | Modified: required "today", the draft's range and today passed to the steps |
| `src/app/(dashboard)/requests/new/cause-dates-step.tsx`                                                                                                                                                                                                                                                                                                                                                                                                               | Modified: follows the start field, shows the note for a future start        |
| `src/app/(dashboard)/requests/new/subjects-step.tsx`, `src/app/(dashboard)/requests/new/documents-step.tsx`                                                                                                                                                                                                                                                                                                                                                           | Modified: the recap tops the step (range and today props)                   |
| `src/app/(dashboard)/requests/new/review-step.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                    | Modified: the note under the period                                         |
| `src/app/(dashboard)/requests/new/page.test.tsx`, `src/app/(dashboard)/requests/[id]/correct/page.test.tsx`, `src/app/(dashboard)/requests/new/cause-dates-step.test.tsx`, `src/app/(dashboard)/requests/new/subjects-step.test.tsx`, `src/app/(dashboard)/requests/new/documents-step.test.tsx`, `src/app/(dashboard)/requests/new/review-step.test.tsx`, `src/app/(dashboard)/requests/new/layout-360.test.tsx`, `src/app/(dashboard)/requests/new/actions.test.ts` | Modified: new cases                                                         |

#### Final Spanish UI copy of all of S6 (student screen "intake", "tú"; no key was added in PR 6b)

"intake.datesRecap.label": "Fechas de ausencia"; "range": "Del {start} al {end}"; "edit": "Editar fechas"; "futureStart": "La fecha de inicio es posterior a hoy. Si la ausencia ya ocurrió, corrige las fechas; si es una ausencia prevista, puedes continuar."

English twins: "Absence dates"; "From {start} to {end}"; "Edit dates"; "The start date is later than today. If the absence already happened, correct the dates; if it is a planned absence, you can continue."

#### Deviations (PR 6b)

1. **No seam inside unit 13.** It measures 1071 lines, 91 of them production code; the plan names no cut and every file serves one step. Size exception.
2. **Base.** Tasks 6.9 and 6.11 name "feat/flow-experience-5-local-preview"; PR 6b targets the PR 6 branch and PR 6 targets "feat/flow-experience-5b-file-marks" (#117).
3. **`today` is required on FlowSteps and optional on the steps.** The two pages are the only callers, so a forgotten value fails the typecheck; the steps are rendered by many tests and show no notice without it.
4. **`SubjectsStep` keeps `hasDates` and gains `range`.** The recap needs both: it shows only when the dates are valid and a range is given. `DocumentsStep` shows the recap for any non-null range, because step 3 has no dates-first message.
5. **Task 6.7 mutations.** The step-1 save schema is in `src/lib/validations/solicitud.ts` as the task says, but the final submit validates in `src/lib/intake/submission.ts`, so the submit cases got their own temporary mutation there (restored).
6. **Step 1 follows the start with state; the input stays uncontrolled.** Its default value and the form read are unchanged, so the saved values are exactly what they were.
7. **Step 4 shows the note only when both dates are set,** the same condition that shows the period; otherwise it would sit under "Sin completar".
8. **The recap sits above the hint on step 3 and above the message on every state of step 2** (list, empty, degraded), so it shows whenever the dates are valid.
9. **Tasks 6.9 to 6.11 close over both PRs.**
10. **Line endings.** Files touched were CRLF in the working tree (index LF) and were converted to LF without changing the index content. A prettier run over the whole requests directory converted more files than the unit touches; they differ from the index only in line endings and were not staged. After the power loss of 2026-11-20 about 28 files still show as modified for that reason ("git diff --ignore-cr-at-eol" shows no content change).

#### Notes for S7 (UX-20, the "Cambiar contraseña" link)

- Base: S7 stacks on "feat/flow-experience-6b-dates-wiring" (the S6 tip, #119). Tasks 7.0, 7.5 and 7.7 name "feat/flow-experience-6-dates-recap"; the real base is the 6b tip.
- No overlap with S6: S7 touches `src/app/(dashboard)/profile/page.tsx`, `src/components/dashboard-header.tsx`, their tests and the catalogs ("profile" and "auth.userMenu").
- The route constant is `PASSWORD_CHANGE_PATH` in `src/lib/auth/routes.ts`; use it instead of a literal.
- Pitfall met in S6: a Zod refinement is skipped when another field already failed, so a mutation that must fire beside another error belongs on the field itself.
## Phase 7 (PR 7): S7 UX-20, the "Cambiar contraseña" link

Mode: Strict TDD. Date: 2026-11-20. Branch "feat/flow-experience-7-password-link", cut from the tip of "feat/flow-experience-6b-dates-wiring" (83f4f8a, the S6 tip, #119). One work unit (unit 14), one code commit. PR 7 is #120 ("https://github.com/Josuedcm03/justifia/pull/120", base "feat/flow-experience-6b-dates-wiring", stacked on #119). The slice is under the 460 stop line, so it is one PR. No new route and no access rule changed.

### Commits (PR 7)

| Unit | Hash    | Message                                                           |
| ---- | ------- | ----------------------------------------------------------------- |
| 14   | 59571b6 | feat(profile): link to the voluntary password change              |
| docs | (tip)   | docs(flow-experience): record the Phase 7 apply progress for PR 7 |

### TDD cycle evidence (PR 7)

| Task        | Test file                                                       | Layer              | Safety net                           | RED                                                                                                               | GREEN                | Triangulation                                                                                                                                                                           | Refactor    |
| ----------- | --------------------------------------------------------------- | ------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 7.1 and 7.2 | `src/app/(dashboard)/profile/page.test.tsx`                     | Component (page)   | 7 existing cases of the file passing | 9 cases failed first (five roles, Spanish, outline large link, the only link and the rows kept, the catalog keys) | 11 files, 469 passed | The five roles; es and en; the 44 px outline link; one link only with the email and CIF rows still shown; both catalog values                                                           | None needed |
| 7.1 and 7.2 | `src/components/dashboard-header.test.tsx` (new)                | Component (server) | N/A (new file)                       | 9 cases failed first (five roles, English, entry order, no other link, the catalog keys)                          | Pass                 | The menu is opened with the user-event click; each role; es and en; the order "Ver perfil", "Cambiar contraseña", "Cerrar sesión"; the only hrefs are "/profile" and "/change-password" | None needed |
| 7.3         | `src/app/route-coverage.test.ts`, `src/test/access` (read-only) | Structural         | N/A                                  | Pass at write (4 files, 536 tests, no row added)                                                                  | Pass                 | Mutation check below                                                                                                                                                                    | N/A         |

### Mutation checks (revert-only; the file was restored from a byte-identical backup copy and confirmed with "git diff --stat")

| Pass-at-write test                                           | Temporary edit                                                                      | Result                                                                 |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| route-coverage "the table lists every protected entry point" | In `src/test/access/matrix-table.ts`: the "change-password/page.tsx" row is removed | 1 failed, 528 passed; the file was restored and its diff stat is empty |

### Checkpoint (task 7.5): measured size of PR 7

Measure: "git diff --numstat feat/flow-experience-6b-dates-wiring...HEAD" excluding "openspec/" and ".engram/".

| Scope                                                  | Changed lines |
| ------------------------------------------------------ | ------------- |
| Production (profile page 13, header 6, two catalogs 8) | 27            |
| Tests (header test 101, profile test 53)               | 154           |
| All of PR 7 (179 added, 2 deleted)                     | 181           |

The design forecast was about 50; the slice is 3.6 times that and under the stop line. Tests are 85 percent of the lines and were not trimmed.

### Work unit evidence (PR 7)

| Evidence                              | Value                                                                                                                                                                                                                                                |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | "DATABASE_URL='postgres://u:p@127.0.0.1:9/x' npm test -- profile/page.test dashboard-header src/i18n": 11 files, 469 tests, all passed. The access proof: "npm test -- access-matrix route-coverage src/test/access": 4 files, 536 tests, all passed |
| Runtime harness                       | N/A: a link and a menu entry to an existing route; the access matrix and the route inventory are the proof, and no database or Neon command was run                                                                                                  |
| Rollback boundary                     | Revert the PR: `src/app/(dashboard)/profile/page.tsx` loses the link, `src/components/dashboard-header.tsx` loses the entry and the two "changePassword" keys go. No data, no schema, no route, no access rule                                       |

### Gates (task 7.6), tip of "-7-password-link" (the S7 tip), dummy DB

- Full "npm test": 375 files, 9349 tests, all passed, 257.5 s vitest duration. The S6 tip was 374 files and 9331 tests; PR 7 adds one test file (the header test) and 18 tests.
- "npm run typecheck": exit 0.
- "npx eslint src": apart from the known CRLF "Delete" prettier noise (133651 findings counted with it), the only findings are the same three in files S7 does not touch: the unused "SidebarGroupLabel" warning in `src/components/app-sidebar.tsx` and two prettier quote errors in `src/test/access/inventory.ts`. "npx eslint" on the touched files alone is clean, and "npx prettier --check" passes on every touched file and on both catalogs.

### Files (PR 7; all LF in the working tree, the index was already LF)

| File                                        | Action                                                                      |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `src/app/(dashboard)/profile/page.tsx`      | Modified: outline large link to PASSWORD_CHANGE_PATH under the account card |
| `src/components/dashboard-header.tsx`       | Modified: the user menu entry between "Ver perfil" and "Cerrar sesión"      |
| `src/app/(dashboard)/profile/page.test.tsx` | Modified: 9 new cases                                                       |
| `src/components/dashboard-header.test.tsx`  | Created: 9 cases                                                            |
| `i18n/es.json`, `i18n/en.json`              | Modified: "profile.changePassword" and "auth.userMenu.changePassword"       |

### Final Spanish UI copy added in PR 7 (labels with no verb, so neutral in both existing registers)

- "profile.changePassword": "Cambiar contraseña" (the profile page speaks "tú")
- "auth.userMenu.changePassword": "Cambiar contraseña"

English twins: "Change password" for both.

### Deviations (PR 7)

1. **Base.** Tasks 7.0, 7.5 and 7.7 name "feat/flow-experience-6-dates-recap"; the real base is the tip of "feat/flow-experience-6b-dates-wiring" (#119), which holds all of S6.
2. **Link position and width.** The tasks say "outline lg link"; it sits under the account card, full row at 360 px and content width from the "sm" breakpoint, aligned to the start.
3. **Constant, not a literal.** Both entries use PASSWORD_CHANGE_PATH of `src/lib/auth/routes.ts`; the tests also pin its value "/change-password".
4. **Header test is a server render.** DashboardHeader is an async server component, so its test mocks the server translator, the locale reader and the logout action, and stubs the locale switcher, theme toggle, page context and sidebar trigger, which need providers of their own and are not under test.
5. **Outline classes.** The first version of the profile test expected "border-border"; the outline variant of the button uses "border-primary", so the expectation was corrected before the GREEN.
6. **Flagged and anonymous cases.** They are the existing redirect cases of the profile test (they throw before anything renders), so no new case was added for them.
7. **Line endings.** The touched files were CRLF in the working tree (index LF); they were converted to LF without changing the index content. Other files still show as modified for that reason only.

### Notes for S8 (motive "otro", migration 0016, RN-20)

What the orchestrator must do before S8 starts (tasks 8.0 and 8.1; S8 is based on the tracker, not on the S7 branch):

1. **Confirm #98 and the migration number (task 8.0, read-only).** "gh pr view 98 --json state,mergedAt" must show it merged, and "eza drizzle" on the latest main must still show 0015 as the last file. If #98 is open, stop and ask the owner. Record both results in this file.
2. **Merge PRs 1 to 7 into the tracker, in order, each with the owner's OK** (merging into the tracker does not deploy; only the tracker ever merges to "main"). The stack is a chain, so after each merge retarget the next PR with "gh pr edit <number> --base feat/flow-experience" and check that its diff holds only its own files:
   - S1: #109 (base the tracker), #110 (1b).
   - S2: #111.
   - S3: #112 (3a), #113 (3b).
   - S4: #114, #115 (4b).
   - S5: #116, #117 (5b).
   - S6: #118, #119 (6b).
   - S7: #120.
     Never delete a slice branch or the tracker.
3. **Merge "origin/main" into the tracker** ("git merge origin/main"). If #105 (catalog namespace) merged, expect JSON conflicts in `i18n/es.json` and `i18n/en.json`: S1 to S7 added keys under "review", "requests", "intake", "profile" and "auth.userMenu" only. Resolve them and run T(src/i18n).
4. **Create "feat/flow-experience-8-motive-otro" from the tracker tip** and record "git log --oneline -3".
5. The S1 to S7 PRs are over the usual 460 lines on purpose (owner's size exception of 2026-11-20); S8 is covered by the same exception, cut at its plan seam (after unit 15: migration, then dialog and notice, then the docs unit).
6. S8 touches `src/app/(dashboard)/review/[id]/escalate-dialog.tsx`, `src/i18n/review-messages.test.ts` and the "review.escalation" keys that S1 and S3 changed (previousAnswer notice, required note label, hint), so the S8 RED tests must be written against the merged text, and the "otro" hint is a new "usted" key beside "noteHint".
7. The DB rule holds: "drizzle-kit generate" reads the schema and opens no connection; "migrate", "push", "db:seed" and the production command of task 8.25 are owner-run with an explicit "yes".

## Phase 8 (PR 8): S8 motive "otro", migration 0016 and RN-20 (code and files only)

Mode: Strict TDD. Date: 2026-11-20. Scope: every task up to, not including, the first database task: 8.0 to 8.16. Tasks 8.17 to 8.25 are owner-gated database tasks and stay open; no database or Neon command of any kind was run in this apply (unit tests use the dummy DB, and "drizzle-kit generate" opens no connection). Owner decision of 2026-11-20: keep "caso_especial" and add the motive "otro", whose note text is required. It enters through the escalation constants only (design D11).

Migration 0016 has NOT been applied to any database.

### Task 8.0 and the merges (recorded 2026-11-20)

- "gh pr view 98 --json state,mergedAt": MERGED at 2026-11-20T17:57:26Z (27abd8c on main). `drizzle/` ends at `drizzle/0015_manual_document_data.sql`, so 0016 is free (the last journal entry is 0015 with "when" 1795134628842).
- Merged into the tracker by the orchestrator, in order, every slice branch kept: #109 d554fb0, #110 ddbd234, #111 005e11d, #112 cccc758, #113 cfda39f, #114 525566f, #115 b1c31c2, #116 f63ccdf, #117 7a87385, #118 87be648, #119 a950f77, #120 809f212. Then "origin/main" (which includes #98) merged as bb6f67c and pushed.
- Branch "feat/flow-experience-8-motive-otro" was cut from bb6f67c.

### Cut (size exception, plan seam after unit 15)

The slice measured about 880 authored lines before the docs, so it was cut at the plan's seam into two PRs. Each commit typechecks and is green.

| PR  | Branch                                     | Base                                     | Commits                                                                                                                                                      | Changed lines (excl. "openspec/" and the snapshot) |
| --- | ------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| 8a  | "feat/flow-experience-8-motive-otro"       | tracker "feat/flow-experience" (bb6f67c) | 418497b feat(db): add the escalation motive otro                                                                                                             | 445 (403 added, 42 deleted)                        |
| 8b  | "feat/flow-experience-8b-otro-dialog-docs" | "feat/flow-experience-8-motive-otro"     | 741d6ef feat(escalation): give the motive otro its own hint in the dialog; 61db5f8 docs(requirements): add the motive otro to RN-20 and pin its constraints | 456 (447 added, 9 deleted)                         |

PR 8a is #121 ("https://github.com/Josuedcm03/justifia/pull/121") and PR 8b is #122 ("https://github.com/Josuedcm03/justifia/pull/122"). The snapshot `drizzle/meta/0016_snapshot.json` is 2467 generated lines, reported apart. Production versus tests: 8a has 67 production and migration lines and 378 of tests; 8b has 25 production and docs lines and 431 of tests. The design forecast was about 280 for the whole slice; the slice is 3.2 times that, in line with the repository precedent. Tests were not trimmed.

### TDD cycle evidence (PR 8)

One combined RED run before any production code: 47 cases failed in 12 files. The full suite later revealed 4 more query-placeholder pins, fixed in unit 15.

| Task        | Test file                                                                                                                                                                                                         | Layer                   | RED                                                                                                                                                         | GREEN                                                       | Triangulation                                                                                                                                                                             | Refactor                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 8.2         | `src/lib/intake/escalation.test.ts`                                                                                                                                                                               | Unit                    | 8 failed (kinds, reasons, accepts "otro", empty, blank, non-string and 1001-character note, the 1000 bound)                                                 | Pass                                                        | Four bad notes, the 1000 and trimmed 1000 bounds, "Otro", " otro", an array and the notice kind refused (the last four pass at write, mutation below)                                     | None needed                                             |
| 8.3         | `src/db/migration-escalation-otro.test.ts` (new)                                                                                                                                                                  | Structural (SQL file)   | 9 failed (0016 not found)                                                                                                                                   | Pass after "drizzle-kit generate"                           | Journal position and "when"; exactly eight statements; each drop before its add; index drop before create; only-widens; only four objects touched                                         | None needed                                             |
| 8.4 to 8.6  | `src/lib/escalation/message.test.ts`, `src/lib/data/solicitud-escalation.test.ts`, the data-layer pins                                                                                                            | Unit (message, data)    | 4 message, 2 escalate, 1 detail, 1 documentos failed; then 4 more query pins found by the full suite (revision-queue, coordination-queue, escalation-answer x2) | 18 files and 767 tests passed, then 9373 on the full suite  | The label and the full text and HTML equal the other escalations except the reason; "otro" escalates like the others and the audit row carries no note; no note refuses before the database | None needed                                             |
| 8.4 to 8.6  | `src/app/(dashboard)/review/[id]/escalate-dialog.test.tsx`, `src/i18n/review-messages.test.ts`                                                                                                                    | Component, catalog      | 4 dialog cases (three radios in both locales, send "otro", cancel resets three) and 4 catalog cases failed                                                  | Pass                                                        | Three radios with none checked, the labels "Otro" and "Other"                                                                                                                             | None needed                                             |
| 8.8 and 8.9 | the same dialog and catalog tests                                                                                                                                                                                 | Component, catalog      | 5 dialog cases (English and Spanish hint, back to the standard hint, empty note error, labels) and 4 hint-copy cases failed                                 | Pass                                                        | The hint swaps only for "otro"; the usted pin and the staff-only statement                                                                                                                | Short comment on why the dialog wraps the copy function |
| 8.8         | `src/app/(dashboard)/review/[id]/escalation-section.test.tsx`, `src/app/(dashboard)/review/page.test.tsx`, `src/app/(dashboard)/coordination/page.test.tsx`, `src/app/(dashboard)/coordination/[id]/page.test.tsx` | Component (render)      | 6 failed (the label key was missing)                                                                                                                        | Pass                                                        | "Other" in English and "Otro" in Spanish on the section; one row on the En coordinacion tab; the list item and its link; the detail with note and answer form                             | None needed                                             |
| 8.8         | `src/lib/audit/events.test.ts`, `src/app/(dashboard)/requests/[id]/page.test.tsx`, `src/app/(dashboard)/requests/request-card.test.tsx`                                                                           | Unit, component         | Pass at write (they pin behavior the builders and pages already have)                                                                                       | Pass                                                        | The payload holds the code "otro" and no part of the note; the student detail and card show no trace of the motive, the label or the description                                          | None needed                                             |
| 8.11        | `src/lib/data/integration/escalation-constraints.integration.test.ts`                                                                                                                                             | Integration (owner-run) | Not run here (needs a disposable branch with 0016): "npm run typecheck" passes and "npm test" does not collect it                                           | N/A                                                         | N/A                                                                                                                                                                                       | N/A                                                     |

### Mutation checks (revert-only; each file was restored from a byte-identical backup copy and confirmed with "git diff --stat")

| Pass-at-write test                                      | Temporary edit                                                  | Result            |
| ------------------------------------------------------- | --------------------------------------------------------------- | ----------------- |
| refusals of "Otro" and " otro" in `escalation.test.ts`  | `isEscalationReason` trims and lowercases the value             | 2 failed; restored |
| audit payload cases of `events.test.ts`                 | `solicitudEscaladaEvent` adds the note to "datos"               | 3 failed; restored |
| student detail pins (`requests/[id]/page.test.tsx`)     | the page prints "motivo" of the detail                          | 2 failed; restored |
| student card pin (`request-card.test.tsx`)              | the card prints its "escalamientos"                             | 1 failed; restored |
| "original motives keep the standard hint" (dialog test) | the dialog swaps the hint for any chosen motive                 | 2 failed; restored |

An early version of the student pins used a word-boundary regex; the mutation showed it missed a motive printed right after other text, so it was widened before the commit.

### Work unit evidence (PR 8)

| Evidence                              | Value                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused test command and exact result | "DATABASE_URL='postgres://u:p@127.0.0.1:9/x' npm test -- escalation.test migration-escalation-otro message.test escalate-dialog review-messages src/lib/audit coordination escalation-section review/page requests/ solicitud-escalation src/i18n": 64 files, 1923 tests, all passed on the 8b tip                         |
| Runtime harness                       | Owner-run: "flow-it" RED then GREEN, then production (tasks 8.17 to 8.25), all pending. No database command was run                                                                                                                                                                                                         |
| Rollback boundary                     | 8b: revert the PR (the hint, the pins, the RN-20 text, the integration cases). 8a: revert the PR; 0016 only widens and may stay; never revert the constants once "otro" rows exist (the six readers would hide open "otro" escalations; remove only the radio option instead)                                              |

### Gates

- Full "npm test" with the dummy DB: tip of 8a 376 files, 9373 tests, all passed, 263.2 s; tip of 8b 376 files, 9392 tests, all passed, 274.4 s. The S7 tip had 375 files and 9349 tests; PR 8a adds the migration test file.
- "npm run typecheck": exit 0 on both tips.
- "npx eslint" on the touched files: only the known CRLF "Delete" prettier noise (the working copies go back to CRLF after a branch switch); no real finding. "npx prettier --check" is clean on the touched files, `docs/requirements.md` and both catalogs (with "--end-of-line auto" when the checkout wrote CRLF).
- "npx eslint src" over the whole tree was not repeated: the same three findings in untouched files were recorded in Phase 7 and S8 touches none of them.

### Files (PR 8)

| File                                                                                                                                                         | Action                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `src/lib/intake/escalation.ts`                                                                                                                               | Modified: "otro" in both arrays, doc comments                         |
| `src/db/schema.ts`                                                                                                                                           | Modified: comment only                                                |
| `drizzle/0016_escalation_otro.sql`, `drizzle/meta/_journal.json`, `drizzle/meta/0016_snapshot.json`                                                          | Created and modified: the migration, journal entry 16, the snapshot   |
| `src/db/migration-escalation-otro.test.ts`                                                                                                                   | Created: 9 cases                                                      |
| `src/lib/escalation/message.ts`, `src/lib/escalation/message.test.ts`                                                                                        | Modified: the label "Otro" and the maps                               |
| `src/lib/data/solicitud-escalation.ts` and its test, the pins of `documentos`, `solicitud-detail`, `revision-queue`, `coordination-queue` and `escalation-answer` | Modified: comment, escalate cases, query placeholders                 |
| `i18n/es.json`, `i18n/en.json`                                                                                                                               | Modified: "reasons.otro", "dialog.motivo.otro", "dialog.noteHintOtro" |
| `src/app/(dashboard)/review/[id]/escalate-dialog.tsx` and its test                                                                                           | Modified: the hint swap and the cases                                 |
| `src/i18n/review-messages.test.ts`                                                                                                                           | Modified: catalog pins                                                |
| render pins: `escalation-section`, `review/page`, `coordination/page`, `coordination/[id]/page`, `requests/[id]/page`, `request-card` tests                  | Modified: cases for "otro"                                            |
| `src/lib/audit/events.test.ts`                                                                                                                               | Modified: cases for "otro"                                            |
| `src/lib/data/integration/escalation-constraints.integration.test.ts`                                                                                        | Modified: "otro" cases (owner-run)                                    |
| `docs/requirements.md`                                                                                                                                       | Modified: RN-20 and one change-history row                            |

### Final Spanish UI copy (staff screens, "usted")

- Radio label: "Otro" (`en`: "Other"). Reason label on every surface (notice message, escalations section, En coordinacion tab, coordination list and detail): "Otro" (`en`: "Other").
- "review.escalation.dialog.noteHintOtro": "Esta nota es la descripción del motivo: explique la situación que lo lleva a escalar la solicitud y por qué no corresponde a los otros dos motivos. Solo la ve el personal." (`en`: "This note is the description of the reason: explain the situation that leads you to escalate the request and why it fits neither of the other two reasons. Only staff can see it.")
- RN-20 in `docs/requirements.md`: "Los motivos de escalamiento son la sospecha sobre el documento, el caso especial fuera de las causas del reglamento y otro motivo, que la secretaría describe en la nota obligatoria. El reporte de exceso del 20 % que comunica el docente es un aviso informativo a la coordinación: no cambia el estado de la solicitud ni se responde. El sistema no calcula ese porcentaje."
- Change-history row (2026-11-20): RN-20 names the three motives and keeps the 20 % report wording; the reason cites the owner decision and FE-9, pending the thesis sync (4.2:89, 5.4:19). The counts do not change (18 RF, 14 RNF, 27 RN).

### Exact SQL of `drizzle/0016_escalation_otro.sql` (generated, then checked by hand; "--> statement-breakpoint" separates statements)

```sql
ALTER TABLE "Escalamiento" DROP CONSTRAINT "CK_Escalamiento_Tipo";--> statement-breakpoint
ALTER TABLE "Escalamiento" DROP CONSTRAINT "CK_Escalamiento_Kind";--> statement-breakpoint
ALTER TABLE "Escalamiento" DROP CONSTRAINT "CK_Escalamiento_SinRespuesta";--> statement-breakpoint
DROP INDEX "UX_Escalamiento_Abierto";--> statement-breakpoint
CREATE UNIQUE INDEX "UX_Escalamiento_Abierto" ON "Escalamiento" USING btree ("SolicitudId") WHERE "Escalamiento"."Tipo" IN ('sospecha_documento', 'caso_especial', 'otro') AND "Escalamiento"."RespondidaEn" IS NULL;--> statement-breakpoint
ALTER TABLE "Escalamiento" ADD CONSTRAINT "CK_Escalamiento_Tipo" CHECK ("Escalamiento"."Tipo" IN ('sospecha_documento', 'caso_especial', 'otro', 'exceso_inasistencias'));--> statement-breakpoint
ALTER TABLE "Escalamiento" ADD CONSTRAINT "CK_Escalamiento_Kind" CHECK (("Escalamiento"."Tipo" IN ('sospecha_documento', 'caso_especial', 'otro') AND "Escalamiento"."EstadoPrevio" = 'pendiente' AND "Escalamiento"."ReporteId" IS NULL AND "Escalamiento"."Nota" IS NOT NULL AND length(btrim("Escalamiento"."Nota")) > 0) OR ("Escalamiento"."Tipo" = 'exceso_inasistencias' AND "Escalamiento"."EstadoPrevio" = 'aprobada' AND "Escalamiento"."ReporteId" IS NOT NULL AND "Escalamiento"."Nota" IS NULL));--> statement-breakpoint
ALTER TABLE "Escalamiento" ADD CONSTRAINT "CK_Escalamiento_SinRespuesta" CHECK ("Escalamiento"."Tipo" IN ('sospecha_documento', 'caso_especial', 'otro') OR "Escalamiento"."RespondidaEn" IS NULL);
```

Journal entry 16: tag "0016_escalation_otro", "when" 1795216905153 (later than 0015's 1795134628842), "breakpoints" true. Existing rows satisfy the wider rules, so the migration can run in one transaction.

### Owner-gated database tasks 8.17 to 8.25 (open; none run; each needs the owner's explicit "yes" for its exact command)

Order and exact commands (placeholders in angle brackets are the owner's URLs):

1. 8.17 read-only, production preflight, four read-only queries (the first must return 16 and 1795134628842; the second and third must not contain 'otro'; the fourth is recorded for the later comparison):

   ```sql
   SELECT count(*), max(created_at) FROM drizzle.__drizzle_migrations;
   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname IN ('CK_Escalamiento_Tipo','CK_Escalamiento_Kind','CK_Escalamiento_SinRespuesta');
   SELECT indexdef FROM pg_indexes WHERE indexname = 'UX_Escalamiento_Abierto';
   SELECT "Tipo", count(*) FROM "Escalamiento" GROUP BY 1;
   ```

2. 8.18 confirm, create the disposable branch: "neon branches create --name flow-it --parent dev-arnia" (the owner confirms the syntax of the installed CLI); then the read-only journal count and last "when" (stop and ask if "dev-arnia" lacks 0014 and 0015).
3. 8.19 confirm, bring "flow-it" to 0015 only, from a checkout of the tracker tip before PR 8 merges: "$env:DATABASE_URL='<direct non-pooler URL of branch flow-it>'; npm run db:migrate"; then read-only: 16 migrations, last "when" 1795134628842, no 'otro' in the four definitions.
4. 8.20 confirm, RED before 0016: "$env:INTEGRATION_DATABASE_URL='<direct URL of branch flow-it>'; $env:INTEGRATION_ALLOW_WRITES='1'; npm run test:integration -- escalation-constraints". Run it from the tip of "feat/flow-experience-8b-otro-dialog-docs": the "otro" integration cases live in PR 8b, not in the branch named by the task. The "otro" cases and the catalog and index checks must fail, the earlier cases pass.
5. 8.21 confirm, apply 0016 to "flow-it" only, from the same tip: "$env:DATABASE_URL='<direct non-pooler URL of branch flow-it>'; npm run db:migrate"; then read-only: 17 migrations, last "when" 1795216905153, and 'otro' in "CK_Escalamiento_Tipo", "CK_Escalamiento_Kind", "CK_Escalamiento_SinRespuesta" and "UX_Escalamiento_Abierto".
6. 8.22 confirm, GREEN: "$env:INTEGRATION_DATABASE_URL='<direct URL of branch flow-it>'; $env:INTEGRATION_ALLOW_WRITES='1'; npm run test:integration -- escalation" (it also runs the race test).
7. 8.23 no command: record the run dates, commit, branch, the RED and GREEN counts and the assertions.
8. 8.24 confirm, production safety check before the apply: "git status" clean, and `drizzle/meta/_journal.json` (read-only) lists only 0016 beyond production's 16 entries.
9. 8.25 confirm, production apply BEFORE the tracker reaches main: "$env:DATABASE_URL='<production direct non-pooler URL from the Neon CLI>'; npm run db:migrate"; then read-only: the 8.21 checks on production, the "Escalamiento" counts of 8.17 equal, and "/login" answers 200. Never on "validacion-secretaria" or "validacion-estudiantes".

### Deviations (PR 8)

1. **Cut and branch names.** The slice was cut into 8a and 8b at the plan seam (size exception of 2026-11-20). 8a keeps the name "feat/flow-experience-8-motive-otro" and targets the tracker; 8b is "feat/flow-experience-8b-otro-dialog-docs", stacked on 8a.
2. **Type-forced pieces in unit 15.** Adding "otro" to `ESCALATION_KINDS` breaks the maps typed by `EscalationKind` in `src/lib/escalation/message.ts` and adds a third radio whose label keys must exist, so those pieces, the label keys and the pins of the existing radio and catalog tests are in the first commit. Task 8.4 therefore carries more than the constants, so that each commit typechecks and is green.
3. **Extra pins.** Five query-placeholder pins outside the task list (documentos, solicitud-detail, revision-queue, coordination-queue, escalation-answer) changed because each "Tipo" list now binds three motives; four of them were found only by the full suite.
4. **Labels.** The spec label "Otro" (`en`: "Other") governs over the design's "Otro motivo" and "Otro (descríbalo en la nota)"; the hint replaces the standard hint for "otro" rather than adding to it.
5. **RN-20.** The orchestrator's instruction governs: #98's 20 % report sentences are kept verbatim (task 8.12 and the design shorten them), and the change history gets a row.
6. **Integration run location.** Tasks 8.20 to 8.22 name the tip of the 8a branch; the "otro" integration cases are in 8b, so those runs start from the 8b tip (or from the tracker once both are merged).
7. **Line endings.** The working copies of touched files were converted to LF before editing. A branch switch writes CRLF back for files that differ between branches, so eslint shows the known CRLF noise and prettier needs "--end-of-line auto" in that state; the index content is LF.
8. **Where this section lives.** Task marks and this section are committed on the 8b tip, as the S1 and S6 splits did.

### Notes for S9

- S9a stacks on the PR 8 chain (the 8b tip, or the tracker once 8a and 8b merge). S8 touches the catalogs only under "review.escalation", so there is no conflict with the "auth" and "users" keys of S9.
- The "usted" hint of "otro" sits beside "noteHint" in "review.escalation.dialog".
