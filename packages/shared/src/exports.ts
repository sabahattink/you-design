import { z } from 'zod';

export const ExportFormat = z.enum(['html', 'pdf', 'pptx']);
export type ExportFormat = z.infer<typeof ExportFormat>;

export const CreateExportBody = z.object({
  projectId: z.string().uuid(),
  format: ExportFormat,
});

export const ExportJobStatus = z.object({
  id: z.string().uuid(),
  format: ExportFormat,
  status: z.enum(['pending', 'processing', 'done', 'failed']),
  errorMsg: z.string().nullable(),
});
export type ExportJobStatusType = z.infer<typeof ExportJobStatus>;
