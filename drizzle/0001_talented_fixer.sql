CREATE TABLE "Carrera" (
	"Id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "Carrera_Id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"Nombre" varchar(160) NOT NULL,
	"FacultadId" bigint NOT NULL,
	CONSTRAINT "Carrera_Nombre_unique" UNIQUE("Nombre")
);
--> statement-breakpoint
CREATE TABLE "Facultad" (
	"Id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "Facultad_Id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"Nombre" varchar(160) NOT NULL,
	"Siglas" varchar(16),
	CONSTRAINT "Facultad_Nombre_unique" UNIQUE("Nombre")
);
--> statement-breakpoint
ALTER TABLE "Carrera" ADD CONSTRAINT "Carrera_FacultadId_Facultad_Id_fk" FOREIGN KEY ("FacultadId") REFERENCES "public"."Facultad"("Id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_CarreraId_Carrera_Id_fk" FOREIGN KEY ("CarreraId") REFERENCES "public"."Carrera"("Id") ON DELETE no action ON UPDATE no action;