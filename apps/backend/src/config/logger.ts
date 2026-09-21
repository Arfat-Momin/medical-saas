import pino from 'pino';
import { createRequire } from 'node:module';
import { env, isProd } from './env.js';

function hasPinoPretty(): boolean {
  try {
    const require = createRequire(import.meta.url);
    require.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

const prettyEnabled = !isProd && hasPinoPretty();

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.refreshToken',
      'req.body.vitals',
      'req.body.diagnoses',
      'req.body.prescription',
      'req.body.labTests',
      'req.body.chiefComplaint',
      'req.body.history',
      'req.body.examination',
      'req.body.notes',
      '*.password',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
    ],
    censor: '[REDACTED]',
  },
  transport: prettyEnabled
    ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } }
    : undefined,
});
