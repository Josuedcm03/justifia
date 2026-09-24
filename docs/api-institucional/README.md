# Contrato propuesto — API institucional de datos académicos

> **Estado:** borrador base para negociar con la institución (UAM). Es una
> **simulación**: hoy la UAM no expone ninguna API ni vista
> (`modelo_datos_sql.md`, encabezado y §4 nota 3). Este documento propone la
> forma en que el sistema necesita recibir los datos, para que la solicitud a
> la institución parta de algo concreto y se ajuste sobre ello.
>
> **Derivado de:** `src/db/schema.ts`, `src/lib/import/schemas.ts`,
> `src/lib/import/sheets.ts` y `modelo_datos_sql.md` (rama
> `claude/excel-upload-module-kuyaot`, commit `c7183e5`). Si el modelo cambia,
> este contrato debe revisarse.
>
> Los ejemplos de respuesta están en [`ejemplos/`](./ejemplos). Todos los
> nombres, correos, CIF y códigos son **ficticios** (dominio `ejemplo.edu.ni`).

---

## 1. Qué datos vienen de la institución y cuáles no

El modelo tiene dos tipos de entidades. Solo las **de referencia académica**
deberían venir de la institución. Las demás las genera el propio sistema.

| Entidad (tabla) | Origen | ¿Entra en la API? | Hoy se carga por |
|---|---|---|---|
| `Facultad` | Institución | Sí | Seed único (fuera de la importación) |
| `Carrera` | Institución | Sí | Seed único (fuera de la importación) |
| `Asignatura` | Institución | Sí | Excel, hoja `Asignaturas` |
| `Usuario` con rol `docente` | Institución | Sí | Excel, hoja `Docentes` |
| `Grupo` | Institución | Sí, por periodo | Excel, hoja `Grupos` |
| `Usuario` con rol `estudiante` | Institución | Sí | **Nada todavía** (quedó fuera del alcance de la importación) |
| `Inscripcion` (matrícula) | Institución | Sí, por periodo | **Nada todavía** |
| Periodo académico | Institución | Sí (opcional) | Texto libre `AAAA-S1`/`AAAA-S2` dentro de `Grupo.Periodo` |
| `Rol` | Sistema | No | Seed del sistema |
| Cuentas de `coordinacion`, `secretaria`, `administrador` | Sistema | No | Alta manual en el sistema |
| `TipoCausa` | Sistema (reglamento) | No | Catálogo propio (Art. 34) |
| `Solicitud`, `SolicitudDetalle`, `Adjunto`, `SolicitudBitacora`, `Notificacion` | Sistema | No | Operación del sistema |
| `EventoAuditoria` | Sistema | No | Escrituras del sistema |
| Credenciales (`Login`, `HashClave`, `DebeCambiarClave`) | Sistema | **Nunca** | Las genera el sistema |

**Por qué importan estudiantes e inscripciones:** RF-03 (resolver
automáticamente el grupo y el docente de una solicitud) y RF-31 (verificar
que el estudiante estaba matriculado en ese grupo) necesitan la matrícula. Con
el Excel actual no se cargan, así que hoy esa verificación sigue siendo manual.
Una API es la oportunidad de cerrar ese hueco.

---

## 2. Principios del contrato

1. **Solo lectura.** Todos los endpoints son `GET`. El sistema nunca escribe
   en la institución.
2. **Claves naturales, nunca IDs internos.** El sistema no guarda los IDs de
   la institución ni la institución los nuestros. Cada referencia viaja por su
   clave natural, igual que en el Excel:

   | Entidad | Clave natural que usa el sistema |
   |---|---|
   | Facultad | `nombre` (se recomienda sumar `codigo`, ver B-1) |
   | Carrera | `nombre` (se recomienda sumar `codigo`, ver B-1) |
   | Asignatura | `codigo` |
   | Docente | `correo` (se recomienda sumar `codigo`, ver B-4) |
   | Estudiante | `cif` |
   | Grupo | (`asignatura.codigo`, `periodo`, `numeroGrupo`) |
   | Inscripción | (`estudiante.cif`, `grupo`) |

3. **Foto completa por periodo.** Para `grupos`, `estudiantes` e
   `inscripciones`, la respuesta de un periodo debe traer **todos** los
   registros vigentes de ese periodo. El sistema aplica la regla que ya usa con
   el Excel: *lo que falta se desactiva, nunca se borra*. Por eso una respuesta
   incompleta, o una página que no se leyó, desactivaría grupos por error. Cada
   respuesta declara `meta.snapshotCompleto: true` y el sistema no planifica
   nada hasta haber leído todas las páginas (ver B-10).
4. **Datos personales mínimos.** Solo se piden los campos que el sistema usa
   (RNF-05, Ley 787). No se piden cédula, dirección, fecha de nacimiento,
   notas, asistencia ni datos financieros.
5. **Formatos:** UTF-8; fechas `AAAA-MM-DD`; marcas de tiempo ISO 8601 con
   zona horaria (`-06:00`); cadenas sin espacios al inicio ni al final; los
   códigos se comparan **literalmente** (`"01"` ≠ `"1"`).
6. **Nombres de campo en `camelCase` y en español**, los mismos que usa el
   código (`codigo`, `nombreCompleto`, `horasTotales`, `numeroGrupo`). Así la
   traducción al modelo es directa.

---

## 3. Envoltorio común

Todas las respuestas comparten esta forma:

```json
{
  "meta": {
    "recurso": "grupos",
    "version": "1.0",
    "generadoEn": "2026-09-24T08:00:00-06:00",
    "periodo": "2026-S2",
    "snapshotCompleto": true,
    "total": 3,
    "pagina": 1,
    "porPagina": 500,
    "totalPaginas": 1
  },
  "data": [ ... ]
}
```

| Campo `meta` | Tipo | Obligatorio | Uso en el sistema |
|---|---|---|---|
| `recurso` | string | Sí | Verificar que se leyó el recurso correcto |
| `version` | string | Sí | Detectar cambios de contrato |
| `generadoEn` | datetime | Sí | Trazabilidad: se guarda con el resumen de la sincronización |
| `periodo` | string | En recursos por periodo | Debe coincidir con el parámetro pedido |
| `snapshotCompleto` | boolean | En recursos por periodo | Si es `false`, **no** se desactiva nada |
| `total`, `pagina`, `porPagina`, `totalPaginas` | integer | Sí | Recorrer todas las páginas antes de planificar |

**Errores:** código HTTP adecuado (400, 401, 403, 404, 429, 500) y este cuerpo:

```json
{
  "meta": { "recurso": "grupos", "version": "1.0", "generadoEn": "2026-09-24T08:00:00-06:00" },
  "error": {
    "codigo": "PERIODO_INVALIDO",
    "mensaje": "El periodo '2026-3' no existe o no tiene el formato esperado.",
    "detalle": { "parametro": "periodo", "valorRecibido": "2026-3" }
  }
}
```

**Paginación:** `?pagina=N&porPagina=M`. La API debería admitir `porPagina`
de al menos 500, la misma cifra que `WRITE_CHUNK_ROWS` en
`src/lib/import/limits.ts`.

---

## 4. Endpoints

Base sugerida: `https://<host-institucional>/api/academico/v1`

| # | Endpoint | Parámetros | Ejemplo | Prioridad |
|---|---|---|---|---|
| 1 | `GET /periodos` | — | [`periodos.json`](./ejemplos/periodos.json) | Media |
| 2 | `GET /facultades` | — | [`facultades.json`](./ejemplos/facultades.json) | Alta |
| 3 | `GET /carreras` | — | [`carreras.json`](./ejemplos/carreras.json) | Alta |
| 4 | `GET /asignaturas` | — | [`asignaturas.json`](./ejemplos/asignaturas.json) | Alta |
| 5 | `GET /docentes` | `periodo` (opcional) | [`docentes.json`](./ejemplos/docentes.json) | Alta |
| 6 | `GET /grupos` | `periodo` (obligatorio) | [`grupos.json`](./ejemplos/grupos.json) | Alta |
| 7 | `GET /estudiantes` | `periodo` (obligatorio) | [`estudiantes.json`](./ejemplos/estudiantes.json) | Alta para RF-03/RF-31 |
| 8 | `GET /inscripciones` | `periodo` (obligatorio), `cif` (opcional) | [`inscripciones.json`](./ejemplos/inscripciones.json) | Alta para RF-03/RF-31 |

Las reglas de validación de cada campo son las que el sistema **ya aplica**
hoy al Excel (`src/lib/import/schemas.ts`). Si la institución no puede
cumplir alguna, hay que decidir si se relaja la regla o si se transforma el
dato al recibirlo.

### 4.1 `GET /periodos`

```json
{ "codigo": "2026-S2", "nombre": "Segundo semestre 2026",
  "fechaInicio": "2026-07-27", "fechaFin": "2026-12-05", "vigente": true }
```

| Campo | Tipo | Oblig. | Regla | Destino en el modelo |
|---|---|---|---|---|
| `codigo` | string | Sí | `^\d{4}-S[12]$` (distingue mayúsculas) | `Grupo.Periodo`, `Solicitud.Periodo` |
| `nombre` | string | No | — | No se almacena |
| `fechaInicio`, `fechaFin` | date | Sí | `fechaFin >= fechaInicio` | **No se almacena hoy** (§4 nota 9: se promovería a tabla `PeriodoAcademico`) |
| `vigente` | boolean | Sí | Un solo periodo vigente | No se almacena; serviría para elegir el periodo por defecto |

Con las fechas se podría validar que la fecha de inasistencia cae dentro del
periodo. Ver B-3.

### 4.2 `GET /facultades`

| Campo | Tipo | Oblig. | Regla | Destino |
|---|---|---|---|---|
| `codigo` | string | Recomendado | Estable en el tiempo | **Sin columna hoy** (B-1) |
| `nombre` | string | Sí | ≤ 160, único | `Facultad.Nombre` |
| `siglas` | string \| null | No | ≤ 16 | `Facultad.Siglas` |
| `activo` | boolean | Sí | — | **Sin columna**: las facultades nunca se desactivan (spec *academic-catalog*) |

### 4.3 `GET /carreras`

| Campo | Tipo | Oblig. | Regla | Destino |
|---|---|---|---|---|
| `codigo` | string | Recomendado | Estable en el tiempo | **Sin columna hoy** (B-1) |
| `nombre` | string | Sí | ≤ 160, único | `Carrera.Nombre` |
| `facultad.codigo` / `facultad.nombre` | string | Sí | Debe existir en `/facultades` | `Carrera.FacultadId` (se resuelve por nombre) |
| `activo` | boolean | Sí | — | Sin columna (igual que facultad) |

### 4.4 `GET /asignaturas` (equivale a la hoja `Asignaturas`)

| Campo | Tipo | Oblig. | Regla (`schemas.ts`) | Destino | Columna Excel actual |
|---|---|---|---|---|---|
| `codigo` | string | Sí | 1–32, único | `Asignatura.Codigo` | `Codigo` |
| `nombre` | string | Sí | 1–160 | `Asignatura.Nombre` | `Nombre` |
| `carrera.codigo` / `carrera.nombre` | string | Sí | Debe existir; si no, error de fila `carrera.unresolved` | `Asignatura.CarreraId` | `Carrera` (por nombre) |
| `horasTotales` | integer | Sí | Entero > 0 (`CK_Asignatura_Horas`) | `Asignatura.HorasTotales` (base del 20 %) | `HorasTotales` |
| `activo` | boolean | Sí | — | Sin columna: las asignaturas nunca se desactivan | — |

Ver B-2 (asignatura compartida entre carreras) y B-7 (qué son las horas).

### 4.5 `GET /docentes` (equivale a la hoja `Docentes`)

| Campo | Tipo | Oblig. | Regla (`schemas.ts`) | Destino | Columna Excel actual |
|---|---|---|---|---|---|
| `codigo` | string | Recomendado | Estable, no cambia con el correo | **Sin columna hoy** (B-4) | — |
| `nombreCompleto` | string | Sí | 1–160 | `Usuario.NombreCompleto` | `Nombre` |
| `correo` | string | Sí | Email válido, ≤ 160 y **≤ 60** (se usa como `Login`) | `Usuario.Correo` y `Usuario.Login` | `Correo` |
| `telefono` | string \| null | No | ≤ 30 | `Usuario.Telefono` (aviso por WhatsApp) | `Telefono` |
| `activo` | boolean | Sí | — | Hoy una cuenta inactiva **no** se reactiva sola (supuesto abierto) | — |

El sistema crea la cuenta con `Rol = docente`, una clave temporal y
`DebeCambiarClave = true`. La API **nunca** envía credenciales.

### 4.6 `GET /grupos?periodo=2026-S2` (equivale a la hoja `Grupos`)

| Campo | Tipo | Oblig. | Regla (`schemas.ts`) | Destino | Columna Excel actual |
|---|---|---|---|---|---|
| `asignatura.codigo` | string | Sí | 1–32; debe existir | `Grupo.AsignaturaId` | `CodigoAsignatura` |
| `periodo` | string | Sí | `^\d{4}-S[12]$`, sin espacios | `Grupo.Periodo` | `Periodo` |
| `numeroGrupo` | string | Sí | 1–12, se compara literal (`"01"` ≠ `"1"`) | `Grupo.NumeroGrupo` | `NumGrupo` |
| `docente.correo` | string | Sí | Debe ser un docente existente o venir en `/docentes`; cualquier otro rol da error | `Grupo.DocenteId` | `CorreoDocente` |
| `docente.codigo` | string | Recomendado | — | Sin columna hoy (B-4) | — |
| `activo` | boolean | Sí | Si es `false` o el grupo falta, se desactiva (nunca se borra) | `Grupo.Activo` | — |

La clave natural (`asignatura.codigo`, `periodo`, `numeroGrupo`) no puede
repetirse en la respuesta (`UQ_Grupo_Seccion`). Ver B-5 y B-6.

### 4.7 `GET /estudiantes?periodo=2026-S2`

| Campo | Tipo | Oblig. | Regla | Destino |
|---|---|---|---|---|
| `cif` | string | Sí | ≤ 20, único | `Usuario.Cif` |
| `nombreCompleto` | string | Sí | 1–160 | `Usuario.NombreCompleto` |
| `correo` | string | Sí | Email válido, ≤ 160 | `Usuario.Correo` |
| `telefono` | string \| null | No | ≤ 30 | `Usuario.Telefono` |
| `carrera.codigo` / `carrera.nombre` | string | Sí | Debe existir en `/carreras` | `Usuario.CarreraId` |
| `activo` | boolean | Sí | — | `Usuario.Activo` |

> **Importante:** hoy la importación **no crea cuentas de estudiante**, por
> decisión del product owner. Consumir este endpoint requiere decidir cómo se
> provisionan esas cuentas (login por CIF o por correo, clave inicial). Es
> trabajo nuevo que no está en el spec actual. Ver B-9.

### 4.8 `GET /inscripciones?periodo=2026-S2[&cif=...]`

| Campo | Tipo | Oblig. | Regla | Destino |
|---|---|---|---|---|
| `estudiante.cif` | string | Sí | Debe existir en `/estudiantes` | `Inscripcion.EstudianteId` |
| `grupo.asignaturaCodigo` | string | Sí | Junto con `periodo` y `numeroGrupo` debe existir en `/grupos` | `Inscripcion.GrupoId` |
| `grupo.periodo` | string | Sí | Igual al periodo pedido | — |
| `grupo.numeroGrupo` | string | Sí | Literal | — |
| `activo` | boolean | Sí | `false` = retiro o baja | `Inscripcion.Activo` |

Con el filtro `cif` el sistema puede verificar la matrícula en línea al
recibir una solicitud (RF-31), sin esperar a la sincronización completa.

---

## 5. Cómo encaja con lo ya construido

El planificador (`src/lib/import/plan.ts`) recibe un `ParsedWorkbook` sin
importarle de dónde vino. Una integración por API solo necesita un
**adaptador** que convierta los JSON de §4.4–4.6 a esa misma forma. Todo lo
demás se reutiliza sin cambios: las validaciones de `schemas.ts`, el
planificador puro, la auditoría y la escritura transaccional. Por eso los
nombres y reglas de este contrato siguen al pie de la letra los del Excel.

```
API institucional ─► adaptador (nuevo) ─┐
                                        ├─► ParsedWorkbook ─► planImport ─► apply (transacción + auditoría)
Excel (.xlsx)     ─► parse.ts ──────────┘
```

Estudiantes e inscripciones (§4.7–4.8) no tienen equivalente en el Excel, así
que el planificador tendría que crecer. Es la parte con más trabajo nuevo.

---

## 6. Brechas e inconsistencias a confirmar con la institución

Son los puntos donde la realidad institucional puede no coincidir con el
modelo actual. Conviene resolverlos **antes** de pedir la API, porque varios
implican cambios de esquema (migraciones).

| ID | Brecha | Riesgo si no se aclara | Pregunta a la institución | ¿Cambio de esquema? |
|---|---|---|---|---|
| **B-1** | `Facultad` y `Carrera` no tienen código; se enlazan por **nombre** | Un cambio de nombre o de tilde rompe el enlace de todas sus asignaturas | ¿Tienen código institucional estable para facultad y carrera? | Sí: agregar `Codigo` único a `Facultad` y `Carrera` |
| **B-2** | `Asignatura.CarreraId` es **uno solo** | Una asignatura común a varias carreras (p. ej. Matemática I) no se puede representar; habría duplicados o carreras mal asignadas | ¿Una asignatura (mismo código) puede pertenecer a varias carreras o planes de estudio? | Posible: tabla puente `AsignaturaCarrera` |
| **B-3** | El periodo solo admite `AAAA-S1` / `AAAA-S2` | Cursos de verano, intensivos, trimestres o cuatrimestres se rechazarían | ¿Qué formato de periodo usan? ¿Hay periodos además de los dos semestres? | Solo regla de validación (`PERIODO_RE`); tabla `PeriodoAcademico` si se quieren fechas |
| **B-4** | El docente se identifica por **correo** | Si cambia de correo, el sistema crea una **cuenta duplicada** y pierde su historial | ¿Tienen código de empleado o docente estable? ¿El correo institucional cambia alguna vez? | Sí: agregar `CodigoInstitucional` único a `Usuario` |
| **B-5** | `Grupo` tiene **un solo** docente | Grupos con teoría, práctica o laboratorio a cargo de docentes distintos no caben; la solicitud se remitiría a uno solo | ¿Un grupo puede tener más de un docente? | Posible: tabla `GrupoDocente` |
| **B-6** | `numeroGrupo` se compara literal | Si una fuente manda `"01"` y otra `"1"`, se crean dos grupos distintos | ¿El número de grupo es texto estable? ¿Lleva ceros a la izquierda? | No (regla de normalización) |
| **B-7** | `HorasTotales` es fijo por asignatura | Si las horas varían por grupo, modalidad o plan, el umbral del 20 % se calcula mal | ¿Las horas son por asignatura o por grupo? ¿Son horas presenciales totales del periodo o créditos? | Posible: `Grupo.HorasTotales` |
| **B-8** | Un rol por usuario, y el login del docente es su correo | Un docente que además coordina ya tiene cuenta con ese correo: la importación lo **rechaza** (`correo.assignedToOtherRole`) | ¿Cuántos docentes tienen también cargo de coordinación? | Posible: tabla `UsuarioRol` (§4 nota 1) |
| **B-9** | Estudiantes: formato de CIF desconocido y una sola carrera por estudiante | Validación de CIF imposible; estudiantes con doble carrera pierden una | ¿Formato exacto del CIF? ¿Hay estudiantes con doble titulación? | Posible: regla de CIF; `CarreraId` múltiple |
| **B-10** | Desactivar lo que falta exige una foto completa | Una respuesta parcial (error, página perdida, filtro mal aplicado) **desactiva** grupos o matrículas válidas | ¿La API garantiza la foto completa por periodo? ¿Ofrece también cambios incrementales (`modificadoDesde`)? | No; es una regla del adaptador |
| **B-11** | Teléfono y correo son datos personales | Compartirlos sin base legal expone a ambas partes (Ley 787) | ¿Hay autorización o base legal para compartir teléfono y correo? ¿Se requiere convenio? | No |
| **B-12** | Bajas y retiros | No se sabe cómo representa la institución a un estudiante retirado de una asignatura ni a un docente reemplazado a mitad de periodo | ¿Cómo marcan retiros, bajas y reemplazos? ¿Con fecha efectiva? | Posible: fecha efectiva en `Inscripcion` |

### Preguntas técnicas

- **Autenticación:** ¿OAuth 2.0 *client credentials*, API key o certificado
  mutuo? ¿Hay lista blanca de IP? La credencial vivirá en las variables de
  entorno del servidor, nunca en el navegador.
- **Ambiente de pruebas:** ¿Hay un ambiente de pruebas con datos ficticios?
- **Frecuencia y ventana:** ¿Cuándo se cierra la matrícula y la asignación de
  docentes de cada periodo? ¿Desde cuándo los datos son estables?
- **Límites:** ¿Límite de peticiones por minuto? ¿Tamaño máximo de página?
- **Disponibilidad y versión:** ¿Cómo avisan cambios de contrato? (`meta.version`)

---

## 7. Siguientes pasos sugeridos

1. Revisar y ajustar este borrador (campos, nombres, prioridades).
2. Llevar la §6 a la institución y registrar sus respuestas aquí mismo.
3. Con las respuestas, decidir qué brechas implican migraciones (B-1, B-2,
   B-4, B-5, B-8) y abrirlas como cambios propios en `openspec/`. **No**
   mezclarlas con `catalog-excel-import`.
4. Cuando la API exista: el adaptador API → `ParsedWorkbook`, más una
   decisión de producto sobre la provisión de cuentas de estudiante (§4.7).
