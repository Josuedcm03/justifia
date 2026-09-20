CREATE TABLE "Rol" (
	"Id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "Rol_Id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"Codigo" varchar(20) NOT NULL,
	"Nombre" varchar(60) NOT NULL,
	CONSTRAINT "Rol_Codigo_unique" UNIQUE("Codigo")
);
--> statement-breakpoint
INSERT INTO "Rol" ("Codigo", "Nombre") VALUES ('estudiante','Estudiante'),('docente','Docente'),('coordinacion','Coordinación'),('secretaria','Secretaría'),('administrador','Administrador') ON CONFLICT ("Codigo") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "Usuario" ADD COLUMN "RolId" bigint;
--> statement-breakpoint
UPDATE "Usuario" u SET "RolId" = r."Id" FROM "Rol" r WHERE r."Codigo" = u."Rol";
--> statement-breakpoint
ALTER TABLE "Usuario" ALTER COLUMN "RolId" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_RolId_Rol_Id_fk" FOREIGN KEY ("RolId") REFERENCES "public"."Rol"("Id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "Usuario" DROP COLUMN "Rol";