import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/env";
import { poolOptions } from "@/db/pool-options";
import * as schema from "@/db/schema";

const globalForDb = globalThis as unknown as {
  client: ReturnType<typeof postgres> | undefined;
};

const client =
  globalForDb.client ?? postgres(env.DATABASE_URL, poolOptions(env.NODE_ENV));

if (env.NODE_ENV !== "production") {
  globalForDb.client = client;
}

export const db = drizzle(client, { schema });

export { schema };
