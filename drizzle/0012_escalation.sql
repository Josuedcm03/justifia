CREATE TABLE "Escalamiento" (
	"Id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "Escalamiento_Id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"SolicitudId" bigint NOT NULL,
	"Tipo" varchar(30) NOT NULL,
	"EstadoPrevio" varchar(30) NOT NULL,
	"Nota" varchar(1000),
	"ReporteId" bigint,
	"SecretariaId" bigint NOT NULL,
	"CreadoEn" timestamp with time zone DEFAULT now() NOT NULL,
	"Respuesta" varchar(1000),
	"RespondidaPorId" bigint,
	"RespondidaEn" timestamp with time zone,
	"NotificacionEstado" varchar(20) DEFAULT 'pendiente' NOT NULL,
	"NotificacionMotivo" varchar(30),
	"Intentos" smallint DEFAULT 0 NOT NULL,
	"ReclamoId" uuid,
	"ReclamadaEn" timestamp with time zone,
	"EnviadaEn" timestamp with time zone,
	"ProveedorMensajeId" varchar(100),
	"ActualizadaEn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "CK_Escalamiento_Tipo" CHECK ("Escalamiento"."Tipo" IN ('sospecha_documento', 'exceso_inasistencias')),
	CONSTRAINT "CK_Escalamiento_Kind" CHECK (("Escalamiento"."Tipo" = 'sospecha_documento' AND "Escalamiento"."EstadoPrevio" = 'pendiente' AND "Escalamiento"."ReporteId" IS NULL AND "Escalamiento"."Nota" IS NOT NULL AND length(btrim("Escalamiento"."Nota")) > 0) OR ("Escalamiento"."Tipo" = 'exceso_inasistencias' AND "Escalamiento"."EstadoPrevio" = 'aprobada' AND "Escalamiento"."ReporteId" IS NOT NULL AND "Escalamiento"."Nota" IS NULL)),
	CONSTRAINT "CK_Escalamiento_Respuesta" CHECK (("Escalamiento"."Respuesta" IS NULL) = ("Escalamiento"."RespondidaPorId" IS NULL) AND ("Escalamiento"."Respuesta" IS NULL) = ("Escalamiento"."RespondidaEn" IS NULL) AND ("Escalamiento"."Respuesta" IS NULL OR (length(btrim("Escalamiento"."Respuesta")) > 0 AND "Escalamiento"."RespondidaEn" >= "Escalamiento"."CreadoEn"))),
	CONSTRAINT "CK_Escalamiento_SinRespuesta" CHECK ("Escalamiento"."Tipo" = 'sospecha_documento' OR "Escalamiento"."RespondidaEn" IS NULL),
	CONSTRAINT "CK_Escalamiento_NotificacionEstado" CHECK ("Escalamiento"."NotificacionEstado" IN ('pendiente', 'enviada', 'bloqueada')),
	CONSTRAINT "CK_Escalamiento_NotificacionMotivo" CHECK ("Escalamiento"."NotificacionMotivo" IS NULL OR "Escalamiento"."NotificacionMotivo" IN ('sin_destinatarios', 'error_envio')),
	CONSTRAINT "CK_Escalamiento_Enviada" CHECK (("Escalamiento"."NotificacionEstado" = 'enviada') = ("Escalamiento"."EnviadaEn" IS NOT NULL)),
	CONSTRAINT "CK_Escalamiento_MotivoEstado" CHECK (("Escalamiento"."NotificacionEstado" <> 'enviada' OR "Escalamiento"."NotificacionMotivo" IS NULL) AND ("Escalamiento"."NotificacionEstado" <> 'bloqueada' OR ("Escalamiento"."NotificacionMotivo" IS NOT NULL AND "Escalamiento"."NotificacionMotivo" = 'sin_destinatarios')) AND ("Escalamiento"."NotificacionEstado" <> 'pendiente' OR "Escalamiento"."NotificacionMotivo" IS NULL OR "Escalamiento"."NotificacionMotivo" = 'error_envio')),
	CONSTRAINT "CK_Escalamiento_Reclamo" CHECK (("Escalamiento"."ReclamoId" IS NULL) = ("Escalamiento"."ReclamadaEn" IS NULL)),
	CONSTRAINT "CK_Escalamiento_Intentos" CHECK ("Escalamiento"."Intentos" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ReporteInasistencia" (
	"Id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ReporteInasistencia_Id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"SolicitudId" bigint NOT NULL,
	"DocenteId" bigint NOT NULL,
	"DocenteNombre" varchar(160) NOT NULL,
	"ComunicadoEl" date NOT NULL,
	"Nota" varchar(1000),
	"RegistradoPorId" bigint NOT NULL,
	"RegistradoEn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "CK_ReporteInasistencia_Nota" CHECK ("ReporteInasistencia"."Nota" IS NULL OR length(btrim("ReporteInasistencia"."Nota")) > 0)
);
--> statement-breakpoint
DROP INDEX "IX_Solicitud_Cola";--> statement-breakpoint
ALTER TABLE "Solicitud" ADD COLUMN "PlazoInicioEn" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "Escalamiento" ADD CONSTRAINT "Escalamiento_SolicitudId_Solicitud_Id_fk" FOREIGN KEY ("SolicitudId") REFERENCES "public"."Solicitud"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Escalamiento" ADD CONSTRAINT "Escalamiento_ReporteId_ReporteInasistencia_Id_fk" FOREIGN KEY ("ReporteId") REFERENCES "public"."ReporteInasistencia"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Escalamiento" ADD CONSTRAINT "Escalamiento_SecretariaId_Usuario_Id_fk" FOREIGN KEY ("SecretariaId") REFERENCES "public"."Usuario"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Escalamiento" ADD CONSTRAINT "Escalamiento_RespondidaPorId_Usuario_Id_fk" FOREIGN KEY ("RespondidaPorId") REFERENCES "public"."Usuario"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ReporteInasistencia" ADD CONSTRAINT "ReporteInasistencia_SolicitudId_Solicitud_Id_fk" FOREIGN KEY ("SolicitudId") REFERENCES "public"."Solicitud"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ReporteInasistencia" ADD CONSTRAINT "ReporteInasistencia_DocenteId_Usuario_Id_fk" FOREIGN KEY ("DocenteId") REFERENCES "public"."Usuario"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ReporteInasistencia" ADD CONSTRAINT "ReporteInasistencia_RegistradoPorId_Usuario_Id_fk" FOREIGN KEY ("RegistradoPorId") REFERENCES "public"."Usuario"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "UX_Escalamiento_Abierto" ON "Escalamiento" USING btree ("SolicitudId") WHERE "Escalamiento"."Tipo" = 'sospecha_documento' AND "Escalamiento"."RespondidaEn" IS NULL;--> statement-breakpoint
CREATE INDEX "IX_Escalamiento_Pendiente" ON "Escalamiento" USING btree ("CreadoEn","Id") WHERE "Escalamiento"."NotificacionEstado" = 'pendiente';--> statement-breakpoint
CREATE INDEX "IX_Escalamiento_Solicitud" ON "Escalamiento" USING btree ("SolicitudId","CreadoEn");--> statement-breakpoint
CREATE INDEX "IX_ReporteInasistencia_Solicitud" ON "ReporteInasistencia" USING btree ("SolicitudId");--> statement-breakpoint
CREATE INDEX "IX_Solicitud_Cola" ON "Solicitud" USING btree (coalesce("PlazoInicioEn", "ReenviadaEn", "PresentadaEn"),"Id") WHERE "Solicitud"."Estado" = 'pendiente';--> statement-breakpoint
ALTER TABLE "Solicitud" ADD CONSTRAINT "CK_Solicitud_PlazoInicio" CHECK ("Solicitud"."PlazoInicioEn" IS NULL OR "Solicitud"."PlazoInicioEn" >= coalesce("Solicitud"."ReenviadaEn", "Solicitud"."PresentadaEn"));