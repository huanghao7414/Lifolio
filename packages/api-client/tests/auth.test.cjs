const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../../shared-types/src/index.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);

test('phone input normalizes Chinese numbers and preserves explicit international prefixes', () => {
  assert.equal(loaded.exports.normalizePhone('138 1234 5678'), '+8613812345678');
  assert.equal(loaded.exports.normalizePhone('+1 (415) 555-1234'), '+14155551234');
  assert.equal(loaded.exports.normalizePhone('+44 7700 900123'), '+447700900123');
});
test('invalid or ambiguous phone input never becomes an OTP destination', () => {
  for (const input of ['', '123', '4155551234', '+0123456789', 'test@example.com', '+86138<script>', '+1234567890123456']) {
    assert.throws(() => loaded.exports.normalizePhone(input));
  }
});
