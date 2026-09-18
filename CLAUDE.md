@AGENTS.md

## Base de datos — regla de migraciones

Nunca ejecutar contra la base de datos (Neon) ningún comando que modifique
esquema o datos —`drizzle-kit migrate`, `drizzle-kit push`, `db:seed`,
`neon deploy`/`neon config apply`, o cualquier SQL de escritura directo—
sin antes pedir confirmación explícita al usuario y esperar su "sí" para
ese comando puntual. Consultas de solo lectura (`select`, `neon status`,
inspección de tablas) no requieren confirmación.
