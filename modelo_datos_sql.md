# Modelo de datos (SQL) — Sistema de justificaciones de inasistencias (FIA)

**Fuente:** Entrevista E-02 (v0.9), 8 de septiembre de 2026, secretaria académica de la Facultad de Ingeniería y Arquitectura (FIA), Universidad Americana (UAM). Insumo de análisis, no esquema definitivo.

- **Dialecto:** PostgreSQL 15+.
- **Convención de nombres:** `PascalCase` para tablas, columnas y restricciones. En PostgreSQL esto obliga a usar comillas dobles (`"Solicitud"`, `"EstudianteId"`); en SQL Server o MySQL los mismos identificadores funcionan sin comillas.
- **Enumeraciones:** todavía no se definen. Las columnas que serán `ENUM` más adelante se dejan como `VARCHAR` y se listan en §2.
- **Consulta institucional:** la UAM **no expone** ningún recurso (API ni vista) para consultar grupo, docente o matrícula. Por eso `Grupo` e `Inscripcion` son tablas propias que se cargan por importación o carga manual (§4, nota 3).
- Citas `mm:ss` → grabación E-02; `Art.` → Reglamento de Régimen Académico y Disciplinario (REG-DACA-003-0424).

---

## 1. Entidades

| #   | Tabla               | Rol                                                                        | Evidencia             |
| --- | ------------------- | -------------------------------------------------------------------------- | --------------------- |
| 1   | `Facultad`          | Catálogo de facultades                                                     | 02:09                 |
| 2   | `Carrera`           | Catálogo de carreras, pertenece a una facultad                             | 02:09                 |
| 3   | `Asignatura`        | Materia de una carrera, con carga horaria nominal                          | 19:55; 23:07          |
| 4   | `Usuario`           | Login, credenciales, rol e identidad; absorbe estudiante y coordinador     | 02:09; RNF-07         |
| 5   | `Grupo`             | Sección de una asignatura en un periodo, con su docente                    | 02:09; 23:07          |
| 6   | `Inscripcion`       | Estudiante matriculado en un grupo                                         | 02:09                 |
| 7   | `TipoCausa`         | Catálogo de causas de justificación y su efecto                            | 03:36; 20:17; Art. 34 |
| 8   | `Solicitud`         | Solicitud de justificación del estudiante                                  | 00:40; 02:09; 21:15   |
| 9   | `SolicitudDetalle`  | Afectación por grupo y fecha; incluye la respuesta del docente             | 02:09; 10:06; 11:01   |
| 10  | `Adjunto`           | Archivo que adjunta el estudiante en la solicitud                          | 00:40; 06:52; 09:17   |
| 11  | `SolicitudBitacora` | Traza de estados y decisiones (absorbe devolución, escalamiento y rechazo) | 00:40; 10:31; RNF-08  |
| 12  | `Notificacion`      | Mensaje enviado a un usuario sobre una solicitud                           | 14:58; 24:10          |

**Diferidas** (se agregan al construir CU-09): `Configuracion` (clave/valor para plazo, umbral y textos) y, si hace falta, `Plantilla`.

**Descartadas y por qué:**

| Entidad previa                           | Motivo                                                                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Persona`                                | `Usuario` concentra identidad y login.                                                                                                             |
| `Estudiante`, `Coordinador`              | Fusionadas en `Usuario` (`Cif`, `CarreraId`).                                                                                                      |
| `EmisorDocumento`, `DocumentoRespaldo`   | Reemplazadas por `Adjunto`; del emisor solo quedan `TieneFirma` / `TieneSello` (no se verifica registro profesional — hallazgo 11).                |
| `FormatoEspecial`                        | El formato llenado es un `Adjunto` (`TipoDocumento = 'formato_especial'`); la autorización son columnas en `Solicitud` + un evento en la bitácora. |
| `Devolucion`, `Escalamiento`, `Rechazo`  | Son transiciones de estado: se registran en `SolicitudBitacora` y en `Solicitud.Estado` / `Solicitud.MotivoCierre`.                                |
| `ParametroNormativo`, `PlantillaMensaje` | Administrativas; se difieren a CU-09.                                                                                                              |
| `RegistroAsistencia`                     | El conteo del 20 % lo llevan los docentes fuera del sistema (10:31; divergencia c-1).                                                              |
| `PeriodoAcademico`                       | Reducida a la columna `Periodo` (texto, p. ej. `2026-S2`) en `Grupo` y `Solicitud`.                                                                |

---

## 2. Columnas que serán enumeraciones

| Tabla.Columna                | Valores previstos                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `Solicitud.CanalRecepcion`   | correo, fisico                                                                                                                            |
| `Solicitud.Estado`           | recibida, en_verificacion, en_coordinacion, distribuida, en_revision_docente, devuelta, aprobada, rechazada, caducada                     |
| `Solicitud.MotivoCierre`     | reincidencia, causa_no_elegible, documento_alterado, fuera_de_plazo_injustificado, coordinacion_no_acepta                                 |
| `SolicitudDetalle.Resultado` | procede, limite_excedido                                                                                                                  |
| `SolicitudDetalle.Efecto`    | reprogramacion_obligatoria, a_criterio_docente, sin_efecto                                                                                |
| `Adjunto.TipoDocumento`      | constancia_medica, constancia_deportiva, epicrisis, acta_defuncion, formato_especial, otro                                                |
| `Notificacion.Canal`         | correo, whatsapp, presencial, sistema                                                                                                     |
| `SolicitudBitacora.Motivo`   | (libre por ahora: reincidencia, presunta_alteracion, limite_20_excedido, documento_ilegible, fecha_incongruente, solicitud_incompleta, …) |

**`Usuario.Rol` (retirado de esta lista, roles-lookup-table):** dejó de ser un
`VARCHAR` con enumeración diferida. Ahora es un catálogo referenciado:
`Usuario.RolId` (bigint, `NOT NULL`) apunta a `Rol.Id`, y `Rol.Codigo`
contiene exactamente los cinco valores anteriores (estudiante, docente,
coordinacion, secretaria, administrador). Ver §3.1.

---

## 3. DDL

### 3.1 Estructura académica

```sql
CREATE TABLE "Facultad" (
    "Id"        BIGINT GENERATED ALWAYS AS IDENTITY,
    "Nombre"    VARCHAR(160) NOT NULL,
    "Siglas"    VARCHAR(16),
    CONSTRAINT "PK_Facultad" PRIMARY KEY ("Id"),
    CONSTRAINT "UQ_Facultad_Nombre" UNIQUE ("Nombre")
);

CREATE TABLE "Carrera" (
    "Id"          BIGINT GENERATED ALWAYS AS IDENTITY,
    "Nombre"      VARCHAR(160) NOT NULL,
    "FacultadId"  BIGINT NOT NULL,
    CONSTRAINT "PK_Carrera" PRIMARY KEY ("Id"),
    CONSTRAINT "UQ_Carrera_Nombre" UNIQUE ("Nombre"),
    CONSTRAINT "FK_Carrera_Facultad" FOREIGN KEY ("FacultadId") REFERENCES "Facultad" ("Id")
);

CREATE TABLE "Asignatura" (
    "Id"            BIGINT GENERATED ALWAYS AS IDENTITY,
    "Codigo"        VARCHAR(32)  NOT NULL,
    "Nombre"        VARCHAR(160) NOT NULL,
    "CarreraId"     BIGINT NOT NULL,
    "HorasTotales"  INTEGER NOT NULL,                 -- base nominal del 20 % (19:55)
    "Activo"        BOOLEAN NOT NULL DEFAULT TRUE,    -- el mantenimiento manual desactiva, nunca borra (catalog-management)
    CONSTRAINT "PK_Asignatura" PRIMARY KEY ("Id"),
    CONSTRAINT "UQ_Asignatura_Codigo" UNIQUE ("Codigo"),
    CONSTRAINT "FK_Asignatura_Carrera" FOREIGN KEY ("CarreraId") REFERENCES "Carrera" ("Id"),
    CONSTRAINT "CK_Asignatura_Horas" CHECK ("HorasTotales" > 0)
);

-- Catálogo de roles (roles-lookup-table). `Codigo` es el valor que antes
-- vivía como texto libre en `Usuario.Rol` (§2); `Nombre` es solo
-- documentación/UI, no la fuente de verdad de los valores válidos (esa
-- sigue siendo el enum de la aplicación).
CREATE TABLE "Rol" (
    "Id"      BIGINT GENERATED ALWAYS AS IDENTITY,
    "Codigo"  VARCHAR(20) NOT NULL,                   -- estudiante | docente | coordinacion | secretaria | administrador
    "Nombre"  VARCHAR(60) NOT NULL,
    CONSTRAINT "PK_Rol" PRIMARY KEY ("Id"),
    CONSTRAINT "UQ_Rol_Codigo" UNIQUE ("Codigo")
);

CREATE TABLE "Usuario" (
    "Id"              BIGINT GENERATED ALWAYS AS IDENTITY,
    "Login"           VARCHAR(60)  NOT NULL,
    "HashClave"       VARCHAR(255) NOT NULL,
    "RolId"           BIGINT NOT NULL,                -- FK a Rol.Id (antes: "Rol" VARCHAR(20), §2)
    "NombreCompleto"  VARCHAR(160) NOT NULL,
    "Correo"          VARCHAR(160),                   -- solicitado a cada estudiante (02:09)
    "Telefono"        VARCHAR(30),                    -- aviso por WhatsApp (14:58)
    "Cif"             VARCHAR(20),                    -- solo estudiantes; clave de identificacion (02:09)
    "CarreraId"       BIGINT,                         -- carrera del estudiante o carrera que coordina
    "Activo"          BOOLEAN NOT NULL DEFAULT TRUE,
    "DebeCambiarClave" BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE en cuentas creadas por importación (catalog-excel-import)
    "CreadoEn"        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "PK_Usuario" PRIMARY KEY ("Id"),
    CONSTRAINT "UQ_Usuario_Login" UNIQUE ("Login"),
    CONSTRAINT "UQ_Usuario_Correo" UNIQUE ("Correo"),  -- varios NULL pueden coexistir; clave natural de docentes en la importación
    CONSTRAINT "UQ_Usuario_Cif" UNIQUE ("Cif"),
    CONSTRAINT "FK_Usuario_Rol" FOREIGN KEY ("RolId") REFERENCES "Rol" ("Id"),
    CONSTRAINT "FK_Usuario_Carrera" FOREIGN KEY ("CarreraId") REFERENCES "Carrera" ("Id")
);

CREATE TABLE "Grupo" (
    "Id"            BIGINT GENERATED ALWAYS AS IDENTITY,
    "AsignaturaId"  BIGINT NOT NULL,
    "Periodo"       VARCHAR(12) NOT NULL,             -- p. ej. '2026-S2'
    "NumeroGrupo"   VARCHAR(12) NOT NULL,             -- "hay 40 grupos de matematicas" (23:07)
    "DocenteId"     BIGINT NOT NULL,                  -- Usuario con Rol = 'docente'
    "Activo"        BOOLEAN NOT NULL DEFAULT TRUE,    -- la importación desactiva, nunca borra
    "Origen"        VARCHAR(12) NOT NULL DEFAULT 'importacion', -- cómo se creó la fila; se fija al crear y no se reescribe (catalog-management)
    "Dias"          SMALLINT NOT NULL DEFAULT 0,      -- días de la semana en que se reúne el grupo, como máscara de bits (ver nota bajo la tabla); 0 = días no registrados
    CONSTRAINT "PK_Grupo" PRIMARY KEY ("Id"),
    CONSTRAINT "UQ_Grupo_Seccion" UNIQUE ("AsignaturaId", "Periodo", "NumeroGrupo"),
    CONSTRAINT "FK_Grupo_Asignatura" FOREIGN KEY ("AsignaturaId") REFERENCES "Asignatura" ("Id"),
    CONSTRAINT "FK_Grupo_Docente" FOREIGN KEY ("DocenteId") REFERENCES "Usuario" ("Id"),
    CONSTRAINT "CK_Grupo_Origen" CHECK ("Origen" IN ('importacion', 'manual')),
    CONSTRAINT "CK_Grupo_Dias" CHECK ("Dias" BETWEEN 0 AND 127)
);
-- "Grupo"."Dias": máscara de bits, un bit por día de la semana.
--   Lunes = bit 0 (1), Martes = bit 1 (2), Miércoles = bit 2 (4), Jueves = bit 3 (8),
--   Viernes = bit 4 (16), Sábado = bit 5 (32), Domingo = bit 6 (64).
--   El índice del bit es `isodow - 1`. El rango válido es 0..127 (CK_Grupo_Dias).
--   0 (conjunto vacío) significa «días no registrados»: es el valor de los grupos
--   anteriores a esta columna y de los que se crean sin indicar días.
--   Lectura en SQL: ("Dias" & (1 << (extract(isodow from <fecha>)::int - 1))) <> 0
--   Nota: `getDay()` de JavaScript cuenta el domingo como 0; el índice del bit es
--   (getDay() + 6) % 7. El código de la aplicación usa `src/lib/catalog/dias.ts`.

CREATE TABLE "Inscripcion" (
    "EstudianteId"  BIGINT NOT NULL,                  -- Usuario con Rol = 'estudiante'
    "GrupoId"       BIGINT NOT NULL,
    "Activo"        BOOLEAN NOT NULL DEFAULT TRUE,    -- la importación desactiva, nunca borra
    CONSTRAINT "PK_Inscripcion" PRIMARY KEY ("EstudianteId", "GrupoId"),
    CONSTRAINT "FK_Inscripcion_Estudiante" FOREIGN KEY ("EstudianteId") REFERENCES "Usuario" ("Id"),
    CONSTRAINT "FK_Inscripcion_Grupo" FOREIGN KEY ("GrupoId") REFERENCES "Grupo" ("Id")
);

CREATE TABLE "TipoCausa" (
    "Id"                                BIGINT GENERATED ALWAYS AS IDENTITY,
    "Nombre"                            VARCHAR(80) NOT NULL,
    "BaseLegal"                         VARCHAR(40),          -- p. ej. 'Art. 34 d)'
    "TramiteEstandar"                   BOOLEAN NOT NULL,     -- salud/deporte = TRUE; resto por via especial (03:36)
    "RequiereReprogramacion"           BOOLEAN NOT NULL,     -- salud, deporte, maternidad (20:17)
    "RequiereAutorizacionCoordinacion" BOOLEAN NOT NULL DEFAULT FALSE,  -- causas atipicas (05:33)
    CONSTRAINT "PK_TipoCausa" PRIMARY KEY ("Id"),
    CONSTRAINT "UQ_TipoCausa_Nombre" UNIQUE ("Nombre")
);

-- Bitácora de escrituras (RNF-02), append-only, particionada por año.
-- Definida a mano en drizzle/0004_audit_log.sql; drizzle-kit no la ve (src/db/audit-schema.ts solo la tipa).
CREATE TABLE "EventoAuditoria" (
    "Id"          BIGINT GENERATED ALWAYS AS IDENTITY,   -- identity confirmado en el padre particionado (sonda S1, PG 18)
    "ActorId"     BIGINT NOT NULL,                       -- usuario autenticado que ejecutó la acción
    "OcurridoEn"  TIMESTAMPTZ NOT NULL DEFAULT now(),    -- clave de partición
    "Accion"      VARCHAR(60) NOT NULL,
    "EntidadTipo" VARCHAR(40) NOT NULL,                  -- 'Usuario' | 'Importacion' | ...
    "EntidadId"   BIGINT,                                -- NULL solo para operaciones completas ('Importacion')
    "Datos"       JSONB NOT NULL DEFAULT '{}'::jsonb,    -- resumen estructurado; nunca credenciales
    CONSTRAINT "PK_EventoAuditoria" PRIMARY KEY ("Id", "OcurridoEn"),  -- la clave de partición debe estar en la PK
    CONSTRAINT "FK_EventoAuditoria_Actor" FOREIGN KEY ("ActorId") REFERENCES "Usuario" ("Id"),
    CONSTRAINT "CK_EventoAuditoria_Entidad" CHECK ("EntidadTipo" <> 'Usuario' OR "EntidadId" IS NOT NULL)
) PARTITION BY RANGE ("OcurridoEn");
-- Índices: IX_EventoAuditoria_Entidad (EntidadTipo, EntidadId, OcurridoEn DESC),
--          IX_EventoAuditoria_Actor (ActorId, OcurridoEn DESC), IX_EventoAuditoria_Ocurrido (OcurridoEn).
-- Particiones anuales 2026..2030 con límites +00 y una partición DEFAULT (ver §4, notas 12 y 13).
```

### 3.2 Solicitud y ciclo de vida

```sql
CREATE TABLE "Solicitud" (
    "Id"                  BIGINT GENERATED ALWAYS AS IDENTITY,
    "EstudianteId"        BIGINT NOT NULL,
    "Periodo"             VARCHAR(12) NOT NULL,
    "TipoCausaId"         BIGINT NOT NULL,
    "Descripcion"         TEXT,                        -- detalle libre del motivo
    "CanalRecepcion"      VARCHAR(12) NOT NULL,        -- §2: correo | fisico (00:40; 09:17)
    "FechaPresentacion"   TIMESTAMPTZ NOT NULL DEFAULT now(),
    "FueraDePlazo"        BOOLEAN NOT NULL DEFAULT FALSE,  -- > 48 h habiles (09:17)
    "Estado"              VARCHAR(24) NOT NULL DEFAULT 'recibida',  -- §2
    "SolicitudOrigenId"   BIGINT,                      -- reingreso / apelacion (18:29)
    "AutorizadoPor"       BIGINT,                      -- coordinador que autoriza caso especial (05:33)
    "AutorizadoEn"        TIMESTAMPTZ,
    "MotivoCierre"        VARCHAR(40),                 -- §2, solo si Estado = 'rechazada' (07:40)
    "MotivoCierreDetalle" TEXT,
    "CreadoEn"            TIMESTAMPTZ NOT NULL DEFAULT now(),
    "ActualizadoEn"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "PK_Solicitud" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Solicitud_Estudiante"  FOREIGN KEY ("EstudianteId")      REFERENCES "Usuario" ("Id"),
    CONSTRAINT "FK_Solicitud_TipoCausa"   FOREIGN KEY ("TipoCausaId")       REFERENCES "TipoCausa" ("Id"),
    CONSTRAINT "FK_Solicitud_Origen"      FOREIGN KEY ("SolicitudOrigenId") REFERENCES "Solicitud" ("Id"),
    CONSTRAINT "FK_Solicitud_Autorizador" FOREIGN KEY ("AutorizadoPor")     REFERENCES "Usuario" ("Id")
);

CREATE INDEX "IX_Solicitud_Estudiante" ON "Solicitud" ("EstudianteId");
CREATE INDEX "IX_Solicitud_Estado"     ON "Solicitud" ("Estado");

-- Una solicitud afecta varias asignaturas/fechas; cada fila se remite a un docente
-- (via Grupo.DocenteId) y ese docente responde por separado (02:09; 11:01).
CREATE TABLE "SolicitudDetalle" (
    "Id"                 BIGINT GENERATED ALWAYS AS IDENTITY,
    "SolicitudId"        BIGINT NOT NULL,
    "GrupoId"            BIGINT NOT NULL,
    "FechaInasistencia"  DATE NOT NULL,
    "Justificada"        BOOLEAN NOT NULL DEFAULT FALSE,  -- la inasistencia NO se elimina (19:33)
    "Resultado"          VARCHAR(20),                 -- §2: procede | limite_excedido (11:01)
    "Efecto"             VARCHAR(30),                 -- §2 (20:17)
    "Observacion"        TEXT,
    "RespondidoEn"       TIMESTAMPTZ,
    CONSTRAINT "PK_SolicitudDetalle" PRIMARY KEY ("Id"),
    CONSTRAINT "UQ_SolicitudDetalle" UNIQUE ("SolicitudId", "GrupoId", "FechaInasistencia"),
    CONSTRAINT "FK_SolicitudDetalle_Solicitud" FOREIGN KEY ("SolicitudId") REFERENCES "Solicitud" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_SolicitudDetalle_Grupo"     FOREIGN KEY ("GrupoId")     REFERENCES "Grupo" ("Id")
);

CREATE INDEX "IX_SolicitudDetalle_Solicitud" ON "SolicitudDetalle" ("SolicitudId");

CREATE TABLE "Adjunto" (
    "Id"             BIGINT GENERATED ALWAYS AS IDENTITY,
    "SolicitudId"    BIGINT NOT NULL,
    "NombreArchivo"  VARCHAR(255) NOT NULL,
    "Ruta"           VARCHAR(500) NOT NULL,           -- escaneo o foto (00:40; RNF-05)
    "Mime"           VARCHAR(100),
    "TamanoBytes"    BIGINT,
    "TipoDocumento"  VARCHAR(30) NOT NULL,            -- §2
    "TieneFirma"     BOOLEAN NOT NULL DEFAULT FALSE,  -- unico control del emisor (06:52)
    "TieneSello"     BOOLEAN NOT NULL DEFAULT FALSE,
    "ReposoDesde"    DATE,                            -- coherencia de fechas (14:58)
    "ReposoHasta"    DATE,
    "Vigente"        BOOLEAN NOT NULL DEFAULT TRUE,   -- FALSE cuando lo reemplaza una version corregida (18:29)
    "ReemplazaA"     BIGINT,
    "SubidoPor"      BIGINT NOT NULL,
    "SubidoEn"       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "PK_Adjunto" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Adjunto_Solicitud" FOREIGN KEY ("SolicitudId") REFERENCES "Solicitud" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Adjunto_Reemplazo" FOREIGN KEY ("ReemplazaA")  REFERENCES "Adjunto" ("Id"),
    CONSTRAINT "FK_Adjunto_SubidoPor" FOREIGN KEY ("SubidoPor")   REFERENCES "Usuario" ("Id"),
    CONSTRAINT "CK_Adjunto_Reposo" CHECK ("ReposoHasta" IS NULL OR "ReposoDesde" IS NULL OR "ReposoHasta" >= "ReposoDesde")
);

CREATE INDEX "IX_Adjunto_Solicitud" ON "Adjunto" ("SolicitudId");

-- Absorbe devolucion, escalamiento y rechazo: cada uno es una fila de transicion.
CREATE TABLE "SolicitudBitacora" (
    "Id"              BIGINT GENERATED ALWAYS AS IDENTITY,
    "SolicitudId"     BIGINT NOT NULL,
    "EstadoAnterior"  VARCHAR(24),
    "EstadoNuevo"     VARCHAR(24) NOT NULL,
    "ActorUsuarioId"  BIGINT,
    "Accion"          VARCHAR(60) NOT NULL,           -- 'recibe', 'devuelve', 'escala', 'decide', 'rechaza', 'aprueba'
    "Motivo"          VARCHAR(60),
    "Nota"            TEXT,
    "OcurridoEn"      TIMESTAMPTZ NOT NULL DEFAULT now(),   -- RF-27, RNF-08
    CONSTRAINT "PK_SolicitudBitacora" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_SolicitudBitacora_Solicitud" FOREIGN KEY ("SolicitudId")    REFERENCES "Solicitud" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_SolicitudBitacora_Actor"     FOREIGN KEY ("ActorUsuarioId") REFERENCES "Usuario" ("Id")
);

CREATE INDEX "IX_SolicitudBitacora_Solicitud" ON "SolicitudBitacora" ("SolicitudId", "OcurridoEn");

CREATE TABLE "Notificacion" (
    "Id"                     BIGINT GENERATED ALWAYS AS IDENTITY,
    "SolicitudId"            BIGINT NOT NULL,
    "DestinatarioUsuarioId"  BIGINT NOT NULL,
    "Canal"                  VARCHAR(12) NOT NULL,    -- §2
    "Asunto"                 VARCHAR(200),
    "Cuerpo"                 TEXT,                    -- plantilla parametrizada (24:10)
    "EnviadoEn"              TIMESTAMPTZ NOT NULL DEFAULT now(),
    "Entregado"              BOOLEAN,
    "Error"                  TEXT,
    CONSTRAINT "PK_Notificacion" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Notificacion_Solicitud"    FOREIGN KEY ("SolicitudId")           REFERENCES "Solicitud" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_Notificacion_Destinatario" FOREIGN KEY ("DestinatarioUsuarioId") REFERENCES "Usuario" ("Id")
);

CREATE INDEX "IX_Notificacion_Solicitud" ON "Notificacion" ("SolicitudId");
```

---

## 4. Notas de modelado y vacíos de evidencia

1. **`Usuario` sustituye a `Persona`, `Estudiante` y `Coordinador`.** Un rol por usuario (`Usuario.Rol`, sin tabla puente). Si una persona necesita dos roles (docente que además coordina), se resuelve con dos cuentas o con una futura tabla `UsuarioRol`. Las FK a `Usuario` (`Grupo.DocenteId`, `Inscripcion.EstudianteId`, `Solicitud.EstudianteId`) **no garantizan** el rol correcto: esa regla se valida en la aplicación o con un `TRIGGER`.

2. **`Cif` y `CarreraId` viven en `Usuario`.** `Cif` es único y solo lo llevan los estudiantes; `CarreraId` es la carrera del estudiante o la carrera que coordina el coordinador. Ambos son `NULL` para secretaría y administración.

3. **`Grupo` e `Inscripcion` son tablas propias.** La institución no expone ninguna consulta, así que estos datos se cargan por importación de un archivo `.xlsx` cada periodo (RF-35 es la fuente de autoridad; el «CSV del sistema académico» de versiones anteriores de esta nota ya no aplica). La carga manual de asignaturas y grupos existe (catalog-management): `Asignatura.Activo` permite desactivar una asignatura sin borrarla y `Grupo.Origen` (`importacion` o `manual`) registra cómo se creó cada grupo; se fija al crear y nunca se reescribe, ni siquiera cuando la importación reactiva o actualiza la fila. Esto es lo que hoy la secretaria hace a mano al buscar por CIF (02:09); el sistema solo puede automatizarlo si tiene los datos cargados.

4. **`SolicitudDetalle` es la unidad de trabajo del docente.** Una solicitud afecta varias asignaturas y fechas; cada fila se remite a un docente (vía `Grupo.DocenteId`) y ese docente responde en `Resultado` / `Efecto`. El caso «misma inasistencia el mismo día en varias asignaturas» no está resuelto en la entrevista (hallazgo 3); el modelo lo soporta, la regla de negocio queda pendiente.

5. **`Adjunto` reemplaza a `DocumentoRespaldo` y `EmisorDocumento`.** Guarda el archivo más los pocos datos que la secretaria realmente revisa: `TieneFirma`, `TieneSello` y el rango de reposo para contrastar fechas. No hay código MINSA ni validación de colegiatura (hallazgo 11). El reingreso de una constancia corregida es un `Adjunto` nuevo con `ReemplazaA` apuntando al anterior y el anterior con `Vigente = FALSE` (18:29).

6. **Devolución, escalamiento y rechazo no son tablas.** Son filas de `SolicitudBitacora` con su `Accion`, `Motivo` y `ActorUsuarioId`, más el cambio de `Solicitud.Estado`. Solo el motivo del rechazo final se denormaliza en `Solicitud.MotivoCierre` para consultarlo sin recorrer la bitácora. La decisión de coordinación es otra fila de bitácora (`Accion = 'decide'`, actor = coordinador).

7. **El formato especial no es tabla.** El formato firmado y sellado se sube como `Adjunto` (`TipoDocumento = 'formato_especial'`); la autorización queda en `Solicitud.AutorizadoPor` / `AutorizadoEn` y en una fila de bitácora (05:33).

8. **Sin `RegistroAsistencia`.** El conteo del 20 % lo llevan los docentes fuera del sistema (10:31). `SolicitudDetalle.Resultado = 'limite_excedido'` es un dato **que aporta el docente**, no un cálculo del sistema (divergencia c-1).

9. **`Periodo` es un texto, no una tabla.** Aparece en `Grupo` y `Solicitud`. Si más adelante se necesita marcar el periodo vigente o sus fechas, se promueve a tabla `PeriodoAcademico`.

10. **Configuración diferida.** Plazo (48 h), umbral (20 % sobre horas) y textos de plantilla se manejarán con una tabla `Configuracion` (clave/valor) cuando se implemente CU-09 (RNF-09, RNF-10; 04:41; 19:55; divergencia c-4).

11. **Sin evidencia sobre:** si hoy se guarda registro escrito del rechazo (hallazgo 14), volumen de solicitudes por periodo y tipo, y tiempos de trámite. Los `CHECK` y cardinalidades de esas zonas son tentativos.

12. **`EventoAuditoria` es append-only, con límites honestos.** Un `TRIGGER` de fila `BEFORE UPDATE OR DELETE` en la tabla padre (PostgreSQL lo clona a cada partición existente y futura) más un `TRIGGER` `BEFORE TRUNCATE` **por partición** (los triggers de sentencia no se clonan; la sonda S2 confirmó que el padre acepta uno propio, así que hay uno en el padre y uno en cada partición) rechazan la escritura con `42501`. `REVOKE UPDATE, DELETE, TRUNCATE ... FROM PUBLIC` por relación es solo defensa en profundidad, no el mecanismo. **Límites**: el rol de la aplicación es el dueño de la tabla y las migraciones lo usan también, así que puede ejecutar `DISABLE TRIGGER`, `DROP TABLE` y `DROP`/`DETACH PARTITION`; una restauración de Neon (point-in-time) revierte la tabla. No se afirma inmutabilidad absoluta: se garantiza contra las sentencias de datos de la aplicación. La purga por retención no está implementada; sus restricciones están en design.md (Migration/Rollout 9).

13. **Ventana de particiones de `EventoAuditoria`.** Hay particiones anuales 2026..2030 (límites UTC con `+00`) y una partición `DEFAULT`. La ventana expira el **`2030-12-31`**: antes de esa fecha una migración escrita por una persona debe añadir la siguiente ventana, y **cada partición nueva necesita su propio trigger `BEFORE TRUNCATE` y su `REVOKE`** (PostgreSQL no los proporciona). Chequeo de salud: `SELECT count(*) FROM "EventoAuditoria_default";` (un valor distinto de cero indica que la ventana venció). Trampa del `DEFAULT`: una fila en `DEFAULT` impide crear la partición de ese año y el trigger de inmutabilidad impide moverla. Quién es responsable del calendario es una decisión abierta (ver la sección final de design.md).
