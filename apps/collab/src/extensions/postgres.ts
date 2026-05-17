import { Database } from '@hocuspocus/extension-database';
import { db, schema } from '@you-design/db';
import { eq } from 'drizzle-orm';
import { logger } from './logger.js';

export function createPostgresExtension() {
  return new Database({
    fetch: async ({ documentName }) => {
      try {
        const row = await db.query.projectCollabDocs.findFirst({
          where: eq(schema.projectCollabDocs.projectId, documentName),
        });
        if (!row?.yjsState) return null;
        return new Uint8Array(Buffer.from(row.yjsState, 'base64'));
      } catch (err) {
        logger.error({ err, documentName }, 'failed to load Y.Doc');
        return null;
      }
    },
    store: async ({ documentName, state }) => {
      const yjsState = Buffer.from(state).toString('base64');
      try {
        await db
          .insert(schema.projectCollabDocs)
          .values({ projectId: documentName, yjsState })
          .onConflictDoUpdate({
            target: schema.projectCollabDocs.projectId,
            set: { yjsState, updatedAt: new Date() },
          });
        logger.debug({ documentName, bytes: state.length }, 'persisted Y.Doc');
      } catch (err) {
        logger.error({ err, documentName }, 'failed to persist Y.Doc');
        throw err;
      }
    },
  });
}
