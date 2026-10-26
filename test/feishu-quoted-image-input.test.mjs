import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import sharp from 'sharp';

import { FeishuHarnessBridge } from '../src/channels/feishu/bridge.mjs';
import { HarnessClient, HarnessRpcError } from '../src/channels/shared/harness-client.mjs';
import { stageInboundFiles } from '../src/channels/shared/inbound-file.mjs';

const MB = 1024 * 1024;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const SMALL_POLICY = { maxDownloadMb: 1, maxImageMb: 1, maxTotalMb: 1, maxImages: 20 };

function manifest(content) {
  const blocks = content.filter((part) => part.type === 'text' && part.text.includes('<dsh_im_files>'));
  assert.equal(blocks.length, 1);
  return JSON.parse(blocks[0].text.split('\n').find((line) => line.startsWith('{'))).files;
}

function post(...keys) {
  return JSON.stringify({
    title: '原图说明',
    content: [[{ tag: 'text', text: '比较这些图片' }], keys.map((image_key) => ({ tag: 'img', image_key }))],
  });
}

// Use the real Bridge, HarnessClient, file ingress, model image admission and
// compression. Only Feishu/Host transport is synthetic; no live account is used.
async function fixture(t, {
  quotedType = 'image', quotedContent = JSON.stringify({ image_key: 'img_quote' }),
  bytes = new Map(), policy, onPrompt, downloadError,
} = {}) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-feishu-quote-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const prompts = [];
  const staged = [];
  const downloads = [];
  const sent = [];
  const harness = new HarnessClient({
    baseUrl: 'http://127.0.0.1:3080', workspace: '/unused-configured-workspace',
    imageInputPolicy: policy,
    fileIngressExecutor: async ({ workspace, files, signal }) => {
      assert.equal(workspace, root);
      const batch = await stageInboundFiles({ files }, { workspace, signal, retention: 'persistent' });
      staged.push(batch);
      return batch;
    },
  });
  harness.ensureRunning = async () => true;
  harness.sessionExists = async () => true;
  harness.watchHarnessEvents = async () => {};
  harness.watchInteractions = async (_sessionId, { signal, onOpen }) => {
    onOpen();
    await new Promise((resolve) => {
      if (signal.aborted) resolve();
      else signal.addEventListener('abort', resolve, { once: true });
    });
  };
  harness.rpc = async (method, payload, _timeout, options) => {
    if (method === 'workspace.list') return { items: [], archivedSessionIds: [] };
    if (method === 'session.list') return { items: [{ sessionId: 'test-session', cwd: root }] };
    if (method === 'session.prompt') {
      prompts.push({ ...payload, rpcId: options.rpcId });
      await onPrompt?.(payload.content, prompts.length);
      return { accepted: true };
    }
    assert.equal(method, 'session.history');
    if (!prompts.length) return { events: [] };
    return { events: [
      { event: { seq: 1, type: 'turn/start', data: { turn: 1 } } },
      { event: { seq: 2, type: 'user/message', data: { turn: 1, source: { rpcId: prompts[0].rpcId } } } },
      { event: { seq: 3, type: 'assistant/message', data: { turn: 1, message: { content: [{ type: 'text', text: 'verified' }] } } } },
      { event: { seq: 4, type: 'turn/end', data: { turn: 1, reason: 'completed' } } },
    ] };
  };
  const client = { im: { v1: {
    message: {
      get: async () => ({ code: 0, data: { items: [{
        message_id: 'om_quote', chat_id: 'oc_same', msg_type: quotedType,
        sender: { id: 'ou_author', sender_name: '原作者' },
        body: { content: quotedContent },
      }] } }),
      create: async (request) => {
        sent.push(JSON.parse(request.data.content).text);
        return { code: 0, data: { message_id: 'om_answer' } };
      },
    },
    messageResource: { get: async (request) => {
      downloads.push(request);
      if (downloadError) throw downloadError;
      const data = bytes.get(request.path.file_key) ?? PNG;
      return {
        headers: { 'content-length': String(data.length) },
        getReadableStream: () => Readable.from([data]),
      };
    } },
  } } };
  const seen = new Set();
  const bridge = new FeishuHarnessBridge({
    client, harness, channel: {},
    state: {
      sessionFor: () => 'test-session', hasSeen: (id) => seen.has(id),
      markSeen: async (id) => seen.add(id), setSession: async () => {},
    },
    status: { messagesReceived: 0, messagesReplied: 0, messagesRejected: 0 },
    allowedSenderOpenIds: new Set(['ou_reader']),
    logger: { info() {}, warn() {}, error() {} },
  });
  const send = async (overrides = {}) => {
    await bridge.accept({
      sender: { sender_type: 'user', sender_id: { open_id: 'ou_reader' } },
      message: {
        message_id: 'om_current', message_type: 'text', chat_type: 'p2p',
        chat_id: 'oc_same', parent_id: 'om_quote',
        content: JSON.stringify({ text: '这是啥？' }), ...overrides,
      },
    });
    await bridge.waitForIdle();
  };
  return { root, prompts, staged, downloads, sent, send };
}

test('Feishu quoted single image reaches real Harness admission and retains its original', async (t) => {
  const f = await fixture(t);
  await f.send();
  assert.deepEqual(f.sent, ['verified']);
  assert.deepEqual(f.downloads, [{
    path: { message_id: 'om_quote', file_key: 'img_quote' }, params: { type: 'image' },
  }]);
  assert.equal(f.prompts.length, 1);
  const content = f.prompts[0].content;
  assert.equal(content.filter((part) => part.type === 'image').length, 1);
  assert.ok(content.some((part) => part.text === '这是啥？'));
  assert.match(content[0].text, /原作者/);
  assert.equal(JSON.stringify(content).includes('img_quote'), false);
  assert.equal(JSON.stringify(content).includes('om_quote'), false);
  const files = manifest(content);
  assert.equal(files.length, 1);
  assert.deepEqual(await readFile(join(f.root, files[0].path)), PNG);
});

test('Feishu current and quoted rich-post images share admission and deduplicate in current-first order', async (t) => {
  const f = await fixture(t, { quotedType: 'post', quotedContent: post('img_shared', 'img_second') });
  await f.send({ message_type: 'post', content: post('img_shared') });
  assert.deepEqual(f.downloads.map(({ path }) => path), [
    { message_id: 'om_current', file_key: 'img_shared' },
    { message_id: 'om_quote', file_key: 'img_second' },
  ]);
  const content = f.prompts[0].content;
  assert.equal(content.filter((part) => part.type === 'image').length, 2);
  assert.equal(manifest(content).length, 2);
  assert.match(content[0].text, /原图说明/);
  assert.match(content[0].text, /比较这些图片/);
  assert.equal(f.staged.length, 1);
});

test('Feishu current plus quoted image count is checked together before any download', async (t) => {
  const f = await fixture(t, {
    quotedType: 'post', quotedContent: post('img_one', 'img_two'),
    policy: () => ({ ...SMALL_POLICY, maxImages: 2 }),
  });
  await f.send({ message_type: 'image', content: JSON.stringify({ image_key: 'img_current' }) });
  assert.equal(f.downloads.length, 0);
  assert.equal(f.prompts.length, 0);
  assert.ok(f.sent.some((text) => text.includes('2 张图片')));
});

test('Feishu quoted images use the configured original-download limit and safe diagnostic', async (t) => {
  const f = await fixture(t, {
    bytes: new Map([['img_quote', Buffer.concat([PNG, Buffer.alloc(MB)])]]),
    policy: () => SMALL_POLICY,
  });
  await f.send();
  assert.equal(f.downloads.length, 1);
  assert.equal(f.prompts.length, 0);
  assert.ok(f.sent.some((text) => text.includes('1 MB')));
});

test('Feishu current and quoted images share the model total budget and keep file-only originals', async (t) => {
  const gif = await sharp({ create: { width: 1, height: 1, channels: 3, background: 'red' } }).gif().toBuffer();
  // GIF originals are never flattened or recompressed, so each consumes this
  // exact model budget while remaining a valid image with trailing padding.
  const data = Buffer.concat([gif, Buffer.alloc(600 * 1024)]);
  const f = await fixture(t, {
    policy: () => SMALL_POLICY,
    bytes: new Map([['img_current', data], ['img_quote', data]]),
  });
  await f.send({ message_type: 'image', content: JSON.stringify({ image_key: 'img_current' }) });
  assert.equal(f.downloads.length, 2);
  const content = f.prompts[0].content;
  assert.equal(content.filter((part) => part.type === 'image').length, 1);
  assert.ok(content.some((part) => part.text?.includes('图片序号：2')));
  const files = manifest(content);
  assert.equal(files.length, 2);
  for (const file of files) assert.deepEqual(await readFile(join(f.root, file.path)), data);
});

test('Feishu quoted image model rejection retries with the saved original without redownload', async (t) => {
  const f = await fixture(t, { onPrompt: (_content, attempt) => {
    if (attempt === 1) throw new HarnessRpcError('session.prompt', {
      code: 'attachment-error', details: { reason: 'MODEL_DOES_NOT_SUPPORT_IMAGES' },
    });
  } });
  await f.send();
  assert.deepEqual(f.sent, ['verified']);
  assert.equal(f.downloads.length, 1);
  assert.equal(f.staged.length, 1);
  assert.equal(f.prompts.length, 2);
  assert.equal(f.prompts[0].rpcId, f.prompts[1].rpcId);
  assert.equal(f.prompts[0].content.filter((part) => part.type === 'image').length, 1);
  assert.equal(f.prompts[1].content.some((part) => part.type === 'image'), false);
  assert.deepEqual(manifest(f.prompts[0].content), manifest(f.prompts[1].content));
  assert.match(f.prompts[1].content[0].text, /原作者/);
  assert.ok(f.prompts[1].content.some((part) => part.text?.includes('不要假设自己能直接看到图片内容')));
});

test('Feishu quoted large image uses existing resizing and keeps the untouched original', async (t) => {
  const data = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: 'blue' } }).png().toBuffer();
  const f = await fixture(t, { bytes: new Map([['img_quote', data]]) });
  await f.send();
  assert.equal(f.downloads.length, 1);
  const content = f.prompts[0].content;
  const image = content.find((part) => part.type === 'image');
  assert.ok(image);
  const metadata = await sharp(Buffer.from(image.data, 'base64')).metadata();
  assert.equal(metadata.width, 2048);
  assert.equal(metadata.height, 1024);
  assert.deepEqual(await readFile(join(f.root, manifest(content)[0].path)), data);
});

test('Feishu quoted image download failures never submit metadata-only answers or leak provider details', async (t) => {
  const f = await fixture(t, { downloadError: new Error('private-token-and-provider-response') });
  await f.send();
  assert.equal(f.downloads.length, 1);
  assert.equal(f.prompts.length, 0);
  assert.ok(f.sent.some((text) => text.includes('图片下载失败')));
  assert.equal(f.sent.join('\n').includes('private-token-and-provider-response'), false);
});
