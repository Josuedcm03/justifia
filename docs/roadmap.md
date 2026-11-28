# Roadmap de changes

Orden de los changes de SDD que cubren la línea base de
[`docs/requirements.md`](./requirements.md). Los identificadores RF, RN y RNF
remiten a ese archivo.

| #   | Change                     | Cubre                                                                                | Responsable | Prototipo            | Estado    |
| --- | -------------------------- | ------------------------------------------------------------------------------------ | ----------- | -------------------- | --------- |
| 0   | `catalog-schedule`         | Mantenimiento de inscripciones por la secretaría: RF-12 (a) a (c), RF-17 (b), (d), (e); RN-21; RNF-01, RNF-02, RNF-06, RNF-12; relacionado con RN-27 | Josué       | Sí                   | archivado |
| 1   | `justification-intake`     | RF-01 a RF-04; RN-01 a RN-06, RN-21 a RN-23                                          | Armando     | Sí                   | archivado |
| 2   | `secretary-review`         | RF-06 a RF-08; RN-08, RN-15 a RN-17                                                  | Armando     | Sí                   | archivado |
| 3   | `teacher-remission`        | RF-09; RN-18, RN-19; RNF-07                                                          | Por asignar | Sí                   | archivado |
| 4   | `document-extraction`      | RF-11; RNF-03                                                                        | Por asignar | Si alcanza el tiempo | archivado |
| 5   | `validation-signals`       | RF-05 (a) a (d), RF-13 (c); RN-07, RN-09, RN-10, RN-14, RN-15, RN-26                | Por asignar | Si alcanza el tiempo | archivado |
| 6   | `escalation`               | RF-10, RF-15; RN-20                                                                  | Por asignar | No                   | archivado |
| 7   | `coordination-reports`     | RF-18; RF-13 (a), (b), (d)                                                           | Por asignar | No                   | archivado |
| 8   | `normative-parameters`     | RNF-14; RN-01, RN-04, RN-07, RN-08, RN-13, RN-14, RN-23; RNF-01, RNF-06, RNF-12      | Armando     | No                   | archivado |
| 9   | `request-consent`          | RF-01 (d), RF-03 (f); RN-25                                                          | Por asignar | Sí                   | archivado |
| 10  | `secretary-templates`      | Plantillas propias de la secretaría (RF-07)                                          | Por asignar | No                   | pendiente |
| 11  | `backoffice-ui-refresh`    | Transversal de interfaz: RNF-01, RNF-11 (pantallas compartidas); contribuye a RNF-10 | Josué       | No                   | archivado |
| 12  | `printable-forms`          | Formato especial prellenado e impresión (RN-19); requiere RF nuevo                   | Por asignar | No                   | pendiente |
| 13  | `flow-experience`          | RF-01, RF-02, RF-03 (a, b), RF-04 (a), RF-06, RF-07 (c), RF-08, RF-10, RF-16 (c); RN-02, RN-05, RN-08, RN-16, RN-17, RN-20, RN-22, RN-23; RNF-01, RNF-06, RNF-10, RNF-11, RNF-12 | Armando     | No                   | archivado |
| 14  | `student-enrollment`       | RF-17 (antes RF-16), RF-12, RF-04; RN-21, RN-22; RNF-06, RNF-12                      | Josué       | No                   | archivado |
| 15  | `rest-signals-cause-scope` | RF-05 (a), (b); RN-09, RN-10, RN-15                                                  | Armando     | No                   | archivado |
| 16  | `auth-route-tests`         | RNF-01 (c)                                                                           | Armando     | Si alcanza el tiempo | archivado |
| 17  | `data-retention`           | RNF-04, RN-27                                                                        | Armando     | No                   | archivado |
| 18  | `manual-document-data`     | RF-14 (a) a (d); RF-05 (e); RN-11, RN-12, RN-13, RN-24; RNF-14 (solo el mapa tipo-causa) | Armando | No                | archivado |
| 19  | `docente-maintenance`      | RF-12 (a), (b) de docentes; RNF-01, RNF-06 (a), RNF-12, RNF-13 (b)                   | Armando     | No                   | archivado |

**Notas:**

- `student-enrollment` agrega RF-17 (numerado RF-16 hasta el 2026-11-09): el estudiante declara su propia inscripción
  en `/enrollment`, mientras no haya acceso al registro académico (RN-21). La
  declaración no está verificada y el control sigue siendo la aprobación de la
  secretaría (RN-15). Quedan fuera de alcance la vista del personal sobre las
  inscripciones y la columna `Origen`. Pendiente: agregar RF-17 a la matriz de la tesis y
  sincronizar RF-12 (c) y RN-21.
  Archivado el 2026-10-25; el recorrido del propietario (fase 13) quedó
  parcial, según `openspec/changes/archive/2026-10-25-student-enrollment/tasks.md`.
- `catalog-schedule` (archivado el 2026-11-22) da a la secretaría el mantenimiento de las
  inscripciones de los estudiantes de su facultad en `/catalog/inscripciones`:
  lista con filtros, desactivación y reactivación con confirmación, cambio de
  grupo y alta. Cubre RF-12 (a) a (c), RF-17 (b), (d), (e), RN-21, RNF-01,
  RNF-02, RNF-06 y RNF-12, y se relaciona con RN-27 (una inscripción activa
  retiene los datos del estudiante). Usa el permiso `canManageEnrollments`
  (solo la secretaría) y no `canManageCatalog`. El mantenimiento de docentes
  de RF-12 (a) lo cubre `docente-maintenance` (fila 19). No cubre los horarios
  con hora de reloj de RN-22.
- RF-12 y RNF-13 (mantenimiento e importación de catálogos) los cubren los
  changes en curso de Josué: `catalog-excel-import` y `catalog-management`.
- RNF-08, RNF-09 y RNF-10 se verifican en el piloto o en la operación, no en un
  change. RNF-04 queda cubierto por `data-retention` (fila 17) y se verificó con la
  corrida de integración del 2026-11-19 sobre una rama desechable de Neon (9 de 9
  pruebas, commit 653d761).
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
  Cumplido: la migración quedó como `0011_document_extraction`.
- `document-extraction` (archivado el 2026-10-28) lee con el modelo NuExtract3
  los documentos de respaldo de cada solicitud presentada o corregida, y del
  barrido diario, y muestra a la secretaría el nombre, el emisor, la fecha de
  emisión y el reposo extraídos (RF-11). Los datos son una ayuda y no cambian
  la solicitud. La migración `0011` ya está aplicada en producción. Orden de
  puesta en marcha: migrar, desplegar sin `EXTRACTION_API_URL` (la secretaría
  ve el aviso de configuración y nada se pierde) y definir la variable cuando
  el servidor del modelo esté desplegado; el despliegue de ese servidor (GPU
  serverless) queda fuera de alcance. `MAX_IMAGE_TOKENS` (6144) está atado al
  contexto de 8192 tokens del servidor (`-c 8192`): si se cambia el servidor,
  revisar ese límite, porque una solicitud que no entra agota los 3 intentos.
  Los documentos que terminan `fallida` no tienen carga manual en la lectura de extracción; la carga manual (RF-14) la entrega `manual-document-data` (fila 18), que sobrescribe el valor extraído campo por campo sin modificarlo (RN-24). Nota para el equipo (`escalation`): su migración
  también es `0011`; debe regenerarla con el número siguiente (no numerar a
  mano).
- `escalation` (archivado el 2026-10-30) permite a la secretaría escalar a la
  coordinación de la carrera una solicitud pendiente por sospecha sobre el
  documento o por un caso especial fuera de las causas del reglamento (RF-10
  a, RN-20), con el plazo de RN-08 en pausa hasta la respuesta, y registrar en
  una solicitud aprobada el reporte de exceso del 20 % que comunica el docente
  (RF-15), que solo avisa a la coordinación (RF-10 b): la aprobación sigue
  siendo definitiva. La migración `0012_escalation` se regeneró después de
  `document-extraction` y se aplica en producción con la fase 16 de su
  `tasks.md`. Pendientes fuera del change: la revisión legal de la UAM del
  consentimiento v2 y del aviso de privacidad; las cuentas de coordinación de
  cada carrera de la FIA (sin una cuenta activa la secretaría no puede
  escalar; Civil y Arquitectura aún no la tienen); `APP_BASE_URL` en Vercel
  (producción) para el enlace del aviso, y un dominio propio verificado en
  Resend para que el aviso no llegue a spam. El historial de escalamientos
  respondidos queda para `coordination-reports`. Nota para el equipo: cuando
  dos changes traen migración, el que llega segundo a `main` la regenera con
  `drizzle-kit generate`; nunca se numera a mano.
- `validation-signals` (archivado el 2026-11-02, entrega parcial) entrega el
  veredicto sugerido y las señales RN-07, RN-09, RN-10, RN-14 y RN-26 (RF-05
  (a) a (d)), que se calculan en cada lectura, no se guardan y no cambian la
  solicitud (RN-15). La secretaría ve el detalle completo; la coordinación ve
  solo resultados y veredicto, sin valores extraídos ni número de otra
  solicitud; el estudiante no ve nada. Quedaron fuera de esta entrega: RF-05 (e),
  RN-11, RN-12, RN-13 y RN-24 con RF-14 (la carga manual de datos del
  documento), que entrega `manual-document-data` (fila 18), y NS-12. El umbral de RN-14 era una constante de código hasta
  `normative-parameters` (RNF-14), que ya lo lee de la tabla de parámetros
  (fila 8, pendiente de archivo). La migración `0013_validation_signals`
  (huella del archivo) se aplicó en la base de producción el 2026-11-02. La
  revisión jurídica de la UAM (tarea 10.8 del change) quedó diferida por
  decisión del propietario hasta un despliegue real con estudiantes reales; no
  se realizó.
- Candidata para `validation-signals`: NS-12, señal de procedencia IA
  declarada en los metadatos de la imagen. No entra en el subconjunto mínimo
  previo a la prueba de usabilidad de la semana 13. Se promueve a RN y a un
  criterio de RF-05 solo si el spike en dispositivos de
  [`docs/investigacion/procedencia-ia-metadatos.md`](./investigacion/procedencia-ia-metadatos.md)
  la sustenta; si no, pasa a trabajo futuro de la tesis.
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
- `flow-experience` (archivado el 2026-11-25) entrega los ajustes de la
  Tabla 19 de la tesis (RF-01, RF-06, RF-07, RF-08, RF-10 y RF-16; UX-23 a
  UX-28), el enlace a «Cambiar contraseña» (UX-20), el ingreso con el CIF o el
  correo institucional (UX-21) y la sesión de 30 días con «Mantener la sesión
  iniciada» (UX-22). Agrega el motivo de escalamiento «Otro» (RN-20) con la
  migración `0016_escalation_otro`, aplicada en la base de producción el
  2026-11-25. Por decisión del propietario (2026-11-20) no queda ningún ingreso
  con el «Usuario» anterior: la columna `Login` se conserva, pero ya no
  identifica a nadie. Los desajustes con el texto de la tesis quedan listados en
  el informe de archivo. Siguen abiertas UX-29 (límite de intentos de ingreso),
  UX-30 (revocar las sesiones de 30 días) y UX-31 (buscar por CIF con guion o
  espacio). El insumo vivo sigue siendo
  [`docs/flow-experience-backlog.md`](./flow-experience-backlog.md): las mejoras
  nuevas se anotan ahí y se planifican en otro change; si alguna cambia un
  requisito, se actualiza `docs/requirements.md` antes de planificarla.
- El calendario de días no hábiles de RN-08 (2026 y 2027) se validó contra el
  calendario académico de la UAM el 2026-10-12. Debe extenderse cada año antes
  de que empiece: `src/lib/intake/calendar.test.ts` falla cuando el año en
  curso no está cubierto.
- `coordination-reports` (archivado el 2026-11-18) da a la coordinación de
  carrera el tablero `/reports` (rankings de estudiantes, docentes y
  asignaturas por período) y el detalle `/reports/requests`, con filtros por
  período, docente, estudiante y causa y descarga en Excel cuyo total coincide
  con el de la pantalla. Cubre RF-18 (RF-17 en su planificación, antes de la renumeración del 2026-11-09) y RF-13 (a), (b) y (d). RF-13 (c), el
  número de señales de reincidencia de cada estudiante, pasa a
  `validation-signals` (#5, RN-14): el ranking de estudiantes cuenta
  solicitudes y no es la reincidencia de RN-14. La descarga real (tarea 4.12)
  se comprobó el 2026-11-18 sobre `main` b82b359 en una rama de Neon
  desechable. Pendiente: sincronizar RF-18 con la matriz de la tesis.
- `auth-route-tests` (archivado el 2026-11-18) entrega pruebas de acceso para
  RNF-01 (c): las de `/login`, `/register`, `/profile` y la acción de registro;
  un control que falla cuando un punto de entrada o una acción de servidor
  bajo `src/app` no tiene prueba, o cuando una página del panel no llama a un
  guard como primera instrucción; y una matriz de acceso por rol: 62 puntos de
  entrada (25 páginas, 7 rutas y 30 acciones de servidor) x 7 identidades = 434
  casos, 320 denegados, cada uno ejecutado a través del guard real (`dal.ts`)
  y sin leer ningún dato antes de la denegación. También corrige una
  redirección abierta en el destino `next` del inicio de sesión
  (`safeNextPath`). El `/register` abierto (punto 0.6 del plan de la tesis) se
  cerró después con `REGISTRATION_OPEN`, cerrado por defecto. Pendientes: una
  prueba de `middleware.ts` y la ventana de la cuenta
  desactivada dentro de la sesión de 8 horas.
- `data-retention` (archivado el 2026-11-19) cancela a cada estudiante cinco años
  después de su última actividad, salvo que siga inscrito (RNF-04, RN-27). Una tarea
  diaria, a las 11:00 UTC, cancela por anonimización en el lugar: la cuenta conserva
  su fila, pero no puede iniciar sesión; sus datos personales se reemplazan por
  marcadores y se eliminan los documentos de respaldo y sus archivos. Se conservan
  el estado de las solicitudes, las fechas, las asignaturas, la versión del
  consentimiento y la auditoría. Cada cancelación deja una fila de auditoría
  `usuario.cancelado`, registrada por la cuenta del sistema.
  La cuenta del sistema (`sistema`, rol administrador) está inactiva y su clave no
  coincide con ninguna contraseña: solo sirve como actor de esas filas. Las
  particiones de la auditoría cubren de 2031 a 2035; la partición de 2036 es una
  tarea de mantenimiento que debe crearse antes del 1 de enero de 2036.
  Supuesto: se considera que la anonimización equivale a la «cancelación» que
  exige la Ley 787 (arts. 19 f y 24). Es un supuesto del change, no una revisión
  jurídica; la revisión de la UAM sigue pendiente.
- `manual-document-data` (archivado el 2026-11-20) permite a la secretaría
  registrar a mano, por documento de respaldo, el nombre del estudiante, el
  emisor, la fecha de emisión, el reposo (solo fechas desde y hasta; los días
  se calculan), el tipo de documento y las marcas de firma y sello (RF-14 (a)
  a (d); RF-05 (e)). El valor manual prevalece, campo por campo, sobre el
  extraído, y la extracción no se modifica (RN-24). Las señales RN-11, RN-12 y
  RN-13 se calculan en cada lectura. La migración `0015_manual_document_data`
  se aplicó en la base de producción el 2026-11-20 a las 00:34 (hora de
  Managua). Regla estricta: mientras una marca siga «Sin registrar», la señal
  queda sin resolver («La secretaría aún no registró este dato») y el
  veredicto sigue «No concluyente». Supuesto del
  change, no verificado: la correspondencia tipo-causa de
  `src/lib/signals/document-type-causes.ts` asigna la constancia médica a
  maternidad y paternidad. RNF-14 en su conjunto sigue «No cumple» hasta que
  `normative-parameters` (fila 8) cierre la constante de umbrales. El change
  ya está construido; el cumplimiento se declara cuando la prueba de sistema
  del change lo confirme.
- `docente-maintenance` (fila 19, archivado el 2026-11-26) da a la
  secretaría el mantenimiento de los docentes que faltaba en RF-12 (a) y (b):
  editar el nombre, el correo y el teléfono, y desactivar y reactivar al
  docente desde `/catalog/docentes`. Solo la secretaría puede hacerlo (permiso
  derivado de `canAssignRole`); administración y coordinación siguen con la
  lista de solo lectura. Un docente con grupos activos no se desactiva: primero
  se reasignan o se desactivan sus grupos. La importación nunca reactiva a un
  docente y rechaza con un error de fila (`docente.inactive`) los grupos que
  nombran a uno inactivo, lo que cierra el supuesto A-C12 de `catalog-management`.
  La creación de cuentas de `/users/new` registra una fila de auditoría
  `usuario.creado`. No hay migración ni variable de entorno nueva. RF-09, RN-18,
  RN-19, RN-02 y RN-27 no cambian: las remisiones ya generadas conservan el
  correo con el que se enviaron y las nuevas leen el nombre y el correo
  vigentes. La prueba contra Postgres y el recorrido RF-12 se hacen en una rama
  desechable de Neon antes de llevar el change a `main`.
