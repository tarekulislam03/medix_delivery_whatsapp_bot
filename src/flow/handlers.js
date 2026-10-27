const STATES = require('./states');
const { msg } = require('./messages');
const whatsapp = require('../services/whatsapp');
const drive = require('../services/drive');
const sheets = require('../services/sheets');
const sessionManager = require('../services/session');
const logger = require('../utils/logger');
const {
  validateIndianPhone,
  validateName,
  validateAddress
} = require('../utils/validators');

/**
 * Helper to build text message with language switch footnote
 */
function withLangFooter(lang, key, vars = {}) {
  return msg(lang, key, vars) + msg(lang, 'lang_footer');
}

/**
 * Main dispatcher for all incoming WhatsApp messages
 *
 * @param {string} phone - Customer WhatsApp number
 * @param {object} message - Meta message object
 */
async function handleIncomingMessage(phone, message) {
  const session = sessionManager.get(phone);
  const type = message.type;

  // Extract interactive click IDs or text body
  let buttonId = null;
  let listId = null;
  let textBody = '';

  if (type === 'interactive') {
    if (message.interactive.type === 'button_reply') {
      buttonId = message.interactive.button_reply.id;
    } else if (message.interactive.type === 'list_reply') {
      listId = message.interactive.list_reply.id;
    }
  } else if (type === 'text') {
    textBody = (message.text?.body || '').trim();
  }

  const actionId = buttonId || listId;
  const lowerText = textBody.toLowerCase();

  // Global reset keywords (restart conversation)
  if (['restart', 'start', 'cancel', 'reset'].includes(lowerText)) {
    sessionManager.resetOrder(phone);
    session.returnState = null;
    session.state = STATES.SELECT_LANGUAGE;
    sessionManager.set(phone, session);
    return sendLanguageSelect(phone);
  }

  // Language Change Trigger:
  // User can click button, select list row, or type "lang"/"language" at ANY point
  const isChangeLangCmd =
    actionId === 'action_change_lang' ||
    actionId === 'opt_change_lang' ||
    ['lang', 'language', 'bhasha', 'भाषा', 'ভাষা', 'change lang', 'change language'].some(
      (cmd) => lowerText === cmd || lowerText === `/${cmd}`
    );

  if (isChangeLangCmd) {
    if (session.state !== STATES.SELECT_LANGUAGE) {
      session.returnState = session.state;
    }
    session.state = STATES.SELECT_LANGUAGE;
    sessionManager.set(phone, session);
    return sendLanguageSelect(phone);
  }

  // Greeting keywords
  if (['hi', 'hello', 'hey'].includes(lowerText)) {
    if (!session.lang) {
      session.state = STATES.SELECT_LANGUAGE;
      sessionManager.set(phone, session);
      return sendLanguageSelect(phone);
    }
    // If language already known, ask order method directly
    sessionManager.resetOrder(phone);
    session.returnState = null;
    session.state = STATES.SELECT_ORDER_TYPE;
    sessionManager.set(phone, session);
    return sendOrderTypeSelect(phone, session);
  }

  // 1. Language Selection Check
  if (!session.lang || session.state === STATES.SELECT_LANGUAGE || session.state === STATES.START) {
    let chosenLang = null;

    if (actionId === 'lang_en' || actionId === 'lang_bn' || actionId === 'lang_hi') {
      chosenLang = actionId.replace('lang_', '');
    } else if (lowerText === '1' || lowerText === 'en' || lowerText.includes('english')) {
      chosenLang = 'en';
    } else if (lowerText === '2' || lowerText === 'bn' || lowerText.includes('bangla') || lowerText.includes('বাংলা')) {
      chosenLang = 'bn';
    } else if (lowerText === '3' || lowerText === 'hi' || lowerText.includes('hindi') || lowerText.includes('हिन्दी') || lowerText.includes('हिंदी')) {
      chosenLang = 'hi';
    }

    if (chosenLang) {
      session.lang = chosenLang;
      // Resume whatever step they were at, or default to SELECT_ORDER_TYPE
      const resumeTarget = session.returnState || STATES.SELECT_ORDER_TYPE;
      session.state = resumeTarget;
      session.returnState = null;
      sessionManager.set(phone, session);
      return resumeStatePrompt(phone, session);
    }

    // Default: send language options
    return sendLanguageSelect(phone);
  }

  // State Machine Routing
  switch (session.state) {
    case STATES.SELECT_ORDER_TYPE:
      return handleSelectOrderTypeState(phone, session, actionId, type, textBody, message);

    case STATES.WAIT_TEXT_ORDER:
      return handleWaitTextOrderState(phone, session, type, textBody);

    case STATES.WAIT_PRESCRIPTION:
    case STATES.WAIT_PRESCRIPTION_MORE:
      return handleWaitPrescriptionState(phone, session, type, message);

    case STATES.WAIT_STRIP:
    case STATES.WAIT_STRIP_MORE:
      return handleWaitStripState(phone, session, type, message);

    case STATES.WAIT_VOICE:
      return handleWaitVoiceState(phone, session, type, message);

    case STATES.ASK_NAME:
      return handleAskNameState(phone, session, type, textBody);

    case STATES.ASK_ADDRESS:
      return handleAskAddressState(phone, session, type, message, textBody);

    case STATES.ASK_LANDMARK:
      return handleAskLandmarkState(phone, session, type, textBody);

    case STATES.ASK_PHONE:
      return handleAskPhoneState(phone, session, actionId, type, textBody);

    case STATES.ASK_PHONE_MANUAL:
      return handleAskPhoneManualState(phone, session, type, textBody);

    case STATES.ASK_ORDER_MORE:
      return handleAskOrderMoreState(phone, session, actionId, textBody);

    // Backwards compatibility for older sessions
    case STATES.MAIN_MENU:
      return handleMainMenuState(phone, session, actionId, type);

    case STATES.CONFIRM:
      return handleConfirmState(phone, session, actionId);

    case STATES.EDIT_SELECT:
      return handleEditSelectState(phone, session, actionId);

    case STATES.TRACK_ORDER:
      return handleTrackOrderState(phone, session, actionId);

    case STATES.TRACK_ORDER_INPUT:
      return handleTrackOrderInputState(phone, session, type, textBody);

    default:
      session.state = STATES.SELECT_ORDER_TYPE;
      sessionManager.set(phone, session);
      return sendOrderTypeSelect(phone, session);
  }
}

/**
 * Resumes and sends prompt for current state in selected language
 */
async function resumeStatePrompt(phone, session) {
  const lang = session.lang || 'en';

  switch (session.state) {
    case STATES.SELECT_ORDER_TYPE:
      return sendOrderTypeSelect(phone, session);

    case STATES.WAIT_TEXT_ORDER:
      return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'prompt_text_order'));

    case STATES.WAIT_PRESCRIPTION:
    case STATES.WAIT_PRESCRIPTION_MORE:
      return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'prompt_rx_upload'));

    case STATES.WAIT_STRIP:
    case STATES.WAIT_STRIP_MORE:
      return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'prompt_strip_upload'));

    case STATES.WAIT_VOICE:
      return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'prompt_voice_upload'));

    case STATES.ASK_NAME:
      return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'prompt_name'));

    case STATES.ASK_ADDRESS:
    case STATES.ASK_LANDMARK:
      return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'prompt_address'));

    case STATES.ASK_PHONE:
      return sendAskPhoneOptions(phone, session);

    case STATES.ASK_PHONE_MANUAL:
      return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'prompt_phone_manual'));

    case STATES.ASK_ORDER_MORE:
      return sendAskOrderMore(phone, session);

    default:
      return sendOrderTypeSelect(phone, session);
  }
}

/**
 * Box 1: Select Language
 */
async function sendLanguageSelect(phone) {
  const body = msg('en', 'welcome_language');
  const buttons = [
    { id: 'lang_en', title: 'English' },
    { id: 'lang_bn', title: 'বাংলা' },
    { id: 'lang_hi', title: 'हिन्दी' }
  ];
  return whatsapp.sendButtonMessage(phone, body, buttons);
}

/**
 * Box 2: Order Method Question & Interactive List (includes Change Language row)
 */
async function sendOrderTypeSelect(phone, session) {
  const lang = session.lang || 'en';
  session.state = STATES.SELECT_ORDER_TYPE;
  sessionManager.set(phone, session);

  const title = msg(lang, 'prompt_order_type');
  const btnLabel = msg(lang, 'list_order_btn');
  const sections = [
    {
      title: msg(lang, 'list_section_title'),
      rows: [
        {
          id: 'opt_text',
          title: msg(lang, 'row_text_title'),
          description: msg(lang, 'row_text_desc')
        },
        {
          id: 'opt_prescription',
          title: msg(lang, 'row_rx_title'),
          description: msg(lang, 'row_rx_desc')
        },
        {
          id: 'opt_strip',
          title: msg(lang, 'row_strip_title'),
          description: msg(lang, 'row_strip_desc')
        },
        {
          id: 'opt_voice',
          title: msg(lang, 'row_voice_title'),
          description: msg(lang, 'row_voice_desc')
        },
        {
          id: 'opt_change_lang',
          title: msg(lang, 'row_lang_title'),
          description: msg(lang, 'row_lang_desc')
        }
      ]
    }
  ];

  return whatsapp.sendListMessage(phone, title, btnLabel, sections);
}

/**
 * Order Type Choice Handler (Box 2 -> Box 3a, 3b, 3c, 3d)
 */
async function handleSelectOrderTypeState(phone, session, actionId, type, textBody, message) {
  const lang = session.lang || 'en';
  const lowerText = textBody ? textBody.toLowerCase() : '';

  // 1. Write medicine name & quantity
  if (actionId === 'opt_text' || lowerText === '1' || lowerText.includes('নাম') || lowerText.includes('text') || lowerText.includes('name')) {
    session.order.orderType = 'Text Order';
    session.state = STATES.WAIT_TEXT_ORDER;
    sessionManager.set(phone, session);
    return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'prompt_text_order'));
  }

  // 2. Prescription photo
  if (actionId === 'opt_prescription' || lowerText === '2' || lowerText.includes('প্রেসক্রিপশন') || lowerText.includes('prescription') || lowerText.includes('rx') || lowerText.includes('पर्चा')) {
    session.order.orderType = 'Prescription';
    session.state = STATES.WAIT_PRESCRIPTION;
    sessionManager.set(phone, session);
    return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'prompt_rx_upload'));
  }

  // 3. Medicine strip back photo
  if (actionId === 'opt_strip' || lowerText === '3' || lowerText.includes('পাতা') || lowerText.includes('strip') || lowerText.includes('पत्ता')) {
    session.order.orderType = 'Strip Photo';
    session.state = STATES.WAIT_STRIP;
    sessionManager.set(phone, session);
    return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'prompt_strip_upload'));
  }

  // 4. Voice message
  if (actionId === 'opt_voice' || lowerText === '4' || lowerText.includes('ভয়েস') || lowerText.includes('voice') || lowerText.includes('audio') || lowerText.includes('वॉयस')) {
    session.order.orderType = 'Voice Message';
    session.state = STATES.WAIT_VOICE;
    sessionManager.set(phone, session);
    return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'prompt_voice_upload'));
  }

  // Direct media handling if user uploads directly at this step
  if (type === 'image' || type === 'document') {
    session.order.orderType = 'Prescription';
    return handleWaitPrescriptionState(phone, session, type, message);
  }
  if (type === 'audio' || type === 'voice') {
    session.order.orderType = 'Voice Message';
    return handleWaitVoiceState(phone, session, type, message);
  }

  // Fallback: repeat order type list
  return sendOrderTypeSelect(phone, session);
}

/**
 * Box 3a: Wait Text Order Handler -> Box 4
 */
async function handleWaitTextOrderState(phone, session, type, textBody) {
  const lang = session.lang || 'en';

  if (type === 'text' && textBody.length > 0) {
    session.order.medicines = textBody;
    session.state = STATES.ASK_NAME;
    sessionManager.set(phone, session);
    return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'prompt_name'));
  }

  return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'invalid_type_text'));
}

/**
 * Box 3b: Wait Prescription State Handler -> Box 4 ("after getting image")
 */
async function handleWaitPrescriptionState(phone, session, type, message) {
  const lang = session.lang || 'en';

  if (type === 'image' || type === 'document') {
    const mediaId = message.image?.id || message.document?.id;
    if (mediaId) {
      try {
        const { buffer, mimeType } = await whatsapp.downloadMedia(mediaId);
        const ext = mimeType.includes('pdf') ? 'pdf' : mimeType.split('/')[1] || 'jpg';
        const link = await drive.uploadFile({
          buffer,
          mimeType,
          fileName: `prescription_${phone}_${Date.now()}.${ext}`
        });
        session.order.fileLinks.push(link);
      } catch (err) {
        logger.error({ phone, error: err.message }, 'Failed uploading prescription to Drive');
      }
    }

    session.order.medicines = 'Prescription attached';
    session.state = STATES.ASK_NAME;
    sessionManager.set(phone, session);
    return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'prompt_name'));
  }

  return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'invalid_type_rx'));
}

/**
 * Box 3c: Wait Strip Photo State Handler -> Box 4
 */
async function handleWaitStripState(phone, session, type, message) {
  const lang = session.lang || 'en';

  if (type === 'image') {
    const mediaId = message.image?.id;
    if (mediaId) {
      try {
        const { buffer, mimeType } = await whatsapp.downloadMedia(mediaId);
        const link = await drive.uploadFile({
          buffer,
          mimeType,
          fileName: `strip_${phone}_${Date.now()}.jpg`
        });
        session.order.fileLinks.push(link);
      } catch (err) {
        logger.error({ phone, error: err.message }, 'Failed uploading strip photo to Drive');
      }
    }

    session.order.medicines = 'Strip photo attached';
    session.state = STATES.ASK_NAME;
    sessionManager.set(phone, session);
    return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'prompt_name'));
  }

  return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'invalid_type_strip'));
}

/**
 * Box 3d: Wait Voice State Handler -> Box 4
 */
async function handleWaitVoiceState(phone, session, type, message) {
  const lang = session.lang || 'en';

  if (type === 'audio' || type === 'voice') {
    const mediaId = message.audio?.id || message.voice?.id;
    if (mediaId) {
      try {
        const { buffer, mimeType } = await whatsapp.downloadMedia(mediaId);
        const link = await drive.uploadFile({
          buffer,
          mimeType,
          fileName: `voice_order_${phone}_${Date.now()}.ogg`
        });
        session.order.fileLinks.push(link);
      } catch (err) {
        logger.error({ phone, error: err.message }, 'Failed uploading voice note to Drive');
      }
    }

    session.order.medicines = 'Voice message attached';
    session.state = STATES.ASK_NAME;
    sessionManager.set(phone, session);
    return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'prompt_name'));
  }

  return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'invalid_type_voice'));
}

/**
 * Box 4: Ask Name Handler -> Box 5
 */
async function handleAskNameState(phone, session, type, textBody) {
  const lang = session.lang || 'en';

  if (type === 'text' && validateName(textBody)) {
    session.order.customerName = textBody.trim();
    session.state = STATES.ASK_ADDRESS;
    sessionManager.set(phone, session);
    return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'prompt_address'));
  }

  return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'hint_name_invalid'));
}

/**
 * Box 5: Ask Address / Location Handler -> Box 6
 */
async function handleAskAddressState(phone, session, type, message, textBody) {
  const lang = session.lang || 'en';

  if (type === 'location') {
    const loc = message.location || {};
    const lat = loc.latitude;
    const lng = loc.longitude;
    session.order.mapLink = `https://maps.google.com/?q=${lat},${lng}`;
    session.order.address = loc.address || loc.name || `GPS: ${lat}, ${lng}`;

    session.state = STATES.ASK_PHONE;
    sessionManager.set(phone, session);
    return sendAskPhoneOptions(phone, session);
  }

  if (type === 'text' && textBody.trim().length >= 3) {
    session.order.address = textBody.trim();
    session.state = STATES.ASK_PHONE;
    sessionManager.set(phone, session);
    return sendAskPhoneOptions(phone, session);
  }

  return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'hint_address_invalid'));
}

/**
 * Landmark helper if reached from pin
 */
async function handleAskLandmarkState(phone, session, type, textBody) {
  if (type === 'text' && textBody.trim().length > 0) {
    session.order.address += ` | Landmark: ${textBody.trim()}`;
  }
  session.state = STATES.ASK_PHONE;
  sessionManager.set(phone, session);
  return sendAskPhoneOptions(phone, session);
}

/**
 * Box 6: Ask Phone Options Prompt (Includes Language Change button)
 */
async function sendAskPhoneOptions(phone, session) {
  const lang = session.lang || 'en';
  const body = msg(lang, 'prompt_phone_choice');
  const buttons = [
    { id: 'phone_same', title: msg(lang, 'btn_phone_same') },
    { id: 'phone_other', title: msg(lang, 'btn_phone_other') },
    { id: 'action_change_lang', title: msg(lang, 'btn_change_lang') }
  ];
  return whatsapp.sendButtonMessage(phone, body, buttons);
}

/**
 * Box 6 Handler:
 * - "এই নম্বর ব্যবহার" -> Box 8 & Box 9
 * - "অন্য নম্বর দিচ্ছি" -> Box 7
 */
async function handleAskPhoneState(phone, session, actionId, type, textBody) {
  const lang = session.lang || 'en';
  const lower = (textBody || '').toLowerCase();

  if (actionId === 'phone_same' || actionId === 'phone_use_wa' || ['1', 'same', 'this', 'এই নম্বর', 'यही'].some(k => lower.includes(k))) {
    const valid = validateIndianPhone(phone);
    session.order.phone = valid.isValid ? valid.normalized : phone;
    return completeOrderAndPromptMore(phone, session);
  }

  if (actionId === 'phone_other' || actionId === 'phone_manual' || ['2', 'other', 'অন্য', 'दूसरा'].some(k => lower.includes(k))) {
    session.state = STATES.ASK_PHONE_MANUAL;
    sessionManager.set(phone, session);
    return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'prompt_phone_manual'));
  }

  // If user directly sent 10-digit number
  if (type === 'text') {
    const valid = validateIndianPhone(textBody);
    if (valid.isValid) {
      session.order.phone = valid.normalized;
      return completeOrderAndPromptMore(phone, session);
    }
  }

  return sendAskPhoneOptions(phone, session);
}

/**
 * Box 7: Manual Phone Input Handler -> Box 8 & Box 9
 */
async function handleAskPhoneManualState(phone, session, type, textBody) {
  const lang = session.lang || 'en';

  if (type === 'text') {
    const valid = validateIndianPhone(textBody);
    if (valid.isValid) {
      session.order.phone = valid.normalized;
      return completeOrderAndPromptMore(phone, session);
    }

    const digits = textBody.replace(/\D/g, '');
    if (digits.length >= 10) {
      session.order.phone = digits.slice(-10);
      return completeOrderAndPromptMore(phone, session);
    }
  }

  return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'hint_phone_invalid'));
}

/**
 * Box 8 + Box 9: Order Received Confirmation & Ask Order More?
 */
async function completeOrderAndPromptMore(phone, session) {
  const lang = session.lang || 'en';
  const ord = session.order;

  // Append order to Google Sheets
  try {
    const res = await sheets.appendOrder({
      whatsappNumber: phone,
      customerName: ord.customerName || 'Customer',
      phone: ord.phone || phone,
      address: ord.address || '',
      mapLink: ord.mapLink || '',
      orderType: ord.orderType || 'General',
      medicines: ord.medicines || 'Order details attached',
      fileLinks: ord.fileLinks || [],
      notes: ord.notes || ''
    });
    logger.info({ phone, orderId: res?.orderId }, 'Order placed successfully');
  } catch (err) {
    logger.error({ phone, error: err.message }, 'Error saving order to Google Sheets');
  }

  // Box 8: Order received notification text
  await whatsapp.sendTextMessage(phone, withLangFooter(lang, 'order_received'));

  // Box 9: Interactive buttons "আরও অর্ডার করতে চান?" (হ্যাঁ / না / ভাষা পরিবর্তন)
  return sendAskOrderMore(phone, session);
}

/**
 * Box 9: Interactive Button Prompt (Includes Language Change button)
 */
async function sendAskOrderMore(phone, session) {
  const lang = session.lang || 'en';
  session.state = STATES.ASK_ORDER_MORE;
  sessionManager.set(phone, session);

  const buttons = [
    { id: 'order_more_yes', title: msg(lang, 'btn_yes') },
    { id: 'order_more_no', title: msg(lang, 'btn_no') },
    { id: 'action_change_lang', title: msg(lang, 'btn_change_lang') }
  ];

  return whatsapp.sendButtonMessage(phone, msg(lang, 'prompt_order_more'), buttons);
}

/**
 * Box 9 Handler:
 * - "হ্যাঁ" -> Loops back to Box 1 (Select language)
 * - "না" -> Box 10 (Thank you message)
 */
async function handleAskOrderMoreState(phone, session, actionId, textBody) {
  const lang = session.lang || 'en';
  const lower = (textBody || '').toLowerCase();

  const isYes = actionId === 'order_more_yes' || ['yes', 'y', 'হ্যাঁ', 'हाँ', 'ha', '1'].includes(lower);
  const isNo = actionId === 'order_more_no' || ['no', 'n', 'না', 'नहीं', 'nahi', '2'].includes(lower);

  if (isYes) {
    sessionManager.resetOrder(phone);
    session.returnState = null;
    session.state = STATES.SELECT_LANGUAGE;
    sessionManager.set(phone, session);
    return sendLanguageSelect(phone);
  }

  if (isNo) {
    sessionManager.resetOrder(phone);
    session.returnState = null;
    session.state = STATES.START;
    sessionManager.set(phone, session);
    return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'order_thank_you'));
  }

  // Fallback: repeat prompt
  return sendAskOrderMore(phone, session);
}

/**
 * Backwards compatibility helper for main menu
 */
async function sendMainMenu(phone, session) {
  return sendOrderTypeSelect(phone, session);
}

/**
 * Backwards compatibility handler for main menu
 */
async function handleMainMenuState(phone, session, actionId, type) {
  if (actionId === 'menu_order' || actionId === 'post_order_again') {
    return sendOrderTypeSelect(phone, session);
  }
  return sendOrderTypeSelect(phone, session);
}

/**
 * Backwards compatibility handler for confirm state
 */
async function handleConfirmState(phone, session, actionId) {
  if (actionId === 'confirm_order') {
    return completeOrderAndPromptMore(phone, session);
  }
  if (actionId === 'confirm_cancel') {
    sessionManager.resetOrder(phone);
    session.returnState = null;
    session.state = STATES.SELECT_LANGUAGE;
    sessionManager.set(phone, session);
    return sendLanguageSelect(phone);
  }
  return completeOrderAndPromptMore(phone, session);
}

/**
 * Backwards compatibility for edit select
 */
async function handleEditSelectState(phone, session, actionId) {
  return completeOrderAndPromptMore(phone, session);
}

/**
 * Backwards compatibility for tracking
 */
async function handleTrackOrderState(phone, session, actionId) {
  const lang = session.lang || 'en';
  return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'track_prompt_manual'));
}

async function handleTrackOrderInputState(phone, session, type, textBody) {
  const lang = session.lang || 'en';
  return whatsapp.sendTextMessage(phone, withLangFooter(lang, 'track_prompt_manual'));
}

async function sendOrderSummary(phone, session) {
  return completeOrderAndPromptMore(phone, session);
}

module.exports = {
  handleIncomingMessage,
  sendLanguageSelect,
  sendOrderTypeSelect,
  sendAskPhoneOptions,
  sendAskOrderMore,
  sendMainMenu,
  sendOrderSummary,
  completeOrderAndPromptMore
};
