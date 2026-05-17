import { z } from 'zod';

export const ExportFormat = z.enum(['html', 'pdf', 'pptx', 'mp4', 'gif']);
export type ExportFormat = z.infer<typeof ExportFormat>;

export const MotionExportOptions = z.object({
  durationPerPage: z.number().int().min(1).max(30).default(3),
  transitionDuration: z.number().min(0).max(2).default(0.5),
  fps: z.number().int().min(10).max(60).default(24),
  resolution: z.enum(['720p', '1080p']).default('720p'),
  transition: z.enum(['fade', 'slideleft', 'wipeleft']).default('fade'),
});
export type MotionExportOptions = z.infer<typeof MotionExportOptions>;

export const CreateExportBody = z.object({
  projectId: z.string().uuid(),
  format: ExportFormat,
  motionOptions: MotionExportOptions.optional(),
});

export const ExportJobStatus = z.object({
  id: z.string().uuid(),
  format: ExportFormat,
  status: z.enum(['pending', 'processing', 'done', 'failed']),
  errorMsg: z.string().nullable(),
});
export type ExportJobStatusType = z.infer<typeof ExportJobStatus>;
