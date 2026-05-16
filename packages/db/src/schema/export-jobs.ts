import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects.js';

export const exportJobs = pgTable('export_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  format: text('format').notNull(),
  status: text('status').notNull().default('pending'),
  filePath: text('file_path'),
  errorMsg: text('error_msg'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ExportJob = typeof exportJobs.$inferSelect;
export type NewExportJob = typeof exportJobs.$inferInsert;
