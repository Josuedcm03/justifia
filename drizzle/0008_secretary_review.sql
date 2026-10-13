CREATE TABLE "SolicitudDecision" (
	"Id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "SolicitudDecision_Id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"SolicitudId" bigint NOT NULL,
	"Tipo" varchar(20) NOT NULL,
	"PlantillaCodigo" varchar(40) NOT NULL,
	"MotivoCodigo" varchar(30),
	"Texto" varchar(1000),
	"RevisionId" bigint,
	"SecretariaId" bigint NOT NULL,
	"DecididaEn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "CK_SolicitudDecision_Tipo" CHECK ("SolicitudDecision"."Tipo" IN ('aprobada', 'rechazada', 'devuelta')),
	CONSTRAINT "CK_SolicitudDecision_Motivo" CHECK (("SolicitudDecision"."Tipo" = 'devuelta') = ("SolicitudDecision"."MotivoCodigo" IS NOT NULL)),
	CONSTRAINT "CK_SolicitudDecision_MotivoCodigo" CHECK ("SolicitudDecision"."MotivoCodigo" IS NULL OR "SolicitudDecision"."MotivoCodigo" IN ('fecha_incorrecta', 'fecha_alterada', 'documento_ilegible')),
	CONSTRAINT "CK_SolicitudDecision_Texto" CHECK ("SolicitudDecision"."Tipo" = 'aprobada' OR ("SolicitudDecision"."Texto" IS NOT NULL AND length(btrim("SolicitudDecision"."Texto")) > 0)),
	CONSTRAINT "CK_SolicitudDecision_Revision" CHECK (("SolicitudDecision"."Tipo" = 'devuelta') = ("SolicitudDecision"."RevisionId" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "SolicitudRevision" (
	"Id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "SolicitudRevision_Id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"SolicitudId" bigint NOT NULL,
	"Numero" smallint NOT NULL,
	"Causa" varchar(30) NOT NULL,
	"FechaInicio" date NOT NULL,
	"FechaFin" date NOT NULL,
	"Clases" jsonb NOT NULL,
	"DocumentoIds" jsonb NOT NULL,
	"CreadaEn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "UQ_SolicitudRevision" UNIQUE("SolicitudId","Numero"),
	CONSTRAINT "CK_SolicitudRevision_Numero" CHECK ("SolicitudRevision"."Numero" > 0),
	CONSTRAINT "CK_SolicitudRevision_Causa" CHECK ("SolicitudRevision"."Causa" IN ('maternidad_paternidad', 'actividad_representativa', 'intercambio_academico', 'medica', 'fuerza_mayor')),
	CONSTRAINT "CK_SolicitudRevision_Fechas" CHECK ("SolicitudRevision"."FechaFin" >= "SolicitudRevision"."FechaInicio")
);
--> statement-breakpoint
ALTER TABLE "DocumentoRespaldo" ADD COLUMN "RetiradoEn" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Solicitud" ADD COLUMN "ReenviadaEn" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Usuario" ADD COLUMN "FacultadId" bigint;--> statement-breakpoint
ALTER TABLE "SolicitudDecision" ADD CONSTRAINT "SolicitudDecision_SolicitudId_Solicitud_Id_fk" FOREIGN KEY ("SolicitudId") REFERENCES "public"."Solicitud"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SolicitudDecision" ADD CONSTRAINT "SolicitudDecision_RevisionId_SolicitudRevision_Id_fk" FOREIGN KEY ("RevisionId") REFERENCES "public"."SolicitudRevision"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SolicitudDecision" ADD CONSTRAINT "SolicitudDecision_SecretariaId_Usuario_Id_fk" FOREIGN KEY ("SecretariaId") REFERENCES "public"."Usuario"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SolicitudRevision" ADD CONSTRAINT "SolicitudRevision_SolicitudId_Solicitud_Id_fk" FOREIGN KEY ("SolicitudId") REFERENCES "public"."Solicitud"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IX_SolicitudDecision_Solicitud" ON "SolicitudDecision" USING btree ("SolicitudId","DecididaEn");--> statement-breakpoint
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_FacultadId_Facultad_Id_fk" FOREIGN KEY ("FacultadId") REFERENCES "public"."Facultad"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IX_Solicitud_Cola" ON "Solicitud" USING btree (coalesce("ReenviadaEn", "PresentadaEn"),"Id") WHERE "Solicitud"."Estado" = 'pendiente';--> statement-breakpoint
ALTER TABLE "DocumentoRespaldo" ADD CONSTRAINT "CK_Documento_Retiro" CHECK ("DocumentoRespaldo"."RetiradoEn" IS NULL OR "DocumentoRespaldo"."Estado" = 'valido');--> statement-breakpoint
ALTER TABLE "Solicitud" ADD CONSTRAINT "CK_Solicitud_Reenvio" CHECK ("Solicitud"."ReenviadaEn" IS NULL OR ("Solicitud"."PresentadaEn" IS NOT NULL AND "Solicitud"."ReenviadaEn" >= "Solicitud"."PresentadaEn"));--> statement-breakpoint
ALTER TABLE "Usuario" ADD CONSTRAINT "CK_Usuario_Ambito" CHECK ("Usuario"."FacultadId" IS NULL OR "Usuario"."CarreraId" IS NULL);