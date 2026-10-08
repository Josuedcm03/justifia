ALTER TABLE "Grupo" ADD COLUMN "Dias" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Grupo" ADD CONSTRAINT "CK_Grupo_Dias" CHECK ("Grupo"."Dias" between 0 and 127);