# Pendientes del software para la validación de la tesis

Anotado el 2026-10-28 desde el repositorio de la tesis. Resume lo que la
validación del Capítulo V necesita del sistema, lo que ya existe y lo que falta.
Retomarlo antes de planificar el próximo change.

## Contexto

El 2026-10-28 se decidió que la validación (OE-4) deja de ser un piloto real y
pasa a ser una **prueba de usabilidad sobre escenarios controlados que replican
casos reales**: la secretaría académica y estudiantes de la FIA ejecutan tareas
sobre solicitudes sembradas por el equipo, con constancias anonimizadas
(consentidas) y expedientes reconstruidos con datos alterados. La secretaría
sabe que los datos son simulados.

Fecha de aplicación: **semana 13 (9 al 15 de noviembre)**, decidida el
2026-10-28. El protocolo pide unos 14 días de preparación (consentimientos,
anonimización, siembra, versión congelada y ensayo). El martes 3 de noviembre
se entrega el instrumento y el avance del Capítulo V con 5.1 a 5.3: lo
construido, la matriz de pruebas con desenlaces reales y los RNF medibles.
**Para esa fecha hace falta ejecutar los casos de la Tabla 13 de la tesis
(4.9) sobre el sistema y registrar versión, fecha, ejecutor y desenlace.**

## Qué se mide y de dónde sale

| Medida | Fuente | Estado en el código |
| --- | --- | --- |
| Tiempo por tarea de la secretaría | `EventoAuditoria`: `solicitud.consultada` → `solicitud.aprobada`/`rechazada`/`devuelta`/`escalada` (`OcurridoEn`) | Existe. Verificar que `solicitud.consultada` se registre cada vez que se abre el detalle |
| Tiempo por tarea del estudiante | `Solicitud.CreadoEn` → `PresentadaEn`; `ReenviadaEn` en la corrección | Existe |
| Acciones manuales por solicitud (I-2) | Observación contra la lista de doce acciones del Anexo A | No requiere código |
| Exactitud de extracción por campo (I-3) | `ExtraccionDocumento` contra un etiquetado a mano hecho fuera del sistema | En `feat/document-extraction`, sin servidor. Guarda solo el valor del modelo, no el corregido; alcanza si el etiquetado se hace aparte |
| Docentes correctos en la remisión (I-4) | `Remision` contra el horario sembrado | Existe |
| Concordancia veredicto sugerido / esperado / LC-01 | Señales y veredicto por solicitud | Existe en las ramas de `validation-signals` (S1 a S3), aún sin integrar a `main`. El veredicto se calcula en cada lectura y no se guarda: se registra a mano al ejecutar cada caso (ver el punto 1) |
| SUS y facilidad por tarea | Cuestionario U-02, fuera del sistema | No requiere código |

## Pendientes, por prioridad

1. **`validation-signals` (RF-05, RF-14; RN-07, RN-09 a RN-14, RN-24) no existe
   en ninguna rama.** Figura en el roadmap como «si alcanza el tiempo», pero es el
   diferenciador de la tesis: el veredicto sugerido con sus señales (coherencia
   interna, cruce con el registro e histórico, incluida la huella del archivo).
   Sin él no se pueden validar los escenarios de fechas incoherentes, documento
   reaparecido, emisor con volumen anómalo o tipo discordante, y la concordancia
   queda «no evaluable». Decidir con el equipo qué subconjunto mínimo entra antes
   de la prueba.
   **Decisión del 2026-10-28:** entra una regla nueva, **RN-26: documento
   reaparecido** (la huella del archivo coincide con la de otra solicitud), que
   se especifica en la tesis y se construye dentro de `validation-signals`. El
   emisor con volumen anómalo entre estudiantes distintos queda **fuera del
   alcance**, como trabajo futuro.
   **Anotado el 2026-10-30:** la señal de procedencia IA en los metadatos de
   la imagen (NS-12) es candidata y **no** entra antes de la prueba; depende de
   un spike en dispositivos (`docs/investigacion/procedencia-ia-metadatos.md`).
   **Estado al 2026-11-02 (ramas `feat/validation-signals-s1-signals`,
   `-s2-fingerprint` y `-s3-coordination`, sin integrar a `main`):**
   - *Entregado.* El veredicto sugerido («Revisar con cuidado», «Sin alertas»,
     «No concluyente») y cinco señales: presentación tardía (RN-07), fechas
     incoherentes (RN-09), fechas no cubiertas (RN-10), reincidencia (RN-14) y
     documento repetido (RN-26, el nombre que usa la interfaz para el
     «documento reaparecido»). La secretaría ve el detalle completo; la
     coordinación ve solo los resultados, los motivos de «no evaluable» y el
     veredicto, y nunca el número de otra solicitud; el estudiante no ve nada.
     Las señales se calculan en cada lectura, no se guardan y no cambian la
     solicitud (RN-15).
   - *Límites conocidos.* (1) El umbral de RN-14 (tres) es una constante de
     código hasta `normative-parameters`: RNF-14 no se cumple. (2) RN-26 solo
     detecta el archivo idéntico byte a byte; un documento vuelto a guardar,
     recortado o fotografiado de nuevo no coincide. (3) RN-09, RN-10 y RN-14
     necesitan la extracción `completada`; los documentos anteriores a la
     migración `0013` no tienen huella y RN-26 queda «no evaluable». (4) No se
     entregan RF-05 (e), RN-11, RN-12, RN-13 ni RN-24 con RF-14 (la carga
     manual de datos del documento): sin ella, un documento con extracción
     `fallida` deja las señales que dependen de ella en «no evaluable».
   - *Pendiente de privacidad.* La huella SHA-256 y la comparación entre
     solicitudes esperan la revisión jurídica de la UAM. La migración
     `0013_validation_signals` está generada y no se aplica en producción hasta
     que sea positiva; las pruebas usan solo datos ficticios.
   - *Datos para las pruebas del 2026-11-03.* Sin extracción, el veredicto es
     «No concluyente» y RN-09, RN-10 y RN-14 aparecen «no evaluables»
     (extracción pendiente); solo RN-07 y RN-26 funcionan sin ella. Para ver las
     cinco señales hace falta el servidor local del modelo en
     `127.0.0.1:8080` (`docs/setup-local.md`) y el documento extraído antes de
     abrir `/review/[id]`. Decisión del propietario del 2026-11-02: las pruebas
     corren desde la rama S3, en `dev-arnia`, con la migración `0013` aplicada
     allí después de la prueba de humo de la fase 10 de su `tasks.md`.
   - *Candidata.* NS-12 sigue fuera de esta entrega.
2. **Servidor del modelo (NuExtract3).** Sin él, I-3 queda «no evaluable» y los
   escenarios pasan por captura manual (RF-14, que tampoco está construido).
   Fijar fecha límite para tener el servidor.
3. **Instancia de estudiantes (apertura el 31 de octubre).** Usa una rama de
   Neon propia, sembrada solo con datos ficticios, y **`EXTRACTION_API_URL`
   vacía**: la extracción se dispara al enviar y al corregir
   (`requests/new/actions.ts`, `requests/[id]/correct/actions.ts`) y en el
   barrido diario, así que si esa variable tiene valor, los documentos pasan
   por el proveedor del modelo, y el consentimiento de los estudiantes dice que
   no. Verificar también que los archivos de esa instancia no los borre la
   tarea diaria de huérfanos de otra base.
4. **Ambiente de la prueba.** Una instancia desplegada con su propia rama de
   Neon, sembrada solo con los escenarios. Nunca la base de producción con datos
   reales mezclados.
4. **Script de siembra de escenarios** reproducible (estudiantes ficticios,
   grupos, horarios, docentes y solicitudes), para poder restaurar el estado
   entre una sesión y otra.
5. **Versión visible** (commit o etiqueta) en la interfaz: el cuestionario U-02
   pide registrar la versión del sistema en cada sesión.
6. **Exportación de métricas**: una consulta de solo lectura que saque, por
   solicitud, las marcas de tiempo, la decisión, las remisiones y la extracción
   en CSV, para tabular el Capítulo V sin copiar a mano.

## Desfases con la tesis que hay que resolver

- `docs/roadmap.md` marca `escalation` como pendiente, pero está integrado en
  `main` (PR #54 a #64).
- RF-16 es la respuesta de la coordinación en ambos lados desde el 2026-11-09.
  La inscripción declarada por el estudiante pasó a RF-17 en el repositorio y
  falta agregarla a la matriz de la tesis y a 4.2.
- La tesis describe Tesseract.js como motor de OCR; se reemplaza por NuExtract3
  en un servidor alquilado. Se actualiza en la tesis (4.6, 4.7, 1.6, 3.8, RNF-03).

## Hallazgos del ensayo con estudiantes (2026-10-31)

No cambiar la versión congelada durante la ventana de estudiantes. Evaluar para la sesión de la secretaría (semana 13):

- **Rango de fechas.** La fecha de fin debería tomar por defecto la de inicio (falta de un solo día). La participante propuso marcar los días faltados y que el sistema deduzca inicio y fin.
- **Numeración de solicitudes.** «Solicitud 22, 23, 24» expone el ID interno y confunde al estudiante: mostrar la fecha de la falta (o un número propio del estudiante).
- **Tema por defecto.** Claro por defecto, como los demás sistemas de la UAM; el oscuro queda en el botón de tema.
