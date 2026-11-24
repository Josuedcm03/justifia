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

### UX-10. Avisos leídos en la lista de la coordinación

- **Estado:** abierta.
- **Origen:** implementación de `escalation` (S4), 2026-10-23.
- **Pantalla:** lista de la coordinación (`/coordination`).
- **Hoy:** los avisos informativos de exceso de inasistencias no indican si
  ya se abrieron, la lista no tiene tope y cada apertura queda en la
  auditoría.
- **Esperado:** distinguir los avisos ya vistos de los nuevos y limitar la
  lista (por ejemplo, los más recientes), sin perder el registro de lectura.
- **Requisitos:** RF-10 (b), RF-15; specs `coordination-escalation` y
  `audit-log`.

### UX-11. Tiempo de espera en el detalle de la coordinación

- **Estado:** abierta.
- **Origen:** implementación de `escalation` (S4), 2026-10-23.
- **Pantalla:** detalle de un escalamiento para la coordinación
  (`/coordination/[id]`).
- **Hoy:** el detalle muestra cuándo se escaló la solicitud, pero no cuánto
  tiempo lleva esperando la respuesta. El plazo de RN-08 está pausado, así que
  no hay ningún indicador de demora.
- **Esperado:** un indicador del tiempo transcurrido desde el escalamiento
  (por ejemplo, en días hábiles), para que la coordinación priorice.
- **Requisitos:** RF-10, RN-08; spec `coordination-escalation`.

### UX-12. Qué esperar mientras la coordinación revisa la solicitud

- **Estado:** abierta.
- **Origen:** implementación de `escalation` (S5), 2026-10-23.
- **Pantalla:** detalle de la solicitud para el estudiante (`/requests/[id]`).
- **Hoy:** en `en_revision_coordinacion` el estudiante ve una etiqueta neutra
  («La coordinación de tu carrera está revisando esta solicitud. No necesitas
  hacer nada por ahora.»). No sabe cuánto puede tardar ni cómo se enterará del
  resultado; cuando la coordinación responde, la solicitud vuelve a
  `pendiente` sin otro aviso.
- **Esperado:** una indicación de qué sigue: que la solicitud vuelve a la
  secretaría tras la respuesta y que el resultado se verá en esta pantalla (o
  por correo, si se decide notificar). Sin revelar el motivo del escalamiento
  (E13).
- **Requisitos:** RF-10, RN-16; specs `student-requests` y
  `coordination-escalation`.

### UX-13. Por qué el plazo cambió al volver de coordinación

- **Estado:** abierta.
- **Origen:** observación 1 del diseño de `escalation`, aprobada en el
  recorrido del 2026-10-30.
- **Pantalla:** cola de revisión de la secretaría, pestaña «Pendientes»
  (`/review`).
- **Hoy:** una solicitud que vuelve de la coordinación muestra un vencimiento
  más tardío que el original, sin explicar por qué. El plazo de RN-08 estuvo
  pausado mientras la solicitud estaba escalada.
- **Esperado:** una indicación junto al plazo, por ejemplo «Plazo pausado N
  días mientras estuvo en coordinación», para que la secretaría entienda el
  cambio.
- **Requisitos:** RF-10, RN-08; specs `request-review` y
  `coordination-escalation`.

### UX-14. Buscar en la pestaña «Aprobadas»

- **Estado:** abierta.
- **Origen:** observación 2 del diseño de `escalation` (corte E14), aprobada
  en el recorrido del 2026-10-30.
- **Pantalla:** cola de revisión de la secretaría, pestaña «Aprobadas»
  (`/review`).
- **Hoy:** la pestaña lista solo las 50 solicitudes aprobadas más recientes y
  no tiene búsqueda. Para reportar exceso de inasistencias sobre una solicitud
  más antigua, la secretaría necesita conocer su URL.
- **Esperado:** búsqueda por estudiante (nombre o CIF) o por número de
  solicitud, y paginación más allá de las 50 más recientes.
- **Requisitos:** RF-15; spec `request-review`.

### UX-15. Estado de la remisión en el selector de docentes

- **Estado:** abierta.
- **Origen:** observación 4 del diseño de `escalation`, aprobada en el
  recorrido del 2026-10-30.
- **Pantalla:** diálogo «Reportar exceso de inasistencias» en el detalle de
  una solicitud aprobada (`/review/[id]`).
- **Hoy:** el selector lista a los docentes a los que se remitió la
  solicitud, aunque el correo de remisión siga pendiente o haya fallado. La
  secretaría no sabe si el docente ya recibió la justificación.
- **Esperado:** junto a cada nombre, una indicación breve del estado de la
  remisión (enviada, pendiente o fallida).
- **Requisitos:** RF-15; specs `request-review` y `coordination-escalation`.

### UX-16. Visor del documento dentro del detalle

- **Estado:** abierta.
- **Origen:** recorrido del change `validation-signals` del 2026-11-02, como
  secretaría.
- **Pantalla:** sección «Documentos de respaldo» del detalle de la solicitud,
  para la secretaría (`/review/[id]`) y la coordinación
  (`/coordination/[id]`).
- **Hoy:** cada documento ofrece «Ver», que lo abre en otra pestaña, y
  «Descargar». Para contrastar el documento con los datos extraídos y las
  señales, hay que cambiar de ventana o abrir el archivo descargado.
- **Esperado:** el documento se muestra dentro del mismo detalle, en un
  contenedor con zoom y desplazamiento (imágenes y PDF), junto a los datos
  extraídos y las señales, sin salir de la pantalla. «Descargar» se mantiene.
- **Requisitos:** RF-05, RF-11; specs `request-review`,
  `coordination-escalation` y `supporting-documents`.

### UX-19. Ocultar las cuentas del sistema y las canceladas en el listado de usuarios

- **Estado:** abierta.
- **Origen:** diseño de `data-retention` (D9), 2026-11-19.
- **Pantalla:** listado de usuarios del administrador (`/users`).
- **Hoy:** el listado muestra la cuenta del sistema «Sistema (tarea programada)» y las cuentas de estudiantes canceladas por la retención como usuarios inactivos, sin distinguirlas de las demás.
- **Esperado:** un filtro que oculte esas cuentas del listado.
- **Requisitos:** RNF-04; spec `data-retention`.

### UX-20. Enlace a «Cambiar contraseña» desde el perfil

- **Estado:** abierta.
- **Origen:** cambio de contraseña de las cuatro cuentas de producción que
  conservaban la clave de la semilla (punto 0.2 del plan de cierre de
  brechas), 2026-11-20.
- **Pantalla:** «Mi perfil» (`/profile`) y el menú de usuario de la barra
  lateral.
- **Hoy:** la pantalla `/change-password` admite el cambio voluntario, pero
  ninguna pantalla enlaza a ella. Solo se llega escribiendo la dirección o
  cuando la cuenta está obligada a cambiar la contraseña. El usuario buscó la
  opción en el perfil y en una ruta de ajustes inexistente (404).
- **Esperado:** «Mi perfil» ofrece «Cambiar contraseña», que lleva a
  `/change-password`; opcionalmente, la misma entrada en el menú de usuario.
- **Requisitos:** RNF-01 (la matriz de acceso ya cubre `/change-password`);
  spec `auth-entry-access`.

### UX-21. Ingresar con el CIF o el correo institucional, no con «Usuario»

- **Estado:** abierta.
- **Origen:** observación del dueño del proyecto, 2026-11-20.
- **Pantalla:** inicio de sesión (`/login`); también el alta e importación
  de cuentas del administrador (`/users`) y «Mi perfil».
- **Hoy:** se ingresa con un «Usuario» propio del sistema (columna `Login`)
  y la contraseña. Ninguna plataforma de la UAM identifica así a las
  personas: el campo obliga a recordar un identificador que solo existe en
  este sistema.
- **Esperado:** el campo de ingreso acepta el CIF (estudiantes) o el correo
  institucional (todos los roles), junto con la contraseña. El «Usuario»
  deja de mostrarse y de pedirse en el alta, la importación y el perfil. El
  personal no tiene CIF, así que ingresa con el correo institucional.
- **Requisitos:** RN-02 (el CIF y el correo provienen de la cuenta), RNF-01;
  specs `auth-entry-access`, `user-roles` y `users-listing`. Afecta el Anexo E de la tesis, que hoy
  indica ingresar con «Usuario» y «Contraseña».

### UX-22. Mantener la sesión iniciada

- **Estado:** abierta.
- **Origen:** observación del dueño del proyecto, 2026-11-20, al definir
  UX-21.
- **Pantalla:** inicio de sesión (`/login`).
- **Hoy:** la sesión dura 8 horas (`src/lib/auth/session.ts`) y no hay forma
  de pedir que se mantenga. Quien entra cada día vuelve a escribir su
  identificador y su contraseña.
- **Esperado:** una casilla «Mantener la sesión iniciada» en el inicio de
  sesión. Marcada, la sesión dura más (por ejemplo, 30 días) en ese
  dispositivo; sin marcar, se mantiene el comportamiento actual. Cerrar sesión
  la termina igual en ambos casos.
- **Requisitos:** RNF-01 (no cambia qué puede hacer cada rol); spec
  `auth-entry-access`.

### UX-23. Tarjetas de solicitud que se distingan entre sí

- **Estado:** implementada en `flow-experience`, pendiente de despliegue.
- **Origen:** validación con usuarios, Tabla 19 de la tesis (5.8), fila 1: «Dos
  consultaron otra solicitud» (estudiante, severidad mayor).
- **Pantalla:** lista de solicitudes del estudiante (`/requests`).
- **Hoy:** cada tarjeta muestra el número, el estado, la causa, el periodo de
  ausencia y la fecha de presentación, pero no las asignaturas ni el motivo de
  una solicitud devuelta o rechazada. El diagnóstico de la validación
  (2026-11-20) no halló un defecto en la lista: la causa fue sobre todo el kit,
  porque la consigna suponía una solicitud previa y la base tenía dos, y el
  formulario pedía un «motivo», palabra que solo imprime la solicitud devuelta.
  La solicitud buscada quedaba al final de la lista y, para un mismo
  estudiante, la causa no ayudaba a distinguirlas.
- **Esperado:** cada tarjeta rotula «Fechas de ausencia» con el mes escrito en
  letras, muestra los códigos de asignatura y, si está devuelta o rechazada, el
  motivo: la etiqueta del motivo, o un extracto de la decisión de hasta 140
  caracteres que empieza en el motivo. Una solicitud aprobada no muestra motivo. El orden de la lista no
  cambia.
- **Requisitos:** RF-07 (c), RF-08 (b); RN-16, RN-17; spec `student-requests`
  (FE-14, FE-15).

### UX-24. Vista previa del archivo y nombres de los archivos al reenviar

- **Estado:** implementada en `flow-experience`, pendiente de despliegue.
- **Origen:** validación con usuarios, Tabla 19 de la tesis (5.8), fila 2: «Uno
  reenvió un archivo ajeno a las constancias simuladas» (estudiante, severidad
  mayor).
- **Pantalla:** documentos de la nueva solicitud y de la corrección
  (`/requests/new`, `/requests/[id]/correct`), revisión y diálogo de reenvío.
- **Hoy:** el paso de documentos no deja ver el contenido de un archivo recién
  elegido antes de confirmar; «Ver» abre el documento ya guardado por la ruta
  del documento y deja registro de descarga. El diálogo de reenvío no lista los
  archivos que llevará la solicitud. En la validación, el archivo reenviado no
  era una de las constancias simuladas.
- **Esperado:** «Vista previa» en el navegador de los archivos elegidos en esa
  visita (imagen o PDF, con nombre y tamaño), sin pedir el documento al servidor
  ni dejar registro de auditoría. En la corrección, el paso de documentos, la
  revisión y el diálogo de reenvío listan cada archivo por nombre con la marca
  «Nuevo» o «Anterior». Los archivos ya guardados conservan «Ver».
- **Requisitos:** RF-08 (a, b, c), RF-02; RN-03, RN-04; RNF-06, RNF-11, RNF-12;
  specs `supporting-documents` (FE-17) y `student-requests` (FE-16).

### UX-25. Resumen de las fechas y aviso de inicio posterior a hoy

- **Estado:** implementada en `flow-experience`, pendiente de despliegue.
- **Origen:** validación con usuarios, Tabla 19 de la tesis (5.8), fila 3: «Uno
  registró fechas y asignaturas ajenas» (estudiante, severidad mayor).
- **Pantalla:** nueva solicitud y corrección (`/requests/new`), pasos 1 a 3.
- **Hoy:** el sistema acepta una ausencia que empieza después de hoy (RN-05 y
  RN-23 solo acotan el orden y la ventana de 30 días) y los pasos 2 y 3 no
  repiten las fechas elegidas. El diagnóstico de la validación (2026-11-20)
  atribuyó el caso al participante y al protocolo, no a la interfaz ni a la
  configuración regional: el participante escribió otras fechas (del día de la
  sesión a dos días después), el paso de asignaturas ofreció las que coincidían
  con esas fechas y toda la solicitud tomó 48 segundos.
- **Esperado:** los pasos 2 y 3 muestran un resumen «Fechas de ausencia» con el
  día de la semana y el mes en letras, y un enlace «Editar fechas» que vuelve
  al paso 1 sin perder datos. Si el inicio es posterior a hoy, un aviso
  informativo en el paso 1 y en el resumen pide revisar las fechas, sin
  bloquear el avance ni el envío.
- **Requisitos:** RF-01 (a, b, c), RF-03 (a, b), RF-04 (a); RN-05, RN-22, RN-23;
  RNF-11; spec `justification-intake` (FE-18, FE-19).

### UX-26. Indicar el orden de la bandeja y marcar «Vence primero»

- **Estado:** implementada en `flow-experience`, pendiente de despliegue.
- **Origen:** validación con usuarios, Tabla 19 de la tesis (5.8), fila 4: «No
  nombró la solicitud prioritaria (T-S1)» (secretaría, severidad crítica).
- **Pantalla:** bandeja de la secretaría, pestaña «Pendientes» (`/review`).
- **Hoy:** la descripción de la pestaña habla de orden «de la más antigua a la
  más reciente», pero la bandeja ordena por el plazo efectivo de remisión al
  docente, y ninguna fila marca cuál vence primero. El diagnóstico de la
  validación (2026-11-20) halló que la bandeja aplicó su regla: la primera fila
  era una solicitud ajena a las cinco de la tarea, con el mismo plazo que la
  respuesta esperada. La causa fue el diseño de la tarea, no el orden.
- **Esperado:** la descripción dice que las solicitudes se ordenan por el plazo
  de su remisión al docente, de la que vence antes a la que vence después, y la
  primera solicitud de la bandeja lleva la marca de texto «Vence primero» en la
  tabla y en las tarjetas de 360 px. El orden no cambia.
- **Requisitos:** RF-06 (a, b); RN-08; RNF-10, RNF-12; spec `request-review`
  (FE-1, FE-2).

### UX-27. La respuesta de la coordinación, al inicio del detalle

- **Estado:** implementada en `flow-experience`, pendiente de despliegue.
- **Origen:** validación con usuarios, Tabla 19 de la tesis (5.8), fila 5:
  «Volvió a escalar lo ya contestado (T-S11)» (secretaría, severidad crítica).
- **Pantalla:** detalle de la solicitud para la secretaría (`/review/[id]`) y
  su diálogo de escalamiento.
- **Hoy:** cuando la coordinación responde, la solicitud vuelve a «pendiente»
  y la respuesta solo consta en la sección de escalamientos, más abajo en el
  detalle. La secretaría puede escalar de nuevo sin haberla visto. En la
  validación, la secretaria dijo haber leído la respuesta, calificó con 1
  haberla visto y volvió a escalar con la misma pregunta (5.6).
- **Esperado:** un aviso «Respuesta de coordinación» sobre todas las secciones,
  con la respuesta completa, su autor y la fecha. El panel de decisión dice que
  la coordinación ya respondió, el diálogo de escalamiento muestra la respuesta
  anterior como aviso informativo y el historial enlaza a los escalamientos.
  Volver a escalar sigue permitido (decisión del dueño, 2026-11-20).
- **Requisitos:** RF-16 (c), RF-10 (a); RN-16, RN-20, RN-08; RNF-10; specs
  `request-review` (FE-3, FE-4, FE-5) y `coordination-escalation` (FE-12).

### UX-28. Nota obligatoria, errores que se borran y motivo «Otro»

- **Estado:** implementada en `flow-experience`, pendiente de despliegue.
- **Origen:** validación con usuarios, Tabla 19 de la tesis (5.8), fila 6: «Dos
  ayudas en T-S3: buscar una solicitud y escribir la nota» (secretaría,
  severidad mayor).
- **Pantalla:** diálogo «Escalar» del detalle de la solicitud (`/review/[id]`).
- **Hoy:** el diálogo no rotula la nota como obligatoria, deja visible el error
  del motivo o de la nota después de corregirlo y ofrece solo dos motivos. La
  otra ayuda, buscar una solicitud, no forma parte del alcance de
  `flow-experience`.
- **Esperado:** la nota se rotula «Nota para coordinación (obligatoria)» con un
  ejemplo y la aclaración de que solo la ve el personal. El error del motivo
  desaparece al elegirlo y el de la nota al editarla. Un tercer motivo, «Otro»,
  se comporta como los demás (misma pausa de plazo, mismo aviso a la
  coordinación) y su nota describe la razón; el estudiante no lo ve. Requiere la
  migración `0016` en producción.
- **Requisitos:** RF-10 (a, b); RN-20; RNF-10, RNF-12; spec
  `coordination-escalation` (FE-9, FE-10, FE-11).

### UX-29. Limitar los intentos de ingreso

- **Estado:** abierta.
- **Origen:** decisión D13 del diseño de `flow-experience`, 2026-11-20.
- **Pantalla:** inicio de sesión (`/login`).
- **Hoy:** nada limita los intentos de ingreso: no hay limitador ni capa que
  intercepte las peticiones. Lo único que se hizo en `flow-experience` es igualar
  el tiempo de respuesta: un identificador desconocido también ejecuta la
  comprobación de contraseña contra un hash fijo y recibe el mismo error
  genérico.
- **Esperado:** un límite de intentos fallidos por identificador o por origen,
  con una espera o un bloqueo temporal. Es infraestructura nueva y requiere una
  decisión del dueño sobre el mecanismo y el almacenamiento del contador.
- **Requisitos:** RNF-01; spec `auth-entry-access`.

### UX-30. Revocar en el servidor las sesiones de 30 días

- **Estado:** abierta.
- **Origen:** diseño de `flow-experience` (FE-32, «Mantener la sesión
  iniciada»), 2026-11-20.
- **Pantalla:** inicio de sesión (`/login`) y cierre de sesión.
- **Hoy:** la sesión es un token firmado y no existe una tabla de sesiones. Un
  token emitido no se puede revocar antes de que expire: desactivar una cuenta
  impide el siguiente ingreso, pero no el token ya emitido. Con «Mantener la
  sesión iniciada» el plazo es de 30 días en lugar de 8 horas.
- **Esperado:** poder invalidar en el servidor las sesiones emitidas (por
  ejemplo, con una tabla de sesiones o una versión de sesión por cuenta), para
  que desactivar una cuenta surta efecto antes de que el token expire.
- **Requisitos:** RNF-01; spec `auth-entry-access`.

### UX-31. Buscar un estudiante por CIF escrito con guion o espacio

- **Estado:** abierta.
- **Origen:** revisión de la normalización del CIF (S9d) en `flow-experience`,
  2026-11-24.
- **Pantalla:** lista de inscripciones (`/catalog/inscripciones`) y búsqueda de
  estudiante de la pantalla de asignación (`/catalog/inscripciones/assign`).
- **Hoy:** el CIF se guarda sin espacios ni guiones (`normalizeCif`, FE-26),
  pero la búsqueda compara el término tal como se escribió: usa `ilike` con
  `%término%` sobre el CIF y sobre el nombre (`src/lib/data/inscripciones.ts`).
  Buscar «2201-0116» o «2201 0116» no encuentra al estudiante con el CIF
  «22010116».
- **Esperado:** la búsqueda también compara el CIF con el término limpio como
  lo limpia el ingreso, y conserva la coincidencia del nombre con el término tal
  como se escribió.
- **Requisitos:** RF-12 (a); RN-02; spec `enrollment-administration` (EA-LIST-1,
  EA-CRE-1); FE-21 y FE-26 de `flow-experience`.
