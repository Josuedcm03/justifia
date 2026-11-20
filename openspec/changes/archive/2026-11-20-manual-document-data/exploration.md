# Exploration: manual-document-data (RF-14 a-d, RF-05 e, RN-11/12/13/24, RNF-14 mapping)

Rebuilt from Engram observation #497 (`sdd/manual-document-data/explore`),
plus the owner-confirmed decisions at the end. Roadmap row 18, owner Armando.
Source of truth: the thesis workspace (`C:\thesis-workspace`).

Tooling note: CodeGraph had no index for the `p1` worktree and no shell was
available to initialize it; Read/Grep/Glob were used.

## Thesis acceptance

- RF-14 (`tesis/04_propuesta/4.2_requisitos.md:28`, Alta, origin "E-02;
  Decisión de diseño"):
  - (a) the secretary registers or corrects student name, issuer, issue date
    and rest period, and "el detalle marca cada dato 'ingresado manualmente'";
  - (b) marks presence of firma and sello;
  - (c) "Sin datos extraídos por OCR, la solicitud se resuelve con los datos
    registrados";
  - (d) registers the document type "para contrastarlo con la causa declarada
    (RN-13)".
- RF-05 (e) (4.2:19): "Un documento cuyo tipo registrado no corresponde a la
  causa declarada muestra la señal 'formato no corresponde a la causa'."
- RN-11 / RN-12 (4.2:80-81): a document marked by the secretary without the
  issuer's firma / sello generates "firma ausente" / "sello ausente".
- RN-13 (4.2:82): "La correspondencia entre tipo de documento y causa es un
  parámetro normativo (RNF-14)".
- RN-24 (4.2:93): "Un dato que la secretaría ingresa o corrige prevalece sobre
  el extraído por OCR."
- RNF-14 (4.2:56): a change in "plazos, calendario, causas, umbral de
  reincidencia o tamaño máximo" needs no new deploy. The type-to-cause mapping
  is not in that list; only RN-13 names it.
- Tests (`4.9_diseno_pruebas.md:19,26`):
  - RF-05 = Unitaria / Vitest, "Documento de E-02, tercera solicitud de un
    emisor, tipo discordante y archivo repetido (a–f)".
  - RF-14 = Sistema / Captura, "Registro manual de datos, marcas y tipo;
    resolución sin extracción (a–d)".
  - Pass rule (4.9:7): "Un requisito se aprueba cuando pasa cada inciso de su
    criterio".
- System steps (`bitacora/hoja_ejecucion_pruebas_sistema_2026-11-03.md:46-53`):
  - a) register/correct name, issuer, issue date, rest -> each datum marked
    "ingresado manualmente";
  - b) mark firma and sello -> saved;
  - c) with extraction off, resolve the request -> resolves with registered
    data;
  - d) register type -> saved and contrasted with the cause.
- A5 scenarios (`anexos/instrumentos/anexo_a5_escenarios_prueba.md:23-36`;
  causes from `build/documentos_sesion/datos.py`):
  - SC-05 actividad_representativa + FM (medical certificate) -> rn13 present.
  - SC-08 medica, sello false -> rn12.
  - SC-14 medica, firma false -> rn11.
  - SC-12 medica, rest 9 Nov vs absence 9-10 Nov, handwriting: before capture
    "no reconocidos", after capture -> rn10 present.
  - SC-01 FM + medica -> no signal.
  - SC-10 CD (UAM letter) + actividad_representativa -> no signal.
  - SC-06 CI + fuerza_mayor; SC-13 CI + intercambio_academico.
  - SC-11 FE + fuerza_mayor -> no signal.
- Anexo F today: RF-05-e "No ejecutable / Señal RN-13 no construida"; RF-14
  (a a d) "No ejecutable / Función no construida"; RNF-14 "No cumple". Alta
  incisos 47/53 -> 52/53 after this change (RF-12 a remains).
- Anexo D:
  - D11 DocumentoRespaldo adds `TipoDocumento varchar(40)` (constancia_medica,
    constancia_institucional u otro; "Otro activa la señal de RN-13"),
    `TieneFirma boolean` nullable ("Nulo: aún no registrado"), `TieneSello`.
  - D15 DatoExtraido (DocumentoRespaldoId, Campo, Valor, Origen ocr|manual,
    unique per document + field + origin).
  - D19 ParametroNormativo (Clave, Valor jsonb including the type->cause map,
    VigenteDesde).
  - The note at line 42 says the database has no D15/D19 names and the D11
    columns are "previstos para RF-14".
- CU-08 step 3 (`4.3_vista_escenarios.md:63`): "Registra datos, firma, sello y
  tipo, y el sistema genera con ellos las señales".
- `bitacora/plan_cierre_brechas_2026-11-16.md:79`: the RN-13 mapping "Puede ir
  primero como constante y pasar a normative-parameters después".

## Current code (worktree p1)

- Placeholders are only comments: `review/[id]/page.tsx:149-156`,
  `request-sections.tsx:18-21`.
- Page wiring: `loadExtractions` page.tsx:116-126,209; signals :134-147,
  213-216; `ExtractionSection` :301; audited read :218.
- `ExtraccionDocumento` in `schema.ts:817-891`; `CK_Extraccion_Datos`
  (874-877) forces data NULL unless `completada`. Only
  `src/lib/data/extraction.ts` writes it (`completeExtraction` :222-243).
  `listExtractions` (:384-444) is the single read of extracted data for the
  page AND the signals.
- `ExtractionSection` hides entries whose display kind is `notConfigured`
  (`extraction-section.tsx:151`): with extraction off the secretary sees
  nothing to edit.
- Signals:
  - `types.ts:14` `SIGNAL_CODES` (5); :22-66 reasons / `ALLOWED_REASONS`;
    :159-185 `SignalDocument` / `SignalInput`.
  - `evaluate.ts:19-57`.
  - `verdict.ts:12-31`: `no_alerts` only if every applicable signal is absent;
    `not_evaluable` -> inconclusive.
  - `params.ts:10-12`: constant threshold.
  - `coordination-view.ts` copies by name.
- `rest-dates.ts:19-26` and `issuer.ts:42-59` read only `state === "completada"`
  rows; failed/pending => `not_evaluable`.
- `readIssuerHistory` (`signals.ts:127-177`) reads `extraccionDocumento.emisor`
  directly with estado `completada`: RN-14 history ignores any manual issuer
  today. Text-pinned in `signals-sql.test.ts`.
- `causes.ts:5-34`: `CAUSAS` (5) and `CAUSAS_CON_REPOSO` constants; a comment
  says the configurable cause-document table is RNF-14.
- Write pattern:
  - `escalation-actions.ts:65-78` `authorize()`; `remission-actions.ts`;
    `special-format.ts:139-245` (scope check, transaction, audit in the same
    transaction).
  - `permissions.ts:129-137` `rolesRevisores = [secretaria]`.
  - `AUDIT_ACTIONS` closed list (`audit/types.ts:21-66`; no DB check on
    `Accion`; pinned by `types.test.ts:34-83`); `data/audit.ts:22-37`.
  - Access matrix `src/test/access/matrix-table.ts:182-192`: a new action needs
    a row.
- SR-11: `review/structure.test.ts:196-204` bans `revalidatePath` /
  `router.refresh` in the review directory; actions redirect to self
  (`escalation-actions.ts:166`).
- Retention:
  - `retention-inventory.test.ts:46-182` (documentoRespaldo: all columns in
    `deleted`, :163-181).
  - `retention.ts:190-192` deletes DocumentoRespaldo; extraction cascades.
  - `retention.test.ts:399-407` forbids naming `extraccionDocumento` /
    `huellaSha256` in `retention.ts`.
  - `retention.integration.test.ts:277,428-433` proves the cascade.
- Migrations: latest `0014_data_retention`; next `0015` (Josué's
  catalog-schedule may also add one: Engram #496).
- Integration harness: `vitest.integration.config.mts`, gated by
  `INTEGRATION_DATABASE_URL` + `INTEGRATION_ALLOW_WRITES=1`, never production
  (`guard.ts`); `fixtures.ts`; `validation-signals.integration.test.ts` as the
  model.
- `openspec/specs/` is empty (`.gitkeep`); baseline specs live in
  `openspec/changes/archive/*/specs`.

## Approaches

### Data model

1. **Recommended.** tipo/firma/sello as columns on DocumentoRespaldo per
   Anexo D D11, plus a new 1:1 typed table for the four manual data fields
   (a non-null column = "ingresado manualmente"), overlaid at read.
2. Everything in one new 1:1 table.
3. Anexo D D15 literal row-per-field table with `Origen`.

Rejected: columns inside ExtraccionDocumento (the row may not exist, the CHECK,
the single-writer module, OCR worker overwrite).

### Mapping

- **A, recommended.** Typed code constant behind an injectable policy seam like
  `SignalParams`, with an exhaustive test over types x causes.
- B. ParametroNormativo table with a read-only seed.
- C. Table plus an admin edit UI (= roadmap row 8).

RNF-14 as a whole stays "No cumple" until row 8.

## Open decisions (exploration defaults)

D1 unregistered type/firma/sello => `not_evaluable` "not_registered"; D2 type
list of 4 (+formato_especial) vs Anexo D's 3; D3 mapping contents; D4 RNF-14
scope; D5 any-document aggregation; D6 editable only in pendiente; D7
structural validation only (no OCR plausibility window); D8 clearing a manual
value reverts to OCR; D9 manual data promotes the row to completada.

All are resolved below.

## Slicing (~400 lines each)

- PR1: schema + migration 0015 + pure domain (validation, merge, policy) +
  retention inventory.
- PR2: data layer (write function, audit action, overlay in `listExtractions`
  and `readIssuerHistory`).
- PR3: signals rn11/rn12/rn13 + i18n + verdict fixtures.
- PR4: server action + access matrix + form + display badges.
- PR5: integration E2E of the thesis cases + roadmap row 18 + thesis sync notes.

## Thesis-confirmed decisions

Confirmed by the owner, who made the thesis the source of truth. Paths are
relative to `C:\thesis-workspace`.

| ID | Decision | Grounding |
|----|----------|-----------|
| D1 | An unregistered firma, sello or tipo makes its signal `not_evaluable` with a new reason `not_registered`; the suggested verdict shows the signal was not evaluated (inconclusive). Existing verdict fixtures are updated. | `tesis/04_propuesta/4.6_vista_desarrollo.md:33` "Las señales que dependen de ese dato quedan sin evaluar, y el veredicto sugerido lo indica"; Anexo D D11 "Nulo: aún no registrado"; CU-08 step 3 (`4.3_vista_escenarios.md:63`) |
| D2 | Three document types, exactly as Anexo D D11 (`anexos/anexo_d_modelo_fisico.md:197`): `constancia_medica`, `constancia_institucional`, `otro`. "Otro activa la señal de RN-13": `otro` corresponds to no cause. FE (FIA special format), CD (UAM sports letter) and CI (employer or foundation letters) are all `constancia_institucional`. Keeps SC-11 consistent without a new type; Anexo D needs no edit for the type list. | Anexo D D11; A5 SC-10, SC-11 |
| D3 | The type->cause mapping is a typed code constant behind an injectable policy seam (same pattern as `SignalParams`), shaped so a ParametroNormativo table can replace it later. RF-05 (e) approval does not depend on where the mapping lives, because the RNF-14 criterion does not include it. | Anexo D line 42 (D19 not in the real database); `bitacora/plan_cierre_brechas_2026-11-16.md:79` "primero como constante"; RNF-14 criterion (4.2:56) |
| D4 | `constancia_medica` -> `medica`, `maternidad_paternidad` (lactancia included in that cause per RN-01; no thesis scenario, declared an assumption). `constancia_institucional` -> `actividad_representativa`, `intercambio_academico`, `fuerza_mayor`. `otro` -> none. | A5 SC-05, SC-10, SC-06, SC-13, SC-11, SC-01, SC-09; `investigacion/bases_del_proyecto.md` §2.1 "Formato de casos especiales usado para causa médica, o a la inversa" (institutional + medica produces the signal) |
| D5 | With several documents, a signal is present if any document is present, as in RN-09. | RN-09 aggregation |
| D6 | Manual data is editable only while the request is `pendiente`; coordination is read-only. | Owner decision |
| D7 | Validation is structural only: real dates and rest from <= to. | Owner decision |
| D8 | Clearing a manual value reverts to the OCR value. | RN-24 |
| D9 | Fields are independent. Firma and sello are tri-state (Sí / No / Sin registrar). Manual data promotes the effective state, so RF-14 (c) works with extraction failed or off. | RF-14 (c); Anexo D D11 nullable booleans |

### Scope confirmed

- Covers RF-14 (a)-(d), RF-05 (e), RN-11, RN-12, RN-13, RN-24. RNF-14: only
  the type-to-cause mapping; RNF-14 as a whole stays "No cumple" (plazos,
  calendario, causas, umbral and tamaño remain constants).
- Out of scope: RF-12 (a) (catalog-schedule, Josué), RF-13 (c), roadmap row 8
  normative-parameters.
