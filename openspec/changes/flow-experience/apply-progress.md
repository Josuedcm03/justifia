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
