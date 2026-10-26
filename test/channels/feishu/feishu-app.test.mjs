import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyFeishuApp } from '../../../src/channels/feishu/feishu-app.mjs';
import { createConnectionDiagnostics } from '../../../src/channels/shared/connection-error.mjs';

test('verifyFeishuApp validates credentials and returns a safe bot identity', async () => {
  const requests = [];
  const result = await verifyFeishuApp({
    appId: 'cli_test',
    appSecret: 'never-return-this',
    timeoutMs: 1234,
    httpInstance: {
      async request(options) {
        requests.push(options);
        if (requests.length === 1) {
          return { code: 0, tenant_access_token: 'tenant-token' };
        }
        return {
          code: 0,
          bot: { app_name: '北汇星河助手', open_id: 'ou_bot', activate_status: 1 },
        };
      },
    },
  });

  assert.deepEqual(result, {
    appId: 'cli_test',
    name: '北汇星河助手',
    openId: 'ou_bot',
    activated: 1,
  });
  assert.equal('appSecret' in result, false);
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].url, 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal');
  assert.deepEqual(requests[0].data, { app_id: 'cli_test', app_secret: 'never-return-this' });
  assert.equal(requests[0].timeout, 1234);
  assert.ok(requests[0].signal instanceof AbortSignal);
  assert.equal(requests[1].method, 'GET');
  assert.equal(requests[1].url, 'https://open.feishu.cn/open-apis/bot/v3/info/');
  assert.equal(requests[1].headers.authorization, 'Bearer tenant-token');
  assert.equal(requests[1].timeout, 1234);
  assert.ok(requests[1].signal instanceof AbortSignal);
});

test('verifyFeishuApp rejects invalid credentials before reading bot info', async () => {
  let calls = 0;
  await assert.rejects(verifyFeishuApp({
    appId: 'cli_bad',
    appSecret: 'bad',
    httpInstance: {
      async request() {
        calls += 1;
        return { code: 10003, msg: 'invalid app secret' };
      },
    },
  }), /Feishu authentication failed/);
  assert.equal(calls, 1);
});

test('verifyFeishuApp requires the shared SDK HTTP instance', async () => {
  await assert.rejects(verifyFeishuApp({
    appId: 'cli_test',
    appSecret: 'secret',
  }), /requires an HTTP instance/);
});

for (const [operation, providerCode] of [['authentication', 10015], ['bot verification', 99991672]]) {
  test(`verifyFeishuApp preserves the safe provider code for ${operation} failures`, async () => {
    const logs = [];
    const diagnostics = createConnectionDiagnostics({
      channel: 'feishu', logger: { error: (line) => logs.push(line) },
    });
    let calls = 0;
    await assert.rejects(verifyFeishuApp({
      appId: 'cli_test',
      appSecret: 'private-app-secret',
      httpInstance: {
        async request() {
          calls += 1;
          if (operation === 'bot verification' && calls === 1) {
            return { code: 0, tenant_access_token: 'private-tenant-token' };
          }
          return { code: providerCode, msg: 'private-provider-message', data: { secret: 'private-response-data' } };
        },
      },
    }), (error) => {
      const { publicError } = diagnostics.report(error, { operation: 'provision.poll', stage: 'activation' });
      assert.equal(publicError.details.reason, 'provider-rejected');
      assert.equal(publicError.details.providerCode, String(providerCode));
      assert.equal(publicError.details.stage, 'credential.verify');
      assert.doesNotMatch(`${error.message} ${JSON.stringify(error)} ${JSON.stringify(publicError)} ${logs.join('\n')}`, /private-/);
      return true;
    });
    assert.equal(calls, operation === 'authentication' ? 1 : 2);
  });
}

test('verifyFeishuApp does not reflect malformed provider codes or response bodies', async () => {
  const malformed = [
    null, [], 'private-response', {}, { code: 0 },
    { code: 'private-code', msg: 'private-message' },
    { code: '10015', msg: 'private-message' },
    { code: Number.NaN }, { code: 1.5 }, { code: Number.MAX_SAFE_INTEGER + 1 },
  ];
  for (const body of malformed) {
    await assert.rejects(verifyFeishuApp({
      appId: 'cli_test', appSecret: 'private-app-secret',
      httpInstance: { async request() { return body; } },
    }), (error) => {
      const { publicError } = createConnectionDiagnostics({ channel: 'feishu', logger: {} }).report(error);
      assert.equal(publicError.details.reason, 'invalid-response');
      assert.equal(publicError.details.stage, 'credential.verify');
      assert.equal(publicError.details.providerCode, undefined);
      assert.doesNotMatch(`${error.message} ${JSON.stringify(error)} ${JSON.stringify(publicError)}`, /private-/);
      return true;
    });
  }
});

test('verifyFeishuApp preserves transport failures and cancellation without classifying them as provider rejections', async () => {
  for (const failure of [
    Object.assign(new Error('connection reset'), { code: 'ECONNRESET' }),
    new DOMException('cancelled', 'AbortError'),
  ]) {
    await assert.rejects(verifyFeishuApp({
      appId: 'cli_test', appSecret: 'private-app-secret',
      httpInstance: { async request() { throw failure; } },
    }), (error) => {
      assert.equal(error, failure);
      assert.equal(error.providerCode, undefined);
      return true;
    });
  }
});
