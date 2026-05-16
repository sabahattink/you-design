import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://youdesign:youdesign@localhost:5432/youdesign';

const queryClient = postgres(connectionString, { max: 10 });
export const db = drizzle(queryClient, { schema });

export { schema };
export type Database = typeof db;
