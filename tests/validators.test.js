const test = require('node:test');
const assert = require('node:assert');
const {
  validateIndianPhone,
  validateName,
  validateAddress,
  validateOrderId
} = require('../src/utils/validators');

test('validateIndianPhone - valid numbers', () => {
  const cases = [
    { input: '9876543210', expected: '9876543210' },
    { input: '+91 98765 43210', expected: '9876543210' },
    { input: '09876543210', expected: '9876543210' },
    { input: '+91-8123456789', expected: '8123456789' },
    { input: '917012345678', expected: '7012345678' },
    { input: '6200000000', expected: '6200000000' }
  ];

  for (const { input, expected } of cases) {
    const res = validateIndianPhone(input);
    assert.strictEqual(res.isValid, true, `Failed on ${input}`);
    assert.strictEqual(res.normalized, expected);
  }
});

test('validateIndianPhone - invalid numbers', () => {
  const invalidCases = [
    '1234567890',      // does not start with 6-9
    '5876543210',      // starts with 5
    '987654321',       // 9 digits
    '987654321000',    // too long
    'abcd987654',
    '',
    null,
    undefined
  ];

  for (const input of invalidCases) {
    const res = validateIndianPhone(input);
    assert.strictEqual(res.isValid, false, `Should be invalid: ${input}`);
    assert.strictEqual(res.normalized, null);
  }
});

test('validateName - validates min 2 chars', () => {
  assert.strictEqual(validateName('Dr'), true);
  assert.strictEqual(validateName('Rahul Kumar'), true);
  assert.strictEqual(validateName('A'), false);
  assert.strictEqual(validateName(''), false);
  assert.strictEqual(validateName('   '), false);
  assert.strictEqual(validateName(null), false);
});

test('validateAddress - validates min 10 chars', () => {
  assert.strictEqual(validateAddress('Flat 202, Sunshine Apts, MG Road'), true);
  assert.strictEqual(validateAddress('Short addr'), true); // exactly 10 chars
  assert.strictEqual(validateAddress('Too short'), false); // 9 chars
  assert.strictEqual(validateAddress(''), false);
  assert.strictEqual(validateAddress(null), false);
});

test('validateOrderId - checks MDX-YYMMDD-XXXX pattern', () => {
  assert.strictEqual(validateOrderId('MDX-261027-A1B2'), true);
  assert.strictEqual(validateOrderId('mdx-261027-a1b2'), true);
  assert.strictEqual(validateOrderId('MDX-240101-9999'), true);
  assert.strictEqual(validateOrderId('MDX-123-ABCD'), false);
  assert.strictEqual(validateOrderId('ORDER-123456'), false);
  assert.strictEqual(validateOrderId(''), false);
});
