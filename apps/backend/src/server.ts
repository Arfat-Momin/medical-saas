import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(` Medical SaaS backend running on http://localhost:${env.PORT}`);
  logger.info(`   Environment: ${env.NODE_ENV}`);
});

const shutdown = (signal: string) => {
  logger.info(`${signal} received - shutting down gracefully`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
