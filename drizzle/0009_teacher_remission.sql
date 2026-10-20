CREATE TABLE "Remision" (
	"Id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "Remision_Id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"SolicitudId" bigint NOT NULL,
	"DocenteId" bigint NOT NULL,
	"DocenteNombre" varchar(160) NOT NULL,
	"Correo" varchar(160),
	"Clases" jsonb NOT NULL,
	"Estado" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"MotivoCodigo" varchar(40),
	"Intentos" smallint DEFAULT 0 NOT NULL,
	"ReclamoId" uuid,
	"ReclamadaEn" timestamp with time zone,
	"EnviadaEn" timestamp with time zone,
	"ProveedorMensajeId" varchar(100),
	"CreadaEn" timestamp with time zone DEFAULT now() NOT NULL,
	"ActualizadaEn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "UQ_Remision_SolicitudDocente" UNIQUE("SolicitudId","DocenteId"),
	CONSTRAINT "CK_Remision_Estado" CHECK ("Remision"."Estado" IN ('pendiente', 'enviada', 'bloqueada')),
	CONSTRAINT "CK_Remision_Motivo" CHECK ("Remision"."MotivoCodigo" IS NULL OR "Remision"."MotivoCodigo" IN ('sin_correo', 'formato_especial_faltante', 'adjuntos_exceden_limite', 'error_envio')),
	CONSTRAINT "CK_Remision_Enviada" CHECK (("Remision"."Estado" = 'enviada') = ("Remision"."EnviadaEn" IS NOT NULL)),
	CONSTRAINT "CK_Remision_MotivoEstado" CHECK (("Remision"."Estado" <> 'enviada' OR "Remision"."MotivoCodigo" IS NULL) AND ("Remision"."Estado" <> 'bloqueada' OR ("Remision"."MotivoCodigo" IS NOT NULL AND "Remision"."MotivoCodigo" <> 'error_envio')) AND ("Remision"."Estado" <> 'pendiente' OR "Remision"."MotivoCodigo" IS NULL OR "Remision"."MotivoCodigo" = 'error_envio')),
	CONSTRAINT "CK_Remision_Correo" CHECK ("Remision"."Correo" IS NOT NULL OR "Remision"."MotivoCodigo" = 'sin_correo'),
	CONSTRAINT "CK_Remision_Reclamo" CHECK (("Remision"."ReclamoId" IS NULL) = ("Remision"."ReclamadaEn" IS NULL)),
	CONSTRAINT "CK_Remision_Intentos" CHECK ("Remision"."Intentos" >= 0)
);
--> statement-breakpoint
ALTER TABLE "DocumentoRespaldo" ADD COLUMN "SubidoPorId" bigint;--> statement-breakpoint
ALTER TABLE "DocumentoRespaldo" ADD COLUMN "FormatoEspecial" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Solicitud" ADD COLUMN "FormatoEspecial" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Remision" ADD CONSTRAINT "Remision_SolicitudId_Solicitud_Id_fk" FOREIGN KEY ("SolicitudId") REFERENCES "public"."Solicitud"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Remision" ADD CONSTRAINT "Remision_DocenteId_Usuario_Id_fk" FOREIGN KEY ("DocenteId") REFERENCES "public"."Usuario"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IX_Remision_Pendiente" ON "Remision" USING btree ("CreadaEn","Id") WHERE "Remision"."Estado" = 'pendiente';--> statement-breakpoint
CREATE INDEX "IX_Remision_Solicitud" ON "Remision" USING btree ("SolicitudId");--> statement-breakpoint
ALTER TABLE "DocumentoRespaldo" ADD CONSTRAINT "DocumentoRespaldo_SubidoPorId_Usuario_Id_fk" FOREIGN KEY ("SubidoPorId") REFERENCES "public"."Usuario"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "UX_Documento_FormatoEspecial" ON "DocumentoRespaldo" USING btree ("SolicitudId") WHERE "DocumentoRespaldo"."FormatoEspecial";--> statement-breakpoint
ALTER TABLE "DocumentoRespaldo" ADD CONSTRAINT "CK_Documento_FormatoEspecial" CHECK ("DocumentoRespaldo"."FormatoEspecial" = ("DocumentoRespaldo"."SubidoPorId" IS NOT NULL) AND (NOT "DocumentoRespaldo"."FormatoEspecial" OR "DocumentoRespaldo"."Estado" = 'valido'));--> statement-breakpoint
ALTER TABLE "Solicitud" ADD CONSTRAINT "CK_Solicitud_FormatoEspecial" CHECK (NOT "Solicitud"."FormatoEspecial" OR ("Solicitud"."Estado" = 'aprobada' AND "Solicitud"."Causa" = 'fuerza_mayor'));