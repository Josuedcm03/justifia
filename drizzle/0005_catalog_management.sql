ALTER TABLE "Asignatura" ADD COLUMN "Activo" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "Grupo" ADD COLUMN "Origen" varchar(12) DEFAULT 'importacion' NOT NULL;--> statement-breakpoint
ALTER TABLE "Grupo" ADD CONSTRAINT "CK_Grupo_Origen" CHECK ("Grupo"."Origen" in ('importacion', 'manual'));