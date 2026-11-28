CREATE TABLE "ParametroNormativo" (
	"Id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ParametroNormativo_Id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"Clave" varchar(60) NOT NULL,
	"Valor" jsonb NOT NULL,
	"VigenteDesde" date NOT NULL,
	CONSTRAINT "UQ_ParametroNormativo_Clave_Vigencia" UNIQUE("Clave","VigenteDesde")
);
--> statement-breakpoint
-- Hand-appended below the generated statement (normative-parameters, NP-16,
-- design A5). The Reglamento defaults as stored rows, so the loader reads data
-- from the first request. Dated with a fixed literal, not CURRENT_DATE: in
-- force at once, independent of the database time zone, and the same on every
-- branch. Idempotent: a re-run keeps whatever a row already holds.
INSERT INTO "ParametroNormativo" ("Clave", "Valor", "VigenteDesde") VALUES
	('plazo_remision_dias', '2'::jsonb, '2026-01-01'),
	('alerta_dias', '1'::jsonb, '2026-01-01'),
	('presentacion_tardia_dias', '2'::jsonb, '2026-01-01'),
	('ventana_presentacion_dias', '30'::jsonb, '2026-01-01'),
	('umbral_reincidencia', '3'::jsonb, '2026-01-01'),
	('tamano_maximo_mib', '10'::jsonb, '2026-01-01'),
	('calendario', '[{"fecha":"2026-01-01","descripcion":"Anio Nuevo"},{"fecha":"2026-03-30","descripcion":"Semana Santa"},{"fecha":"2026-03-31","descripcion":"Semana Santa"},{"fecha":"2026-04-01","descripcion":"Semana Santa"},{"fecha":"2026-04-02","descripcion":"Semana Santa"},{"fecha":"2026-04-03","descripcion":"Semana Santa"},{"fecha":"2026-05-01","descripcion":"Dia del Trabajo"},{"fecha":"2026-05-30","descripcion":"Dia de las Madres"},{"fecha":"2026-07-19","descripcion":"Dia de la Revolucion"},{"fecha":"2026-08-01","descripcion":"Santo Domingo, bajada (Managua)"},{"fecha":"2026-08-10","descripcion":"Santo Domingo, subida (Managua)"},{"fecha":"2026-09-14","descripcion":"Batalla de San Jacinto"},{"fecha":"2026-09-15","descripcion":"Independencia"},{"fecha":"2026-12-08","descripcion":"Inmaculada Concepcion"},{"fecha":"2026-12-25","descripcion":"Navidad"},{"fecha":"2027-01-01","descripcion":"Anio Nuevo"},{"fecha":"2027-03-22","descripcion":"Semana Santa"},{"fecha":"2027-03-23","descripcion":"Semana Santa"},{"fecha":"2027-03-24","descripcion":"Semana Santa"},{"fecha":"2027-03-25","descripcion":"Semana Santa"},{"fecha":"2027-03-26","descripcion":"Semana Santa"},{"fecha":"2027-05-01","descripcion":"Dia del Trabajo"},{"fecha":"2027-05-30","descripcion":"Dia de las Madres"},{"fecha":"2027-07-19","descripcion":"Dia de la Revolucion"},{"fecha":"2027-08-01","descripcion":"Santo Domingo, bajada (Managua)"},{"fecha":"2027-08-10","descripcion":"Santo Domingo, subida (Managua)"},{"fecha":"2027-09-14","descripcion":"Batalla de San Jacinto"},{"fecha":"2027-09-15","descripcion":"Independencia"},{"fecha":"2027-12-08","descripcion":"Inmaculada Concepcion"},{"fecha":"2027-12-25","descripcion":"Navidad"}]'::jsonb, '2026-01-01'),
	('causas', '[{"codigo":"maternidad_paternidad","activa":true,"posicion":1},{"codigo":"actividad_representativa","activa":true,"posicion":2},{"codigo":"intercambio_academico","activa":true,"posicion":3},{"codigo":"medica","activa":true,"posicion":4},{"codigo":"fuerza_mayor","activa":true,"posicion":5}]'::jsonb, '2026-01-01'),
	('tipo_documento_causa', '{"constancia_medica":["medica","maternidad_paternidad"],"constancia_institucional":["actividad_representativa","intercambio_academico","fuerza_mayor"],"otro":[]}'::jsonb, '2026-01-01')
ON CONFLICT ("Clave","VigenteDesde") DO NOTHING;
