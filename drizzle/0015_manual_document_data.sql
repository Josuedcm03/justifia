CREATE TABLE "DocumentoDatoManual" (
	"DocumentoId" bigint PRIMARY KEY NOT NULL,
	"NombreEstudiante" varchar(160),
	"Emisor" varchar(200),
	"FechaEmision" date,
	"ReposoDesde" date,
	"ReposoHasta" date,
	"RegistradoPorId" bigint NOT NULL,
	"ActualizadoEn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "CK_DatoManual_Reposo" CHECK (("DocumentoDatoManual"."ReposoDesde" IS NULL) = ("DocumentoDatoManual"."ReposoHasta" IS NULL) AND ("DocumentoDatoManual"."ReposoHasta" IS NULL OR "DocumentoDatoManual"."ReposoHasta" >= "DocumentoDatoManual"."ReposoDesde")),
	CONSTRAINT "CK_DatoManual_Texto" CHECK (("DocumentoDatoManual"."NombreEstudiante" IS NULL OR btrim("DocumentoDatoManual"."NombreEstudiante") <> '') AND ("DocumentoDatoManual"."Emisor" IS NULL OR btrim("DocumentoDatoManual"."Emisor") <> '')),
	CONSTRAINT "CK_DatoManual_NoVacio" CHECK ("DocumentoDatoManual"."NombreEstudiante" IS NOT NULL OR "DocumentoDatoManual"."Emisor" IS NOT NULL OR "DocumentoDatoManual"."FechaEmision" IS NOT NULL OR "DocumentoDatoManual"."ReposoDesde" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "DocumentoRespaldo" ADD COLUMN "TipoDocumento" varchar(40);--> statement-breakpoint
ALTER TABLE "DocumentoRespaldo" ADD COLUMN "TieneFirma" boolean;--> statement-breakpoint
ALTER TABLE "DocumentoRespaldo" ADD COLUMN "TieneSello" boolean;--> statement-breakpoint
ALTER TABLE "DocumentoDatoManual" ADD CONSTRAINT "DocumentoDatoManual_DocumentoId_DocumentoRespaldo_Id_fk" FOREIGN KEY ("DocumentoId") REFERENCES "public"."DocumentoRespaldo"("Id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DocumentoDatoManual" ADD CONSTRAINT "DocumentoDatoManual_RegistradoPorId_Usuario_Id_fk" FOREIGN KEY ("RegistradoPorId") REFERENCES "public"."Usuario"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DocumentoRespaldo" ADD CONSTRAINT "CK_Documento_TipoDocumento" CHECK ("DocumentoRespaldo"."TipoDocumento" IS NULL OR "DocumentoRespaldo"."TipoDocumento" IN ('constancia_medica', 'constancia_institucional', 'otro'));