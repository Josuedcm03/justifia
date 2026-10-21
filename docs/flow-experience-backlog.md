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
