import { eq, sql } from 'drizzle-orm';
import type { Database } from '@you-design/db';
import { schema } from '@you-design/db';

/**
 * Persistence for the per-project collab token version (M5c revocation).
 * `null` means the project does not exist.
 */
export interface CollabTokenStore {
  getTokenVersion(projectId: string): Promise<number | null>;
  bumpTokenVersion(projectId: string): Promise<number | null>;
}

export function createDrizzleCollabTokenStore(db: Database): CollabTokenStore {
  return {
    async getTokenVersion(projectId) {
      const [row] = await db
        .select({ version: schema.projects.collabTokenVersion })
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId));
      return row?.version ?? null;
    },
    async bumpTokenVersion(projectId) {
      // Single atomic UPDATE … RETURNING: concurrent revokes cannot lose a bump.
      const [row] = await db
        .update(schema.projects)
        .set({ collabTokenVersion: sql`${schema.projects.collabTokenVersion} + 1` })
        .where(eq(schema.projects.id, projectId))
        .returning({ version: schema.projects.collabTokenVersion });
      return row?.version ?? null;
    },
  };
}
