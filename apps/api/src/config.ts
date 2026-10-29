import { z } from 'zod';
import { COLLAB_TOKEN_SECRET_MIN_LENGTH } from '@you-design/shared';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_CORS_ORIGINS: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  QUEUE_CONCURRENCY: z.coerce.number().int().positive().default(4),

  // Optional server-side BYOK fallbacks. Per-request keys from the client
  // override these. None are required to boot.
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),

  // M5c: signs collab capability tokens. Must match apps/collab.
  COLLAB_TOKEN_SECRET: z
    .string({ required_error: 'required — generate one with `openssl rand -base64 48`' })
    .min(
      COLLAB_TOKEN_SECRET_MIN_LENGTH,
      `must be at least ${COLLAB_TOKEN_SECRET_MIN_LENGTH} characters (openssl rand -base64 48)`,
    ),

  TELEMETRY_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v.toLowerCase() === 'true'),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:');
    console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
