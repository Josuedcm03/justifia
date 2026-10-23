# Insumo: experiencia del flujo

Lista viva de mejoras de experiencia de uso (UX) del sistema. Es el insumo del
change `flow-experience` (fila #13 de [`docs/roadmap.md`](./roadmap.md)): cuando
se planifique, su exploración parte de este archivo.

Cada entrada indica dónde se observó, qué pasa hoy, qué se espera y qué
requisitos toca. Una entrada no es una decisión: el change la confirma, la
ajusta o la descarta. Al archivar el change, las entradas resueltas se marcan
con el change que las cubrió.

Estados: `abierta` (por analizar), `decisión pendiente` (falta una decisión del
equipo), `resuelta` (cubierta por un change).

## Entradas

### UX-01. Validación desigual entre los pasos del formulario de solicitud

- **Estado:** abierta.
- **Origen:** recorrido manual de `request-consent`, 2026-10-21.
- **Pantalla:** nueva solicitud y corrección (`/requests/new`), pasos 1 a 4.
- **Hoy:** el paso 1 (causa y fechas) no deja avanzar sin completar sus campos.
  Los pasos 2 (asignaturas) y 3 (documentos) dejan pulsar «Continuar» sin
  ninguna asignatura marcada ni documento adjunto; los errores aparecen recién
  en la revisión (paso 4), todos juntos.
- **Esperado:** un criterio uniforme en todos los pasos. Por ejemplo, que cada
  paso avise de lo que falta al pulsar «Continuar», sin perder la revisión
  final con todos los errores.
- **Requisitos:** RF-01, RF-02, RF-03 (a, c, e); spec `justification-intake`,
  requisitos «Four-step stepper» y «Submit blocking».

### UX-02. ¿Sigue siendo obligatorio el documento de respaldo?

- **Estado:** decisión pendiente, antes del piloto.
- **Origen:** recorrido manual de `request-consent`, 2026-10-21.
- **Hoy:** sin al menos un documento de respaldo la solicitud no se envía
  (RF-03 c, RN-03).
- **Duda:** puede haber casos sin constancia ni prueba. Hasta decidirlo, el
  documento sigue siendo obligatorio.
- **Requisitos:** RF-03 (c), RN-03; si cambia, también `docs/requirements.md`.

### UX-03. Retomar un borrador: avisar antes de continuar

- **Estado:** abierta (idea, sin confirmar).
- **Origen:** recorrido manual de `request-consent`, 2026-10-21.
- **Hoy:** abrir una nueva solicitud retoma el borrador existente en su último
  paso (spec `justification-intake`, requisito «One open draft per student,
  resume»). El comportamiento es correcto y se mantiene.
- **Idea:** al abrir el flujo con un borrador guardado, preguntar si se continúa
  con él o se empieza de cero.
- **Requisitos:** RF-01; decisión D8 de `justification-intake`.

### UX-04. Buscar solicitudes por CIF o nombre en la bandeja de la secretaría

- **Estado:** abierta.
- **Origen:** exploración de `escalation`, 2026-10-22.
- **Pantalla:** bandeja de la secretaría (`/review`).
- **Hoy:** la bandeja lista solo las solicitudes pendientes. Una solicitud ya
  decidida solo se abre escribiendo su dirección (`/review/<id>`).
  `escalation` agrega pestañas por estado (pendientes, en coordinación,
  aprobadas), pero no una búsqueda.
- **Esperado:** buscar una solicitud por el CIF o el nombre del estudiante,
  en cualquier estado.
- **Requisitos:** RF-06, RF-15; spec `request-review`.

### UX-05. Explicar el estado en el detalle de una solicitud no pendiente

- **Estado:** abierta.
- **Origen:** exploración de `escalation`, 2026-10-22.
- **Pantalla:** detalle de la solicitud para la secretaría (`/review/[id]`).
- **Hoy:** el panel de decisión aparece solo cuando la solicitud está
  pendiente. En cualquier otro estado la pantalla no dice en qué estado está
  ni qué acciones quedan.
- **Esperado:** un panel de estado que nombre el estado actual y las acciones
  disponibles, o que diga que no queda ninguna.
- **Requisitos:** RF-07 (a), RN-16; spec `request-review`.

### UX-06. Aviso suave por una fecha de reporte anterior a la aprobación

- **Estado:** abierta.
- **Origen:** implementación de `escalation` (S1), 2026-10-23.
- **Pantalla:** diálogo de reporte de exceso de inasistencias en el detalle de
  la solicitud aprobada (`/review/[id]`).
- **Hoy:** la fecha en que el docente comunicó el exceso solo rechaza un día
  futuro. Una fecha anterior a la aprobación se guarda sin aviso, aunque sea un
  error de tipeo (por ejemplo, el año).
- **Esperado:** un aviso que no bloquee, del tipo «La fecha es anterior a la
  aprobación de la solicitud. ¿Es correcta?», y que la secretaría pueda
  confirmar igual. El registro del reporte no cambia (RF-15).
- **Requisitos:** RF-15 (a); spec `coordination-escalation`.

### UX-07. Estado de la remisión en el selector de docentes del reporte

- **Estado:** abierta.
- **Origen:** implementación de `escalation` (S2), 2026-10-23.
- **Pantalla:** diálogo de reporte de exceso de inasistencias en el detalle de
  la solicitud aprobada (`/review/[id]`).
- **Hoy:** el selector lista los docentes a los que se remitió la solicitud,
  sin indicar si el correo de remisión ya se envió o sigue pendiente.
- **Esperado:** junto a cada nombre, el estado de su remisión (enviada,
  pendiente o bloqueada), para que la secretaría sepa si el docente recibió la
  justificación antes de registrar su reporte.
- **Requisitos:** RF-09 (c), RF-15; specs `teacher-remission` y
  `coordination-escalation`.

### UX-08. Mostrar que se agotaron los reintentos automáticos de un aviso

- **Estado:** abierta.
- **Origen:** implementación de `escalation` (S3), 2026-10-23.
- **Pantalla:** estado del aviso a la coordinación en el detalle de la
  solicitud (`/review/[id]`).
- **Hoy:** tras los 8 intentos automáticos, la etiqueta sigue diciendo
  «pendiente, último intento fallido», igual que antes de agotarlos.
- **Esperado:** que la etiqueta indique que el sistema ya no reintentará solo
  y que queda el reenvío manual.
- **Requisitos:** RF-10 (b), RNF-07; spec `coordination-escalation`.

### UX-09. Reenviar el aviso desde la pestaña «En coordinación»

- **Estado:** abierta.
- **Origen:** implementación de `escalation` (S3), 2026-10-23.
- **Pantalla:** pestaña «En coordinación» de la bandeja de la secretaría
  (`/review`).
- **Hoy:** la pestaña muestra el estado del aviso de cada solicitud, pero el
  reenvío solo está en el detalle; hay que abrir la solicitud para reenviar.
- **Esperado:** el control de reenvío en la misma fila cuando el aviso no se
  envió.
- **Requisitos:** RF-10 (b); specs `request-review` y
  `coordination-escalation`.
