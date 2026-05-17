import type { Config } from 'drizzle-kit';

export default {
  schema: [
    './src/schema/users.ts',
    './src/schema/projects.ts',
    './src/schema/project-pages.ts',
    './src/schema/project-memories.ts',
    './src/schema/usage-logs.ts',
    './src/schema/export-jobs.ts',
    './src/schema/project-collab-docs.ts',
  ],
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://youdesign:youdesign@localhost:5432/youdesign',
  },
  verbose: true,
  strict: true,
} satisfies Config;
