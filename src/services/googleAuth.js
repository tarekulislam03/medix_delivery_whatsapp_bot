const fs = require('fs');
const { google } = require('googleapis');
const logger = require('../utils/logger');

let cachedAuth = null;

/**
 * Parses Google Service Account credentials from environment variables.
 * Supports:
 * 1. File path to JSON file
 * 2. Base64-encoded JSON string
 * 3. Raw JSON string
 * 4. Fallback to GOOGLE_APPLICATION_CREDENTIALS
 *
 * @returns {object|null} parsed credentials or null
 */
function getCredentials() {
  const envVal = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!envVal) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      return null; // GoogleAuth will read GOOGLE_APPLICATION_CREDENTIALS automatically
    }
    logger.warn('GOOGLE_SERVICE_ACCOUNT_JSON is not defined in environment');
    return null;
  }

  // 1. Check if it's a file path
  if (fs.existsSync(envVal)) {
    try {
      const content = fs.readFileSync(envVal, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to read credentials file path');
    }
  }

  // 2. Check if it's a raw JSON string
  const trimmed = envVal.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed);
    } catch (err) {
      logger.error({ err: err.message }, 'Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON as JSON string');
    }
  }

  // 3. Check if it's a base64 encoded string
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    if (decoded.trim().startsWith('{')) {
      return JSON.parse(decoded);
    }
  } catch {
    // Not valid base64
  }

  logger.error('GOOGLE_SERVICE_ACCOUNT_JSON could not be resolved as file path, JSON string, or base64');
  return null;
}

/**
 * Returns an authenticated GoogleAuth client
 * @param {string[]} scopes
 * @returns {google.auth.GoogleAuth}
 */
function getGoogleAuth(scopes = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive'
]) {
  if (cachedAuth) {
    return cachedAuth;
  }

  const credentials = getCredentials();
  const options = { scopes };

  if (credentials) {
    options.credentials = credentials;
  }

  cachedAuth = new google.auth.GoogleAuth(options);
  return cachedAuth;
}

module.exports = {
  getGoogleAuth,
  getCredentials
};
