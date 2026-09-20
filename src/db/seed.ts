import "dotenv/config";

import { db, schema } from "@/db";
import { hashPassword } from "@/lib/auth/password";
import { getRolIdByCodigo } from "@/lib/data/roles";

async function main() {
  const hash = await hashPassword("Cambiar123");
  // Roles must be seeded first (db:seed chains db:seed:roles before this
  // script); resolve the codes to catalog ids before inserting users.
  const [administradorId, secretariaId] = await Promise.all([
    getRolIdByCodigo("administrador"),
    getRolIdByCodigo("secretaria"),
  ]);

  await db
    .insert(schema.usuario)
    .values([
      {
        login: "bratty",
        hashClave: hash,
        rolId: administradorId,
        nombreCompleto: "Armando Alguera",
        correo: "analguera@uam.edu.ni",
      },
      {
        login: "jdkno",
        hashClave: hash,
        rolId: secretariaId,
        nombreCompleto: "Josue Cano",
        correo: "jdcano@uam.edu.ni",
      },
      {
        login: "administrador",
        hashClave: hash,
        rolId: administradorId,
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
