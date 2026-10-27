const test = require('node:test');
const assert = require('node:assert');
const STATES = require('../src/flow/states');
const sessionManager = require('../src/services/session');
const whatsapp = require('../src/services/whatsapp');
const sheets = require('../src/services/sheets');
const drive = require('../src/services/drive');
const { handleIncomingMessage } = require('../src/flow/handlers');

// Mock external services for test environment
let lastSentMessages = [];
whatsapp.sendButtonMessage = async (to, body, buttons) => {
  lastSentMessages.push({ type: 'button', to, body, buttons });
};
whatsapp.sendListMessage = async (to, body, btn, sections) => {
  lastSentMessages.push({ type: 'list', to, body, btn, sections });
};
whatsapp.sendTextMessage = async (to, body) => {
  lastSentMessages.push({ type: 'text', to, body });
};
sheets.appendOrder = async (order) => ({ orderId: 'MDX-261027-TEST' });
sheets.findOrdersByPhone = async () => [];
sheets.findOrderByOrderId = async () => null;
sheets.logSupportRequest = async () => {};
drive.uploadFile = async () => 'https://drive.google.com/file/d/test1234/view';

test('stateMachine - language selection sets session.lang and transitions directly to SELECT_ORDER_TYPE', async () => {
  const phone = '919876543220';
  sessionManager.delete(phone);

  // Send language button click: বাংলা
  await handleIncomingMessage(phone, {
    type: 'interactive',
    interactive: {
      type: 'button_reply',
      button_reply: { id: 'lang_bn', title: 'বাংলা' }
    }
  });

  const session = sessionManager.get(phone);
  assert.strictEqual(session.lang, 'bn');
  assert.strictEqual(session.state, STATES.SELECT_ORDER_TYPE);
});

test('stateMachine - SELECT_ORDER_TYPE to WAIT_TEXT_ORDER on opt_text', async () => {
  const phone = '919876543222';
  const session = sessionManager.get(phone);
  session.lang = 'bn';
  session.state = STATES.SELECT_ORDER_TYPE;
  sessionManager.set(phone, session);

  await handleIncomingMessage(phone, {
    type: 'interactive',
    interactive: {
      type: 'list_reply',
      list_reply: { id: 'opt_text', title: 'ওষুধের নাম লিখে' }
    }
  });

  const updated = sessionManager.get(phone);
  assert.strictEqual(updated.state, STATES.WAIT_TEXT_ORDER);
  assert.strictEqual(updated.order.orderType, 'Text Order');
});

test('stateMachine - complete text order flow according to flow diagram', async () => {
  const phone = '919876543223';
  const session = sessionManager.get(phone);
  session.lang = 'bn';
  session.state = STATES.WAIT_TEXT_ORDER;
  session.order.orderType = 'Text Order';
  sessionManager.set(phone, session);

  // 1. Enter medicines (Box 3a)
  await handleIncomingMessage(phone, {
    type: 'text',
    text: { body: 'Calpol 650 - 2' }
  });

  let cur = sessionManager.get(phone);
  assert.strictEqual(cur.order.medicines, 'Calpol 650 - 2');
  assert.strictEqual(cur.state, STATES.ASK_NAME);

  // 2. Enter invalid name (should stay in ASK_NAME)
  await handleIncomingMessage(phone, {
    type: 'text',
    text: { body: 'A' }
  });
  cur = sessionManager.get(phone);
  assert.strictEqual(cur.state, STATES.ASK_NAME);

  // 3. Enter valid name (Box 4)
  await handleIncomingMessage(phone, {
    type: 'text',
    text: { body: 'Rahul Mondal' }
  });
  cur = sessionManager.get(phone);
  assert.strictEqual(cur.order.customerName, 'Rahul Mondal');
  assert.strictEqual(cur.state, STATES.ASK_ADDRESS);

  // 4. Enter valid address (Box 5)
  await handleIncomingMessage(phone, {
    type: 'text',
    text: { body: 'Vill: Krishnanagar, PO: Chakda, PIN: 741222' }
  });
  cur = sessionManager.get(phone);
  assert.strictEqual(cur.order.address, 'Vill: Krishnanagar, PO: Chakda, PIN: 741222');
  assert.strictEqual(cur.state, STATES.ASK_PHONE);

  // 5. Click "এই নম্বর ব্যবহার" (Box 6)
  await handleIncomingMessage(phone, {
    type: 'interactive',
    interactive: {
      type: 'button_reply',
      button_reply: { id: 'phone_same', title: 'এই নম্বর ব্যবহার' }
    }
  });

  // Moves to ASK_ORDER_MORE (Box 9) after placing order (Box 8)
  cur = sessionManager.get(phone);
  assert.strictEqual(cur.state, STATES.ASK_ORDER_MORE);
  assert.strictEqual(cur.order.phone, '9876543223');

  // 6. Click "হ্যাঁ" (Yes) in Box 9 -> loops back to SELECT_LANGUAGE (Box 1)
  await handleIncomingMessage(phone, {
    type: 'interactive',
    interactive: {
      type: 'button_reply',
      button_reply: { id: 'order_more_yes', title: 'হ্যাঁ' }
    }
  });

  cur = sessionManager.get(phone);
  assert.strictEqual(cur.state, STATES.SELECT_LANGUAGE);
});

test('stateMachine - location pin in ASK_ADDRESS transitions directly to ASK_PHONE', async () => {
  const phone = '919876543224';
  const session = sessionManager.get(phone);
  session.lang = 'en';
  session.state = STATES.ASK_ADDRESS;
  sessionManager.set(phone, session);

  // Send location pin
  await handleIncomingMessage(phone, {
    type: 'location',
    location: {
      latitude: 22.5726,
      longitude: 88.3639,
      name: 'Kolkata, WB'
    }
  });

  const cur = sessionManager.get(phone);
  assert.strictEqual(cur.state, STATES.ASK_PHONE);
  assert.ok(cur.order.mapLink.includes('22.5726,88.3639'));
});

test('stateMachine - selecting other phone number transitions to ASK_PHONE_MANUAL then complete', async () => {
  const phone = '919876543225';
  const session = sessionManager.get(phone);
  session.lang = 'en';
  session.state = STATES.ASK_PHONE;
  sessionManager.set(phone, session);

  // Click "Provide other number"
  await handleIncomingMessage(phone, {
    type: 'interactive',
    interactive: {
      type: 'button_reply',
      button_reply: { id: 'phone_other', title: 'Provide other number' }
    }
  });

  let cur = sessionManager.get(phone);
  assert.strictEqual(cur.state, STATES.ASK_PHONE_MANUAL);

  // Send 10-digit number
  await handleIncomingMessage(phone, {
    type: 'text',
    text: { body: '9876543210' }
  });

  cur = sessionManager.get(phone);
  assert.strictEqual(cur.state, STATES.ASK_ORDER_MORE);
  assert.strictEqual(cur.order.phone, '9876543210');

  // Click "No" -> finishes with thank you
  await handleIncomingMessage(phone, {
    type: 'interactive',
    interactive: {
      type: 'button_reply',
      button_reply: { id: 'order_more_no', title: 'No' }
    }
  });

  cur = sessionManager.get(phone);
  assert.strictEqual(cur.state, STATES.START);
});

test('stateMachine - prescription upload moves directly to ASK_NAME', async () => {
  const phone = '919876543226';
  const session = sessionManager.get(phone);
  session.lang = 'bn';
  session.state = STATES.WAIT_PRESCRIPTION;
  sessionManager.set(phone, session);

  await handleIncomingMessage(phone, {
    type: 'image',
    image: { id: 'media_rx_123' }
  });

  const cur = sessionManager.get(phone);
  assert.strictEqual(cur.state, STATES.ASK_NAME);
  assert.strictEqual(cur.order.medicines, 'Prescription attached');
});

test('stateMachine - strip photo upload moves directly to ASK_NAME', async () => {
  const phone = '919876543227';
  const session = sessionManager.get(phone);
  session.lang = 'hi';
  session.state = STATES.WAIT_STRIP;
  sessionManager.set(phone, session);

  await handleIncomingMessage(phone, {
    type: 'image',
    image: { id: 'media_strip_123' }
  });

  const cur = sessionManager.get(phone);
  assert.strictEqual(cur.state, STATES.ASK_NAME);
  assert.strictEqual(cur.order.medicines, 'Strip photo attached');
});

test('stateMachine - voice message upload moves directly to ASK_NAME', async () => {
  const phone = '919876543228';
  const session = sessionManager.get(phone);
  session.lang = 'hi';
  session.state = STATES.WAIT_VOICE;
  sessionManager.set(phone, session);

  await handleIncomingMessage(phone, {
    type: 'voice',
    voice: { id: 'media_voice_123' }
  });

  const cur = sessionManager.get(phone);
  assert.strictEqual(cur.state, STATES.ASK_NAME);
  assert.strictEqual(cur.order.medicines, 'Voice message attached');
});

test('stateMachine - mid-flow language switch preserves order and resumes seamlessly', async () => {
  const phone = '919876543229';
  const session = sessionManager.get(phone);
  session.lang = 'en';
  session.state = STATES.ASK_NAME;
  session.order.medicines = 'Dolo 650 - 1 strip';
  sessionManager.set(phone, session);

  // 1. User types "lang"
  await handleIncomingMessage(phone, {
    type: 'text',
    text: { body: 'lang' }
  });

  let cur = sessionManager.get(phone);
  assert.strictEqual(cur.state, STATES.SELECT_LANGUAGE);
  assert.strictEqual(cur.returnState, STATES.ASK_NAME);

  // 2. User selects Hindi
  await handleIncomingMessage(phone, {
    type: 'interactive',
    interactive: {
      type: 'button_reply',
      button_reply: { id: 'lang_hi', title: 'हिन्दी' }
    }
  });

  cur = sessionManager.get(phone);
  assert.strictEqual(cur.lang, 'hi');
  assert.strictEqual(cur.state, STATES.ASK_NAME);
  assert.strictEqual(cur.returnState, null);

  // 3. User enters name in Hindi flow
  await handleIncomingMessage(phone, {
    type: 'text',
    text: { body: 'विकास शर्मा' }
  });

  cur = sessionManager.get(phone);
  assert.strictEqual(cur.state, STATES.ASK_ADDRESS);
  assert.strictEqual(cur.order.customerName, 'विकास शर्मा');
  assert.strictEqual(cur.order.medicines, 'Dolo 650 - 1 strip');
});

