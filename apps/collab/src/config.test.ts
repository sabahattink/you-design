import { describe, expect, it } from 'vitest';
import { parseCollabEnv } from './config.js';

const BASE = {
  DATABASE_URL: 'postgresql://youdesign:youdesign@localhost:5434/youdesign',
  COLLAB_TOKEN_SECRET: 'x'.repeat(32),
};

describe('parseCollabEnv', () => {
  it('applies defaults', () => {
    const result = parseCollabEnv(BASE);
    expect(result.success && result.data).toMatchObject({
      NODE_ENV: 'development',
      COLLAB_PORT: 3002,
      COLLAB_TOKEN_SECRET: BASE.COLLAB_TOKEN_SECRET,
    });
  });

  it('requires COLLAB_TOKEN_SECRET', () => {
    const result = parseCollabEnv({ DATABASE_URL: BASE.DATABASE_URL });
    expect(result.success).toBe(false);
    expect(!result.success && result.error.flatten().fieldErrors.COLLAB_TOKEN_SECRET).toBeTruthy();
  });

  it('rejects a secret shorter than 32 characters', () => {
    const result = parseCollabEnv({ ...BASE, COLLAB_TOKEN_SECRET: 'short' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty secret (the .env.example placeholder)', () => {
    expect(parseCollabEnv({ ...BASE, COLLAB_TOKEN_SECRET: '' }).success).toBe(false);
  });

  it('coerces COLLAB_PORT', () => {
    const result = parseCollabEnv({ ...BASE, COLLAB_PORT: '4002' });
    expect(result.success && result.data.COLLAB_PORT).toBe(4002);
  });
});
