import { z } from 'zod';

export const AnalyticsSummary = z.object({
  pages: z.array(z.object({
    path: z.string(),
    views: z.number().int(),
    clicks: z.number().int(),
    ctr: z.number(),
  })),
  totalViews: z.number().int(),
  period: z.string(),
  fetchedAt: z.number(),
});
export type AnalyticsSummary = z.infer<typeof AnalyticsSummary>;

export const AnalyticsConfig = z.object({
  postHogApiKey: z.string().min(1),
  postHogProjectId: z.string().min(1),
  postHogHost: z.string().url().default('https://app.posthog.com'),
  deployedBaseUrl: z.string().url().optional(),
});
export type AnalyticsConfig = z.infer<typeof AnalyticsConfig>;
