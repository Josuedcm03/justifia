CREATE TABLE "ExtraccionDocumento" (
	"DocumentoId" bigint PRIMARY KEY NOT NULL,
	"Estado" varchar(12) DEFAULT 'pendiente' NOT NULL,
	"Intentos" smallint DEFAULT 0 NOT NULL,
	"ErrorCodigo" varchar(30),
	"ReclamoId" uuid,
	"ReclamadaEn" timestamp with time zone,
	"NombreEstudiante" varchar(160),
	"Emisor" varchar(200),
	"FechaEmision" date,
	"ReposoDesde" date,
	"ReposoHasta" date,
	"ReposoDias" smallint,
	"Motor" varchar(40),
	"ProcesadoEn" timestamp with time zone,
	"CreadaEn" timestamp with time zone DEFAULT now() NOT NULL,
	"ActualizadaEn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "CK_Extraccion_Estado" CHECK ("ExtraccionDocumento"."Estado" IN ('pendiente', 'procesando', 'completada', 'fallida', 'no_aplica')),
	CONSTRAINT "CK_Extraccion_Error" CHECK ("ExtraccionDocumento"."ErrorCodigo" IS NULL OR "ExtraccionDocumento"."ErrorCodigo" IN ('not_configured', 'document_unavailable', 'unreadable_document', 'render_unavailable', 'timeout', 'model_error', 'invalid_response')),
	CONSTRAINT "CK_Extraccion_Reclamo" CHECK (("ExtraccionDocumento"."ReclamoId" IS NULL) = ("ExtraccionDocumento"."ReclamadaEn" IS NULL)),
	CONSTRAINT "CK_Extraccion_Procesando" CHECK (("ExtraccionDocumento"."Estado" = 'procesando') = ("ExtraccionDocumento"."ReclamoId" IS NOT NULL)),
	CONSTRAINT "CK_Extraccion_Fallida" CHECK ("ExtraccionDocumento"."Estado" <> 'fallida' OR "ExtraccionDocumento"."ErrorCodigo" IS NOT NULL),
	CONSTRAINT "CK_Extraccion_Completada" CHECK ("ExtraccionDocumento"."Estado" <> 'completada' OR ("ExtraccionDocumento"."ErrorCodigo" IS NULL AND "ExtraccionDocumento"."ProcesadoEn" IS NOT NULL AND "ExtraccionDocumento"."Motor" IS NOT NULL)),
	CONSTRAINT "CK_Extraccion_Datos" CHECK ("ExtraccionDocumento"."Estado" = 'completada' OR ("ExtraccionDocumento"."NombreEstudiante" IS NULL AND "ExtraccionDocumento"."Emisor" IS NULL AND "ExtraccionDocumento"."FechaEmision" IS NULL AND "ExtraccionDocumento"."ReposoDesde" IS NULL AND "ExtraccionDocumento"."ReposoHasta" IS NULL AND "ExtraccionDocumento"."ReposoDias" IS NULL)),
	CONSTRAINT "CK_Extraccion_Reposo" CHECK (("ExtraccionDocumento"."ReposoDias" IS NULL OR "ExtraccionDocumento"."ReposoDias" > 0) AND ("ExtraccionDocumento"."ReposoHasta" IS NULL OR "ExtraccionDocumento"."ReposoDesde" IS NULL OR "ExtraccionDocumento"."ReposoHasta" >= "ExtraccionDocumento"."ReposoDesde")),
	CONSTRAINT "CK_Extraccion_Intentos" CHECK ("ExtraccionDocumento"."Intentos" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ExtraccionDocumento" ADD CONSTRAINT "ExtraccionDocumento_DocumentoId_DocumentoRespaldo_Id_fk" FOREIGN KEY ("DocumentoId") REFERENCES "public"."DocumentoRespaldo"("Id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IX_Extraccion_Abierta" ON "ExtraccionDocumento" USING btree ("CreadaEn") WHERE "ExtraccionDocumento"."Estado" IN ('pendiente', 'procesando');