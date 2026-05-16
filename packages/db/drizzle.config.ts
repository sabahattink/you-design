import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://youdesign:youdesign@localhost:5432/youdesign',
  },
  verbose: true,
  strict: true,
} satisfies Config;
