import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { env } from './config.js';
import { healthRoutes } from './routes/health.js';
import { projectsRoutes } from './routes/projects.js';
import { llmRoutes } from './routes/llm.js';
import { usageRoutes } from './routes/usage.js';
import { redis } from './lib/redis.js';

async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
          : undefined,
    },
    disableRequestLogging: false,
    trustProxy: true,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(sensible);
  await app.register(helmet, { contentSecurityPolicy: false });

  await app.register(cors, {
    origin: env.API_CORS_ORIGINS.split(',').map((s) => s.trim()),
    credentials: true,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis,
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'You Design API',
        description: 'Local-first AI design + code workspace — API surface',
        version: '0.0.0',
      },
      servers: [{ url: `http://${env.API_HOST}:${env.API_PORT}` }],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(healthRoutes);
  await app.register(projectsRoutes, { prefix: '/api/v1' });
  await app.register(llmRoutes, { prefix: '/api/v1' });
  await app.register(usageRoutes, { prefix: '/api/v1' });

  return app;
}

async function main() {
  const app = await buildServer();
  try {
    await app.listen({ host: env.API_HOST, port: env.API_PORT });
    app.log.info(`API ready on http://${env.API_HOST}:${env.API_PORT} (docs at /docs)`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
