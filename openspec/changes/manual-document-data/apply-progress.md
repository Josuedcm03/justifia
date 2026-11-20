# Apply progress: manual-document-data

## Phase 0: Planning and decisions

### 0.1 Owner answers (2026-11-19, Managua)

- (a) **Size: exception accepted up front.** Keep the seven planned slices (forecast block in tasks.md). The owner accepts that slices may exceed the 400-line budget, as data-retention did. The unit-boundary split rule stays as guidance only.
- (b) **Section title: it stays "Datos extraídos"** (spec MD-23, MD-26, MD-28). The thesis does not name the section. RF-14 (a) only asks that the detail mark each manual datum "ingresado manualmente", and the per-field mark does that.
- (c) **Signal evidence: document ids only** (spec MD-16 and MD-28). No counts or type codes.
- (d) **MD-30 stays in scope** (PR 7). It is a coordination read-only block with the type and the marks, never the four values.
- (e) **A4 accepted.** While OCR is pending, a missing date reads "field_missing" (spec MD-17). In both cases the signal stays not evaluated, as thesis 4.6:33 asks.
- (f) **Vercel previews use the PRODUCTION database.** Preview and Production share DATABASE_URL (Engram #439, set on 2026-11-14 from the production branch). Consequences:
  - Never use a slice preview for testing.
  - The RF-14 system case (Phase 10) runs locally against the disposable branch "manual-it".
  - A preview of PR 1 onward that inserts a document would fail until 0015 is in production. Nobody uses previews, so no action is taken beyond this note.

### 0.2 Coordination (2026-11-19)

- (a) **Migration number: 0015.** On the latest main (172e9e0) the last migration is 0014_data_retention. Josué may add a migration in catalog-schedule. Whoever merges second rebases and regenerates with "npx drizzle-kit generate".
- (b) **Requirements doc.** Josué is syncing docs/requirements.md (RN-16, RN-20, RF-11, RNF-03, RN-26, RF-17, RF-12 (c)). This change keeps its edit there to one line (task 8.12) and rebases first.

### 0.4 Spec reconciliation check

- "whole number": no match in specs/manual-document-data/spec.md (dates only).
- "tieneFirma": present in specs/audit-log/spec.md (the closed list).
- "STRICT": present in specs/validation-signals/spec.md (the MD-16 rule).
