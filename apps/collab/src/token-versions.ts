import { db, schema } from '@you-design/db';
import { eq } from 'drizzle-orm';
import type { TokenVersionLookup } from './auth.js';

/** Reads `projects.collab_token_version`; null when the project does not exist. */
export const lookupTokenVersion: TokenVersionLookup = async (projectId) => {
  const [row] = await db
    .select({ version: schema.projects.collabTokenVersion })
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId));
  return row?.version ?? null;
};
