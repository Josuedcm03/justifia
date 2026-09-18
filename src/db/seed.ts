import "dotenv/config";

import { db, schema } from "@/db";
import { hashPassword } from "@/lib/auth/password";

async function main() {
  const hash = await hashPassword("Cambiar123");

  await db
    .insert(schema.usuario)
    .values([
      {
        login: "bratty",
        hashClave: hash,
        rol: "administrador",
        nombreCompleto: "Armando Alguera",
        correo: "analguera@uam.edu.ni",
      },
      {
        login: "jdkno",
        hashClave: hash,
        rol: "secretaria",
        nombreCompleto: "Josue Cano",
        correo: "jdcano@uam.edu.ni",
      },
      {
        login: "administrador",
        hashClave: hash,
        rol: "administrador",
        nombreCompleto: "administrador fia",
        correo: "admin@uam.edu.ni",
      },
    ])
    .onConflictDoNothing();

  console.log(
    'Seed completado. Contraseña de todos los usuarios: "Cambiar123"',
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
