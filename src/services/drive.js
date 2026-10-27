const { Readable } = require('stream');
const axios = require('axios');
const { google } = require('googleapis');
const { getGoogleAuth } = require('./googleAuth');
const logger = require('../utils/logger');

/**
 * Uploads a file buffer to Google Drive
 * Supports:
 * 1. GOOGLE_APPS_SCRIPT_URL (No Google Cloud Console needed!)
 * 2. Fallback to Google Service Account API if configured
 *
 * @param {object} params
 * @param {Buffer} params.buffer - Raw file buffer
 * @param {string} params.mimeType - File MIME type
 * @param {string} [params.fileName] - Name to save file as
 * @param {string} [params.folderId] - Target Google Drive folder ID
 * @returns {Promise<string>} Shareable link to the uploaded file
 */
async function uploadFile({ buffer, mimeType = 'image/jpeg', fileName, folderId }) {
  const targetFolderId = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
  const generatedName = fileName || `prescription_${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`;

  // 1. Google Apps Script Web App method (Simple, zero-GCP setup)
  if (process.env.GOOGLE_APPS_SCRIPT_URL) {
    try {
      const payload = {
        action: 'uploadFile',
        base64Data: buffer.toString('base64'),
        mimeType,
        fileName: generatedName,
        folderId: targetFolderId || ''
      };

      const res = await axios.post(process.env.GOOGLE_APPS_SCRIPT_URL, payload, {
        headers: { 'Content-Type': 'application/json' },
        maxContentLength: 50 * 1024 * 1024,
        timeout: 45000
      });

      if (res.data?.fileUrl) {
        logger.info({ fileName: generatedName, fileUrl: res.data.fileUrl }, 'File uploaded via Google Apps Script');
        return res.data.fileUrl;
      }
    } catch (appsScriptErr) {
      logger.error({ error: appsScriptErr.message }, 'Failed uploading via Google Apps Script');
      throw appsScriptErr;
    }
  }

  // 2. Fallback: Google Cloud Service Account
  try {
    const auth = getGoogleAuth();
    const drive = google.drive({ version: 'v3', auth });

    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);

    const fileMetadata = {
      name: generatedName,
      parents: targetFolderId ? [targetFolderId] : []
    };

    const media = {
      mimeType,
      body: readableStream
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, name, webViewLink, webContentLink'
    });

    const fileId = file.data.id;
    let shareableLink = file.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

    try {
      await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' }
      });
    } catch (permErr) {
      logger.warn({ fileId, error: permErr.message }, 'Could not set public permission on Drive file');
    }

    logger.info({ fileId, fileName: generatedName }, 'Uploaded file to Google Drive via Service Account');
    return shareableLink;
  } catch (err) {
    logger.error({ fileName: generatedName, error: err.message }, 'Failed to upload file to Google Drive');
    throw err;
  }
}

module.exports = {
  uploadFile
};
