import { z } from 'zod';
import { COLLAB_TOKEN_SECRET_MIN_LENGTH } from '@you-design/shared';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),
  COLLAB_PORT: z.coerce.number().int().positive().default(3002),
  DATABASE_URL: z.string().url(),
  COLLAB_TOKEN_SECRET: z
    .string({ required_error: 'required — generate one with `openssl rand -base64 48`' })
    .min(
      COLLAB_TOKEN_SECRET_MIN_LENGTH,
      `must be at least ${COLLAB_TOKEN_SECRET_MIN_LENGTH} characters (openssl rand -base64 48)`,
    ),
});

export type CollabEnv = z.infer<typeof EnvSchema>;

export function parseCollabEnv(
  source: Record<string, string | undefined>,
): ReturnType<typeof EnvSchema.safeParse> {
  return EnvSchema.safeParse(source);
}

/** Validates process.env at startup; exits with a readable error otherwise. */
export function loadCollabEnv(): CollabEnv {
  const result = parseCollabEnv(process.env);
  if (!result.success) {
    // Logger may not be configured yet; mirror apps/api/src/config.ts.
    console.error('Invalid environment variables for apps/collab:');
    console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));
    process.exit(1);
  }
  return result.data;
}
