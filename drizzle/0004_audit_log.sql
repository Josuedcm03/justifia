-- 0004_audit_log: append-only, yearly-partitioned audit table (design decisions 18-26).
-- Hand-written: drizzle-kit never sees this table (src/db/audit-schema.ts only types it).
-- Never edit this file after it is applied; forward-fix with a new migration.
-- Partition window: 2026-01-01 .. 2031-01-01 (UTC) plus a DEFAULT partition.
-- Runbook: modelo_datos_sql.md section 4 (notes 12 and 13).
CREATE TABLE "EventoAuditoria" (
	"Id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
	"ActorId" bigint NOT NULL,
	"OcurridoEn" timestamp with time zone DEFAULT now() NOT NULL,
	"Accion" varchar(60) NOT NULL,
	"EntidadTipo" varchar(40) NOT NULL,
	"EntidadId" bigint,
	"Datos" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "PK_EventoAuditoria" PRIMARY KEY ("Id", "OcurridoEn"),
	CONSTRAINT "FK_EventoAuditoria_Actor" FOREIGN KEY ("ActorId") REFERENCES "Usuario" ("Id"),
	CONSTRAINT "CK_EventoAuditoria_Entidad" CHECK ("EntidadTipo" <> 'Usuario' OR "EntidadId" IS NOT NULL)
) PARTITION BY RANGE ("OcurridoEn");
--> statement-breakpoint
CREATE TABLE "EventoAuditoria_2026" PARTITION OF "EventoAuditoria" FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');
--> statement-breakpoint
CREATE TABLE "EventoAuditoria_2027" PARTITION OF "EventoAuditoria" FOR VALUES FROM ('2027-01-01 00:00:00+00') TO ('2028-01-01 00:00:00+00');
--> statement-breakpoint
CREATE TABLE "EventoAuditoria_2028" PARTITION OF "EventoAuditoria" FOR VALUES FROM ('2028-01-01 00:00:00+00') TO ('2029-01-01 00:00:00+00');
--> statement-breakpoint
CREATE TABLE "EventoAuditoria_2029" PARTITION OF "EventoAuditoria" FOR VALUES FROM ('2029-01-01 00:00:00+00') TO ('2030-01-01 00:00:00+00');
--> statement-breakpoint
CREATE TABLE "EventoAuditoria_2030" PARTITION OF "EventoAuditoria" FOR VALUES FROM ('2030-01-01 00:00:00+00') TO ('2031-01-01 00:00:00+00');
--> statement-breakpoint
CREATE TABLE "EventoAuditoria_default" PARTITION OF "EventoAuditoria" DEFAULT;
--> statement-breakpoint
CREATE INDEX "IX_EventoAuditoria_Entidad" ON "EventoAuditoria" USING btree ("EntidadTipo", "EntidadId", "OcurridoEn" DESC);
--> statement-breakpoint
CREATE INDEX "IX_EventoAuditoria_Actor" ON "EventoAuditoria" USING btree ("ActorId", "OcurridoEn" DESC);
--> statement-breakpoint
CREATE INDEX "IX_EventoAuditoria_Ocurrido" ON "EventoAuditoria" USING btree ("OcurridoEn");
--> statement-breakpoint
-- The guard raises 42501 (insufficient_privilege) for any UPDATE, DELETE or TRUNCATE.
CREATE FUNCTION "fn_EventoAuditoria_inmutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'EventoAuditoria is append-only: % is not allowed', TG_OP USING ERRCODE = '42501';
END;
$$;
--> statement-breakpoint
-- Row trigger on the parent: PostgreSQL clones it into every existing and future partition.
CREATE TRIGGER "TR_EventoAuditoria_inmutable"
	BEFORE UPDATE OR DELETE ON "EventoAuditoria"
	FOR EACH ROW EXECUTE FUNCTION "fn_EventoAuditoria_inmutable"();
--> statement-breakpoint
-- Statement-level TRUNCATE triggers are NOT cloned (probe S2): the parent gets its own
-- and so does every partition, added by hand. Identity on the partitioned parent
-- was accepted by probe S1 (PostgreSQL 18), so no sequence fallback is used.
CREATE TRIGGER "TR_EventoAuditoria_truncate"
	BEFORE TRUNCATE ON "EventoAuditoria"
	FOR EACH STATEMENT EXECUTE FUNCTION "fn_EventoAuditoria_inmutable"();
--> statement-breakpoint
CREATE TRIGGER "TR_EventoAuditoria_2026_truncate"
	BEFORE TRUNCATE ON "EventoAuditoria_2026"
	FOR EACH STATEMENT EXECUTE FUNCTION "fn_EventoAuditoria_inmutable"();
--> statement-breakpoint
CREATE TRIGGER "TR_EventoAuditoria_2027_truncate"
	BEFORE TRUNCATE ON "EventoAuditoria_2027"
	FOR EACH STATEMENT EXECUTE FUNCTION "fn_EventoAuditoria_inmutable"();
--> statement-breakpoint
CREATE TRIGGER "TR_EventoAuditoria_2028_truncate"
	BEFORE TRUNCATE ON "EventoAuditoria_2028"
	FOR EACH STATEMENT EXECUTE FUNCTION "fn_EventoAuditoria_inmutable"();
--> statement-breakpoint
CREATE TRIGGER "TR_EventoAuditoria_2029_truncate"
	BEFORE TRUNCATE ON "EventoAuditoria_2029"
	FOR EACH STATEMENT EXECUTE FUNCTION "fn_EventoAuditoria_inmutable"();
--> statement-breakpoint
CREATE TRIGGER "TR_EventoAuditoria_2030_truncate"
	BEFORE TRUNCATE ON "EventoAuditoria_2030"
	FOR EACH STATEMENT EXECUTE FUNCTION "fn_EventoAuditoria_inmutable"();
--> statement-breakpoint
CREATE TRIGGER "TR_EventoAuditoria_default_truncate"
	BEFORE TRUNCATE ON "EventoAuditoria_default"
	FOR EACH STATEMENT EXECUTE FUNCTION "fn_EventoAuditoria_inmutable"();
--> statement-breakpoint
-- Defence in depth only (the owner bypasses it): the triggers are the mechanism.
REVOKE UPDATE, DELETE, TRUNCATE ON "EventoAuditoria" FROM PUBLIC;
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "EventoAuditoria_2026" FROM PUBLIC;
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "EventoAuditoria_2027" FROM PUBLIC;
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "EventoAuditoria_2028" FROM PUBLIC;
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "EventoAuditoria_2029" FROM PUBLIC;
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "EventoAuditoria_2030" FROM PUBLIC;
--> statement-breakpoint
REVOKE UPDATE, DELETE, TRUNCATE ON "EventoAuditoria_default" FROM PUBLIC;
