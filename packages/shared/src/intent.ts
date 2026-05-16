import { z } from 'zod';

export const Persona = z.object({
  role: z.string(),
  context: z.string().optional(),
  painPoint: z.string().optional(),
});
export type Persona = z.infer<typeof Persona>;

export const SuccessMetric = z.object({
  name: z.string(),
  target: z.string(),
  unit: z.string().optional(),
});
export type SuccessMetric = z.infer<typeof SuccessMetric>;

export const Emotion = z.enum([
  'calm',
  'urgent',
  'playful',
  'serious',
  'warm',
  'cold',
  'energetic',
  'minimal',
]);
export type Emotion = z.infer<typeof Emotion>;

export const Domain = z.enum([
  'general',
  'healthcare',
  'fintech',
  'ecommerce',
  'saas',
  'education',
  'media',
  'government',
]);
export type Domain = z.infer<typeof Domain>;

export const IntentContract = z.object({
  persona: Persona,
  primaryAction: z.string(),
  emotion: Emotion,
  domain: Domain,
  successMetrics: z.array(SuccessMetric).min(1),
  constraints: z.array(z.string()).default([]),
});
export type IntentContract = z.infer<typeof IntentContract>;
