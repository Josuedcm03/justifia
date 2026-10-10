CREATE TABLE "DocumentoRespaldo" (
	"Id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "DocumentoRespaldo_Id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"SolicitudId" bigint NOT NULL,
	"Pathname" varchar(255) NOT NULL,
	"NombreOriginal" varchar(255) NOT NULL,
	"TipoDetectado" varchar(10),
	"TamanoBytes" integer NOT NULL,
	"Estado" varchar(10) NOT NULL,
	"CreadoEn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "DocumentoRespaldo_Pathname_unique" UNIQUE("Pathname"),
	CONSTRAINT "CK_Documento_Tipo" CHECK ("DocumentoRespaldo"."TipoDetectado" IS NULL OR "DocumentoRespaldo"."TipoDetectado" IN ('pdf', 'png', 'jpeg')),
	CONSTRAINT "CK_Documento_Tamano" CHECK ("DocumentoRespaldo"."TamanoBytes" > 0 AND "DocumentoRespaldo"."TamanoBytes" <= 10485760),
	CONSTRAINT "CK_Documento_Estado" CHECK ("DocumentoRespaldo"."Estado" IN ('pendiente', 'valido')),
	CONSTRAINT "CK_Documento_Validado" CHECK ("DocumentoRespaldo"."Estado" = 'pendiente' OR "DocumentoRespaldo"."TipoDetectado" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "Solicitud" (
	"Id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "Solicitud_Id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"EstudianteId" bigint NOT NULL,
	"Estado" varchar(30) DEFAULT 'borrador' NOT NULL,
	"Causa" varchar(30),
	"FechaInicio" date,
	"FechaFin" date,
	"PresentadaEn" timestamp with time zone,
	"EstudianteNombre" varchar(160),
	"EstudianteCif" varchar(20),
	"EstudianteCarrera" varchar(160),
	"EstudianteCorreo" varchar(160),
	"CreadoEn" timestamp with time zone DEFAULT now() NOT NULL,
	"ActualizadoEn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "CK_Solicitud_Estado" CHECK ("Solicitud"."Estado" IN ('borrador', 'pendiente', 'en_revision_coordinacion', 'devuelta', 'aprobada', 'rechazada')),
	CONSTRAINT "CK_Solicitud_Causa" CHECK ("Solicitud"."Causa" IS NULL OR "Solicitud"."Causa" IN ('maternidad_paternidad', 'actividad_representativa', 'intercambio_academico', 'medica', 'fuerza_mayor')),
	CONSTRAINT "CK_Solicitud_Fechas" CHECK ("Solicitud"."FechaFin" >= "Solicitud"."FechaInicio"),
	CONSTRAINT "CK_Solicitud_Presentada" CHECK ("Solicitud"."Estado" = 'borrador' OR ("Solicitud"."PresentadaEn" IS NOT NULL AND "Solicitud"."Causa" IS NOT NULL AND "Solicitud"."FechaInicio" IS NOT NULL AND "Solicitud"."FechaFin" IS NOT NULL AND "Solicitud"."EstudianteNombre" IS NOT NULL AND "Solicitud"."EstudianteCif" IS NOT NULL AND "Solicitud"."EstudianteCarrera" IS NOT NULL AND "Solicitud"."EstudianteCorreo" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "SolicitudAsignatura" (
	"SolicitudId" bigint NOT NULL,
	"GrupoId" bigint NOT NULL,
	CONSTRAINT "SolicitudAsignatura_SolicitudId_GrupoId_pk" PRIMARY KEY("SolicitudId","GrupoId")
);
--> statement-breakpoint
ALTER TABLE "DocumentoRespaldo" ADD CONSTRAINT "DocumentoRespaldo_SolicitudId_Solicitud_Id_fk" FOREIGN KEY ("SolicitudId") REFERENCES "public"."Solicitud"("Id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_EstudianteId_Usuario_Id_fk" FOREIGN KEY ("EstudianteId") REFERENCES "public"."Usuario"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SolicitudAsignatura" ADD CONSTRAINT "SolicitudAsignatura_SolicitudId_Solicitud_Id_fk" FOREIGN KEY ("SolicitudId") REFERENCES "public"."Solicitud"("Id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SolicitudAsignatura" ADD CONSTRAINT "SolicitudAsignatura_GrupoId_Grupo_Id_fk" FOREIGN KEY ("GrupoId") REFERENCES "public"."Grupo"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IX_Documento_Solicitud" ON "DocumentoRespaldo" USING btree ("SolicitudId");--> statement-breakpoint
CREATE UNIQUE INDEX "UX_Solicitud_Borrador" ON "Solicitud" USING btree ("EstudianteId") WHERE "Solicitud"."Estado" = 'borrador';--> statement-breakpoint
CREATE INDEX "IX_Solicitud_Estado" ON "Solicitud" USING btree ("Estado","PresentadaEn");--> statement-breakpoint
CREATE INDEX "IX_Solicitud_BorradorActualizado" ON "Solicitud" USING btree ("ActualizadoEn") WHERE "Solicitud"."Estado" = 'borrador';