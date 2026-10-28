# Archive Report: backoffice-ui-refresh

**Change**: backoffice-ui-refresh
**Project**: justifia
**Archived on**: 2026-10-18
**Archived to**: `openspec/changes/archive/2026-10-18-backoffice-ui-refresh/`
**Artifact store**: hybrid (openspec files authoritative; engram observations recorded for traceability)
**Close state**: archived and closed under ordinary repository policy. No review receipt was discovered (`reviewGate` absent).
**Verification verdict at close**: PASS WITH WARNINGS (0 CRITICAL, 0 blockers). Per the final verify-report of 2026-10-18.

## 1. Pre-archive gates

| Gate | Result | Source |
|---|---|---|
| Native status | `gentle-ai sdd-status backoffice-ui-refresh --cwd . --json`: all dependencies `all_done`, `archive: ready`, `blockedReasons: []`, `nextRecommended: archive`, `actionContext.mode: repo-local` | native status, re-checked at the start of this phase |
| Native review receipt gate | `reviewGate` absent. The review artifacts (`reviewBundle`, `reviewLedger`, `reviewReceipt`, `reviewContext`, `reviewState`) are all `missing`. Archive proceeds under ordinary repository policy | native status |
| Task completion gate | `tasks.md`: 123 of 123 checkboxes checked, 0 unchecked (`- [ ]`) | `tasks.md` as archived |
| Critical issues | `critical_findings: 0`, `blockers: 0` | verify-report |
| Mechanical copy readback | Empty `diff -r` for every copy and for the archive move. See section 5 | this phase |

## 2. Final-state facts

Facts are ranked per the Final-State Authority hierarchy. Native review authority ranks first. Here it is absent by design. The tasks artifact ranks second. Explicit final-state facts in the launch prompt rank third. The verify-report and apply-progress snapshots rank last.

- **Tasks**: 123 of 123 complete. F.5, F.6 and F.8 are ticked. The owner confirmed F.6 and authorized the roadmap row (engram #135, decision, 2026-10-18). Source: `tasks.md` (rank 2), corroborated by #135.
- **Delivery**: PR #27 (merge commit `6e0c10c`) is merged to `main`, and the code was verified at `f8fb7cf`. At archive time, both commits are ancestors of `origin/main` (`git merge-base --is-ancestor`). The Vercel deployment is per the launch facts and was not independently verified by this phase.
- **Owner amendments applied before archive (2026-10-18)**:
  - The total count moved to the toolbar (DT-PAG-1, DT-TOOL-1, users-listing pagination, CM-LST-1 wording).
  - Navigation and home include My requests and Review requests (BS-NAV-1, BS-CTX-1, BS-HOME-1).
  - The route-level skeleton on same-route list changes was accepted (DT-PEND-1, BS-LOAD-1, BS-MOT-1).
  - The merged main specs reflect the amended deltas. Corroborated by the verify-report section "Resolved since the previous report" (W1, W2, W3).
- **Final verification (2026-10-18)**: PASS WITH WARNINGS. 0 CRITICAL. 3 WARNING (W4, W5, W6). 9 SUGGESTION (S1 to S9). 37 requirements and 131 scenarios (105 fully compliant, 24 partial, 2 manual). Typecheck clean, 4,537 tests passed, build green. `evidence_revision: sha256:0518cb349acc2d360e6dbaa2876ef7515e86a516ac5e13a0624c8e70a3d85ef1`. Source: verify-report (engram #136, content identical to the archived `verify-report.md`).
- **Size**: accepted as `size:exception`, about 13,311 changed lines against an 800-line budget (verify-report S7).

### Recorded stale claims and contradictions

1. **Task count**: engram #131 (`tasks`, 2026-10-11) says "121 tasks". The tasks artifact on disk has 123 checkboxes, all checked. Ranked resolution: `tasks.md` (123/123). The forecast table inside `tasks.md` also says 121, which is stale. The verify-report records this.
2. **Pre-amendment snapshots**: engram #128 (proposal), #129 (design) and #130 (spec), all dated 2026-10-11, predate the 2026-10-18 amendments. Ranked resolution: the amended on-disk delta specs, now merged into `openspec/specs/`, and the `design.md` section "Deviations accepted during apply".
3. **Verify commit recommendation**: verify-report S9 advised committing the artifact edits before archive. The archive did not commit, per the phase instructions. It ran on the uncommitted working tree. The verified state was `f8fb7cf` plus the amended spec edits in the working tree. The commit is an owner or parent step.

No contradiction remained unranked.

## 3. Spec sync

| Domain | Action | Details |
|---|---|---|
| `backoffice-shell` | Created (new capability) | Mechanical copy of the delta spec. Per verify-report: 14 requirements, 37 scenarios. |
| `data-table` | Created (new capability) | Mechanical copy of the delta spec. Per verify-report: 15 requirements, 48 scenarios. |
| `users-listing` | Updated | ADDED 5 requirements: Column sorting, Status filter, List parameters never widen the viewer scope, Changing the view returns to page 1, The browser receives only displayed fields. MODIFIED 2 requirements: Server-side pagination, Fail-soft when the database is unavailable. Requirements 8 to 13. |
| `catalog-management` | Updated | MODIFIED 1 requirement: CM-LST-1 Lists, filters, search and pagination (9 to 19 scenarios). Requirements 33 to 33. CM-ASG-7, CM-NAV-1 and CM-UX-1 are unchanged and byte-identical to the pre-archive main spec. |

**Assumptions applied to `users-listing` ("Assumptions withdrawn or changed at archive")**:

- Page size: "Assumption (confirm): default page size is 10." became "Default page size is 10 and the selectable set is 10, 25 and 50 (D11)."
- Sorting and filters: "no sorting, per-column filters or export" became "export, a role filter and other per-column filters are out of scope. Sorting and the status filter are in scope."
- Search: "Open (design): submit-on-Enter versus debounced search" became "Resolved (D5): search is submit-on-Enter, not debounced."
- Table library: "Open (design): whether a table library is adopted" became "Resolved: the list uses a TanStack-based table in manual mode."
- Default order assumption: unchanged.

The "Assumptions withdrawn or changed at archive" section itself is not copied into the main spec. It stays in the archived delta spec as the audit trail.

## 4. Archive move

`openspec/changes/backoffice-ui-refresh/` was moved to `openspec/changes/archive/2026-10-18-backoffice-ui-refresh/` with `git mv`. The naming follows the existing `YYYY-MM-DD-<change>` pattern in `openspec/changes/archive/`. The rename is staged in the index and nothing was committed.

Archived contents (11 files at move time): `apply-progress.md`, `design.md`, `exploration.md`, `HANDOFF.md`, `proposal.md`, `tasks.md`, `verify-report.md` (untracked at move time), and `specs/{backoffice-shell,catalog-management,data-table,users-listing}/spec.md`. This report was added afterwards as an additive file.

## 5. Mechanical readback (verbatim `diff -r`)

| Operation | Command | Output |
|---|---|---|
| `backoffice-shell` main spec | `diff -r openspec/changes/backoffice-ui-refresh/specs/backoffice-shell/spec.md openspec/specs/backoffice-shell/spec.md` | (empty, exit 0) |
| `data-table` main spec | `diff -r openspec/changes/backoffice-ui-refresh/specs/data-table/spec.md openspec/specs/data-table/spec.md` | (empty, exit 0) |
| Archive move | `diff -r <pre-move snapshot>/source openspec/changes/archive/2026-10-18-backoffice-ui-refresh` | (empty, exit 0) |

The `users-listing` and `catalog-management` main specs are merges, not copies. They were checked as follows:

- A diff against the pre-archive backup shows changes only in the expected requirement and assumption ranges.
- Every delta requirement block is present in the merged main file. Missing count: 0 for `users-listing` (7 of 7 blocks) and 0 for `catalog-management` (1 of 1 block). The comparison ignores CR bytes.
- `CM-ASG-7`, `CM-NAV-1` and `CM-UX-1` are byte-identical to the pre-archive backup.

Line endings: the existing main specs are CRLF. The merged `users-listing` and `catalog-management` were normalized to uniform CRLF. Content is identical apart from the terminator bytes. `backoffice-shell` and `data-table` are byte-identical to their LF deltas, as the mechanical contract requires.

## 6. Traceability: engram observations

| ID | Topic | Use in this archive |
|---|---|---|
| #128 | `sdd/backoffice-ui-refresh/proposal` | Read. Pre-amendment snapshot. Not authoritative. |
| #129 | `sdd/backoffice-ui-refresh/design` | Read. Pre-amendment snapshot. Not authoritative. |
| #130 | `sdd/backoffice-ui-refresh/spec` | Read. Pre-amendment snapshot. Superseded by the on-disk delta specs. |
| #131 | `sdd/backoffice-ui-refresh/tasks` | Read. Stale count ("121"). Superseded by `tasks.md` (123/123). |
| #133 | `sdd/backoffice-ui-refresh/apply-progress` | Read for traceability. Intermediate snapshot. |
| #135 | `decision`: F.5, F.6, F.8 and roadmap row 11 | Read. Owner confirmation, 2026-10-18. |
| #136 | `sdd/backoffice-ui-refresh/verify-report` | Read. Current verify snapshot (2026-10-18 06:04:42). Content identical to the archived `verify-report.md`. |

Retrieval note: the engram MCP tools were not exposed to this executor. The CLI `search` and `timeline` commands return truncated previews, so full content was read from a read-only `engram export` written to the session scratchpad.

## 7. Follow-ups (not blocking archive)

- **Dormant pending dimming** (verify S8): the card-level `pending` prop and `opacity-60` dimming remain in `src/components/tables/data-table.tsx` (lines 52-53, 160-161) and `src/components/table-card.tsx`. Their tests are `list-table.test.tsx:422-487`, `data-table.test.tsx:291-316` and `table-card.test.tsx`. The docblock at `src/components/tables/list-table.tsx:75-76` is stale. Remove the dormant code and tests, or reword the comment.
- **Real-Postgres ordering suite** (verify S1, G-1, W4): an optional opt-in suite would prove ordering, collation and stable paging against real rows.
- **Line endings** (verify W6): add `.gitattributes` with `eol=lf` to remove the local CRLF lint noise.
- **Other verify suggestions**: S2 (pin DT-DENS-1 with an assertion), S3 (guard in `(home)/loading.test.tsx`), S4 (record per-item manual observations), S5 (vendored `ui/button.tsx` and `ui/sidebar.tsx` still use `transition-all`), S6 (uniform TDD evidence tables).

## 8. Risks and notes

- **Uncommitted archive**: the archive ran on the uncommitted working tree. Nothing was committed or pushed.
- **Staged rename**: `git mv` staged the folder rename in the index. The modified tracked files remain unstaged.
- **Manual-only scenarios**: W5 browser and router-only scenarios (BS-RSP-1, reduced motion, browser Back, the BS-LOAD-1 same-route skeleton) rest on the owner's manual checks (F.4 and gate V1), not on automated tests.
- **Roadmap**: `docs/roadmap.md` was not edited by this phase. Row 11 must be set to `archivado` by the parent.
- **Database**: no database command was run. `engram export` is read-only with respect to the database.
- **Incident, resolved**: a mistyped `engram export --help` wrote a stray untracked file named `--help` into the repository root. It was removed and confirmed absent. The export output was written to the scratchpad instead.
