# Archive Report: flow-experience

**Change**: flow-experience (roadmap row 13; Tabla 19 rows RF-01, RF-06, RF-07, RF-08, RF-10 and RF-16; UX-20 to UX-28)
**Archived**: 2026-11-25, to `openspec/changes/archive/2026-11-25-flow-experience/`
**Artifact store**: openspec (repo-local)
**Branch**: `feat/flow-experience-14-archive`, from the tip of `main` (38a5b71)
**Archive mode**: intentional-with-warnings. The folder was moved with 190 of 191 tasks done. The last one, 12.12 (deleting the disposable Neon branch `flow-it`), was done afterwards, on 2026-11-25 17:49 UTC, with the owner's explicit yes: exit 0, the other six branches remain. All 191 tasks are done.
**Verdict**: `pass_with_warnings` (`verify-report.md`, at 5078e39): 0 critical, 6 warnings open when it was written, 5 at close. Strict coverage: 188 of 199 scenarios and 27 of 33 requirements; 4 scenarios UNTESTED, 7 PARTIAL, none failing. The envelope shows 33/33 and 199/199 by the convention explained in the report.

## 1. Final state

| Fact at close | Evidence |
|---|---|
| Migration 0016 in production | 2026-11-25 16:46 UTC, 17 migrations, "otro" in the three CHECKs and in the unique index (`apply-progress.md`, 8.25) |
| First deploy | #151, `main` 39dafd9, Vercel success, 2026-11-25 |
| Second deploy (S9g) | #153, `main` 38a5b71, Vercel success, 2026-11-25 |
| Smoke test | By the owner, 2026-11-25 (`apply-progress.md`, 13.5) |
| Lockout counts | 0, 0, 0 before and after the migration and after each deploy |
| Tests | 392 files, 10441 tests; typecheck 0; ESLint 0 errors; `next build` 0 |
| Mutation checks | 30 of 30 killed |
| Pull requests | Slices #109 to #129 and #144 to #152, into the tracker; #151 and #153, into `main` |

The coordination-answer banner (FE-3) was not seen in production, because no request there has an answer. Its evidence is the one on `flow-it` (task 12, RF-16).

## 2. Warnings carried at close

- **W1**: resolved. 14.1 to 14.6 were done by this archive and 12.12 after it.
- **W2**: the four FE-25 count scenarios are read-only queries run by hand, with no automated test. Counts recorded on 2026-11-20 and 2026-11-25.
- **W5**: a 30-day session cannot be revoked from the server. Accepted by the owner; live in production. UX-30.
- **W6**: no login rate limiting. Accepted by the owner. UX-29.
- **W7**: `findLoginAccount` is proven against a query double; no integration test runs it on Postgres. Sign-in by CIF and by email was observed on `flow-it` and in production.
- **W9**: the 360 px scenarios rest on class guards; jsdom has no layout.
- W3, W4 and W8 are resolved. Of the suggestions, S8 and S10 are resolved in the spec text (see 3); S1 to S7 and S9 stay open.

## 3. Specs synced

Eleven deltas, 25 requirements added and 8 replaced. The merge was made by a script. Its readback found every delta requirement block, from its heading to its last scenario, in the main spec: 0 missing. The only removed heading is "A second open escalation of either motive is refused", whose replacement names the three motives.

| Main spec | Added | Replaced |
|---|---|---|
| `audit-log` | 0 | 1 |
| `auth-entry-access` | 7 | 1 |
| `catalog-management` | 0 | 1 |
| `coordination-escalation` | 4 | 3 |
| `imported-account-provisioning` | 0 | 1 |
| `justification-intake` | 2 | 0 |
| `request-review` | 5 | 1 |
| `staff-account-creation` | 2 | 0 |
| `student-requests` | 3 | 0 |
| `supporting-documents` | 1 | 0 |
| `users-listing` | 1 | 0 |

Edits at archive time, outside the delta blocks:

- FE-21: the scenario "The form asks no Usuario" says that the field has no hint (S10 of the verify report). Changed in the delta and in the main spec.
- `coordination-escalation`: the Purpose and the Terms name `otro`; "either motive" reads "any of the three motives". Same wording in `request-review`.
- `catalog-management` A-DOC-FIELDS and `data-table` (`sort` of docentes): the list shows no login (W8).
- `auth-entry-access`: the Purpose lists FE-20 to FE-25 and FE-32, and the note "this whole file is ADDED" is removed.

## 4. Roadmap and backlog

`docs/roadmap.md`: row 13 is "archivado" and its note is rewritten. `docs/flow-experience-backlog.md`: UX-20 to UX-28 are "resuelta"; UX-29, UX-30 and UX-31 stay open.

## 5. Thesis sync list (flag for the owner; no thesis file was edited)

1. 5.8: every row adjusted. RF-01, RF-06 and RF-07 are worded as a defensive improvement with its diagnosis; RF-10 and RF-16 as system causes. The rows "sin definir" (5.8:20) are resolved.
2. 4.2:89: RN-20 adds "caso especial" and "otro". Already in the thesis text (matriz de requisitos, RN-20).
3. 5.4:19: "Otro" was added.
4. Anexo E:3 still says that everyone signs in with "Usuario" and "Contraseña". Since 2026-11-25 students sign in with their CIF or email and staff with their institutional email. "Mantener la sesión iniciada" lasts 30 days.
5. Recommendation 6: the queue search exists on the pending tab.
6. Recommendation 8: the Tabla 19 adjustments are done; repeating the test stays as future work.
7. The CIF format of the staff is unknown and is not stored.

## 6. Coordination notes

- #98 edited `docs/requirements.md` first; this change applied RN-20 on top.
- #105 touched the i18n JSON; the JSON was rebased last.
- The final migration is 0016 (`0016_escalation_otro`), in production since 2026-11-25. `dev-arnia` does not have 0014, 0015 or 0016, and `validacion-secretaria` was not touched.

## 7. Follow-ups

- Login rate limiting (design D13, UX-29).
- Server-side revocation of the 30-day sessions (UX-30).
- Search by a CIF typed with a hyphen or a space (UX-31).
- The thesis sync list of section 5.
- The duplicate queue-view audit rows and the draft rows created on visiting `/requests/new` (out of scope).
- The UX-17 and UX-18 numbering gap: those two entries are in the owner's staged edit of the backlog, in another checkout.
- Open suggestions of the verify report: non-empty guards in two tests (S1), the dead `login` sort key of docentes (S2), drift in `design.md` (S3), `docs/setup-local.md` should say that the seeded accounts sign in by email (S4), a real-browser preview of a PDF (S5), an index on `lower("Correo")` if the table grows (S6), the specific message for a CIF with "@" (S7) and the class-name checkbox tests (S9).

## 8. Move readback

`git mv openspec/changes/flow-experience openspec/changes/archive/2026-11-25-flow-experience`. `diff -r` between a copy of the source folder and the destination: empty output, exit 0 (this report did not exist yet).
