# Roadmap de changes

Orden de los changes de SDD que cubren la línea base de
[`docs/requirements.md`](./requirements.md). Los identificadores RF, RN y RNF
remiten a ese archivo.

| #   | Change                 | Cubre                                       | Responsable | Prototipo            | Estado    |
| --- | ---------------------- | ------------------------------------------- | ----------- | -------------------- | --------- |
| 0   | `catalog-schedule`     | Horarios en el catálogo (RN-22, RF-12)      | Josué       | Sí                   | pendiente |
| 1   | `justification-intake` | RF-01 a RF-04; RN-01 a RN-06, RN-21 a RN-23 | Armando     | Sí                   | pendiente |
| 2   | `secretary-review`     | RF-06 a RF-08; RN-08, RN-15 a RN-17         | Por asignar | Sí                   | pendiente |
| 3   | `teacher-remission`    | RF-09; RN-18, RN-19; RNF-07                 | Por asignar | Sí                   | pendiente |
| 4   | `document-extraction`  | RF-11; RNF-03                               | Por asignar | Si alcanza el tiempo | pendiente |
| 5   | `validation-signals`   | RF-05; RN-07, RN-09 a RN-14                 | Por asignar | Si alcanza el tiempo | pendiente |
| 6   | `escalation`           | RF-10; RN-20                                | Por asignar | No                   | pendiente |
| 7   | `coordination-reports` | RF-13                                       | Por asignar | No                   | pendiente |
| 8   | `normative-parameters` | RNF-14                                      | Por asignar | No                   | pendiente |

**Notas:**

- RF-12 y RNF-13 (mantenimiento e importación de catálogos) los cubren los
  changes en curso de Josué: `catalog-excel-import` y `catalog-management`.
- RNF-04, RNF-08, RNF-09 y RNF-10 se verifican en el piloto o en la operación,
  no en un change.
- Cada change se planifica con el flujo SDD del proyecto, uno por vez, y se
  archiva antes de abrir el siguiente.
