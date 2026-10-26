import { connectionStageError } from '../shared/connection-error.mjs';

function endpointFor(domain, path) {
  const origin = domain === 'lark' ? 'https://open.larksuite.com' : 'https://open.feishu.cn';
  return new URL(path, origin);
}

function verificationError(message, code, providerCode) {
  const error = new Error(message);
  error.code = code;
  if (providerCode !== undefined) error.providerCode = providerCode;
  return connectionStageError(error, 'credential.verify');
}

function jsonResponse(body, operation) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || !Number.isSafeInteger(body.code)) {
    throw verificationError(`${operation} returned an invalid response`, 'invalid-response');
  }
  if (body.code !== 0) {
    // Preserve the documented numeric code without reflecting provider text or
    // response data, which can contain credentials, into errors or diagnostics.
    throw verificationError(`${operation} failed`, 'provider-rejected', body.code);
  }
  return body;
}

/** Validate freshly provisioned credentials and read the bot identity. */
export async function verifyFeishuApp({
  appId,
  appSecret,
  domain = 'feishu',
  httpInstance,
  timeoutMs = 15000,
}) {
  if (!appId || !appSecret) throw new Error('Feishu credentials are incomplete');
  if (!httpInstance || typeof httpInstance.request !== 'function') {
    throw new TypeError('Feishu verification requires an HTTP instance');
  }
  const tokenBody = jsonResponse(await httpInstance.request({
    method: 'POST',
    url: endpointFor(domain, '/open-apis/auth/v3/tenant_access_token/internal').href,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    data: { app_id: appId, app_secret: appSecret },
    signal: AbortSignal.timeout(timeoutMs),
    timeout: timeoutMs,
  }), 'Feishu authentication');
  if (!tokenBody.tenant_access_token) {
    throw verificationError('Feishu authentication returned no tenant access token', 'invalid-response');
  }

  const botBody = jsonResponse(await httpInstance.request({
    method: 'GET',
    url: endpointFor(domain, '/open-apis/bot/v3/info/').href,
    headers: { authorization: `Bearer ${tokenBody.tenant_access_token}` },
    signal: AbortSignal.timeout(timeoutMs),
    timeout: timeoutMs,
  }), 'Feishu bot verification');
  const bot = botBody.bot ?? {};
  return Object.freeze({
    appId,
    name: bot.app_name ?? bot.bot_name ?? null,
    openId: bot.open_id ?? null,
    activated: bot.activate_status ?? null,
  });
}
