import { db, schema } from '@you-design/db';
import { eq } from 'drizzle-orm';
import { logger } from './extensions/logger.js';

export interface AuthContext {
  projectId: string;
}

export async function authenticate(payload: { documentName: string }): Promise<AuthContext> {
  const { documentName } = payload;

  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, documentName),
  });

  if (!project) {
    logger.warn({ documentName }, 'collab join rejected: project not found');
    throw new Error(`project ${documentName} not found`);
  }

  return { projectId: documentName };
}
