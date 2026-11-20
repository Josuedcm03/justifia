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
