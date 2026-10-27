const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const logger = require('../utils/logger');
const sessionManager = require('../services/session');
const whatsapp = require('../services/whatsapp');
const { handleIncomingMessage } = require('../flow/handlers');
const { msg } = require('../flow/messages');

// Deduplication map (message ID -> timestamp)
const processedMessageIds = new Map();
const DEDUPE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Periodic cleanup of deduplication map
setInterval(() => {
  const now = Date.now();
  for (const [id, time] of processedMessageIds.entries()) {
    if (now - time > DEDUPE_TTL_MS) {
      processedMessageIds.delete(id);
    }
  }
}, 5 * 60 * 1000).unref?.();

/**
 * Validates Meta X-Hub-Signature-256 header using WHATSAPP_APP_SECRET
 * @param {express.Request} req
 * @returns {boolean}
 */
function verifySignature(req) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    logger.warn('WHATSAPP_APP_SECRET is not configured; skipping signature verification');
    return true;
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    logger.warn('Missing X-Hub-Signature-256 header');
    return false;
  }

  const parts = signature.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    logger.warn('Malformed X-Hub-Signature-256 header');
    return false;
  }

  const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
  const expectedHash = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const signatureBuffer = Buffer.from(parts[1], 'hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

/**
 * GET /webhook: Meta Webhook Verification
 */
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === expectedToken) {
    logger.info('Meta webhook verification challenge succeeded');
    return res.status(200).send(challenge);
  }

  // Friendly response if opened directly in a browser
  if (!mode && !token) {
    return res.status(200).json({
      status: 'active',
      service: 'Medix WhatsApp Webhook',
      message: 'Webhook endpoint is active and waiting for Meta Cloud API events.',
      guide: 'In Meta Developer Portal > WhatsApp Configuration, set this URL as Callback URL and enter your WHATSAPP_VERIFY_TOKEN.'
    });
  }

  logger.warn({ mode, tokenReceived: !!token }, 'Meta webhook verification failed');
  return res.sendStatus(403);
});

/**
 * POST /webhook: Event Handler
 */
router.post('/webhook', (req, res) => {
  logger.info({ body: req.body }, 'Incoming webhook event received from Meta');

  // 1. Signature validation
  if (!verifySignature(req)) {
    logger.warn('Invalid webhook signature rejected with 403');
    return res.sendStatus(403);
  }

  // 2. Immediate 200 response
  res.status(200).send('EVENT_RECEIVED');

  // 3. Asynchronously process incoming messages
  processIncomingPayload(req.body).catch((err) => {
    logger.error({ error: err.message, stack: err.stack }, 'Unhandled error in webhook payload processing');
  });
});

/**
 * Extracts and dispatches incoming messages
 * @param {object} body
 */
async function processIncomingPayload(body) {
  if (body.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) {
    return;
  }

  for (const entry of body.entry) {
    if (!Array.isArray(entry.changes)) continue;

    for (const change of entry.changes) {
      const value = change.value;
      if (!value || change.field !== 'messages') continue;

      // Ignore status updates
      if (!Array.isArray(value.messages) || value.messages.length === 0) {
        continue;
      }

      for (const message of value.messages) {
        const messageId = message.id;
        const phone = message.from;

        // Deduplicate message IDs
        if (processedMessageIds.has(messageId)) {
          logger.info({ messageId, phone }, 'Duplicate message ID ignored');
          continue;
        }
        processedMessageIds.set(messageId, Date.now());

        // Check per-user rate limit (20 messages/min)
        if (!sessionManager.checkRateLimit(phone)) {
          logger.warn({ phone, messageId }, 'Rate limit exceeded, dropping message');
          continue;
        }

        // Mark incoming message as read
        whatsapp.markAsRead(messageId).catch(() => {});

        // Sequential per-user processing queue to prevent race conditions
        sessionManager.enqueue(phone, async () => {
          try {
            await handleIncomingMessage(phone, message);
          } catch (err) {
            logger.error({ phone, messageId, error: err.message, stack: err.stack }, 'Error processing message');
            const session = sessionManager.get(phone);
            const lang = session?.lang || 'en';
            await whatsapp
              .sendTextMessage(phone, msg(lang, 'error_generic'))
              .catch(() => {});
          }
        });
      }
    }
  }
}

module.exports = router;
module.exports.verifySignature = verifySignature;
module.exports.processIncomingPayload = processIncomingPayload;
