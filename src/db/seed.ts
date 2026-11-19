import "dotenv/config";

import { db, schema } from "@/db";
import { hashPassword } from "@/lib/auth/password";
import { getRolIdByCodigo } from "@/lib/data/roles";

/** The staff password comes from the environment, never from the source or
 *  the console: a missing or short value stops the seed before any write. */
function seedPassword(): string {
  const value = process.env.SEED_PASSWORD;
  if (!value || value.length < 8) {
    throw new Error("SEED_PASSWORD must be set (8 characters or more).");
  }
  return value;
}

async function main() {
  const hash = await hashPassword(seedPassword());
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

  console.log("Seed completado. Contraseña: la de SEED_PASSWORD.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
