import "dotenv/config";

import { eq } from "drizzle-orm";

import { db, schema } from "@/db";

type FacultadSeed = {
  nombre: string;
  siglas?: string;
  carreras: string[];
};

// Fuente: https://www.uam.edu.ni/ (navegación y oferta académica publicada en el sitio).
const facultades: FacultadSeed[] = [
  {
    nombre: "Facultad de Ciencias Administrativas y Económicas",
    carreras: [
      "Administración de Empresas",
      "Contabilidad y Finanzas",
      "Economía Empresarial",
      "Negocios Internacionales",
    ],
  },
  {
    nombre:
      "Facultad de Ciencias Jurídicas, Humanidades y Relaciones Internacionales",
    carreras: ["Derecho", "Diplomacia y Relaciones Internacionales"],
  },
  {
    nombre: "Facultad de Ciencias Médicas",
    carreras: ["Medicina General", "Psicología", "Nutrición"],
  },
  {
    nombre: "Facultad de Ingeniería y Arquitectura",
    siglas: "FIA",
    carreras: [
      "Arquitectura",
      "Ingeniería Civil",
      "Ingeniería Industrial",
      "Ingeniería de Sistemas",
    ],
  },
  {
    nombre: "Facultad de Marketing, Diseño y Ciencias de la Comunicación",
    carreras: [
      "Marketing y Publicidad",
      "Diseño y Comunicación Visual",
      "Comunicación y Relaciones Públicas",
    ],
  },
  {
    nombre: "Facultad de Odontología",
    carreras: ["Odontología"],
  },
];

async function main() {
  for (const { nombre, siglas, carreras } of facultades) {
    const [fila] = await db
      .insert(schema.facultad)
      .values({ nombre, siglas })
      .onConflictDoNothing()
      .returning();

    const facultadId =
      fila?.id ??
      (
        await db
          .select({ id: schema.facultad.id })
          .from(schema.facultad)
          .where(eq(schema.facultad.nombre, nombre))
          .limit(1)
      )[0]?.id;

    if (!facultadId) {
      throw new Error(`No se pudo resolver el Id de la facultad "${nombre}"`);
    }

    await db
      .insert(schema.carrera)
      .values(
        carreras.map((carreraNombre) => ({
          nombre: carreraNombre,
          facultadId,
        })),
      )
      .onConflictDoNothing();
  }

  console.log("Seed de Facultad/Carrera completado.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
