const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Run the current source without requiring a generated dist directory.
const filename = path.resolve(__dirname, '../src/index.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = module.paths;
loaded._compile(compiled, filename);
const { LifolioAPIClient, APIError } = loaded.exports;

const messages = [{ role: 'user', content: '今天午饭花了 28 元' }];
const client = (streamFetch) => new LifolioAPIClient({
  baseUrl: 'https://lifolio.test/', getToken: async () => 'test-token', streamFetch,
});
const collect = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks.join('');
};
function response(text, bytewise = false, onCancel) {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new Response(new ReadableStream({
    pull(controller) {
      if (offset === bytes.length) return controller.close();
      const end = bytewise ? offset + 1 : bytes.length;
      controller.enqueue(bytes.slice(offset, end));
      offset = end;
    },
    cancel: onCancel,
  }), { headers: { 'Content-Type': 'text/event-stream' } });
}

test('SSE handles UTF-8, CRLF and JSON split at every byte', async () => {
  const api = client(async (url, init) => {
    assert.equal(url, 'https://lifolio.test/api/ai/chat');
    assert.equal(init.headers.Authorization, 'Bearer test-token');
    assert.equal(JSON.parse(init.body).conversation_id, 'conversation-1');
    return response(': heartbeat\r\n\r\ndata: {"content":"你好，"}\r\n\r\ndata:{"content":"世界✦"}\r\n\r\ndata: [DONE]\r\n\r\n', true);
  });
  assert.equal(await collect(api.streamChat(messages, { conversationId: 'conversation-1' })), '你好，世界✦');
});

test('SSE supports multiline data and terminal event without blank line', async () => {
  const api = client(async () => response('data: {\ndata: "content": "hello"}\n\ndata: [DONE]'));
  assert.equal(await collect(api.streamChat(messages)), 'hello');
});

test('provider errors are surfaced instead of treated as a successful empty reply', async () => {
  const api = client(async () => response('data: {"error":"模型连接失败"}\n\ndata: [DONE]\n\n'));
  await assert.rejects(collect(api.streamChat(messages)), e => e instanceof APIError && e.message === '模型连接失败');
});

test('persistence warnings reach the UI while preserving the received reply', async () => {
  const warnings = [];
  const api = client(async () => response('data: {"content":"回答"}\n\ndata: {"warning":"消息未保存"}\n\ndata: [DONE]\n\n'));
  assert.equal(await collect(api.streamChat(messages, { onWarning: text => warnings.push(text) })), '回答');
  assert.deepEqual(warnings, ['消息未保存']);
});

test('malformed events and truncated streams fail explicitly', async () => {
  for (const [text, code] of [
    ['data: invalid\n\n', 'invalid_stream'],
    ['data: {"content":"部分回答"}\n\n', 'incomplete_stream'],
  ]) {
    await assert.rejects(collect(client(async () => response(text)).streamChat(messages)), e => e.code === code);
  }
});

test('API authentication and validation errors retain readable details', async () => {
  for (const [status, detail, expected] of [
    [401, '请重新登录', '请重新登录'],
    [422, [{ msg: '金额必须大于零' }], '金额必须大于零'],
  ]) {
    const api = client(async () => Response.json({ detail }, { status }));
    await assert.rejects(collect(api.streamChat(messages)), e => e.status === status && e.message === expected);
  }
});

test('pre-aborted requests never contact the backend', async () => {
  const controller = new AbortController();
  controller.abort();
  let called = false;
  await assert.rejects(collect(client(async () => { called = true; }).streamChat(messages, { signal: controller.signal })), { name: 'AbortError' });
  assert.equal(called, false);
});

test('abort cancels a blocked reader and releases its lock', async () => {
  const controller = new AbortController();
  let cancelled = false;
  const res = new Response(new ReadableStream({ cancel() { cancelled = true; } }));
  const waiting = collect(client(async () => res).streamChat(messages, { signal: controller.signal }));
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  await assert.rejects(waiting, { name: 'AbortError' });
  assert.equal(cancelled, true);
  assert.equal(res.body.locked, false);
});

test('consumer stopping early also cancels the network reader', async () => {
  let cancelled = false;
  const res = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('data: {"content":"first"}\n\n')); },
    cancel() { cancelled = true; },
  }));
  for await (const chunk of client(async () => res).streamChat(messages)) {
    assert.equal(chunk, 'first');
    break;
  }
  assert.equal(cancelled, true);
  assert.equal(res.body.locked, false);
});

test('conversation and settings requests use authenticated expected routes and key semantics', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    calls.push({ url, ...init });
    return Response.json({ ok: true });
  });
  const api = client();
  await api.getConversations({ limit: 20, offset: 0 });
  await api.createConversation('午餐');
  await api.getConversation('test/id');
  await api.renameConversation('test/id', '九月消费');
  await api.deleteConversation('test/id');
  await api.updateLLMSettings({ chat_model: 'my-model', temperature: 0 });
  await api.testLLMSettings({ chat_model: 'draft-model', base_url: 'https://llm.test/v1' });
  await api.updateLLMSettings({ api_key: '' });
  await api.deleteLLMSettings();
  assert.equal(calls[0].url, 'https://lifolio.test/api/conversations?limit=20&offset=0');
  assert.equal(JSON.parse(calls[1].body).title, '午餐');
  assert.ok(calls[2].url.endsWith('/test%2Fid'));
  assert.equal(calls[3].method, 'PATCH');
  assert.equal(calls[4].method, 'DELETE');
  assert.deepEqual(JSON.parse(calls[5].body), { chat_model: 'my-model', temperature: 0 });
  assert.equal(JSON.parse(calls[6].body).chat_model, 'draft-model');
  assert.equal(JSON.parse(calls[7].body).api_key, '');
  assert.equal(calls[8].method, 'DELETE');
  assert.ok(calls.every(call => call.headers.Authorization === 'Bearer test-token'));
});

test('React Native multipart image form is reused, not nested', async t => {
  const form = new FormData();
  form.append('file', new Blob(['image']), 'receipt.jpg');
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    assert.equal(init.body, form);
    assert.equal(init.headers['Content-Type'], undefined);
    assert.equal(init.headers.Authorization, 'Bearer test-token');
    return Response.json({ type: 'transaction', confidence: 1 });
  });
  assert.equal((await client().analyzeImage(form)).type, 'transaction');
});
