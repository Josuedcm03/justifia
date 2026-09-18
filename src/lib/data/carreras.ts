import "server-only";

import { asc } from "drizzle-orm";

import { db } from "@/db";
import { carrera, type Carrera } from "@/db/schema";

export async function listCarreras(): Promise<Carrera[]> {
  return db.select().from(carrera).orderBy(asc(carrera.nombre));
}
