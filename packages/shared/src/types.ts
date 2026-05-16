import { z } from 'zod';

export const ProjectId = z.string().uuid().brand<'ProjectId'>();
export type ProjectId = z.infer<typeof ProjectId>;

export const UserId = z.string().uuid().brand<'UserId'>();
export type UserId = z.infer<typeof UserId>;

export const Project = z.object({
  id: ProjectId,
  name: z.string().min(1).max(120),
  ownerId: UserId,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Project = z.infer<typeof Project>;

export const ApiError = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiError>;
