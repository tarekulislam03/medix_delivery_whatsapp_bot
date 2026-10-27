const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const sheets = require('../services/sheets');
const whatsapp = require('../services/whatsapp');
const sessionManager = require('../services/session');

/**
 * POST /notify
 * Protected by x-api-key header
 * Reads order from Google Sheet and sends customer a price confirmation message
 */
router.post('/notify', async (req, res) => {
  const apiKey = req.headers['x-api-key'] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  const expectedKey = process.env.NOTIFY_API_KEY;

  if (!expectedKey || apiKey !== expectedKey) {
    logger.warn('Unauthorized /notify attempt with invalid or missing API key');
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }

  const { orderId } = req.body;
  if (!orderId) {
    return res.status(400).json({ error: 'Missing orderId in request body' });
  }

  try {
    const order = await sheets.findOrderByOrderId(orderId);
    if (!order) {
      return res.status(404).json({ error: `Order ${orderId} not found in Google Sheet` });
    }

    if (!order.price || order.price.trim() === '') {
      return res.status(400).json({
        error: `Order ${orderId} does not have a price specified in column L yet`
      });
    }

    const recipientPhone = order.whatsappNumber || order.phone;
    const session = sessionManager.get(recipientPhone);
    const lang = session?.lang || 'en';

    const templateName = process.env.PRICE_CONFIRM_TEMPLATE_NAME || 'medix_price_confirmation';
    const customerName = order.customerName || 'Customer';
    const priceStr = order.price.startsWith('₹') ? order.price : `₹${order.price}`;

    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: customerName },
          { type: 'text', text: orderId },
          { type: 'text', text: priceStr }
        ]
      }
    ];

    try {
      // 1. Send using approved Meta Message Template (guaranteed outside 24h window)
      await whatsapp.sendTemplateMessage(recipientPhone, templateName, lang, components);
      logger.info({ orderId, recipientPhone, price: order.price }, 'Price confirmation template sent');
    } catch (templateErr) {
      logger.warn(
        { orderId, error: templateErr.message },
        'Template send failed (may not be approved yet), attempting interactive button fallback'
      );

      // Fallback if template is pending approval: send interactive buttons if window allows
      const body = `Hello ${customerName}! The price for your order *${orderId}* has been confirmed: *${priceStr}*.\n\nPlease confirm if you would like us to dispatch your delivery:`;
      const buttons = [
        { id: 'price_confirm_delivery', title: 'Confirm Delivery' },
        { id: 'price_cancel_order', title: 'Cancel Order' }
      ];
      await whatsapp.sendButtonMessage(recipientPhone, body, buttons);
    }

    return res.status(200).json({
      success: true,
      orderId,
      customerName,
      price: priceStr,
      recipient: recipientPhone
    });
  } catch (err) {
    logger.error({ orderId, error: err.message, stack: err.stack }, 'Error processing /notify endpoint');
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
});

module.exports = router;
