@AGENTS.md

## Base de datos — regla de migraciones

Nunca ejecutar contra la base de datos (Neon) ningún comando que modifique
esquema o datos —`drizzle-kit migrate`, `drizzle-kit push`, `db:seed`,
`neon deploy`/`neon config apply`, o cualquier SQL de escritura directo—
sin antes pedir confirmación explícita al usuario y esperar su "sí" para
ese comando puntual. Consultas de solo lectura (`select`, `neon status`,
inspección de tablas) no requieren confirmación.

## Requisitos y roadmap

- `docs/requirements.md` es la fuente de requisitos: funcionales (RF), reglas
  de negocio (RN) y no funcionales (RNF).
- `docs/roadmap.md` lista los changes previstos, qué RF, RN y RNF cubre cada
  uno y su responsable.
- Todo change de SDD cita en sus specs los IDs que cubre. Se trabaja un change
  por vez y se archiva antes de abrir el siguiente; al archivarlo se actualiza
  su estado en el roadmap.
- Para iniciar un change, usar la plantilla de `docs/sdd-new-template.md`.
