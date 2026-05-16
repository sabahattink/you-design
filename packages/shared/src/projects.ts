import { z } from 'zod';

export const ProjectPage = z.object({
  path: z.string().min(1),
  title: z.string().min(1),
  html: z.string(),
});

export const ProjectMeta = z.object({
  id: z.string().uuid(),
  name: z.string(),
  intentPhase: z.string(),
  pageCount: z.number().int(),
  updatedAt: z.string(),
});

export const ProjectFull = ProjectMeta.extend({
  intentContract: z.unknown().nullable(),
  pages: z.array(ProjectPage),
});

export const ProjectPatch = z.object({
  name: z.string().min(1).max(120).optional(),
  intentPhase: z.string().optional(),
  intentContract: z.unknown().optional(),
  pages: z.array(ProjectPage).optional(),
});

export const CreateProjectBody = z.object({ name: z.string().min(1).max(120) });

export const MemoryStoreBody = z.object({
  summary: z.string().min(1),
  openAiKey: z.string().optional(),
});

export type ProjectPageType = z.infer<typeof ProjectPage>;
export type ProjectMetaType = z.infer<typeof ProjectMeta>;
export type ProjectFullType = z.infer<typeof ProjectFull>;
export type ProjectPatchType = z.infer<typeof ProjectPatch>;
