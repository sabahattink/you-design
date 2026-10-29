import { Hocuspocus } from '@hocuspocus/server';
import { Logger } from '@hocuspocus/extension-logger';
import { loadCollabEnv } from './config.js';
import { createPostgresExtension } from './extensions/postgres.js';
import { cacheVersionLookup, createAuthenticator, createMessageGuard } from './auth.js';
import { lookupTokenVersion } from './token-versions.js';
import { logger } from './extensions/logger.js';

// Revocations reach live sockets within this window (see M5c spec §3).
const VERSION_CACHE_TTL_MS = 10_000;

const env = loadCollabEnv();

const server = new Hocuspocus({
  port: env.COLLAB_PORT,
  extensions: [new Logger(), createPostgresExtension()],
  onAuthenticate: createAuthenticator({
    secret: env.COLLAB_TOKEN_SECRET,
    lookupVersion: lookupTokenVersion,
    logger,
  }),
  beforeHandleMessage: createMessageGuard({
    lookupVersion: cacheVersionLookup(lookupTokenVersion, VERSION_CACHE_TTL_MS),
    logger,
  }),
});

server
  .listen()
  .then(() => logger.info({ port: env.COLLAB_PORT }, 'collab server listening'))
  .catch((err: unknown) => {
    logger.error({ err }, 'collab server failed to start');
    process.exit(1);
  });

const shutdown = (signal: string) => {
  logger.info({ signal }, 'shutting down collab server');
  server
    .destroy()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      logger.error({ err }, 'error during shutdown');
      process.exit(1);
    });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
