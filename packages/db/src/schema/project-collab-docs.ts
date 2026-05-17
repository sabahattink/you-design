import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const projectCollabDocs = pgTable('project_collab_docs', {
  projectId: uuid('project_id')
    .primaryKey()
    .references(() => projects.id, { onDelete: 'cascade' }),
  yjsState: text('yjs_state').notNull(),
  version: integer('version').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ProjectCollabDoc = typeof projectCollabDocs.$inferSelect;
export type NewProjectCollabDoc = typeof projectCollabDocs.$inferInsert;
