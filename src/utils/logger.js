const pino = require('pino');

const isProduction = process.env.NODE_ENV === 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-hub-signature-256"]',
      'token',
      'access_token',
      'WHATSAPP_TOKEN',
      'ANTHROPIC_API_KEY',
      'GEMINI_API_KEY',
      'OPENAI_API_KEY',
      'private_key',
      '*.token',
      '*.key'
    ],
    remove: false,
    censor: '[REDACTED]'
  },
  transport: !isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname'
        }
      }
    : undefined
});

module.exports = logger;
