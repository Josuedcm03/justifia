# Próximo change: `rest-signals-cause-scope`

Anotado el 10 de noviembre de 2026, sobre `245ad57`, para arrancar el flujo SDD el miércoles 11 temprano. Tiene que quedar mergeado en `main` **antes del tag del jueves 12**, porque esa es la versión congelada para la sesión con la secretaría (viernes 13).

## 1. Problema

El viernes la secretaría va a ver señales falsas de «fechas incoherentes» (RN-09) en solicitudes que no son médicas.

La extracción (NuExtract3, `src/lib/extraction/`) siempre pide los mismos seis campos: `student_name`, `issuer`, `issue_date`, `rest_from`, `rest_to` y `rest_days`. En las cartas laborales, las cartas de deportes, las cartas institucionales y el formato de la FIA no existe un período de reposo, pero el modelo **lo inventa** copiando las fechas de la inasistencia.

Con eso, RN-09 («un período de reposo que termina antes de la fecha de emisión del documento») se dispara cada vez que la carta se emitió después de la inasistencia, que es lo normal. RN-10 queda expuesta al mismo error con otras fechas.

### Evidencia

Viene de la prueba con letra simulada del 10 de noviembre: 25 imágenes contra NuExtract3 en Modal. El resultado está en `C:\thesis-workspace\build\salida\documentos_sesion\fotos_simuladas\extraction-check.json`.

| Escenario | Documento | Causa declarada | Qué pasó |
|---|---|---|---|
| SC-06 | Carta laboral, emitida el 4 nov. | fuerza_mayor | Reposo inventado del 2 al 3 nov. → RN-09 falsa |
| SC-11 b | Formato FIA, llenado el 11 nov. | fuerza_mayor | Reposo inventado del 9 al 10 nov. → RN-09 falsa |
| SC-13 | Carta de fundación, emitida el 5 nov. | intercambio_academico | Reposo inventado del 3 al 4 nov. → RN-09 falsa |
| P5 (T-S1) | Formato FIA, llenado el 10 nov. | fuerza_mayor | Reposo inventado el 9 nov. → RN-09 falsa |
| SC-10, SC-11 a, P3 | Carta de deportes UAM y formato | actividad_representativa, fuerza_mayor | Reposo inventado; esta vez sin señal falsa por las fechas |

Totales de esa corrida: 88 campos correctos, 7 incorrectos, **16 inventados** y 10 faltantes. Casi todos los inventados son de reposo en documentos no médicos.

No es un artefacto de la prueba: en producción pasaría lo mismo con cualquier carta laboral.

## 2. Qué cambia

RN-09 y RN-10 se evalúan **solo cuando la causa declarada de la solicitud admite un período de reposo**: `medica` y `maternidad_paternidad`. Con las demás causas (`actividad_representativa`, `intercambio_academico`, `fuerza_mayor`) esas dos señales **no aplican**, y no cuentan para el veredicto sugerido.

**Por qué se puede justificar con los requisitos:** RN-09 y RN-10 hablan de «período de reposo» y de «período acreditado». RF-05 (b) replica el caso de E-02: una constancia médica que concede reposo. El reposo solo existe en documentos de salud.

**Por qué la causa declarada y no el tipo de documento:** el tipo registrado depende de RF-14 (d), que no está construido. La causa es el único dato confiable hoy. Una solicitud médica con un documento que no corresponde ya tiene su propia regla, RN-13 (SC-05).

## 3. Mensajes para arrancar (plantilla de `docs/sdd-new-template.md`)

Antes de empezar:

```text
git switch main
git pull
git switch -c fix/rest-signals-cause-scope
```

Mensaje 1:

```text
Contexto para el change rest-signals-cause-scope; todavía no hagas nada.

- Roadmap: fila #15 de docs/roadmap.md (nueva; agregarla en este change).
- Cubre: RF-05 (a), (b); RN-09, RN-10, RN-15 (docs/requirements.md).
- Fuera de alcance: RN-13 y RF-14 (registro manual y tipo de documento),
  normative-parameters (#8, la tabla causa→tipo configurable de RNF-14),
  cambios al prompt o a la plantilla de extracción de NuExtract3.
- Depende de: nada; validation-signals (#5) y document-extraction (#4) están archivados.
- Decisiones abiertas: ver docs/next-change-rest-signals-cause-scope.md §5.
- Urgencia: debe quedar en main antes del tag del jueves 12 de noviembre
  (sesión con la secretaría el viernes 13). Sin migración.
```

Mensaje 2:

```text
/gentle-sdd-new rest-signals-cause-scope
```

## 4. Dónde está el código (verificado sobre `245ad57`)

| Archivo | Qué hay |
|---|---|
| `src/lib/data/signals.ts` | `readRequestBase` (~línea 66) lee `presentadaEn`, `fechaInicio`, `fechaFin` y `estudianteId`, pero **no `causa`**: hay que agregarla. `loadSignals` (~línea 248) arma el `SignalInput` y llama a `evaluateSignals` |
| `src/lib/signals/types.ts` | `SignalInput`, `SignalResult` (outcomes `present` / `absent` / `not_evaluable`), `REASON_PRECEDENCE`, `ALLOWED_REASONS` por señal |
| `src/lib/signals/evaluate.ts` | Llama a `evaluateIncoherentDates(input.documents)` y a `evaluateUncoveredDates(...)`. Es el lugar natural para el corte por causa |
| `src/lib/signals/rest-dates.ts` | Los evaluadores puros de RN-09 y RN-10 |
| `src/lib/signals/verdict.ts` | `suggestVerdict`: `review_carefully` si alguna está `present`; `no_alerts` solo si **todas** están `absent`; si no, `inconclusive`. **Ojo:** si «no aplica» se modela como `not_evaluable`, todas las solicitudes no médicas quedan `inconclusive` y se pierde «sin alertas» |
| `src/lib/intake/causes.ts` | `CAUSAS` (las cinco causas de RN-01) |
| `src/app/(dashboard)/review/[id]/signals-section.tsx` | Muestra cada señal con `outcomes.<outcome>` y la evidencia; mapa de tonos del veredicto |
| `src/app/(dashboard)/coordination/[id]/page.tsx` | Segundo consumidor de `loadSignals`, con `audience="coordination"` |
| `src/i18n/` (mensajes `review.signals.*`) | Textos de outcomes y razones; hay un test de mensajes i18n |
| Tests | `src/lib/signals/evaluate.test.ts`, `src/lib/data/signals.test.ts`, `src/lib/data/integration/validation-signals.integration.test.ts`, `signals-section.test.tsx` |

## 5. Decisiones abiertas (para la propuesta)

1. **Cómo se modela «no aplica».** Recomendación: un cuarto outcome, `not_applicable`, sin razón, que `suggestVerdict` ignora. «Sin alertas» pasaría a significar «todas las aplicables están `absent`», y si no queda ninguna aplicable, el veredicto sigue el criterio de las demás. La alternativa es filtrar las dos señales fuera de `results`, pero entonces la pantalla deja de mostrarlas y la secretaría no sabe por qué faltan. Hay que definirlo en el spec delta de `validation-signals`.
2. **Qué causas admiten reposo.** Recomendación: `medica` y `maternidad_paternidad`. Queda como constante en código, junto a `CAUSAS` (como D4 de intake), no como configuración: la tabla configurable es RNF-14, del change #8.
3. **Qué ve la secretaría en la sección de extracción.** La extracción igual guarda el reposo inventado y la pantalla lo muestra. Hay dos caminos: mostrarlo con una nota «no aplica a esta causa», o dejarlo como está y mostrar solo la señal como «no aplica». Recomendación: el texto de la señal alcanza para el viernes. La nota en extracción va al backlog de `flow-experience` si no entra.
4. **Texto en la pantalla.** Por ejemplo: «No aplica: la causa declarada no incluye reposo». Va en español en i18n, con el mismo tono que los demás outcomes.

## 6. Criterios de aceptación

- Una solicitud `fuerza_mayor`, `actividad_representativa` o `intercambio_academico` cuya extracción trae `rest_to` anterior a `issue_date` **no** muestra «fechas incoherentes». RN-09 y RN-10 aparecen como «no aplica».
- La misma solicitud, sin otras señales presentes, tiene veredicto «sin alertas», no «inconclusive».
- Una solicitud `medica` con el caso de E-02 sigue mostrando «fechas incoherentes». RF-05 (b) no cambia, SC-02 sigue disparando.
- Una solicitud `maternidad_paternidad` con reposo sigue evaluando RN-09 y RN-10.
- RN-07, RN-14 y RN-26 no cambian para ninguna causa.
- La vista de coordinación muestra el mismo outcome, sin evidencia.
- Tests unitarios del corte por causa y del veredicto, más un caso de integración en `validation-signals.integration.test.ts`. Las suites existentes quedan verdes.

## 7. Requisitos y documentos

- `docs/requirements.md`:
  - RN-09 y RN-10 agregan que se evalúan en solicitudes de causa médica o de maternidad, y que con otra causa no aplican;
  - RN-15 o RF-05 (a) aclaran el «no aplica» si el veredicto cambia de definición;
  - una fila nueva en el historial de cambios con la fecha y el motivo (esta prueba).
- `docs/roadmap.md`: fila #15 `rest-signals-cause-scope`, responsable Armando, que cubre RF-05 (a), (b); RN-09, RN-10, RN-15. Se archiva al cerrar.
- `openspec/specs/validation-signals/`: spec delta con el outcome nuevo y el corte por causa.
- Tesis (se hace en `thesis-workspace`, no en este change): revisar si 4.x describe RN-09 y RN-10 sin el corte, y si A.5 lo necesita. Los veredictos esperados de los escenarios médicos no cambian.

## 8. Merge gate

- **Sin migración.** Es lógica pura más lectura de `causa`, que ya existe en `Solicitud`. Producción no necesita nada antes del merge.
- Tests, `tsc` y lint verdes; integración opt-in contra una rama descartable de Neon. Crear y borrar esa rama requiere el sí del usuario, comando por comando.
- Mergear a `main` el **miércoles 11 o temprano el jueves 12**, antes del tag. `main` se despliega solo a producción, y desde el tag queda congelado hasta que termine la sesión.
- No borrar la rama del change después del merge (memoria `keep-change-branches`).

## 9. Después del merge (antes del tag)

1. Volver a correr la prueba de extracción con las fotos reales: `npx tsx scripts/session-extraction-check.local.ts`.
2. Ensayo general en `ensayo-secretaria` (jueves 12, desde las 07:00): seed `--rehearsal`, cron de extracción, `--resolve-history` y `scripts/session-verify.local.ts`.
3. Actualizar en `session-verify.local.ts` las expectativas de RN-09 y RN-10 para SC-06, SC-10, SC-11 a/b, SC-13, P2, P3 y P5: «no aplica».

## 10. Otros hallazgos de la misma prueba (fuera de este change)

- **SC-04 (RN-14):** en 04a el modelo devolvió como emisor el nombre del dentista y no el de la clínica. Si los tres no coinciden después de normalizar, la reincidencia no se dispara. Hay que confirmarlo con las fotos reales. Si falla, se ajusta el documento (que el membrete destaque un solo nombre) y no el código, porque el viernes no hay margen.
- **SC-12:** el reposo salió como «1 día» sin fechas (`days_only`), así que RN-10 queda `not_evaluable`, no «no reconocidos» como describe A.5. Ajustar la expectativa en A.5 o en la hoja de verificación.
- **«Reposo por 1 día» o «24 hrs»:** el modelo termina el reposo un día tarde en SC-01, SC-03, SC-07, SC-14 y P4. Igual cubre la inasistencia y no cambia ninguna señal. Se informa con I-3.
- **SC-03 (RN-26):** «documento repetido» aparece solo en la segunda solicitud, la de la cuenta 03b. Así está diseñado; la hoja de verificación ya lo espera así.
