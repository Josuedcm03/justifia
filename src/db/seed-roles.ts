import "dotenv/config";

import { db, schema } from "@/db";
import { rolesSeed } from "@/db/roles-seed-data";

async function main() {
  await db.insert(schema.rol).values(rolesSeed).onConflictDoNothing();

  console.log("Seed de Rol completado.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
