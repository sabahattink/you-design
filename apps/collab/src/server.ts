import { Hocuspocus } from '@hocuspocus/server';
import { Logger } from '@hocuspocus/extension-logger';
import { createPostgresExtension } from './extensions/postgres.js';
import { authenticate } from './auth.js';
import { logger } from './extensions/logger.js';

const port = Number(process.env.COLLAB_PORT ?? 3002);

const server = new Hocuspocus({
  port,
  extensions: [new Logger(), createPostgresExtension()],
  onAuthenticate: authenticate,
});

server
  .listen()
  .then(() => logger.info({ port }, 'collab server listening'))
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
