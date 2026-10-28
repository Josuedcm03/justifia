# Roadmap de changes

Orden de los changes de SDD que cubren la línea base de
[`docs/requirements.md`](./requirements.md). Los identificadores RF, RN y RNF
remiten a ese archivo.

| #   | Change                 | Cubre                                       | Responsable | Prototipo            | Estado    |
| --- | ---------------------- | ------------------------------------------- | ----------- | -------------------- | --------- |
| 0   | `catalog-schedule`     | Horarios en el catálogo (RN-22, RF-12)      | Josué       | Sí                   | pendiente |
| 1   | `justification-intake` | RF-01 a RF-04; RN-01 a RN-06, RN-21 a RN-23 | Armando     | Sí                   | archivado |
| 2   | `secretary-review`     | RF-06 a RF-08; RN-08, RN-15 a RN-17         | Armando     | Sí                   | archivado |
| 3   | `teacher-remission`    | RF-09; RN-18, RN-19; RNF-07                 | Por asignar | Sí                   | archivado |
| 4   | `document-extraction`  | RF-11; RNF-03                               | Por asignar | Si alcanza el tiempo | pendiente |
| 5   | `validation-signals`   | RF-05, RF-14; RN-07, RN-09 a RN-14, RN-24   | Por asignar | Si alcanza el tiempo | pendiente |
| 6   | `escalation`           | RF-10, RF-15; RN-20                         | Por asignar | No                   | pendiente |
| 7   | `coordination-reports` | RF-13                                       | Por asignar | No                   | pendiente |
| 8   | `normative-parameters` | RNF-14                                      | Por asignar | No                   | pendiente |
| 9   | `request-consent`      | RF-01 (d), RF-03 (f); RN-25                 | Por asignar | Sí                   | archivado |
| 10  | `secretary-templates`  | Plantillas propias de la secretaría (RF-07) | Por asignar | No                   | pendiente |
| 11  | `backoffice-ui-refresh` | Transversal de interfaz: RNF-01, RNF-11 (pantallas compartidas); contribuye a RNF-10 | Josué | No | archivado |
| 12  | `printable-forms`      | Formato especial prellenado e impresión (RN-19); requiere RF nuevo | Por asignar | No | pendiente |
| 13  | `flow-experience`      | Mejoras de experiencia del flujo; insumo en `docs/flow-experience-backlog.md` | Por asignar | No | pendiente |
| 14  | `student-enrollment`   | RF-16, RF-12, RF-04; RN-21, RN-22; RNF-06, RNF-12 | Josué | No | archivado |

**Notas:**

- `student-enrollment` agrega RF-16: el estudiante declara su propia inscripción
  en `/enrollment`, mientras no haya acceso al registro académico (RN-21). La
  declaración no está verificada y el control sigue siendo la aprobación de la
  secretaría (RN-15). Quedan fuera de alcance la vista del personal sobre las
  inscripciones y la columna `Origen`. Pendiente: sincronizar RF-16, RF-12 (c) y
  RN-21 con la matriz de la tesis.
  Archivado el 2026-10-25; el recorrido del propietario (fase 13) quedó
  parcial, según `openspec/changes/archive/2026-10-25-student-enrollment/tasks.md`.
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
- `request-consent` (archivado el 2026-10-21) agrega el consentimiento
  informado (RN-25) al envío de la solicitud: casilla de consentimiento versión
  1, con `CONSENT_VERSION` 2026-10-20, y aviso de privacidad público en
  `/privacy`. Las solicitudes presentadas antes del change muestran «No
  registrado»; una corrección nunca vuelve a pedir el consentimiento.
  Pendiente fuera del código: la revisión jurídica de la UAM del texto del
  consentimiento y del aviso de privacidad. El domicilio y la oficina de
  contacto del responsable son un marcador provisional; reemplazarlo exige un
  nuevo `CONSENT_VERSION`. El proveedor de correo no se nombra en el aviso, por
  decisión del responsable del proyecto (riesgo de la Ley 787, arts. 13 y 14).
  Quedan fuera de alcance el re-consentimiento y la revocación desde la
  aplicación. Minimizar lo que reciben los docentes por correo es un
  seguimiento de `teacher-remission`.
- Nota para el equipo (`document-extraction`): una vez que `request-consent`
  llegue a `main`, `document-extraction` debe regenerar su migración como `0011`
  (la `0010` la ocupa `request-consent`; no numerar a mano) y rebasar sobre
  `submitRequestAction(input: unknown)` y `SubmitInput.consentimientoVersion`.
- `secretary-templates` se planifica después del piloto. `secretary-review`
  entrega las plantillas de mensaje de cada decisión (aprobación, rechazo y
  devolución por cada motivo de RN-17) como constantes del sistema; la
  secretaría las edita en cada uso, pero no puede guardarlas. Este change
  permite que cada secretaría cree, edite, desactive y reutilice sus propias
  plantillas por facultad. Su alcance se define con los textos que la
  secretaría haya escrito en el piloto, en especial los de rechazo y devolución,
  de los que no hay ejemplos reales. Puede planificarse junto con
  `normative-parameters`.
- `teacher-remission` (archivado el 2026-10-20) envía la justificación a cada
  docente por correo tras la aprobación. Pendiente de operación, no de código:
  configurar `RESEND_API_KEY` y `MAIL_FROM` en Vercel una vez que la UAM
  verifique el dominio del remitente. Mientras tanto, las remisiones quedan
  `pendiente` o `error_envio`, y el reenvío automático o el botón «Reenviar»
  las envían cuando el correo esté configurado. Reemplazar o retirar un formato
  especial mal subido queda fuera de alcance (seguimiento). El formato especial
  prellenado e imprimible es el change #12 `printable-forms`. RN-19 se solapa
  con `validation-signals` (RF-14 d): al planificar ese change, confirmar qué
  parte de RN-19 ya cubre `teacher-remission`.
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
- `flow-experience` reúne las mejoras de experiencia de uso que se detectan
  en los recorridos y en el piloto. Su insumo vivo es
  [`docs/flow-experience-backlog.md`](./flow-experience-backlog.md): cada
  mejora nueva se anota ahí y el change se planifica desde ese archivo. Cubre
  RF y RN ya existentes; si alguna entrada cambia un requisito, se actualiza
  `docs/requirements.md` antes de planificarlo.
- El calendario de días no hábiles de RN-08 (2026 y 2027) se validó contra el
  calendario académico de la UAM el 2026-10-12. Debe extenderse cada año antes
  de que empiece: `src/lib/intake/calendar.test.ts` falla cuando el año en
  curso no está cubierto.
