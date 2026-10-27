/**
 * Utility functions for validating customer inputs
 */

/**
 * Validates and normalizes Indian mobile phone numbers.
 * Supports: +91, 0, spaces, dashes.
 * Must resolve to a 10-digit number starting with 6, 7, 8, or 9.
 *
 * @param {string} rawPhone
 * @returns {{ isValid: boolean, normalized: string|null }}
 */
function validateIndianPhone(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return { isValid: false, normalized: null };
  }

  // Remove all non-digit characters
  const digits = rawPhone.replace(/\D/g, '');

  let normalized = null;

  if (digits.length === 10) {
    normalized = digits;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    normalized = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    normalized = digits.slice(2);
  } else if (digits.length === 13 && digits.startsWith('091')) {
    normalized = digits.slice(3);
  }

  // Indian mobile numbers must start with 6, 7, 8, or 9
  if (normalized && /^[6-9]\d{9}$/.test(normalized)) {
    return { isValid: true, normalized };
  }

  return { isValid: false, normalized: null };
}

/**
 * Validates customer full name (min 2 characters, sensible letters/spaces)
 * @param {string} name
 * @returns {boolean}
 */
function validateName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 80;
}

/**
 * Validates delivery address (min 10 characters)
 * @param {string} address
 * @returns {boolean}
 */
function validateAddress(address) {
  if (!address || typeof address !== 'string') return false;
  const trimmed = address.trim();
  return trimmed.length >= 10 && trimmed.length <= 500;
}

/**
 * Validates Order ID format: MDX-YYMMDD-XXXX
 * @param {string} orderId
 * @returns {boolean}
 */
function validateOrderId(orderId) {
  if (!orderId || typeof orderId !== 'string') return false;
  const regex = /^MDX-\d{6}-[A-Z0-9]{4}$/i;
  return regex.test(orderId.trim());
}

module.exports = {
  validateIndianPhone,
  validateName,
  validateAddress,
  validateOrderId
};
