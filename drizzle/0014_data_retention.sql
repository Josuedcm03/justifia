ALTER TABLE "Solicitud" ADD COLUMN "CanceladaEn" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Usuario" ADD COLUMN "CanceladoEn" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Usuario" ADD CONSTRAINT "CK_Usuario_Cancelado" CHECK ("Usuario"."CanceladoEn" IS NULL OR (NOT "Usuario"."Activo" AND "Usuario"."Correo" IS NULL AND "Usuario"."Telefono" IS NULL AND "Usuario"."Cif" IS NULL));
--> statement-breakpoint
-- Hand-appended below the generated statements (data-retention, D1, D8).
-- The sentinel account: the actor of the retention audit rows. Inactive, with
-- a credential no password can match (not a bcrypt hash), so it can never log
-- in. Looked up by login and hash at run time, never by a literal Id.
INSERT INTO "Usuario" ("Login", "HashClave", "RolId", "NombreCompleto", "Activo", "DebeCambiarClave")
SELECT 'sistema', '!sistema-sin-clave', r."Id", 'Sistema (tarea programada)', false, false
FROM "Rol" r WHERE r."Codigo" = 'administrador'
ON CONFLICT ("Login") DO NOTHING;
--> statement-breakpoint
-- Audit partitions 2031-2035 (UTC). The row trigger of the parent is cloned
-- into each partition; the statement trigger and the REVOKE are not, so each
-- partition gets its own. A partition for 2036 must exist before 2036 begins
-- (runbook: modelo_datos_sql.md section 4).
CREATE TABLE "EventoAuditoria_2031" PARTITION OF "EventoAuditoria" FOR VALUES FROM ('2031-01-01 00:00:00+00') TO ('2032-01-01 00:00:00+00');
--> statement-breakpoint
CREATE TRIGGER "TR_EventoAuditoria_2031_truncate"
	BEFORE TRUNCATE ON "EventoAuditoria_2031"
	FOR EACH STATEMENT EXECUTE FUNCTION "fn_EventoAuditoria_inmutable"();
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "EventoAuditoria_2031" FROM PUBLIC;
--> statement-breakpoint
CREATE TABLE "EventoAuditoria_2032" PARTITION OF "EventoAuditoria" FOR VALUES FROM ('2032-01-01 00:00:00+00') TO ('2033-01-01 00:00:00+00');
--> statement-breakpoint
CREATE TRIGGER "TR_EventoAuditoria_2032_truncate"
	BEFORE TRUNCATE ON "EventoAuditoria_2032"
	FOR EACH STATEMENT EXECUTE FUNCTION "fn_EventoAuditoria_inmutable"();
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "EventoAuditoria_2032" FROM PUBLIC;
--> statement-breakpoint
CREATE TABLE "EventoAuditoria_2033" PARTITION OF "EventoAuditoria" FOR VALUES FROM ('2033-01-01 00:00:00+00') TO ('2034-01-01 00:00:00+00');
--> statement-breakpoint
CREATE TRIGGER "TR_EventoAuditoria_2033_truncate"
	BEFORE TRUNCATE ON "EventoAuditoria_2033"
	FOR EACH STATEMENT EXECUTE FUNCTION "fn_EventoAuditoria_inmutable"();
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "EventoAuditoria_2033" FROM PUBLIC;
--> statement-breakpoint
CREATE TABLE "EventoAuditoria_2034" PARTITION OF "EventoAuditoria" FOR VALUES FROM ('2034-01-01 00:00:00+00') TO ('2035-01-01 00:00:00+00');
--> statement-breakpoint
CREATE TRIGGER "TR_EventoAuditoria_2034_truncate"
	BEFORE TRUNCATE ON "EventoAuditoria_2034"
	FOR EACH STATEMENT EXECUTE FUNCTION "fn_EventoAuditoria_inmutable"();
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "EventoAuditoria_2034" FROM PUBLIC;
--> statement-breakpoint
CREATE TABLE "EventoAuditoria_2035" PARTITION OF "EventoAuditoria" FOR VALUES FROM ('2035-01-01 00:00:00+00') TO ('2036-01-01 00:00:00+00');
--> statement-breakpoint
CREATE TRIGGER "TR_EventoAuditoria_2035_truncate"
	BEFORE TRUNCATE ON "EventoAuditoria_2035"
	FOR EACH STATEMENT EXECUTE FUNCTION "fn_EventoAuditoria_inmutable"();
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "EventoAuditoria_2035" FROM PUBLIC;
