CREATE TABLE "Usuario" (
	"Id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "Usuario_Id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"Login" varchar(60) NOT NULL,
	"HashClave" varchar(255) NOT NULL,
	"Rol" varchar(20) NOT NULL,
	"NombreCompleto" varchar(160) NOT NULL,
	"Correo" varchar(160),
	"Telefono" varchar(30),
	"Cif" varchar(20),
	"CarreraId" bigint,
	"Activo" boolean DEFAULT true NOT NULL,
	"CreadoEn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "Usuario_Login_unique" UNIQUE("Login"),
	CONSTRAINT "Usuario_Cif_unique" UNIQUE("Cif")
);
