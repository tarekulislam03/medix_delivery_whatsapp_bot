const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { verifySignature } = require('../src/routes/webhook');

test('webhook - verifySignature returns true for valid HMAC SHA-256 signature', () => {
  const secret = 'test_app_secret_12345';
  process.env.WHATSAPP_APP_SECRET = secret;

  const body = JSON.stringify({ entry: [{ id: '123' }] });
  const rawBody = Buffer.from(body);
  const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  const req = {
    headers: {
      'x-hub-signature-256': `sha256=${hash}`
    },
    rawBody,
    body: JSON.parse(body)
  };

  const isValid = verifySignature(req);
  assert.strictEqual(isValid, true);
});

test('webhook - verifySignature returns false for mismatched signature', () => {
  process.env.WHATSAPP_APP_SECRET = 'correct_secret';

  const body = JSON.stringify({ entry: [] });
  const rawBody = Buffer.from(body);
  const wrongHash = crypto.createHmac('sha256', 'wrong_secret').update(rawBody).digest('hex');

  const req = {
    headers: {
      'x-hub-signature-256': `sha256=${wrongHash}`
    },
    rawBody,
    body: JSON.parse(body)
  };

  const isValid = verifySignature(req);
  assert.strictEqual(isValid, false);
});

test('webhook - verifySignature returns false when signature header is missing', () => {
  process.env.WHATSAPP_APP_SECRET = 'some_secret';
  const req = {
    headers: {},
    rawBody: Buffer.from('{}'),
    body: {}
  };

  assert.strictEqual(verifySignature(req), false);
});
