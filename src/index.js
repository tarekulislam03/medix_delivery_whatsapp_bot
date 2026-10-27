require('dotenv').config();
const express = require('express');
const logger = require('./utils/logger');
const webhookRoutes = require('./routes/webhook');
const notifyRoutes = require('./routes/notify');
const sessionManager = require('./services/session');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse incoming JSON and preserve raw buffer for HMAC verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  })
);

app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    service: 'Medix Pharmacy WhatsApp Bot'
  });
});

// Root info
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Medix Pharmacy Delivery - WhatsApp Automation Bot',
    mode: 'Button-driven / Rule-based',
    status: 'running'
  });
});

// Mount routes
app.use('/', webhookRoutes);
app.use('/', notifyRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error({ error: err.message, stack: err.stack, path: req.path }, 'Unhandled server error');
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Start listening
const server = app.listen(PORT, () => {
  logger.info(`Medix Pharmacy WhatsApp Bot server running on port ${PORT}`);
});

// Graceful shutdown handling
function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  sessionManager.destroy();

  server.close(() => {
    logger.info('HTTP server closed. Exiting process.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forceful shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = { app, server };
