import assert from 'node:assert/strict';
import test from 'node:test';
import { createFeishuRpcHandler, FEISHU_ENDPOINTS } from '../../../plugin-src/host/channels/feishu/rpc.mjs';
import { normalizeProvisioning } from '../../../plugin-src/client/channels/feishu/api.js';
import { createConnectionDiagnostics } from '../../../src/channels/shared/connection-error.mjs';

const privateText = 'private-token https://user:password@private.example/?secret=secret';
const fakePng = 'data:image/png;base64,YWJjZA==';
const urls = {
  provision: 'https://accounts.feishu.cn/device?user_code=opaque',
  callback_repair: 'https://open.feishu.cn/page/launcher?tp=sdk&clientID=cli_target&addons=encoded&user_code=opaque',
  group_message_permission: 'https://open.feishu.cn/page/launcher?tp=sdk&clientID=cli_target&addons=encoded&user_code=opaque',
};
const endpoints = {
  provision: FEISHU_ENDPOINTS.beginProvisioning,
  callback_repair: FEISHU_ENDPOINTS.beginCallbackRepair,
  group_message_permission: FEISHU_ENDPOINTS.beginGroupMessagePermission,
};

function fixture(operation = 'provision', encodeQr = () => { throw new TypeError(privateText); }) {
  let begins = 0;
  const logs = [];
  const registration = {
    state: 'qr_ready', attempt: 'attempt_1', operation,
    ...(operation === 'provision' ? {} : { botId: 'bot_target' }),
    qrCodeUrl: urls[operation], expiresAt: Date.now() + 60_000,
  };
  const current = { phase: 'registering', registration, bots: [
    { botId: 'bot_target', connected: true, bot: { name: 'Target', domain: 'feishu' } },
  ] };
  const start = () => { begins += 1; return current; };
  const controller = {
    diagnostics: createConnectionDiagnostics({ channel: 'feishu', logger: {
      warn: value => logs.push(value), error: value => logs.push(value),
    } }),
    status: () => current, registrationStatus: () => current,
    startRegistration: start, startCallbackRepair: start, startGroupMessagePermission: start,
    cancelRegistration: () => {
      registration.state = 'cancelled';
      delete registration.qrCodeUrl;
      return current;
    },
    disconnect: () => current,
  };
  return {
    handler: createFeishuRpcHandler(controller, { encodeQr }), registration, current, logs,
    get begins() { return begins; },
  };
}

for (const operation of Object.keys(endpoints)) {
  for (const synchronous of [true, false]) {
    test(`${operation}: ${synchronous ? 'thrown' : 'rejected'} QR failure preserves authorization and polling`, async () => {
      let calls = 0;
      const fx = fixture(operation, () => {
        calls += 1;
        const error = Object.assign(new TypeError(privateText), { code: 'ERR_INVALID_ARG_TYPE' });
        if (synchronous) throw error;
        return Promise.reject(error);
      });
      const begun = await fx.handler(endpoints[operation], operation === 'provision' ? {} : { botId: 'bot_target' });
      assert.equal(begun.ok, true);
      assert.equal(begun.value.verificationUrl, urls[operation]);
      assert.equal(begun.value.qrCodeDataUrl, undefined);
      assert.equal(normalizeProvisioning(begun.value).attemptId, 'attempt_1');
      const status = await fx.handler(FEISHU_ENDPOINTS.status, {});
      assert.equal(status.ok, true);
      assert.equal(status.value.provisioning.verificationUrl, urls[operation]);
      for (let i = 0; i < 3; i += 1) {
        const poll = await fx.handler(FEISHU_ENDPOINTS.pollProvisioning, { attemptId: 'attempt_1' });
        assert.equal(poll.ok, true);
        assert.equal(poll.value.status, 'pending');
        assert.equal(poll.value.provisioning.verificationUrl, urls[operation]);
      }
      assert.equal(fx.begins, 1);
      assert.equal(fx.logs.length, 3, 'repeated automatic poll warnings are deduplicated');
      const warning = JSON.parse(fx.logs[0].slice(fx.logs[0].indexOf('{')));
      assert.equal(warning.event, 'connection-warning');
      assert.equal(warning.stage, 'qr.encode');
      assert.equal(warning.reason, 'ERR_INVALID_ARG_TYPE');
      if (operation === 'provision') assert.equal(warning.operation, endpoints[operation]);
      assert.ok(warning.referenceId);
      assert.deepEqual(warning.errorTypes, ['TypeError']);
      assert.doesNotMatch(JSON.stringify([begun, status, fx.logs]), /private-token|password|private\.example|appSecret/);
      assert.doesNotMatch(JSON.stringify(fx.logs), /user_code|opaque|clientID|addons/);
      fx.registration.state = 'succeeded';
      fx.registration.botId = 'bot_target';
      delete fx.registration.qrCodeUrl;
      fx.current.connected = true;
      const complete = await fx.handler(FEISHU_ENDPOINTS.pollProvisioning, { attemptId: 'attempt_1' });
      assert.equal(complete.ok, true);
      assert.equal(complete.value.status, 'connected');
      assert.equal(complete.value.provisioning, undefined);
      assert.equal(calls, 5);
    });
  }
}

test('Feishu concurrent QR failures share one encoding and recover on the same attempt', async () => {
  const pending = Promise.withResolvers();
  const entered = Promise.withResolvers();
  let calls = 0;
  const fx = fixture('provision', () => {
    calls += 1;
    entered.resolve();
    return calls === 1 ? pending.promise : fakePng;
  });
  const requests = [fx.handler(FEISHU_ENDPOINTS.status, {}), fx.handler(FEISHU_ENDPOINTS.status, {})];
  await entered.promise;
  pending.reject(new TypeError(privateText));
  for (const result of await Promise.all(requests)) {
    assert.equal(result.ok, true);
    assert.equal(result.value.provisioning.verificationUrl, urls.provision);
  }
  assert.equal(calls, 1);
  assert.equal(fx.logs.length, 1);
  const recovered = await fx.handler(FEISHU_ENDPOINTS.pollProvisioning, { attemptId: 'attempt_1' });
  assert.equal(recovered.value.provisioning.qrCodeDataUrl, fakePng);
  assert.equal((await fx.handler(FEISHU_ENDPOINTS.status, {})).value.provisioning.qrCodeDataUrl, fakePng);
  assert.equal(calls, 2);
});

test('Feishu late failure cannot evict a replacement cached QR', async () => {
  const pending = Promise.withResolvers();
  const entered = Promise.withResolvers();
  let calls = 0;
  const fx = fixture('provision', () => {
    calls += 1;
    entered.resolve();
    return calls === 1 ? pending.promise : fakePng;
  });
  const first = fx.handler(FEISHU_ENDPOINTS.status, {});
  await entered.promise;
  for (let i = 0; i < 32; i += 1) {
    fx.registration.qrCodeUrl = `https://accounts.feishu.cn/device/${i}`;
    assert.equal((await fx.handler(FEISHU_ENDPOINTS.status, {})).ok, true);
  }
  fx.registration.qrCodeUrl = urls.provision;
  await fx.handler(FEISHU_ENDPOINTS.status, {});
  const before = calls;
  pending.reject(new TypeError(privateText));
  assert.equal((await first).ok, true);
  assert.equal((await fx.handler(FEISHU_ENDPOINTS.status, {})).value.provisioning.qrCodeDataUrl, fakePng);
  assert.equal(calls, before);
});

test('Feishu QR fallback preserves cancellation and stale-attempt errors', async () => {
  const fx = fixture('provision', () => { throw new DOMException(privateText, 'AbortError'); });
  const cancelled = await fx.handler(FEISHU_ENDPOINTS.beginProvisioning, {});
  assert.equal(cancelled.ok, false);
  assert.equal(cancelled.error.code, 'cancelled');
  assert.equal(fx.logs.length, 0);
  const abort = new AbortController();
  abort.abort();
  assert.equal((await fx.handler(FEISHU_ENDPOINTS.status, {}, abort.signal)).error.code, 'cancelled');
  assert.equal((await fx.handler(FEISHU_ENDPOINTS.pollProvisioning, { attemptId: 'stale' })).error.code, 'bad-request');
});

test('Feishu QR fallback never exposes unvalidated URLs or bypasses target-domain checks', async () => {
  for (const operation of Object.keys(endpoints)) {
    for (const url of ['https://evil.example/device', 'javascript:alert(1)', 'http://accounts.feishu.cn/device',
      'https://user:password@accounts.feishu.cn/device', ...(operation === 'provision' ? [] : [
        'https://open.larksuite.com/page/launcher?tp=sdk&clientID=cli_target&addons=encoded',
        'https://open.feishu.cn/page/launcher?tp=sdk&clientID=cli_target&addons=encoded&createOnly=true',
      ])]) {
      let calls = 0;
      const fx = fixture(operation, () => { calls += 1; throw new TypeError(privateText); });
      fx.registration.qrCodeUrl = url;
      const result = await fx.handler(endpoints[operation], operation === 'provision' ? {} : { botId: 'bot_target' });
      assert.equal(result.ok, false);
      assert.equal(JSON.stringify(result).includes(url), false);
      assert.equal(calls, 0);
    }
  }
});

test('Feishu fallback retains expiry, cancellation and replacement identities', async () => {
  const fx = fixture();
  await fx.handler(FEISHU_ENDPOINTS.beginProvisioning, {});
  fx.registration.state = 'expired';
  delete fx.registration.qrCodeUrl;
  const expired = await fx.handler(FEISHU_ENDPOINTS.pollProvisioning, { attemptId: 'attempt_1' });
  assert.equal(expired.value.status, 'expired');
  assert.equal(expired.value.provisioning, undefined);
  fx.registration.state = 'qr_ready';
  fx.registration.qrCodeUrl = urls.provision;
  const cancelled = await fx.handler(FEISHU_ENDPOINTS.cancelProvisioning, { attemptId: 'attempt_1' });
  assert.equal(cancelled.ok, true);
  assert.equal((await fx.handler(FEISHU_ENDPOINTS.status, {})).value.provisioning, undefined);
  fx.registration.attempt = 'attempt_2';
  assert.equal((await fx.handler(FEISHU_ENDPOINTS.pollProvisioning, { attemptId: 'attempt_1' })).error.code, 'bad-request');
});

for (const operation of ['provision', 'callback_repair']) {
  test(`Feishu ${operation} UI restores link-only authorization, polls and cancels`, async (t) => {
    const React = (await import('react')).default;
    const { act, create } = await import('react-test-renderer');
    const { FeishuSettingsTab } = await import('../../../plugin-src/client/channels/feishu/index.js');
    const previousWindow = globalThis.window;
    const timeouts = new Map();
    let nextTimer = 0;
    globalThis.window = {
      setInterval() { return ++nextTimer; }, clearInterval() {},
      setTimeout(callback) { const id = ++nextTimer; timeouts.set(id, callback); return id; },
      clearTimeout(id) { timeouts.delete(id); },
      requestAnimationFrame() { return ++nextTimer; }, cancelAnimationFrame() {},
    };
    t.after(async () => {
      if (renderer) await act(async () => renderer.unmount());
      if (previousWindow === undefined) delete globalThis.window;
      else globalThis.window = previousWindow;
    });
    const fx = fixture(operation);
    const calls = [];
    let renderer;
    const flush = () => new Promise(resolve => setImmediate(resolve));
    await act(async () => {
      renderer = create(React.createElement(FeishuSettingsTab, { rpcCall: async (endpoint, payload, signal) => {
        calls.push({ endpoint, payload });
        return fx.handler(endpoint, payload, signal);
      } }));
      await flush();
    });
    const link = renderer.root.findAllByType('a').find(node => node.props.href === urls[operation]);
    assert.ok(link, 'the validated SDK link must remain usable when no QR image is available');
    assert.equal(link.props.rel, 'noopener noreferrer');
    assert.equal(renderer.root.findAllByProps({ className: 'bxf-qrFallback dim-qrFallback' }).length, 1);
    const poll = [...timeouts.values()][0];
    assert.equal(typeof poll, 'function');
    await act(async () => { await poll(); await flush(); });
    assert.ok(calls.some(call => call.endpoint === FEISHU_ENDPOINTS.pollProvisioning
      && call.payload.attemptId === 'attempt_1'));
    assert.equal(renderer.root.findAllByProps({ className: 'bxf-qrFallback dim-qrFallback' }).length, 1);
    const textOf = node => typeof node === 'string' ? node : (node?.children ?? []).map(textOf).join('');
    const cancel = renderer.root.findAllByType('button').find(node => textOf(node) === (operation === 'provision' ? '取消添加' : '取消补全'));
    assert.ok(cancel);
    await act(async () => { await cancel.props.onClick(); await flush(); });
    assert.ok(calls.some(call => call.endpoint === FEISHU_ENDPOINTS.cancelProvisioning
      && call.payload.attemptId === 'attempt_1'));
    assert.equal(renderer.root.findAllByType('a').some(node => node.props.href === urls[operation]), false);
    assert.equal(fx.begins, 0, 'restoring and polling may not create a replacement registration');
  });
}
