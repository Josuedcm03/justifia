# Proposal: Manual Document Data

## Intent

Roadmap row 18 (owner Armando). Covers RF-14 (a)-(d), RF-05 (e), RN-11,
RN-12, RN-13 and RN-24. Thesis Anexo F records RF-14 and RF-05-e as "No
ejecutable"; without manual capture a request whose extraction failed or is
off cannot be resolved with document data. The thesis (`C:\thesis-workspace`)
is the source of truth; decisions D1-D9 are owner-confirmed with grounding in
`exploration.md`.

## Scope

### In Scope
- Secretary registers or corrects student name, issuer, issue date and rest
  period; each value is marked "ingresado manualmente" (RF-14 a).
- Tri-state firma/sello (Sí / No / Sin registrar) and document type (RF-14 b,
  d). Types per Anexo D D11: `constancia_medica`, `constancia_institucional`,
  `otro` (D2).
- Effective view where manual wins (RN-24); clearing reverts to OCR (D8);
  resolution without extraction (RF-14 c).
- Signals rn11 (firma ausente), rn12 (sello ausente), rn13 (formato no
  corresponde a la causa); unregistered input is `not_evaluable`
  `not_registered` (D1); any-document aggregation (D5).
- Type->cause mapping (D4), the only RNF-14 part covered.
- Editable only in `pendiente`; coordination read-only (D6); structural
  validation only (D7).

### Out of Scope
- RF-12 (a) (catalog-schedule, Josué), RF-13 (c), roadmap row 8
  normative-parameters.
- RNF-14 as a whole stays "No cumple": plazos, calendario, causas, umbral and
  tamaño remain constants.

## Capabilities

### New Capabilities
- `manual-document-data`: manual fields, marks, type, effective view, edit
  window, validation.

### Modified Capabilities
- `validation-signals`: rn11/rn12/rn13, `not_registered`, verdict impact.
- `document-extraction`: effective state promoted by manual data.
- `request-review`: per-document form, shown also with extraction off.
- `coordination-escalation`: read-only manual data and new signals.
- `audit-log`: `documento.datos_registrados` (field names only).
- `data-retention`: manual data removed by cascade.

## Approach

Exploration approach 1:
- `TipoDocumento varchar(40)`, `TieneFirma`, `TieneSello` (nullable) on
  DocumentoRespaldo (Anexo D D11); new 1:1 typed table for the four fields,
  `ON DELETE CASCADE`; "manual" derived from a non-null value.
- Merge in `listExtractions` and the RN-14 issuer-history SQL.
- Mapping as a typed constant behind an injectable seam like `SignalParams`
  (D3; plan line 79 "primero como constante").
- Migration `0015`; server action with an access-matrix row; retention
  inventory and cascade proof, table not named in `retention.ts`.
- Chained PRs (~400 lines) on tracker `feat/manual-document-data`, slicing per
  exploration (PR1-PR5).

## Affected Areas

| Area | Impact |
|------|--------|
| `drizzle/0015_*.sql`, `src/db/schema.ts` | New/Modified |
| `src/lib/data/extraction.ts`, `signals.ts`, new manual-data module | New/Modified |
| `src/lib/signals/` (types, evaluate, verdict, policy) | Modified |
| `src/lib/audit/types.ts`, `src/test/access/matrix-table.ts` | Modified |
| `src/app/(dashboard)/review/[id]/`, coordination view, `i18n/{es,en}.json` | New/Modified |
| Retention inventory and integration tests | Modified |
| `docs/requirements.md` (minimal), `docs/roadmap.md` | Modified |

**DB schema: YES.** `0015` is applied to production only with the owner's
explicit yes. Merge gate: main auto-deploys, so no code reading the new
schema reaches main before that.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Verdict regression: unregistered marks turn verdicts inconclusive (D1) | High | Update fixtures; review copy says "not evaluated" |
| Text-pinned issuer SQL breaks | Med | Update `signals-sql.test.ts` with the merge |
| Josué edits `docs/requirements.md` concurrently | Med | Minimal requirement edits |
| Migration number clash with catalog-schedule | Med | Coordinate before PR1 |
| Thesis drift | Med | Sync list: Anexo D D15 note; Anexo F RF-05-e, RF-14 a-d, RNF-14 note; A5/Anexo G expectations |
| Maternidad mapping has no scenario | Low | Declared assumption |

## Rollback Plan

Revert the PRs in reverse order. Columns and the 1:1 table are additive and
nullable, so they may stay; dropping them needs a new migration and the
owner's yes.

## Dependencies

- Owner yes for `0015` in production; migration-number agreement with
  catalog-schedule.

## Success Criteria

Acceptance authority: thesis 4.9 line 7, "Un requisito se aprueba cuando pasa
cada inciso de su criterio".
- [ ] RF-14 (a)-(d) pass as Sistema / Captura per hoja
      `bitacora/hoja_ejecucion_pruebas_sistema_2026-11-03.md:46-53`.
- [ ] RF-05 (e) passes as Vitest unit "tipo discordante".
- [ ] Integration test reproduces SC-05, SC-08, SC-12 (forced fallida
      extraction, then capture -> rn10), SC-14, SC-01, SC-11 and RN-24
      precedence; A5 SC-01, 05, 06, 08-14 consistent.
- [ ] Test files named after the incisos.
- [ ] `npm test`, `npm run typecheck`, `npx eslint src` green.
