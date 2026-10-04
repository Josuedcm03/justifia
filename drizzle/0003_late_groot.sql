CREATE TABLE "Asignatura" (
	"Id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "Asignatura_Id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"Codigo" varchar(32) NOT NULL,
	"Nombre" varchar(160) NOT NULL,
	"CarreraId" bigint NOT NULL,
	"HorasTotales" integer NOT NULL,
	CONSTRAINT "Asignatura_Codigo_unique" UNIQUE("Codigo"),
	CONSTRAINT "CK_Asignatura_Horas" CHECK ("Asignatura"."HorasTotales" > 0)
);
--> statement-breakpoint
CREATE TABLE "Grupo" (
	"Id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "Grupo_Id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"AsignaturaId" bigint NOT NULL,
	"Periodo" varchar(12) NOT NULL,
	"NumeroGrupo" varchar(12) NOT NULL,
	"DocenteId" bigint NOT NULL,
	"Activo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "Grupo_AsignaturaId_Periodo_NumeroGrupo_unique" UNIQUE("AsignaturaId","Periodo","NumeroGrupo")
);
--> statement-breakpoint
CREATE TABLE "Inscripcion" (
	"EstudianteId" bigint NOT NULL,
	"GrupoId" bigint NOT NULL,
	"Activo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "Inscripcion_EstudianteId_GrupoId_pk" PRIMARY KEY("EstudianteId","GrupoId")
);
--> statement-breakpoint
ALTER TABLE "Usuario" ADD COLUMN "DebeCambiarClave" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Asignatura" ADD CONSTRAINT "Asignatura_CarreraId_Carrera_Id_fk" FOREIGN KEY ("CarreraId") REFERENCES "public"."Carrera"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_AsignaturaId_Asignatura_Id_fk" FOREIGN KEY ("AsignaturaId") REFERENCES "public"."Asignatura"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Grupo" ADD CONSTRAINT "Grupo_DocenteId_Usuario_Id_fk" FOREIGN KEY ("DocenteId") REFERENCES "public"."Usuario"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_EstudianteId_Usuario_Id_fk" FOREIGN KEY ("EstudianteId") REFERENCES "public"."Usuario"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Inscripcion" ADD CONSTRAINT "Inscripcion_GrupoId_Grupo_Id_fk" FOREIGN KEY ("GrupoId") REFERENCES "public"."Grupo"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IX_Grupo_Docente" ON "Grupo" USING btree ("DocenteId");--> statement-breakpoint
CREATE INDEX "IX_Grupo_Activo" ON "Grupo" USING btree ("AsignaturaId","Periodo") WHERE "Grupo"."Activo";--> statement-breakpoint
CREATE INDEX "IX_Inscripcion_Grupo" ON "Inscripcion" USING btree ("GrupoId");--> statement-breakpoint
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_Correo_unique" UNIQUE("Correo");