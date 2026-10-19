# Roadmap de changes

Orden de los changes de SDD que cubren la línea base de
[`docs/requirements.md`](./requirements.md). Los identificadores RF, RN y RNF
remiten a ese archivo.

| #   | Change                 | Cubre                                       | Responsable | Prototipo            | Estado    |
| --- | ---------------------- | ------------------------------------------- | ----------- | -------------------- | --------- |
| 0   | `catalog-schedule`     | Horarios en el catálogo (RN-22, RF-12)      | Josué       | Sí                   | pendiente |
| 1   | `justification-intake` | RF-01 a RF-04; RN-01 a RN-06, RN-21 a RN-23 | Armando     | Sí                   | archivado |
| 2   | `secretary-review`     | RF-06 a RF-08; RN-08, RN-15 a RN-17         | Armando     | Sí                   | archivado |
| 3   | `teacher-remission`    | RF-09; RN-18, RN-19; RNF-07                 | Por asignar | Sí                   | pendiente |
| 4   | `document-extraction`  | RF-11; RNF-03                               | Por asignar | Si alcanza el tiempo | pendiente |
| 5   | `validation-signals`   | RF-05, RF-14; RN-07, RN-09 a RN-14, RN-24   | Por asignar | Si alcanza el tiempo | pendiente |
| 6   | `escalation`           | RF-10, RF-15; RN-20                         | Por asignar | No                   | pendiente |
| 7   | `coordination-reports` | RF-13                                       | Por asignar | No                   | pendiente |
| 8   | `normative-parameters` | RNF-14                                      | Por asignar | No                   | pendiente |
| 9   | `request-consent`      | RF-01 (d), RF-03 (f); RN-25                 | Por asignar | Sí                   | pendiente |
| 10  | `secretary-templates`  | Plantillas propias de la secretaría (RF-07) | Por asignar | No                   | pendiente |
| 12  | `printable-forms`      | Formato especial prellenado e impresión (RN-19); requiere RF nuevo | Por asignar | No | pendiente |

**Notas:**

- RF-12 y RNF-13 (mantenimiento e importación de catálogos) los cubren los
  changes en curso de Josué: `catalog-excel-import` y `catalog-management`.
- RNF-04, RNF-08, RNF-09 y RNF-10 se verifican en el piloto o en la operación,
  no en un change.
- Cada change se planifica con el flujo SDD del proyecto, uno por vez, y se
  archiva antes de abrir el siguiente.
- El despliegue de `justification-intake` en Vercel está en producción: el
  proyecto existe y `main` se despliega a producción. Los previews de los
  commits de miembros que no pertenecen al equipo de Vercel fallan hasta que
  se les invite.
- `request-consent` agrega el consentimiento informado (RN-25) al envío de la
  solicitud. Modifica el flujo de `justification-intake`, ya archivado, por lo
  que va como change propio. Las solicitudes enviadas antes de este change no
  tienen consentimiento registrado; el change define cómo se tratan.
- `secretary-templates` se planifica después del piloto. `secretary-review`
  entrega las plantillas de mensaje de cada decisión (aprobación, rechazo y
  devolución por cada motivo de RN-17) como constantes del sistema; la
  secretaría las edita en cada uso, pero no puede guardarlas. Este change
  permite que cada secretaría cree, edite, desactive y reutilice sus propias
  plantillas por facultad. Su alcance se define con los textos que la
  secretaría haya escrito en el piloto, en especial los de rechazo y devolución,
  de los que no hay ejemplos reales. Puede planificarse junto con
  `normative-parameters`.
- `printable-forms` genera, a partir de los datos que el estudiante ya
  ingresó en la solicitud, el formato especial de la FIA «Solicitud de
  Justificación de Ausencia» (casos de fuerza mayor de RN-19) listo para
  imprimir con un solo botón, para que la coordinación lo firme y lo selle sin
  que nadie lo llene a mano. El mismo botón sirve para imprimir otros
  documentos de una solicitud que la secretaría necesite en papel. No cubre la
  firma electrónica ni la remisión por correo, que hace `teacher-remission`.
  Bloqueos: falta el ejemplar en blanco del formato (pendiente T-5 del
  repositorio de tesis; los campos se conocen solo por el expediente EXP-05) y
  no hay un RF en la línea base, por lo que hay que agregarlo a
  `docs/requirements.md` antes de planificarlo. Lleva el número 12 porque el
  11 lo usa `backoffice-ui-refresh` en la rama de Josué.
- El calendario de días no hábiles de RN-08 (2026 y 2027) se validó contra el
  calendario académico de la UAM el 2026-10-12. Debe extenderse cada año antes
  de que empiece: `src/lib/intake/calendar.test.ts` falla cuando el año en
  curso no está cubierto.
