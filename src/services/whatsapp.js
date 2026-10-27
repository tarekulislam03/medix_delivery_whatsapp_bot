const axios = require('axios');
const logger = require('../utils/logger');

const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || 'v21.0';
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

/**
 * Validates credentials and returns API URL
 */
function getEndpoint() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;

  if (!phoneNumberId || !token) {
    logger.error('Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_TOKEN');
    throw new Error('WhatsApp credentials not configured');
  }

  return {
    url: `${GRAPH_BASE_URL}/${phoneNumberId}/messages`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };
}

/**
 * Sends a plain text message
 * @param {string} to
 * @param {string} body
 * @returns {Promise<object>}
 */
async function sendTextMessage(to, body) {
  const { url, headers } = getEndpoint();
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: body.slice(0, 1024) }
  };

  try {
    const res = await axios.post(url, payload, { headers, timeout: 15000 });
    logger.info({ to, messageId: res.data?.messages?.[0]?.id }, 'Text message sent');
    return res.data;
  } catch (err) {
    logger.error({ to, error: err.response?.data?.error || err.message }, 'Failed to send text message');
    throw err;
  }
}

/**
 * Sends a reply button message (up to 3 buttons, max 20 chars per title)
 *
 * @param {string} to - Recipient number
 * @param {string} bodyText - Message body (max 1024 chars)
 * @param {Array<{ id: string, title: string }>} buttons - Max 3 buttons
 * @returns {Promise<object>}
 */
async function sendButtonMessage(to, bodyText, buttons) {
  const { url, headers } = getEndpoint();

  const formattedButtons = buttons.slice(0, 3).map((btn) => ({
    type: 'reply',
    reply: {
      id: btn.id,
      title: btn.title.slice(0, 20)
    }
  }));

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText.slice(0, 1024) },
      action: {
        buttons: formattedButtons
      }
    }
  };

  try {
    const res = await axios.post(url, payload, { headers, timeout: 15000 });
    logger.info({ to, messageId: res.data?.messages?.[0]?.id, btnCount: buttons.length }, 'Button message sent');
    return res.data;
  } catch (err) {
    logger.error({ to, error: err.response?.data?.error || err.message }, 'Failed to send button message');
    throw err;
  }
}

/**
 * Sends a list message (up to 10 rows, title max 24 chars, desc max 72 chars, button max 20 chars)
 *
 * @param {string} to
 * @param {string} bodyText
 * @param {string} buttonLabel
 * @param {Array<{ title?: string, rows: Array<{ id: string, title: string, description?: string }> }>} sections
 * @returns {Promise<object>}
 */
async function sendListMessage(to, bodyText, buttonLabel, sections) {
  const { url, headers } = getEndpoint();

  const formattedSections = sections.map((sec) => ({
    title: (sec.title || 'Options').slice(0, 24),
    rows: (sec.rows || []).slice(0, 10).map((row) => ({
      id: row.id,
      title: row.title.slice(0, 24),
      description: (row.description || '').slice(0, 72)
    }))
  }));

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText.slice(0, 1024) },
      action: {
        button: buttonLabel.slice(0, 20),
        sections: formattedSections
      }
    }
  };

  try {
    const res = await axios.post(url, payload, { headers, timeout: 15000 });
    logger.info({ to, messageId: res.data?.messages?.[0]?.id }, 'List message sent');
    return res.data;
  } catch (err) {
    logger.error({ to, error: err.response?.data?.error || err.message }, 'Failed to send list message');
    throw err;
  }
}

/**
 * Sends an approved Meta message template (used outside 24h window for price notification)
 *
 * @param {string} to
 * @param {string} templateName
 * @param {string} languageCode
 * @param {Array<object>} components
 * @returns {Promise<object>}
 */
async function sendTemplateMessage(to, templateName, languageCode = 'en', components = []) {
  const { url, headers } = getEndpoint();

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components
    }
  };

  try {
    const res = await axios.post(url, payload, { headers, timeout: 15000 });
    logger.info({ to, templateName, messageId: res.data?.messages?.[0]?.id }, 'Template message sent');
    return res.data;
  } catch (err) {
    logger.error({ to, templateName, error: err.response?.data?.error || err.message }, 'Failed to send template message');
    throw err;
  }
}

/**
 * Marks incoming message as read
 * @param {string} messageId
 * @returns {Promise<object|null>}
 */
async function markAsRead(messageId) {
  if (!messageId) return null;
  const { url, headers } = getEndpoint();

  const payload = {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId
  };

  try {
    const res = await axios.post(url, payload, { headers, timeout: 10000 });
    return res.data;
  } catch (err) {
    logger.warn({ messageId, error: err.response?.data?.error?.message || err.message }, 'Failed to mark message read');
    return null;
  }
}

/**
 * Downloads media binary buffer using media ID from WhatsApp Cloud API
 * @param {string} mediaId
 * @returns {Promise<{ buffer: Buffer, mimeType: string, fileSize: number }>}
 */
async function downloadMedia(mediaId) {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) throw new Error('WHATSAPP_TOKEN not configured');

  const metaUrl = `${GRAPH_BASE_URL}/${mediaId}`;
  const metaRes = await axios.get(metaUrl, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15000
  });

  const { url: downloadUrl, mime_type: mimeType, file_size: fileSize } = metaRes.data;
  if (!downloadUrl) throw new Error(`Media URL not found for media ID ${mediaId}`);

  const mediaRes = await axios.get(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'arraybuffer',
    timeout: 30000
  });

  const buffer = Buffer.from(mediaRes.data);
  return {
    buffer,
    mimeType: mimeType || 'application/octet-stream',
    fileSize: fileSize || buffer.length
  };
}

module.exports = {
  sendTextMessage,
  sendButtonMessage,
  sendListMessage,
  sendTemplateMessage,
  markAsRead,
  downloadMedia
};
