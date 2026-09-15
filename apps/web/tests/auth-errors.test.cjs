const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../lib/auth-error.ts');
const loaded = new Module(filename, module);
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { authErrorMessage } = loaded.exports;

test('registration transport errors identify the account service', () => {
  for (const text of ['Failed to fetch', 'Load failed', 'Network request failed']) {
    const message = authErrorMessage(new TypeError(text));
    assert.match(message, /账户验证服务/);
    assert.doesNotMatch(message, /密码|注册成功|后端地址/);
  }
  const retry = new Error('Temporary request failure');
  retry.name = 'AuthRetryableFetchError';
  assert.match(authErrorMessage(retry), /账户验证服务/);
});

test('credential and validation errors preserve their explanation', () => {
  assert.equal(authErrorMessage(new Error('密码至少需要 8 位')), '密码至少需要 8 位');
  assert.equal(authErrorMessage(new Error('Invalid login credentials')), 'Invalid login credentials');
  assert.equal(authErrorMessage(null), '请求失败，请稍后重试');
});
