/**
 * Localization and template messages for English, Bengali (বাংলা), and Hindi (हिन्दी).
 * Structured according to the Medix WhatsApp Order Flow:
 * Language Selection -> Order Method -> Input -> Name -> Location/Address -> Phone Choice -> Order Placed -> Order More? -> Thank You
 *
 * All texts and button labels respect WhatsApp Cloud API character constraints:
 * - Button titles: <= 20 chars
 * - List row titles: <= 24 chars
 * - List row descriptions: <= 72 chars
 * - List button labels: <= 20 chars
 * - Body text: <= 1024 chars
 */

const MESSAGES = {
  en: {
    // 1. Language Selection
    welcome_language: 'Select the language',
    btn_lang_en: 'English',
    btn_lang_bn: 'বাংলা',
    btn_lang_hi: 'हिन्दी',

    // Language switch option for every reply
    btn_change_lang: '🌐 Language',
    row_lang_title: '🌐 Change Language',
    row_lang_desc: 'Switch English / বাংলা / हिन्दी',
    lang_footer: '\n\n_💬 Reply "lang" to change language._',

    // 2. Order Method Question & List
    prompt_order_type: 'How would you like to order medicine?',
    list_order_title: 'How would you like to order medicine?',
    list_order_btn: 'Choose Option',
    list_section_title: 'Order Methods',

    row_text_title: 'Type medicine name',
    row_text_desc: 'Write medicine name and quantity',
    row_rx_title: 'Prescription photo',
    row_rx_desc: 'Send clear photo of prescription',
    row_strip_title: 'Strip back photo',
    row_strip_desc: 'Photo of back side of medicine strip',
    row_voice_title: 'Voice message',
    row_voice_desc: 'Send voice note with medicine name',

    // 3. Inputs for each method
    prompt_text_order: 'Send the medicine name and quantity written like this (e.g. Calpol 650 - 2)',
    prompt_rx_upload: 'Please take and send a clear photo of the prescription so that all writing is clearly visible',
    prompt_strip_upload: 'Please take and send a clear photo of the back side of the medicine strip so that the medicine name is legible',
    prompt_voice_upload: 'Please send a voice message stating the medicine name and quantity',

    // 4. Name
    prompt_name: 'Okay, what is your full name?',
    hint_name_invalid: 'Please enter your full name (at least 2 letters):',

    // 5. Address / Location
    prompt_address: 'Send your location here, or type it out (Village, Post Office, PIN code)',
    hint_address_invalid: 'Please provide your address (Village, Post Office, PIN code) or share your location pin:',

    // 6. Phone Choice
    prompt_phone_choice: 'Should we contact you on this number for delivery, or on another number?',
    btn_phone_same: 'Use this number',
    btn_phone_other: 'Provide other number',

    // 7. Manual Phone
    prompt_phone_manual: 'Please send the other number',
    hint_phone_invalid: 'Invalid phone number. Please send a valid 10-digit mobile number:',

    // 8. Order Received
    order_received: 'Okay, your order has been received. We will send you the bill shortly. Once you confirm it, the delivery process will begin.',

    // 9. Order More?
    prompt_order_more: 'Do you want to order more?',
    btn_yes: 'Yes',
    btn_no: 'No',

    // 10. Final Thank You
    order_thank_you: 'Thank you for ordering. Order anytime for any medicine needs.',

    // Fallbacks and system strings
    invalid_type_text: 'Please send the medicine name and quantity in text.',
    invalid_type_rx: 'Please send a photo or PDF of your prescription.',
    invalid_type_strip: 'Please send a clear photo of the medicine strip.',
    invalid_type_voice: 'Please send an audio voice message.',
    error_generic: 'Sorry, something went wrong. Please try again in a moment.',

    // Backwards compatibility keys
    welcome_menu: 'Welcome to *Medix Pharmacy Delivery* 🏥\nFast, reliable medicine delivery at your doorstep.\nHow can we help you today?',
    btn_order: 'Order Medicine',
    btn_track: 'Track Order',
    btn_support: 'Talk to Team',
    btn_back_menu: 'Main Menu',
    btn_confirm: 'Confirm Order',
    btn_edit: 'Edit Details',
    btn_cancel: 'Cancel',
    summary_header: '📋 *Order Summary*\n\n',
    summary_type: '• *Order Type:* ',
    summary_medicines: '• *Medicines / Files:* ',
    summary_name: '• *Name:* ',
    summary_address: '• *Address:* ',
    summary_phone: '• *Phone:* ',
    summary_footer: '\nPlease confirm if all details are correct:',
    order_success: '🎉 Thank you, *{name}*!\nYour order has been placed.\n\n*Order ID:* `{orderId}`\n\nOur pharmacy team will confirm shortly.',
    track_prompt_recent: 'Here are your recent orders:',
    track_list_btn: 'Select Order',
    track_manual_title: 'Enter Order ID',
    track_manual_desc: 'Type your Order ID manually',
    track_prompt_manual: 'Please enter your Order ID:',
    track_not_found: '❌ Order ID *{orderId}* not found.',
    track_found: '📦 *Order Details*\n• *Order ID:* `{orderId}`\n• *Date:* {date}\n• *Status:* *{status}*\n• *Price:* {price}\n• *Items:* {items}',
    price_pending: 'Pending price confirmation',
    support_reply: '👨‍⚕️ Our pharmacy team has been notified. A representative will contact you shortly.'
  },

  bn: {
    // 1. Language Selection
    welcome_language: 'Select the language',
    btn_lang_en: 'English',
    btn_lang_bn: 'বাংলা',
    btn_lang_hi: 'हिन्दी',

    // Language switch option for every reply
    btn_change_lang: '🌐 ভাষা পরিবর্তন',
    row_lang_title: '🌐 ভাষা পরিবর্তন',
    row_lang_desc: 'English / বাংলা / हिन्दी পরিবর্তন করুন',
    lang_footer: '\n\n_💬 ভাষা পরিবর্তন করতে "lang" লিখুন।_',

    // 2. Order Method Question & List
    prompt_order_type: 'ওষুধ কীভাবে অর্ডার করতে চান?',
    list_order_title: 'ওষুধ কীভাবে অর্ডার করতে চান?',
    list_order_btn: 'অপশন বাছুন',
    list_section_title: 'অর্ডার পদ্ধতি',

    row_text_title: 'ওষুধের নাম লিখে',
    row_text_desc: 'ওষুধের নাম আর পরিমাণ লিখে',
    row_rx_title: 'প্রেসক্রিপশনের ছবি দিয়ে',
    row_rx_desc: 'প্রেসক্রিপশনের ছবি ভালো করে তুলে',
    row_strip_title: 'পাতার পেছনের ছবি',
    row_strip_desc: 'ওষুধের পাতার পেছনের দিকের ছবি',
    row_voice_title: 'ভয়েস মেসেজ করে',
    row_voice_desc: 'ভয়েস মেসেজে ওষুধের নাম ও পরিমাণ',

    // 3. Inputs for each method
    prompt_text_order: 'ওষুধের নাম আর পরিমাণ এভাবে লিখে পাঠান (যেমন: Calpol 650 - 2)',
    prompt_rx_upload: 'প্রেসক্রিপশনের ছবিটা ভালো করে তুলে পাঠান, যাতে সব লেখা পরিষ্কার বোঝা যায়',
    prompt_strip_upload: 'ওষুধের পাতার পেছনের দিকের ছবিটা ভালো করে তুলে পাঠান, যাতে ওষুধের নাম বোঝা যায়',
    prompt_voice_upload: 'ভয়েস মেসেজে ওষুধের নাম আর পরিমাণ বলে পাঠান',

    // 4. Name
    prompt_name: 'ঠিক আছে, আপনার পুরো নামটা কী?',
    hint_name_invalid: 'অনুগ্রহ করে আপনার পুরো নাম লিখে পাঠান:',

    // 5. Address / Location
    prompt_address: 'আপনার লোকেশনটা এখানে পাঠিয়ে দিন, অথবা লিখে পাঠান (গ্রাম, পোস্ট অফিস, পিন কোড)',
    hint_address_invalid: 'অনুগ্রহ করে ঠিকানা লিখে পাঠান (গ্রাম, পোস্ট অফিস, পিন কোড) অথবা লোকেশন পিন দিন:',

    // 6. Phone Choice
    prompt_phone_choice: 'ডেলিভারির জন্য কি এই নম্বরেই যোগ করব, নাকি অন্য নম্বরে?',
    btn_phone_same: 'এই নম্বর ব্যবহার',
    btn_phone_other: 'অন্য নম্বর দিচ্ছি',

    // 7. Manual Phone
    prompt_phone_manual: 'অন্য নম্বরটা পাঠিয়ে দিন',
    hint_phone_invalid: 'সঠিক ১০ সংখ্যার ভারতীয় মোবাইল নম্বর দিন:',

    // 8. Order Received
    order_received: 'ঠিক আছে, আপনার অর্ডার নেওয়া হয়ে গেছে। কিছুক্ষণের মধ্যেই আপনাকে বিল পাঠিয়ে দিচ্ছি। তারপর আপনি কনফার্ম করলে ডেলিভারির কাজ শুরু হবে।',

    // 9. Order More?
    prompt_order_more: 'আরও অর্ডার করতে চান?',
    btn_yes: 'হ্যাঁ',
    btn_no: 'না',

    // 10. Final Thank You
    order_thank_you: 'অর্ডার করার জন্য ধন্যবাদ। ওষুধের যেকোনো দরকারে যেকোনো সময় অর্ডার করুন।',

    // Fallbacks and system strings
    invalid_type_text: 'অনুগ্রহ করে ওষুধের নাম ও পরিমাণ লিখে পাঠান।',
    invalid_type_rx: 'অনুগ্রহ করে প্রেসক্রিপশনের পরিষ্কার ছবি তুলে পাঠান।',
    invalid_type_strip: 'অনুগ্রহ করে পাতার পেছনের দিকের ছবি তুলে পাঠান।',
    invalid_type_voice: 'অনুগ্রহ করে ভয়েস মেসেজ পাঠিয়ে জানান।',
    error_generic: 'দুঃখিত, কোনো সমস্যা হয়েছে। একটু পর আবার চেষ্টা করুন।',

    // Backwards compatibility keys
    welcome_menu: '*মেডিক্স ফার্মেসি ডেলিভারি*-তে স্বাগতম 🏥\nদ্রুত এবং বিশ্বস্ত ওষুধ ডেলিভারি আপনার ঠিকানায়।\nআমরা আপনাকে কীভাবে সাহায্য করতে পারি?',
    btn_order: 'ওষুধ অর্ডার',
    btn_track: 'অর্ডার ট্র্যাক',
    btn_support: 'টিমের সাথে কথা',
    btn_back_menu: 'প্রধান মেনু',
    btn_confirm: 'অর্ডার নিশ্চিত',
    btn_edit: 'তথ্য পরিবর্তন',
    btn_cancel: 'বাতিল করুন',
    summary_header: '📋 *অর্ডারের বিবরণ*\n\n',
    summary_type: '• *অর্ডারের ধরন:* ',
    summary_medicines: '• *ওষুধ / ফাইল:* ',
    summary_name: '• *নাম:* ',
    summary_address: '• *ঠিকানা:* ',
    summary_phone: '• *ফোন:* ',
    summary_footer: '\nসব তথ্য ঠিক থাকলে অর্ডার নিশ্চিত করুন:',
    order_success: '🎉 ধন্যবাদ, *{name}*!\nআপনার অর্ডার গ্রহণ করা হয়েছে।\n\n*অর্ডার আইডি:* `{orderId}`\n\nআমাদের ফার্মাসিস্ট শীঘ্রই দাম নিশ্চিত করবেন।',
    track_prompt_recent: 'আপনার সাম্প্রতিক অর্ডার সমূহ:',
    track_list_btn: 'অর্ডার বাছুন',
    track_manual_title: 'আইডি লিখুন',
    track_manual_desc: 'অর্ডার আইডি লিখে সার্চ করুন',
    track_prompt_manual: 'আপনার অর্ডার আইডি লিখুন:',
    track_not_found: '❌ অর্ডার আইডি *{orderId}* খুঁজে পাওয়া যায়নি।',
    track_found: '📦 *অর্ডারের তথ্য*\n• *আইডি:* `{orderId}`\n• *তারিখ:* {date}\n• *স্ট্যাটাস:* *{status}*\n• *মূল্য:* {price}\n• *আইটেম:* {items}',
    price_pending: 'দাম নির্ধারণের অপেক্ষায়',
    support_reply: '👨‍⚕️ আমাদের টিমকে জানানো হয়েছে। শীঘ্রই আপনার সাথে যোগাযোগ করা হবে।'
  },

  hi: {
    // 1. Language Selection
    welcome_language: 'Select the language',
    btn_lang_en: 'English',
    btn_lang_bn: 'বাংলা',
    btn_lang_hi: 'हिन्दी',

    // Language switch option for every reply
    btn_change_lang: '🌐 भाषा बदलें',
    row_lang_title: '🌐 भाषा बदलें',
    row_lang_desc: 'English / বাংলা / हिन्दी बदलें',
    lang_footer: '\n\n_💬 भाषा बदलने के लिए "lang" लिखें।_',

    // 2. Order Method Question & List
    prompt_order_type: 'आप दवाई कैसे ऑर्डर करना चाहते हैं?',
    list_order_title: 'आप दवाई कैसे ऑर्डर करना चाहते हैं?',
    list_order_btn: 'विकल्प चुनें',
    list_section_title: 'ऑर्डर के तरीके',

    row_text_title: 'दवाई का नाम लिखकर',
    row_text_desc: 'दवाई का नाम और मात्रा लिखकर',
    row_rx_title: 'पर्चे की फोटो भेजकर',
    row_rx_desc: 'डॉक्टर के पर्चे की साफ फोटो',
    row_strip_title: 'पत्ते के पीछे की फोटो',
    row_strip_desc: 'दवाई के पत्ते के पीछे की फोटो',
    row_voice_title: 'वॉयस मैसेज भेजकर',
    row_voice_desc: 'बोलकर दवाई का नाम और मात्रा बताएं',

    // 3. Inputs for each method
    prompt_text_order: 'दवाई का नाम और मात्रा इस तरह लिखकर भेजें (जैसे: Calpol 650 - 2)',
    prompt_rx_upload: 'पर्चे की साफ फोटो खींचकर भेजें, ताकि सभी लिखावट साफ दिखाई दे',
    prompt_strip_upload: 'दवाई के पत्ते के पीछे की साफ फोटो भेजें, ताकि दवाई का नाम साफ दिखे',
    prompt_voice_upload: 'वॉयस मैसेज में दवाई का नाम और मात्रा बोलकर भेजें',

    // 4. Name
    prompt_name: 'ठीक है, आपका पूरा नाम क्या है?',
    hint_name_invalid: 'कृपया अपना पूरा नाम लिखकर भेजें:',

    // 5. Address / Location
    prompt_address: 'अपनी लोकेशन यहाँ भेजें, या लिखकर भेजें (गाँव, पोस्ट ऑफिस, पिन कोड)',
    hint_address_invalid: 'कृपया पता लिखकर भेजें (गाँव, पोस्ट ऑफिस, पिन कोड) या लोकेशन पिन भेजें:',

    // 6. Phone Choice
    prompt_phone_choice: 'डिलीवरी के लिए क्या इसी नंबर पर संपर्क करें, या किसी अन्य नंबर पर?',
    btn_phone_same: 'यही नंबर इस्तेमाल',
    btn_phone_other: 'दूसरा नंबर दें',

    // 7. Manual Phone
    prompt_phone_manual: 'कृपया दूसरा नंबर भेज दीजिए',
    hint_phone_invalid: 'अमान्य नंबर। कृपया १० अंकों का भारतीय मोबाइल नंबर दर्ज करें:',

    // 8. Order Received
    order_received: 'ठीक है, आपका ऑर्डर ले लिया गया है। कुछ ही देर में हम आपको बिल भेज देंगे। फिर आपके कन्फर्म करने पर डिलीवरी शुरू होगी।',

    // 9. Order More?
    prompt_order_more: 'क्या आप और ऑर्डर करना चाहते हैं?',
    btn_yes: 'हाँ',
    btn_no: 'नहीं',

    // 10. Final Thank You
    order_thank_you: 'ऑर्डर करने के लिए धन्यवाद। दवाई की किसी भी ज़रूरत के लिए कभी भी ऑर्डर करें।',

    // Fallbacks and system strings
    invalid_type_text: 'कृपया दवाई का नाम और मात्रा लिखकर भेजें।',
    invalid_type_rx: 'कृपया पर्चे की साफ फोटो भेजें।',
    invalid_type_strip: 'कृपया पत्ते के पीछे की साफ फोटो भेजें।',
    invalid_type_voice: 'कृपया वॉयस मैसेज रिकॉर्ड करके भेजें।',
    error_generic: 'क्षमा करें, कुछ समस्या आई। कृपया थोड़ी देर बाद पुनः प्रयास करें।',

    // Backwards compatibility keys
    welcome_menu: '*मेडिक्स फार्मेसी डिलीवरी* में आपका स्वागत है 🏥\nतेज़ और भरोसेमंद दवाई डिलीवरी।\nहम आपकी क्या मदद कर सकते हैं?',
    btn_order: 'दवाई ऑर्डर करें',
    btn_track: 'ऑर्डर ट्रैक',
    btn_support: 'टीम से बात करें',
    btn_back_menu: 'मुख्य मेनू',
    btn_confirm: 'ऑर्डर कन्फर्म',
    btn_edit: 'विवरण बदलें',
    btn_cancel: 'रद्द करें',
    summary_header: '📋 *ऑर्डर विवरण*\n\n',
    summary_type: '• *ऑर्डर प्रकार:* ',
    summary_medicines: '• *दवाइयां / फाइलें:* ',
    summary_name: '• *नाम:* ',
    summary_address: '• *पता:* ',
    summary_phone: '• *फोन:* ',
    summary_footer: '\nकृपया पुष्टि करें कि सभी जानकारी सही है:',
    order_success: '🎉 धन्यवाद, *{name}*!\nआपका ऑर्डर स्वीकार कर लिया गया है।\n\n*ऑर्डर आईडी:* `{orderId}`\n\nहमारी फार्मेसी टीम जल्द ही मूल्य कन्फर्म करेगी।',
    track_prompt_recent: 'आपके हालिया ऑर्डर:',
    track_list_btn: 'ऑर्डर चुनें',
    track_manual_title: 'आईडी लिखें',
    track_manual_desc: 'ऑर्डर आईडी लिखकर जांचें',
    track_prompt_manual: 'कृपया अपनी ऑर्डर आईडी दर्ज करें:',
    track_not_found: '❌ ऑर्डर आईडी *{orderId}* नहीं मिली।',
    track_found: '📦 *ऑर्डर विवरण*\n• *आईडी:* `{orderId}`\n• *दिनांक:* {date}\n• *स्थिति:* *{status}*\n• *मूल्य:* {price}\n• *दवाइयां:* {items}',
    price_pending: 'मूल्य पुष्टि लंबित',
    support_reply: '👨‍⚕️ हमारी टीम को सूचित कर दिया गया है। जल्द ही आपसे संपर्क किया जाएगा।'
  }
};

/**
 * Returns translated string or formatted template
 * @param {string} lang - 'en' | 'bn' | 'hi'
 * @param {string} key
 * @param {object} [vars]
 * @returns {string}
 */
function msg(lang = 'en', key, vars = {}) {
  const dictionary = MESSAGES[lang] || MESSAGES.en;
  let text = dictionary[key] || MESSAGES.en[key] || key;

  for (const [varName, val] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{${varName}\\}`, 'g'), val);
  }

  return text;
}

module.exports = {
  MESSAGES,
  msg
};
