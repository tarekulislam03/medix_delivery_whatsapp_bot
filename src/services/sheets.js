const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { google } = require('googleapis');
const { getGoogleAuth } = require('./googleAuth');
const logger = require('../utils/logger');

const TAB_ORDERS = 'Orders';
const TAB_SUPPORT = 'Support';

const ORDER_HEADERS = [
  'Order ID',
  'Timestamp (IST)',
  'WhatsApp Number',
  'Customer Name',
  'Phone',
  'Address',
  'Map Link',
  'Order Type',
  'Medicines (text)',
  'File Links',
  'Status',
  'Price',
  'Notes'
];

const SUPPORT_HEADERS = ['Timestamp (IST)', 'WhatsApp Number', 'Note'];

const FAILED_ORDERS_FILE = path.join(process.cwd(), 'failed-orders.json');

/**
 * Returns current timestamp in Indian Standard Time (IST)
 * @returns {string}
 */
function getIstTimestamp() {
  const now = new Date();
  const options = {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  return new Intl.DateTimeFormat('en-CA', options).format(now).replace(',', '');
}

/**
 * Generates an Order ID like MDX-YYMMDD-XXXX
 * @returns {string}
 */
function generateOrderId() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);

  const yy = parts.find((p) => p.type === 'year')?.value || '26';
  const mm = parts.find((p) => p.type === 'month')?.value || '10';
  const dd = parts.find((p) => p.type === 'day')?.value || '27';
  const dateStr = `${yy}${mm}${dd}`;

  const randomChars = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `MDX-${dateStr}-${randomChars}`;
}

/**
 * Saves a failed order to local JSON file
 * @param {object} orderRecord
 */
function saveFailedOrder(orderRecord) {
  try {
    let failed = [];
    if (fs.existsSync(FAILED_ORDERS_FILE)) {
      failed = JSON.parse(fs.readFileSync(FAILED_ORDERS_FILE, 'utf8') || '[]');
    }
    failed.push(orderRecord);
    fs.writeFileSync(FAILED_ORDERS_FILE, JSON.stringify(failed, null, 2), 'utf8');
    logger.warn({ orderId: orderRecord.orderId }, 'Saved failed order to local backup failed-orders.json');
  } catch (err) {
    logger.error({ error: err.message }, 'Failed to write to failed-orders.json');
  }
}

/**
 * Retries saving failed orders in the background
 */
async function retryFailedOrders() {
  if (!fs.existsSync(FAILED_ORDERS_FILE)) return;

  try {
    const raw = fs.readFileSync(FAILED_ORDERS_FILE, 'utf8');
    const orders = JSON.parse(raw || '[]');
    if (!orders || orders.length === 0) return;

    const remaining = [];
    for (const ord of orders) {
      try {
        await executeAppendOrder(ord);
        logger.info({ orderId: ord.orderId }, 'Successfully flushed failed order to Google Sheets');
      } catch (err) {
        remaining.push(ord);
      }
    }

    fs.writeFileSync(FAILED_ORDERS_FILE, JSON.stringify(remaining, null, 2), 'utf8');
  } catch (err) {
    logger.error({ error: err.message }, 'Error during failed orders retry');
  }
}

// Background retry every 2 minutes
setInterval(retryFailedOrders, 2 * 60 * 1000).unref?.();

/**
 * Executes append order via Apps Script OR Service Account
 */
async function executeAppendOrder(orderRecord) {
  // Option A: Google Apps Script Web App
  if (process.env.GOOGLE_APPS_SCRIPT_URL) {
    const res = await axios.post(
      process.env.GOOGLE_APPS_SCRIPT_URL,
      {
        action: 'appendOrder',
        ...orderRecord,
        fileLinks: Array.isArray(orderRecord.fileLinks) ? orderRecord.fileLinks.join(', ') : orderRecord.fileLinks
      },
      { timeout: 30000 }
    );
    return res.data;
  }

  // Option B: Google Service Account
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) throw new Error('Neither GOOGLE_APPS_SCRIPT_URL nor GOOGLE_SHEET_ID configured');

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const row = [
    orderRecord.orderId,
    orderRecord.timestamp || getIstTimestamp(),
    orderRecord.whatsappNumber,
    orderRecord.customerName || '',
    orderRecord.phone || '',
    orderRecord.address || '',
    orderRecord.mapLink || '',
    orderRecord.orderType || 'General Order',
    orderRecord.medicines || '',
    Array.isArray(orderRecord.fileLinks) ? orderRecord.fileLinks.join(', ') : orderRecord.fileLinks || '',
    orderRecord.status || 'Pending price confirmation',
    orderRecord.price || '',
    orderRecord.notes || ''
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${TAB_ORDERS}'!A:M`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] }
  });
}

/**
 * Appends order with up to 3 retries, falls back to failed-orders.json
 * @param {object} orderData
 * @returns {Promise<{ orderId: string, timestamp: string }>}
 */
async function appendOrder(orderData) {
  const orderId = orderData.orderId || generateOrderId();
  const timestamp = getIstTimestamp();

  const orderRecord = {
    ...orderData,
    orderId,
    timestamp,
    status: orderData.status || 'Pending price confirmation'
  };

  const maxRetries = 3;
  let attempt = 0;
  let lastErr = null;

  while (attempt < maxRetries) {
    attempt++;
    try {
      if (attempt === 1 && !process.env.GOOGLE_APPS_SCRIPT_URL) {
        await ensureHeaders();
      }
      await executeAppendOrder(orderRecord);
      logger.info({ orderId, whatsappNumber: orderRecord.whatsappNumber }, 'Order appended to Google Sheets');
      return { orderId, timestamp };
    } catch (err) {
      lastErr = err;
      logger.warn({ attempt, orderId, error: err.message }, 'Failed appending order, retrying...');
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000));
      }
    }
  }

  saveFailedOrder(orderRecord);
  return { orderId, timestamp, fallback: true };
}

/**
 * Appends a support request to the "Support" tab
 * @param {string} whatsappNumber
 * @param {string} note
 */
async function logSupportRequest(whatsappNumber, note = 'Customer requested support callback') {
  const timestamp = getIstTimestamp();

  if (process.env.GOOGLE_APPS_SCRIPT_URL) {
    try {
      await axios.post(
        process.env.GOOGLE_APPS_SCRIPT_URL,
        { action: 'support', whatsappNumber, note, timestamp },
        { timeout: 15000 }
      );
      return;
    } catch (err) {
      logger.error({ error: err.message }, 'Failed logging support via Apps Script');
    }
  }

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return;

  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });
    await ensureSupportHeaders(sheets, spreadsheetId);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `'${TAB_SUPPORT}'!A:C`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [[timestamp, whatsappNumber, note]] }
    });
  } catch (err) {
    logger.error({ error: err.message, whatsappNumber }, 'Failed to log support request');
  }
}

/**
 * Finds up to 3 most recent orders for a WhatsApp number
 * @param {string} whatsappNumber
 * @returns {Promise<Array<object>>}
 */
async function findOrdersByPhone(whatsappNumber) {
  if (process.env.GOOGLE_APPS_SCRIPT_URL) {
    try {
      const res = await axios.post(
        process.env.GOOGLE_APPS_SCRIPT_URL,
        { action: 'getOrdersByPhone', phone: whatsappNumber },
        { timeout: 20000 }
      );
      return res.data?.orders || [];
    } catch (err) {
      logger.error({ error: err.message }, 'Failed looking up orders via Apps Script');
      return [];
    }
  }

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return [];

  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${TAB_ORDERS}'!A:M`
    });

    const rows = res.data.values || [];
    if (rows.length <= 1) return [];

    const cleanInput = whatsappNumber.replace(/\D/g, '');
    const matched = [];

    for (let i = rows.length - 1; i >= 1; i--) {
      const r = rows[i];
      const rowPhone = String(r[2] || '').replace(/\D/g, '');
      if (rowPhone && (cleanInput.endsWith(rowPhone) || rowPhone.endsWith(cleanInput))) {
        matched.push({
          orderId: r[0] || '',
          date: r[1] || '',
          phone: r[2] || '',
          customerName: r[3] || '',
          address: r[5] || '',
          orderType: r[7] || '',
          medicines: r[8] || '',
          status: r[10] || 'Pending price confirmation',
          price: r[11] || ''
        });
        if (matched.length >= 3) break;
      }
    }

    return matched;
  } catch (err) {
    logger.error({ error: err.message, whatsappNumber }, 'Failed to lookup orders by phone');
    return [];
  }
}

/**
 * Finds a single order by Order ID
 * @param {string} orderId
 * @returns {Promise<object|null>}
 */
async function findOrderByOrderId(orderId) {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return null;

  try {
    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: 'v4', auth });

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${TAB_ORDERS}'!A:M`
    });

    const rows = res.data.values || [];
    const target = orderId.trim().toUpperCase();

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (String(r[0] || '').trim().toUpperCase() === target) {
        return {
          orderId: r[0],
          date: r[1],
          whatsappNumber: r[2],
          customerName: r[3],
          phone: r[4],
          address: r[5],
          mapLink: r[6],
          orderType: r[7],
          medicines: r[8],
          fileLinks: r[9],
          status: r[10] || 'Pending price confirmation',
          price: r[11] || '',
          notes: r[12] || '',
          rowIndex: i + 1
        };
      }
    }

    return null;
  } catch (err) {
    logger.error({ error: err.message, orderId }, 'Failed to find order by ID');
    return null;
  }
}

/**
 * Ensures header row in Orders tab
 */
async function ensureHeaders() {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) return;

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${TAB_ORDERS}'!A1:M1`
    });

    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${TAB_ORDERS}'!A1:M1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [ORDER_HEADERS] }
      });
    }
  } catch (err) {
    if (err.message && err.message.includes('Unable to parse range')) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: TAB_ORDERS } } }]
        }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${TAB_ORDERS}'!A1:M1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [ORDER_HEADERS] }
      });
    }
  }
}

/**
 * Ensures header row in Support tab
 */
async function ensureSupportHeaders(sheets, spreadsheetId) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${TAB_SUPPORT}'!A1:C1`
    });
    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${TAB_SUPPORT}'!A1:C1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [SUPPORT_HEADERS] }
      });
    }
  } catch (err) {
    if (err.message && err.message.includes('Unable to parse range')) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: TAB_SUPPORT } } }]
        }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${TAB_SUPPORT}'!A1:C1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [SUPPORT_HEADERS] }
      });
    }
  }
}

module.exports = {
  appendOrder,
  findOrdersByPhone,
  findOrderByOrderId,
  logSupportRequest,
  generateOrderId,
  getIstTimestamp,
  ORDER_HEADERS
};
